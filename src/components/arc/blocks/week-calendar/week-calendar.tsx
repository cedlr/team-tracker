"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { CalendarCheck2, CalendarDays, CalendarRange, Inbox, Layers, Link2, LogOut, Plus } from "lucide-react";
import { MotionConfig } from "motion/react";
import { ScreenShell, ScreenShellButton, ScreenShellMark } from "../../screen-shell/screen-shell";
import { createFormat } from "./calendar-time";
import { CalendarBoard, type CalendarChrome, type CalendarController, type CalendarView } from "./calendar-board";
import { CalendarActions, CalendarHeaderBelow, HeaderMeta, InvitesPage, SAMPLE_HOURS, SAMPLE_LINKS, SchedulingPage, SidebarCalendars, SidebarMonth, TodayPanel, isoWeek, type BookingLink } from "./calendar-screen";
import { ACCOUNT_HOME, SAMPLE_CALENDARS, SAMPLE_DATE, sampleEvents, type CalendarEvent, type CalendarResponse, type CalendarSource } from "./week-calendar-data";
import styles from "./calendar-screen.module.css";

export type { CalendarAttendee, CalendarColor, CalendarConference, CalendarEvent, CalendarResponse, CalendarSource } from "./week-calendar-data";
export { SAMPLE_CALENDARS, sampleEvents } from "./week-calendar-data";
export { CalendarBoard } from "./calendar-board";
export type { CalendarBoardProps, CalendarChrome, CalendarController, CalendarView } from "./calendar-board";

export type CalendarPage = "calendar" | "invites" | "scheduling";

export interface WeekCalendarProps {
  /** Controlled events. Pair with `onEventsChange`. */
  events?: CalendarEvent[];
  /** Starting events when uncontrolled. Without either, the calendar shows a sample week. */
  defaultEvents?: CalendarEvent[];
  /** Every change: create, move, resize, edit, answer, delete and undo. */
  onEventsChange?: (events: CalendarEvent[]) => void;
  onCreate?: (event: CalendarEvent) => void;
  onUpdate?: (event: CalendarEvent, previous: CalendarEvent) => void;
  onDelete?: (event: CalendarEvent) => void;
  /** Calendars that color events and can be toggled. Events whose calendarId matches none render in neutral. */
  calendars?: CalendarSource[];
  /** The day to open on. Defaults to today, or to the sample week when showing sample events. */
  defaultDate?: Date;
  defaultView?: CalendarView;
  onViewChange?: (view: CalendarView) => void;
  /** 0 is Sunday, 1 is Monday. People can switch between Monday and Sunday from the account menu. */
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /** First and last visible hour of the day grid. */
  startHour?: number;
  endHour?: number;
  /** IANA zone the grid runs in, such as "America/New_York". Defaults to the browser's zone. */
  timeZone?: string;
  locale?: string;
  className?: string;
  /** The page the screen opens on. */
  defaultPage?: CalendarPage;
  /** Called after someone answers an invite, from the invites page or the event details. */
  onRespond?: (event: CalendarEvent, rsvp: CalendarResponse) => void;
}

/** Two calendar workspaces, each with its own mark: work on a split disc, home on a seed. */
const WORKSPACES = [
  { id: "northwind", name: "Northwind", detail: "emma@northwind.studio", tone: "sky" as const, mark: <ScreenShellMark name="Northwind" variant="split" tone="sky" /> },
  { id: "personal", name: "Personal", detail: "iCloud calendars", tone: "orchid" as const, mark: <ScreenShellMark name="Personal" variant="seed" tone="orchid" /> },
];

/**
 * A full calendar app screen built on the screen shell: a week grid where you drag to create, move and resize events,
 * a sidebar with a mini month and calendars grouped by account, a today panel with the next meetings and world clocks,
 * an invites page where answers update the grid, and a scheduling page with booking links and weekly hours.
 */
export function WeekCalendar({
  events: controlled, defaultEvents, onEventsChange, onCreate, onUpdate, onDelete, calendars: calendarsProp, defaultDate, defaultView = "week", onViewChange,
  weekStartsOn: weekStartsProp = 1, startHour, endHour, timeZone, locale = "en-US", className, defaultPage = "calendar", onRespond,
}: WeekCalendarProps) {
  const sample = controlled === undefined && defaultEvents === undefined;
  const calendars = calendarsProp ?? SAMPLE_CALENDARS;
  const fmt = useMemo(() => createFormat(locale), [locale]);
  const [inner, setInner] = useState<CalendarEvent[]>(() => defaultEvents ?? sampleEvents(timeZone));
  const events = controlled ?? inner;
  const latest = useRef(events);
  useLayoutEffect(() => { latest.current = events; });
  const apply = (next: CalendarEvent[]) => {
    latest.current = next;
    if (controlled === undefined) setInner(next);
    onEventsChange?.(next);
  };

  const defaultHidden = useMemo(() => new Set(calendars.filter(c => c.hidden).map(c => c.id)), [calendars]);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(defaultHidden);
  const [page, setPage] = useState<CalendarPage>(defaultPage);
  const [chrome, setChrome] = useState<CalendarChrome | null>(null);
  const [weekStartsOn, setWeekStartsOn] = useState<number>(weekStartsProp);
  const [workspaceId, setWorkspaceId] = useState("northwind");
  const [signedOut, setSignedOut] = useState(false);
  const [links, setLinks] = useState<BookingLink[]>(SAMPLE_LINKS);
  const [hours, setHours] = useState(SAMPLE_HOURS);
  const board = useRef<CalendarController>(null);

  const pending = events.filter(event => event.rsvp === "pending").length;

  const toggle = (id: string) => setHidden(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const switchWorkspace = (id: string) => {
    setWorkspaceId(id);
    setHidden(id === "personal" && calendars.some(c => c.account === ACCOUNT_HOME) ? new Set(calendars.filter(c => c.account !== ACCOUNT_HOME).map(c => c.id)) : defaultHidden);
  };
  const answer = (id: string, rsvp: CalendarResponse) => {
    const previous = latest.current.find(event => event.id === id);
    if (!previous) return;
    const next = { ...previous, rsvp };
    apply(latest.current.map(event => event.id === id ? next : event));
    onUpdate?.(next, previous);
    if (rsvp !== "pending") onRespond?.(next, rsvp);
  };
  const showInCalendar = (id: string) => { setPage("calendar"); requestAnimationFrame(() => board.current?.openEvent(id)); };
  const newEvent = () => { setPage("calendar"); requestAnimationFrame(() => board.current?.newEvent()); };
  const addLink = () => {
    const n = links.length + 1;
    setLinks(list => [...list, { id: `link-${Date.now().toString(36)}`, title: `New link ${n}`, minutes: 30, provider: "meet", slug: `new-${n}`, booked: 0, on: true, tone: ["orchid", "amber", "green", "rose"][n % 4] }]);
  };

  const header = signedOut ? { title: "Calendar" }
    : page === "calendar" ? {
      title: chrome?.monthTitle ?? "Calendar",
      meta: chrome ? <HeaderMeta>Week {isoWeek(chrome.days[0])}</HeaderMeta> : undefined,
      actions: <CalendarActions chrome={chrome} board={board} onNew={newEvent} />,
      below: <CalendarHeaderBelow chrome={chrome} board={board} />,
    }
    : page === "invites" ? { title: "Invites", meta: <HeaderMeta>{pending ? `${pending} waiting` : "All answered"}</HeaderMeta> }
    : { title: "Scheduling", meta: <HeaderMeta>{links.length} booking links</HeaderMeta>, actions: <ScreenShellButton variant="primary" icon={Plus} onClick={addLink}>New link</ScreenShellButton> };

  return <MotionConfig reducedMotion="user">
    <div className={[styles.root, className].filter(Boolean).join(" ")}>
      <ScreenShell
        aria-label="Calendar"
        workspace={{ name: "Northwind", mark: WORKSPACES[0].mark, activeId: workspaceId, onSelect: switchWorkspace, options: WORKSPACES }}
        nav={[
          { id: "calendar", label: "Calendar", icon: CalendarDays },
          { id: "invites", label: "Invites", icon: Inbox, count: pending || undefined },
          { id: "scheduling", label: "Scheduling", icon: Link2 },
        ]}
        activeId={page}
        onNavigate={id => setPage(id as CalendarPage)}
        search={{ placeholder: "Search" }}
        sections={signedOut ? undefined : [
          { id: "month", label: "Jump to date", icon: CalendarRange, collapsible: false, items: [],
            content: <SidebarMonth fmt={fmt} chrome={chrome} board={board} weekStartsOn={weekStartsOn} onPick={() => setPage("calendar")} /> },
          { id: "calendars", label: "Calendars", icon: Layers, items: [],
            content: <SidebarCalendars calendars={calendars} hidden={hidden} onToggle={toggle} /> },
        ]}
        account={{
          name: "Emma Collins", detail: "emma@northwind.studio", avatar: "/media/people/emma-collins.svg",
          menu: [
            { id: "sunday", label: "Start week on Sunday", icon: CalendarCheck2, checked: weekStartsOn === 0, onSelect: () => setWeekStartsOn(start => start === 0 ? 1 : 0) },
            { id: "signout", label: "Sign out", icon: LogOut, danger: true, separatorBefore: true, onSelect: () => setSignedOut(true) },
          ],
        }}
        header={header}
        rightPanel={page === "calendar" && !signedOut ? {
          label: "Agenda", defaultWidth: 288, minWidth: 264, maxWidth: 380, defaultOpen: false,
          content: <TodayPanel fmt={fmt} calendars={calendars} hidden={hidden} events={events} board={board} timeZone={timeZone} locale={locale} />,
        } : undefined}
        scroll={false}
        padding="none"
      >
        <div className={styles.stage}>
          {/* Every page stays mounted so the week keeps its place; the active one crossfades in above the others. */}
          <div className={styles.layer} data-hidden={page !== "calendar" || signedOut || undefined} inert={page !== "calendar" || signedOut || undefined}>
            <CalendarBoard chrome="screen" controllerRef={board} onChromeChange={setChrome}
              events={events} onEventsChange={apply} onCreate={onCreate} onDelete={onDelete}
              onUpdate={(next, previous) => { onUpdate?.(next, previous); if (next.rsvp !== previous.rsvp && next.rsvp && next.rsvp !== "pending") onRespond?.(next, next.rsvp); }}
              calendars={calendars} hidden={hidden} onHiddenChange={setHidden}
              defaultDate={defaultDate ?? (sample ? SAMPLE_DATE : undefined)} defaultView={defaultView} onViewChange={onViewChange}
              weekStartsOn={weekStartsOn as WeekCalendarProps["weekStartsOn"]} startHour={startHour} endHour={endHour} timeZone={timeZone} locale={locale} />
          </div>
          <div className={styles.layer} data-hidden={page !== "invites" || signedOut || undefined} inert={page !== "invites" || signedOut || undefined}>
            <InvitesPage fmt={fmt} events={events} calendars={calendars} timeZone={timeZone} fromDay={chrome?.days[0] ?? null} onAnswer={answer} onOpen={showInCalendar} />
          </div>
          <div className={styles.layer} data-hidden={page !== "scheduling" || signedOut || undefined} inert={page !== "scheduling" || signedOut || undefined}>
            <SchedulingPage links={links} hours={hours} onLinks={setLinks} onHours={setHours} />
          </div>
          <div className={styles.layer} data-hidden={!signedOut || undefined} inert={!signedOut || undefined}>
            <div className={styles.notice}>
              <p className={styles.noticeTitle}>You signed out of Northwind</p>
              <p className={styles.noticeBody}>This is a local preview, so your calendar stays right here.</p>
              <ScreenShellButton variant="secondary" onClick={() => setSignedOut(false)}>Sign back in</ScreenShellButton>
            </div>
          </div>
        </div>
      </ScreenShell>
    </div>
  </MotionConfig>;
}

export default WeekCalendar;
