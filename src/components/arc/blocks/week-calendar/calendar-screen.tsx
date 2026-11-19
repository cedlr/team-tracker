"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, ChevronLeft, ChevronRight, Plus, Users } from "lucide-react";
import { ScreenShellButton, useScreenShell } from "../../screen-shell/screen-shell";
import { Avatar } from "../../avatar/avatar";
import { AvatarGroup } from "../../avatar-group/avatar-group";
import { Checkbox } from "../../checkbox/checkbox";
import SegmentedControl from "../../segmented-control/segmented-control";
import { Switch } from "../../switch/switch";
import { motionTokens } from "../../lib/motion-tokens";
import { DAY, dayOf, toWall, zoneLabel, type CalendarFormat } from "./calendar-time";
import type { CalendarChrome, CalendarController } from "./calendar-board";
import { AppleMark, CalendarGlyph, ConferenceMark, CopyButton, GoogleMark, MiniMonth, colorOf, conferenceName, monthOf, tint } from "./calendar-parts";
import { ACCOUNT_HOME, ACCOUNT_PEOPLE, type CalendarEvent, type CalendarResponse, type CalendarSource } from "./week-calendar-data";
import styles from "./calendar-screen.module.css";

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");
const instant = { duration: 0 };

/** The wall clock as a whole minute, refreshed each minute. Null until mounted, so the server and client agree. */
export function useNowMinute() {
  const [minute, setMinute] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setMinute(Math.floor(Date.now() / 60000));
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 30000);
    return () => { clearTimeout(first); clearInterval(id); };
  }, []);
  return minute;
}

/** Marks a scroller's cut edges with data-fade-top and data-fade-bottom, so CSS can fade them. */
function useEdgeFade<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const update = () => {
      node.toggleAttribute("data-fade-top", node.scrollTop > 1);
      node.toggleAttribute("data-fade-bottom", node.scrollTop + node.clientHeight < node.scrollHeight - 1);
    };
    update();
    node.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(node);
    if (node.firstElementChild) observer.observe(node.firstElementChild);
    return () => { node.removeEventListener("scroll", update); observer.disconnect(); };
  }, []);
  return ref;
}

/* ------------------------------------------------------------------------------------------------------------------
 * Header controls
 * ---------------------------------------------------------------------------------------------------------------- */

/** The view switch is Arc's segmented control, trimmed to the header's 32px controls. */
export function ViewSwitch({ views, value, onChange, stretch }: { views: { value: string; label: string }[]; value: string; onChange: (value: string) => void; stretch?: boolean }) {
  return <SegmentedControl className={styles.views} options={views} value={value} onValueChange={onChange} label="View" fullWidth={stretch} />;
}

type BoardRef = RefObject<CalendarController | null>;

export function CalendarActions({ chrome, board, onNew }: { chrome: CalendarChrome | null; board: BoardRef; onNew: () => void }) {
  const { size } = useScreenShell();
  if (!chrome) return null;
  const full = size === "full";
  return <>
    <ScreenShellButton variant="secondary" onClick={() => board.current?.today()} disabled={!chrome.canToday} aria-keyshortcuts="T">Today</ScreenShellButton>
    <span className={styles.stepper}>
      <ScreenShellButton variant="ghost" icon={ChevronLeft} iconOnly aria-label={`Previous ${chrome.stepLabel}`} onClick={() => board.current?.previous()} />
      <ScreenShellButton variant="ghost" icon={ChevronRight} iconOnly aria-label={`Next ${chrome.stepLabel}`} onClick={() => board.current?.next()} />
    </span>
    {full && <ViewSwitch views={chrome.views} value={chrome.view} onChange={value => board.current?.setView(value as CalendarChrome["view"])} />}
    <ScreenShellButton variant="primary" icon={Plus} iconOnly={!full} aria-label={full ? undefined : "New event"} aria-keyshortcuts="N" onClick={onNew}>{full ? "New event" : null}</ScreenShellButton>
  </>;
}

/** Below 900px the view switch moves to its own row under the header. */
export function CalendarHeaderBelow({ chrome, board }: { chrome: CalendarChrome | null; board: BoardRef }) {
  const { size } = useScreenShell();
  if (!chrome || size === "full") return null;
  return <div className={styles.below}><ViewSwitch stretch views={chrome.views} value={chrome.view} onChange={value => board.current?.setView(value as CalendarChrome["view"])} /></div>;
}

export function HeaderMeta({ children }: { children: ReactNode }) {
  const { size } = useScreenShell();
  return size === "phone" ? null : <>{children}</>;
}

/* ------------------------------------------------------------------------------------------------------------------
 * Sidebar: a mini month to jump with, and the calendars to show
 * ---------------------------------------------------------------------------------------------------------------- */

function AccountMark({ account }: { account: string }) {
  if (account === ACCOUNT_HOME) return <AppleMark size={14} />;
  if (account === ACCOUNT_PEOPLE) return <Users size={14} strokeWidth={1.75} aria-hidden="true" />;
  if (account.includes("@")) return <GoogleMark size={13} />;
  return null;
}

/** The month in the sidebar. Picking a day opens the calendar on it; in the sheet layout the sheet closes so the week shows. */
export function SidebarMonth({ fmt, chrome, board, weekStartsOn, onPick }: { fmt: CalendarFormat; chrome: CalendarChrome | null; board: BoardRef; weekStartsOn: number; onPick?: () => void }) {
  const { compact, closeSidebar } = useScreenShell();
  const cursor = chrome?.cursor ?? null;
  const cursorMonth = cursor === null ? null : monthOf(cursor);
  const [picked, setPicked] = useState<{ month: number; base: number | null } | null>(null);
  const month = picked && picked.base === cursorMonth ? picked.month : cursorMonth;
  if (month === null || !chrome) return <div className={styles.monthSlot} />;
  return <div className={styles.month}>
    <MiniMonth fmt={fmt} month={month} weekStartsOn={weekStartsOn} today={chrome.today} range={chrome.days}
      onMonth={next => setPicked({ month: next, base: cursorMonth })} onPick={day => { setPicked(null); onPick?.(); board.current?.goToDay(day); if (compact) closeSidebar(); }} />
  </div>;
}

/** Calendars grouped by account. Each row is Arc's checkbox in the calendar's colour; the row itself is the label. */
export function SidebarCalendars({ calendars, hidden, onToggle }: { calendars: CalendarSource[]; hidden: ReadonlySet<string>; onToggle: (id: string) => void }) {
  const uid = useId();
  const groups = useMemo(() => {
    const map = new Map<string, CalendarSource[]>();
    for (const calendar of calendars) {
      const key = calendar.account ?? "Calendars";
      map.set(key, [...(map.get(key) ?? []), calendar]);
    }
    return [...map.entries()];
  }, [calendars]);
  return <div className={styles.sources}>
    {groups.map(([account, list]) => <div key={account} className={styles.group}>
      <p className={styles.groupHead}><span className={styles.groupMark}><AccountMark account={account} /></span><span className={styles.groupName}>{account}</span></p>
      <ul className={styles.calendarList}>
        {list.map(calendar => {
          const on = !hidden.has(calendar.id);
          const id = `${uid}-${calendar.id}`;
          return <li key={calendar.id} className={styles.calendarRow} data-off={!on || undefined} style={tint(colorOf(calendar))}>
            <Checkbox id={id} className={styles.calendarCheck} checked={on} onCheckedChange={() => onToggle(calendar.id)} aria-label={`Show ${calendar.name}`} />
            <label htmlFor={id} className={styles.calendarLabel}>
              {calendar.avatar && <Avatar name={calendar.name} src={calendar.avatar} size="sm" className={styles.calendarAvatar} aria-hidden="true" />}
              <span className={styles.calendarName}>{calendar.name}</span>
            </label>
          </li>;
        })}
      </ul>
    </div>)}
  </div>;
}

/* ------------------------------------------------------------------------------------------------------------------
 * Agenda panel, opened from the header: the next meetings and world clocks
 * ---------------------------------------------------------------------------------------------------------------- */

const ZONES = [{ zone: "America/New_York", city: "New York" }, { zone: "Europe/London", city: "London" }, { zone: "Asia/Tokyo", city: "Tokyo" }];

type PanelProps = { fmt: CalendarFormat; calendars: CalendarSource[]; hidden: ReadonlySet<string>; events: CalendarEvent[]; board: BoardRef; timeZone?: string; locale: string };

export function TodayPanel({ fmt, calendars, hidden, events, board, timeZone, locale }: PanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { setPanelOpen } = useScreenShell();
  const now = useNowMinute();
  /** In the sheet layout, opening an event closes the sheet so the event is visible. */
  const closeIfSheet = () => { if (ref.current?.closest("[data-sheet]")) setPanelOpen(false); };

  const nowWall = now === null ? null : toWall(new Date(now * 60000), timeZone);
  const upcoming = useMemo(() => {
    if (nowWall === null) return [];
    return events
      .filter(event => !event.allDay && !hidden.has(event.calendarId) && event.rsvp !== "no")
      .map(event => ({ event, start: toWall(event.start, timeZone), end: toWall(event.end, timeZone) }))
      .filter(entry => entry.end > nowWall)
      .sort((a, b) => a.start - b.start)
      .slice(0, 4);
  }, [events, hidden, nowWall, timeZone]);

  return <div ref={ref} className={styles.panel}>
    {nowWall !== null && upcoming[0] && <UpNext fmt={fmt} entry={upcoming[0]} nowWall={nowWall} calendar={calendars.find(c => c.id === upcoming[0].event.calendarId)}
      onOpen={() => { closeIfSheet(); board.current?.openEvent(upcoming[0].event.id); }} />}
    {upcoming.length > 1 && <section className={styles.panelSection} aria-label="Later">
      <p className={styles.sectionHead}><span>Later</span></p>
      <ul className={styles.later}>
        {upcoming.slice(1).map(({ event, start, end }) => <li key={event.id}>
          <button type="button" className={styles.laterItem} style={tint(colorOf(calendars.find(c => c.id === event.calendarId)))} onClick={() => { closeIfSheet(); board.current?.openEvent(event.id); }}>
            <span className={styles.laterTime}>{nowWall !== null && dayOf(start) !== dayOf(nowWall) && <span className={styles.laterDay}>{fmt.weekdayShort(dayOf(start))}</span>}{fmt.time(start)}</span>
            <span className={styles.laterTitle}>{event.title}</span>
            <span className={styles.laterLength}>{fmt.length(end - start)}</span>
          </button>
        </li>)}
      </ul>
    </section>}
    <WorldClocks now={now} locale={locale} />
  </div>;
}

function UpNext({ fmt, entry, nowWall, calendar, onOpen }: { fmt: CalendarFormat; entry: { event: CalendarEvent; start: number; end: number }; nowWall: number; calendar?: CalendarSource; onOpen: () => void }) {
  const { event, start, end } = entry;
  const until = start - nowWall;
  const when = until <= 0 ? "Now" : until < 60 ? `In ${until} min` : dayOf(start) === dayOf(nowWall) ? `In ${fmt.length(Math.round(until / 15) * 15)}`
    : dayOf(start) === dayOf(nowWall) + 1 ? "Tomorrow" : fmt.weekdayLong(dayOf(start));
  return <section className={styles.panelSection} aria-label="Up next">
    <p className={styles.sectionHead}><span>Up next</span><span className={styles.when} data-now={until <= 0 || undefined}>{when}</span></p>
    <button type="button" className={styles.next} style={tint(colorOf(calendar))} onClick={onOpen}>
      <CalendarGlyph calendar={calendar} />
      <span className={styles.nextText}>
        <span className={styles.nextTitle}>{event.title}</span>
        <span className={styles.nextMeta}>{fmt.range(start, end)}{event.location ? ` · ${event.location}` : ""}</span>
      </span>
    </button>
    {event.conference && <div className={styles.join}>
      <ConferenceMark conference={event.conference} size={16} />
      <span className={styles.joinName}>{conferenceName(event.conference)}</span>
      <CopyButton text={`https://${event.conference.url}`} ariaLabel="Copy meeting link" />
    </div>}
  </section>;
}

function WorldClocks({ now, locale }: { now: number | null; locale: string }) {
  const rows = useMemo(() => {
    if (now === null) return [];
    const date = new Date(now * 60000);
    const time = (zone?: string) => { try { return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", timeZone: zone }).format(date).replace(/ /g, "\u00a0"); } catch { return ""; } };
    const offsetDays = (zone: string) => { try { return dayOf(toWall(date, zone)) - dayOf(toWall(date)); } catch { return 0; } };
    return [
      { id: "local", city: "Local time", detail: zoneLabel(undefined, locale), time: time() },
      ...ZONES.map(({ zone, city }) => { const shift = offsetDays(zone); return { id: zone, city, detail: `${zoneLabel(zone, locale)}${shift > 0 ? ", tomorrow" : shift < 0 ? ", yesterday" : ""}`, time: time(zone) }; }),
    ];
  }, [now, locale]);
  return <section className={styles.panelSection} aria-label="Time zones">
    <p className={styles.sectionHead}><span>Time zones</span></p>
    <ul className={styles.clocks}>
      {(rows.length ? rows : [{ id: "local", city: "Local time", detail: "", time: "" }]).map(row => <li key={row.id} className={styles.clock}>
        <span className={styles.clockCity}>{row.city}<span className={styles.clockZone}>{row.detail}</span></span>
        <span className={styles.clockTime}>{row.time}</span>
      </li>)}
    </ul>
  </section>;
}

/* ------------------------------------------------------------------------------------------------------------------
 * Invites page
 * ---------------------------------------------------------------------------------------------------------------- */

const ANSWER_TEXT: Record<CalendarResponse, string> = { yes: "Going", maybe: "Maybe", no: "Declined", pending: "Waiting" };

type InviteEntry = { event: CalendarEvent; start: number; end: number };

export function InvitesPage({ fmt, events, calendars, timeZone, fromDay, onAnswer, onOpen }: {
  fmt: CalendarFormat; events: CalendarEvent[]; calendars: CalendarSource[]; timeZone?: string; fromDay: number | null;
  onAnswer: (id: string, rsvp: CalendarResponse) => void; onOpen: (id: string) => void;
}) {
  const scroll = useEdgeFade<HTMLDivElement>();
  const reduce = useReducedMotion();
  const entries = useMemo(() => events.filter(event => event.rsvp)
    .map(event => ({ event, start: toWall(event.start, timeZone), end: toWall(event.end, timeZone) }))
    .sort((a, b) => a.start - b.start), [events, timeZone]);
  const pending = entries.filter(entry => entry.event.rsvp === "pending");
  const answered = entries.filter(entry => entry.event.rsvp !== "pending");
  const yours = useMemo(() => {
    if (fromDay === null) return [];
    const from = fromDay * DAY, to = (fromDay + 7) * DAY;
    return events.filter(event => !event.rsvp && !event.allDay && (event.attendees?.length ?? 0) >= 2)
      .map(event => ({ event, start: toWall(event.start, timeZone), end: toWall(event.end, timeZone) }))
      .filter(entry => entry.start >= from && entry.start < to && !entry.event.title.startsWith("Team standup"))
      .sort((a, b) => a.start - b.start).slice(0, 6);
  }, [events, fromDay, timeZone]);
  const fold = reduce ? instant : { height: motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.fast } };

  return <div ref={scroll} className={styles.pageScroll}>
    <div className={styles.page}>
      <section className={styles.pageSection} aria-labelledby="invites-waiting">
        <h3 id="invites-waiting" className={styles.pageHead}>Waiting for you<span className={styles.pageCount}>{pending.length}</span></h3>
        <ul className={styles.inviteList}>
          <AnimatePresence initial={false}>
            {pending.map(entry => <motion.li key={entry.event.id} className={styles.inviteFold} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={fold}>
              <InviteRow fmt={fmt} entry={entry} calendar={calendars.find(c => c.id === entry.event.calendarId)} onOpen={onOpen}>
                <ScreenShellButton variant="ghost" onClick={() => onAnswer(entry.event.id, "no")}>Decline</ScreenShellButton>
                <ScreenShellButton variant="secondary" onClick={() => onAnswer(entry.event.id, "maybe")}>Maybe</ScreenShellButton>
                <ScreenShellButton variant="primary" className={styles.accept} icon={Check} onClick={() => onAnswer(entry.event.id, "yes")}>Accept</ScreenShellButton>
              </InviteRow>
            </motion.li>)}
          </AnimatePresence>
        </ul>
        <AnimatePresence initial={false}>
          {pending.length === 0 && <motion.p key="empty" className={styles.empty} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={reduce ? instant : { duration: motionTokens.duration.fast }}>
            You have answered every invite. New ones show up here and as outlines on your calendar.
          </motion.p>}
        </AnimatePresence>
      </section>

      {answered.length > 0 && <section className={styles.pageSection} aria-labelledby="invites-answered">
        <h3 id="invites-answered" className={styles.pageHead}>Answered<span className={styles.pageCount}>{answered.length}</span></h3>
        <ul className={styles.inviteList}>
          <AnimatePresence initial={false}>
            {answered.map(entry => <motion.li key={entry.event.id} className={styles.inviteFold} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={fold}>
              <InviteRow fmt={fmt} entry={entry} calendar={calendars.find(c => c.id === entry.event.calendarId)} onOpen={onOpen} quiet>
                <span className={styles.answer} data-answer={entry.event.rsvp}>{ANSWER_TEXT[entry.event.rsvp ?? "pending"]}</span>
                <ScreenShellButton variant="ghost" onClick={() => onAnswer(entry.event.id, "pending")}>Undo</ScreenShellButton>
              </InviteRow>
            </motion.li>)}
          </AnimatePresence>
        </ul>
      </section>}

      {yours.length > 0 && <section className={styles.pageSection} aria-labelledby="invites-yours">
        <h3 id="invites-yours" className={styles.pageHead}>Replies to your meetings<span className={styles.pageCount}>this week</span></h3>
        <ul className={styles.replies}>
          {yours.map(({ event, start, end }) => {
            const list = event.attendees ?? [];
            const count = (status: CalendarResponse) => list.filter(person => (person.status ?? "pending") === status).length;
            const parts = [count("yes") && `${count("yes")} going`, count("maybe") && `${count("maybe")} maybe`, count("pending") && `${count("pending")} waiting`, count("no") && `${count("no")} declined`].filter(Boolean);
            return <li key={event.id} className={styles.reply}>
              <CalendarGlyph calendar={calendars.find(c => c.id === event.calendarId)} />
              <span className={styles.inviteBody}>
                <button type="button" className={styles.inviteTitle} onClick={() => onOpen(event.id)} aria-label={`${event.title}, show in calendar`}>{event.title}</button>
                <span className={styles.inviteMeta}>{fmt.shortDate(dayOf(start))}, {fmt.range(start, end)}</span>
              </span>
              <span className={styles.replyFaces}><AvatarGroup members={list.map(person => ({ name: person.name, src: person.avatar }))} max={4} size="sm" label={`Invited to ${event.title}`} /></span>
              <span className={styles.replyCounts}>{parts.join(" · ")}</span>
            </li>;
          })}
        </ul>
      </section>}
    </div>
  </div>;
}

function InviteRow({ fmt, entry, calendar, onOpen, quiet, children }: { fmt: CalendarFormat; entry: InviteEntry; calendar?: CalendarSource; onOpen: (id: string) => void; quiet?: boolean; children: ReactNode }) {
  const { event, start, end } = entry;
  const day = dayOf(start);
  const organizer = event.organizer ?? event.attendees?.[0];
  const others = (event.attendees?.length ?? 1) - 1;
  return <div className={styles.invite} data-quiet={quiet || undefined} style={tint(colorOf(calendar))}>
    <span className={styles.dateBlock} aria-hidden="true"><span className={styles.dateMonth}>{fmt.weekdayShort(day)}</span><span className={styles.dateDay}>{fmt.date(day)}</span></span>
    <div className={styles.inviteBody}>
      <button type="button" className={styles.inviteTitle} onClick={() => onOpen(event.id)} aria-label={`${event.title}, show in calendar`}>{event.title}</button>
      <span className={styles.inviteMeta}>
        <span>{fmt.monthDay(day)}, {fmt.range(start, end)}</span>
        {event.conference && <span className={styles.inviteConference}><ConferenceMark conference={event.conference} size={13} />{conferenceName(event.conference)}</span>}
      </span>
      {organizer && <span className={styles.inviteFrom}>
        <Avatar name={organizer.name} src={organizer.avatar} size="sm" className={styles.inviteAvatar} aria-hidden="true" />
        <span>{organizer.name} invited you{others > 0 ? ` and ${others} ${others === 1 ? "other" : "others"}` : ""}</span>
      </span>}
    </div>
    <div className={styles.inviteActions}>{children}</div>
  </div>;
}

/* ------------------------------------------------------------------------------------------------------------------
 * Scheduling page
 * ---------------------------------------------------------------------------------------------------------------- */

export type BookingLink = { id: string; title: string; minutes: number; provider: "meet" | "zoom"; slug: string; booked: number; on: boolean; tone: string };
export type WeeklyHours = { day: string; hours: string; on: boolean }[];

export const SAMPLE_LINKS: BookingLink[] = [
  { id: "intro", title: "Intro call", minutes: 30, provider: "meet", slug: "intro", booked: 4, on: true, tone: "sky" },
  { id: "review", title: "Design review", minutes: 45, provider: "zoom", slug: "design-review", booked: 2, on: true, tone: "violet" },
  { id: "office", title: "Office hours", minutes: 20, provider: "meet", slug: "office-hours", booked: 7, on: false, tone: "teal" },
];
export const SAMPLE_HOURS: WeeklyHours = [
  { day: "Monday", hours: "9:00 AM – 5:00 PM", on: true },
  { day: "Tuesday", hours: "9:00 AM – 5:00 PM", on: true },
  { day: "Wednesday", hours: "10:00 AM – 4:00 PM", on: true },
  { day: "Thursday", hours: "9:00 AM – 5:00 PM", on: true },
  { day: "Friday", hours: "9:00 AM – 1:00 PM", on: true },
  { day: "Saturday", hours: "9:00 AM – 1:00 PM", on: false },
  { day: "Sunday", hours: "9:00 AM – 1:00 PM", on: false },
];
const BOOKINGS = [
  { id: "b1", who: "Ryan Sullivan", avatar: "/media/people/ryan-sullivan.svg", link: "Intro call", when: "Mon, Nov 16, 2:00 PM" },
  { id: "b2", who: "Ava Mitchell", avatar: "/media/people/ava-mitchell.svg", link: "Design review", when: "Tue, Nov 17, 11:15 AM" },
  { id: "b3", who: "Andre Williams", avatar: "/media/people/andre-williams.svg", link: "Intro call", when: "Thu, Nov 19, 4:30 PM" },
];

function LinkRow({ link, onToggle }: { link: BookingLink; onToggle: () => void }) {
  const url = `cal.northwind.studio/emma/${link.slug}`;
  const provider = link.provider === "zoom" ? "Zoom" : "Google Meet";
  return <li className={styles.link} data-off={!link.on || undefined}>
    <span className={styles.linkMark} aria-hidden="true"><ConferenceMark conference={{ provider: link.provider, url: "" }} size={18} /></span>
    <div className={styles.linkBody}>
      <span className={styles.linkTitle}>{link.title}</span>
      <span className={styles.linkMeta}>
        <span>{link.minutes} min on {provider}</span>
        <span className={styles.linkUrl}>{url}</span>
      </span>
    </div>
    <span className={styles.linkBooked}>{link.on ? `${link.booked} booked this week` : "Paused"}</span>
    <CopyButton text={`https://${url}`} ariaLabel={`Copy ${link.title} link`} />
    <Switch className={styles.linkSwitch} checked={link.on} onCheckedChange={onToggle} aria-label={`${link.title} link on`} />
  </li>;
}

export function SchedulingPage({ links, hours, onLinks, onHours }: { links: BookingLink[]; hours: WeeklyHours; onLinks: (links: BookingLink[]) => void; onHours: (hours: WeeklyHours) => void }) {
  const scroll = useEdgeFade<HTMLDivElement>();
  const reduce = useReducedMotion();
  const fold = reduce ? instant : { height: motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.fast } };
  const open = hours.filter(day => day.on).length;
  return <div ref={scroll} className={styles.pageScroll}>
    <div className={cx(styles.page, styles.schedule)}>
      <div className={styles.scheduleMain}>
        <section className={styles.pageSection} aria-labelledby="links-head">
          <h3 id="links-head" className={styles.pageHead}>Booking links<span className={styles.pageCount}>{links.filter(link => link.on).length} on</span></h3>
          <ul className={styles.linkList}>
            <AnimatePresence initial={false}>
              {links.map(link => <motion.div key={link.id} className={styles.inviteFold} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={fold}>
                <LinkRow link={link} onToggle={() => onLinks(links.map(item => item.id === link.id ? { ...item, on: !item.on } : item))} />
              </motion.div>)}
            </AnimatePresence>
          </ul>
        </section>
        <section className={styles.pageSection} aria-labelledby="bookings-head">
          <h3 id="bookings-head" className={styles.pageHead}>Booked next week<span className={styles.pageCount}>{BOOKINGS.length}</span></h3>
          <ul className={styles.bookings}>
            {BOOKINGS.map(booking => <li key={booking.id} className={styles.booking}>
              <Avatar name={booking.who} src={booking.avatar} size="sm" aria-hidden="true" />
              <span className={styles.bookingText}><span className={styles.linkTitle}>{booking.who}</span><span className={styles.linkMeta}>{booking.link}</span></span>
              <span className={styles.bookingWhen}>{booking.when}</span>
            </li>)}
          </ul>
        </section>
      </div>
      <section className={cx(styles.pageSection, styles.hours)} aria-labelledby="hours-head">
        <h3 id="hours-head" className={styles.pageHead}>Weekly hours<span className={styles.pageCount}>{open} days open</span></h3>
        <ul className={styles.hourList}>
          {hours.map((row, index) => <li key={row.day} className={styles.hourRow} data-off={!row.on || undefined}>
            <span className={styles.hourDay}>{row.day}</span>
            <span className={styles.hourValue}>{row.on ? row.hours : "Unavailable"}</span>
            <Switch className={styles.hourSwitch} checked={row.on} aria-label={`Bookable on ${row.day}`} onCheckedChange={() => onHours(hours.map((item, i) => i === index ? { ...item, on: !item.on } : item))} />
          </li>)}
        </ul>
        <p className={styles.hoursNote}>Times are in your local zone. Bookings keep 10 minutes free between meetings.</p>
      </section>
    </div>
  </div>;
}

/* ------------------------------------------------------------------------------------------------------------------
 * Helpers for the screen
 * ---------------------------------------------------------------------------------------------------------------- */

/** ISO week number of a wall day. */
export function isoWeek(day: number) {
  const date = new Date(day * 86400000);
  const weekday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - weekday + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((date.getTime() - firstThursday.getTime()) / 86400000 - 3 + (firstThursday.getUTCDay() + 6) % 7) / 7);
}

/** Hours of an event calendar inside a range of days. */
export function hoursIn(events: CalendarEvent[], calendarId: string, days: number[], timeZone?: string) {
  if (!days.length) return 0;
  const from = days[0] * DAY, to = (days[days.length - 1] + 1) * DAY;
  let minutes = 0;
  for (const event of events) {
    if (event.calendarId !== calendarId || event.allDay) continue;
    const start = toWall(event.start, timeZone), end = toWall(event.end, timeZone);
    minutes += Math.max(0, Math.min(end, to) - Math.max(start, from));
  }
  return Math.round(minutes / 30) / 2;
}

