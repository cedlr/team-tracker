"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, FormEvent, ReactNode } from "react";
import { ArrowLeft, Clock, MapPin, Plus, Trash2, Users, X } from "lucide-react";
import { Avatar } from "../../avatar/avatar";
import { Badge } from "../../badge/badge";
import { Button } from "../../button/button";
import { Checkbox } from "../../checkbox/checkbox";
import { CopyButton } from "../../copy-button/copy-button";
import { Input } from "../../input/input";
import SegmentedControl from "../../segmented-control/segmented-control";
import { Select } from "../../select/select";
import type { CalendarEvent, CalendarRsvp } from "./month-calendar-data";
import { CalendarGlyph, VideoMark, videoName } from "./month-calendar-parts";
import { bookedMinutes, clock, cx, duration, endOf, formatDuration, lastDay, minutes, rsvpLabel, useEdgeFade } from "./month-calendar-utils";
import type { CalendarKit } from "./month-calendar-utils";
import styles from "./month-calendar.module.css";

/** The panel frame: a fixed head, a scroller with edge fades and no scrollbar, and an optional foot. */
function Pane({ head, foot, children, label }: { head: ReactNode; foot?: ReactNode; children: ReactNode; label: string }) {
  const scroller = useEdgeFade<HTMLDivElement>();
  return <section className={styles.pane} aria-label={label}>
    <div className={styles.paneHead}>{head}</div>
    <div ref={scroller} className={styles.paneScroll} data-fade="y">{children}</div>
    {foot && <div className={styles.paneFoot}>{foot}</div>}
  </section>;
}

/* ------------------------------------------------------------------------------------------------------------------
 * Day
 * ---------------------------------------------------------------------------------------------------------------- */

const DAY_START = 7 * 60, DAY_END = 22 * 60;
const WORK_START = 9 * 60, WORK_END = 18 * 60;
/** The sample's clock, so "now" on today is stable in screenshots. */
const SAMPLE_NOW = 10 * 60 + 20;

export function DayPanel({ kit, day, events, matches, onOpen, onCreate, onBlock }: {
  kit: CalendarKit; day: string; events: CalendarEvent[]; matches: (event: CalendarEvent) => boolean;
  onOpen: (event: CalendarEvent, node: HTMLElement) => void; onCreate: (day: string) => void; onBlock: (day: string, from: number, to: number) => void;
}) {
  const allDay = events.filter(event => !event.time);
  const timed = events.filter(event => event.time).sort((a, b) => a.time!.localeCompare(b.time!));
  const booked = bookedMinutes(timed);
  const isToday = day === kit.today;

  /* Free gaps of an hour or more inside working hours, offered as focus time. */
  const rows: ({ kind: "event"; event: CalendarEvent } | { kind: "gap"; from: number; to: number })[] = [];
  let cursor = WORK_START;
  const busy = timed.filter(event => event.rsvp !== "no");
  for (const event of timed) {
    const from = minutes(event.time!);
    if (from - cursor >= 60 && from <= WORK_END && busy.includes(event)) rows.push({ kind: "gap", from: cursor, to: Math.min(from, WORK_END) });
    rows.push({ kind: "event", event });
    if (busy.includes(event)) cursor = Math.max(cursor, minutes(endOf(event)!));
  }
  if (WORK_END - cursor >= 60) rows.push({ kind: "gap", from: cursor, to: WORK_END });
  const free = rows.reduce((sum, row) => row.kind === "gap" ? sum + row.to - row.from : sum, 0);

  return <Pane label={`Schedule for ${kit.date(day, "long")}`}
    head={<div className={styles.dayHead}>
      <div className={styles.dayTitleRow}>
        <h3 className={styles.paneTitle}>{kit.date(day, "long")}</h3>
        {isToday && <Badge size="sm" tone="info">Today</Badge>}
      </div>
      <p className={styles.paneMeta}>{events.length ? `${events.length} ${events.length === 1 ? "event" : "events"} · ${formatDuration(booked)} booked` : "Nothing scheduled"}{free ? ` · ${formatDuration(free)} free` : ""}</p>
      <DayStrip kit={kit} events={timed} now={isToday ? SAMPLE_NOW : undefined} />
    </div>}
    foot={<Button variant="secondary" size="sm" className={styles.footButton} onClick={() => onCreate(day)}><Plus size={16} strokeWidth={1.75} aria-hidden="true" />New event on {kit.date(day, "day")}</Button>}>
    {allDay.length > 0 && <div className={styles.group}>
      <p className={styles.groupLabel}>All day</p>
      <ul className={styles.allDayList}>{allDay.map(event => {
        const days = lastDay(event) !== event.start ? `${kit.date(event.start, "day")} to ${kit.date(lastDay(event), "day")}` : "All day";
        return <li key={event.id}><button type="button" className={styles.allDayRow} data-dim={!matches(event) || undefined} style={{ "--event": kit.colorOf(event) } as CSSProperties} onClick={click => onOpen(event, click.currentTarget)}>
          <CalendarGlyph kit={kit} calendarId={event.calendarId} />
          <span className={styles.allDayTitle}>{event.title}</span><span className={styles.allDayMeta}>{days}</span>
        </button></li>;
      })}</ul>
    </div>}
    {timed.length > 0 || rows.length > 0 ? <div className={styles.group}>
      <p className={styles.groupLabel}>Schedule</p>
      <ul className={styles.rows}>{rows.map(row => row.kind === "gap"
        ? <li key={`gap-${row.from}`} className={styles.gap}>
          <span className={styles.gapText}>Free {kit.time(clock(row.from))} to {kit.time(clock(row.to))}</span>
          <Button variant="ghost" size="sm" className={styles.gapAction} onClick={() => onBlock(day, row.from, Math.min(row.to, row.from + 120))}>Block focus time</Button>
        </li>
        : <li key={row.event.id}><EventRow kit={kit} event={row.event} dim={!matches(row.event)} onOpen={onOpen} /></li>)}</ul>
    </div> : null}
    {!events.length && <div className={styles.emptyDay}>
      <p className={styles.emptyTitle}>A clear day</p>
      <p className={styles.emptyBody}>Drag across days in the month to plan something longer.</p>
    </div>}
  </Pane>;
}

/** One timed event: time on the left, the calendar's icon, title and context on the right. */
export function EventRow({ kit, event, dim, onOpen, showDate }: { kit: CalendarKit; event: CalendarEvent; dim?: boolean; onOpen: (event: CalendarEvent, node: HTMLElement) => void; showDate?: boolean }) {
  return <button type="button" className={styles.row} data-dim={dim || undefined} data-pending={event.rsvp === "pending" || undefined} data-declined={event.rsvp === "no" || undefined}
    onClick={click => onOpen(event, click.currentTarget)}>
    <span className={styles.rowTime}>
      {event.time ? <><span>{kit.time(event.time)}</span><span className={styles.rowEnd}>{formatDuration(duration(event))}</span></> : <span>All day</span>}
    </span>
    <CalendarGlyph kit={kit} calendarId={event.calendarId} className={styles.rowGlyph} />
    <span className={styles.rowBody}>
      <span className={styles.rowTitle}>{event.title}</span>
      <span className={styles.rowMeta}>
        {showDate && <span>{kit.date(event.start, "short")}</span>}
        {event.video && <span className={styles.rowVideo}><VideoMark provider={event.video.provider} size={14} />{videoName[event.video.provider]}</span>}
        {!event.video && event.location && <span className={styles.rowPlace}>{event.location}</span>}
        {event.rsvp === "pending" && <span>Awaiting your reply</span>}
        {event.rsvp === "no" && <span>Declined</span>}
      </span>
    </span>
  </button>;
}

/** The day at a glance: busy blocks between 7:00 and 22:00, with a marker for now on today. */
function DayStrip({ kit, events, now }: { kit: CalendarKit; events: CalendarEvent[]; now?: number }) {
  const at = (value: number) => `${((Math.min(Math.max(value, DAY_START), DAY_END) - DAY_START) / (DAY_END - DAY_START)) * 100}%`;
  return <div className={styles.strip} aria-hidden="true">
    <div className={styles.stripTrack}>
      {events.filter(event => event.rsvp !== "no").map(event => {
        const from = minutes(event.time!), to = minutes(endOf(event)!);
        return <span key={event.id} className={styles.stripBlock} data-pending={event.rsvp === "pending" || undefined}
          style={{ left: at(from), width: `calc(${at(to)} - ${at(from)})`, "--event": kit.colorOf(event) } as CSSProperties} />;
      })}
      {now !== undefined && <span className={styles.stripNow} style={{ left: at(now) }} />}
    </div>
    <div className={styles.stripHours}>{[8, 12, 16, 20].map(hour => <span key={hour} style={{ left: at(hour * 60) }}>{kit.shortTime(clock(hour * 60))}</span>)}</div>
  </div>;
}

/* ------------------------------------------------------------------------------------------------------------------
 * Event
 * ---------------------------------------------------------------------------------------------------------------- */

const rsvpOptions = [{ value: "yes", label: "Going" }, { value: "maybe", label: "Maybe" }, { value: "no", label: "No" }];

export function EventPanel({ kit, event, backLabel, onBack, onDelete, onRsvp, onCalendar }: {
  kit: CalendarKit; event: CalendarEvent; backLabel: string; onBack: () => void; onDelete: (event: CalendarEvent) => void;
  onRsvp: (event: CalendarEvent, rsvp: CalendarRsvp) => void; onCalendar: (event: CalendarEvent, calendarId: string) => void;
}) {
  const organizer = event.organizer ? kit.person(event.organizer) : undefined;
  const invited = Boolean(event.organizer && event.organizer !== kit.meId);
  const guests = (event.attendees ?? []).map(attendee => ({ person: kit.person(attendee.id), status: attendee.id === kit.meId && invited ? event.rsvp ?? "yes" : attendee.status ?? "yes" }));
  const going = guests.filter(guest => guest.status === "yes").length;

  return <Pane label={event.title}
    head={<div className={styles.eventTop}>
      <Button variant="ghost" size="sm" className={styles.back} onClick={onBack}><ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />{backLabel}</Button>
      <Button variant="ghost" size="sm" className={styles.iconAction} aria-label={`Delete ${event.title}`} onClick={() => onDelete(event)}><Trash2 size={16} strokeWidth={1.75} aria-hidden="true" /></Button>
    </div>}>
    <div className={styles.eventHead}>
      <h3 className={styles.eventTitle}><CalendarGlyph kit={kit} calendarId={event.calendarId} className={styles.eventGlyph} />{event.title}</h3>
      <p className={styles.eventWhen}>{kit.span(event)}</p>
    </div>

    <dl className={styles.facts}>
      {event.time && <div className={styles.fact}><dt><Clock size={16} strokeWidth={1.75} aria-label="Duration" /></dt><dd>{formatDuration(duration(event))} · ends {kit.time(endOf(event)!)}</dd></div>}
      {event.location && <div className={styles.fact}><dt><MapPin size={16} strokeWidth={1.75} aria-label="Location" /></dt><dd>{event.location}</dd></div>}
      {event.video && <div className={styles.fact}><dt><VideoMark provider={event.video.provider} /><span className={styles.srOnly}>Video call</span></dt><dd className={styles.videoFact}>
        <span className={styles.videoName}>{videoName[event.video.provider]}<span className={styles.videoUrl}>{event.video.url.replace("https://", "")}</span></span>
        <CopyButton value={event.video.url} label="Copy link" className={styles.copy} />
      </dd></div>}
    </dl>

    {invited && <div className={styles.group}>
      <p className={styles.groupLabel}>{event.rsvp === "pending" ? `${organizer?.name ?? "Someone"} invited you` : "Your reply"}</p>
      <SegmentedControl fullWidth label="Your reply" options={rsvpOptions} value={event.rsvp === "pending" ? "" : event.rsvp ?? ""} onValueChange={value => onRsvp(event, value as CalendarRsvp)} />
    </div>}

    {guests.length > 0 && <div className={styles.group}>
      <p className={styles.groupLabel}><Users size={16} strokeWidth={1.75} aria-hidden="true" />{guests.length} guests · {going} going</p>
      <ul className={styles.guests}>{guests.map(({ person, status }) => <li key={person.id} className={styles.guest}>
        <Avatar name={person.name} src={person.avatar} size="sm" aria-hidden="true" />
        <span className={styles.guestText}><span className={styles.guestName}>{person.name}{person.id === kit.meId ? " (you)" : ""}</span>{person.id === event.organizer && <span className={styles.guestRole}>Organizer</span>}</span>
        <span className={styles.guestStatus} data-status={status}>{rsvpLabel[status]}</span>
      </li>)}</ul>
    </div>}

    {event.notes && <div className={styles.group}><p className={styles.groupLabel}>Notes</p><p className={styles.notes}>{event.notes}</p></div>}

    <div className={cx(styles.group, styles.quietLabel)}>
      <Select label="Calendar" options={kit.calendars.map(calendar => ({ value: calendar.id, label: calendar.name }))} value={event.calendarId} onValueChange={id => onCalendar(event, id)} />
    </div>
  </Pane>;
}

/* ------------------------------------------------------------------------------------------------------------------
 * Create
 * ---------------------------------------------------------------------------------------------------------------- */

export function CreatePanel({ kit, start, end, onCancel, onSave }: { kit: CalendarKit; start: string; end: string; onCancel: () => void; onSave: (event: CalendarEvent) => Promise<void> }) {
  const multi = start !== end;
  const [title, setTitle] = useState("");
  const [calendarId, setCalendarId] = useState(kit.calendars[0]?.id ?? "");
  const [allDay, setAllDay] = useState(multi);
  const [from, setFrom] = useState("10:00");
  const [to, setTo] = useState("11:00");
  const [location, setLocation] = useState("");
  const [call, setCall] = useState(false);
  const [guests, setGuests] = useState<string[]>([]);
  const [error, setError] = useState<{ field: "title" | "time" | "form"; text: string }>();
  const [busy, setBusy] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  useEffect(() => { const frame = requestAnimationFrame(() => titleRef.current?.focus({ preventScroll: true })); return () => cancelAnimationFrame(frame); }, []);
  const teammates = kit.people.filter(person => person.id !== kit.meId).slice(0, 7);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) { setError({ field: "title", text: "Add a title" }); titleRef.current?.focus(); return; }
    if (!allDay && to <= from) { setError({ field: "time", text: "End after it starts" }); return; }
    setBusy(true);
    try {
      await onSave({
        id: `new-${Date.now().toString(36)}`, title: title.trim(), calendarId, start, end: multi ? end : undefined,
        time: allDay ? undefined : from, endTime: allDay ? undefined : to, location: location.trim() || undefined,
        organizer: guests.length ? kit.meId : undefined, attendees: guests.length ? [{ id: kit.meId, status: "yes" }, ...guests.map(guest => ({ id: guest, status: "pending" as const }))] : undefined,
        video: call ? { provider: "zoom", url: `https://zoom.us/j/8${String(Date.now()).slice(-10)}` } : undefined,
      });
    } catch (reason) { setError({ field: "form", text: reason instanceof Error ? reason.message : "Could not save the event" }); setBusy(false); }
  };

  return <form className={styles.form} onSubmit={submit} noValidate aria-label="New event">
    <Pane label="New event"
      head={<div className={styles.eventTop}>
        <h3 className={styles.paneTitle}>New event</h3>
        <Button variant="ghost" size="sm" className={styles.iconAction} aria-label="Cancel" onClick={onCancel}><X size={16} strokeWidth={1.75} aria-hidden="true" /></Button>
      </div>}
      foot={<div className={styles.formActions}>
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" size="sm" type="submit" loading={busy}>Save event</Button>
      </div>}>
      <div className={styles.formBody}>
        <Input ref={titleRef} label="Title" value={title} placeholder="Add a title" error={error?.field === "title" ? error.text : undefined}
          onChange={event => { setTitle(event.target.value); setError(undefined); }} />
        <div className={styles.field}>
          <p className={styles.fieldWhen}><Clock size={16} strokeWidth={1.75} aria-hidden="true" />{multi ? `${kit.date(start, "short")} to ${kit.date(end, "short")}` : kit.date(start, "long")}</p>
          <div className={styles.checkRow}><Checkbox label="All day" checked={allDay} onCheckedChange={value => { setAllDay(value === true); setError(undefined); }} /></div>
          <div className={styles.times} data-off={allDay || undefined}>
            <Input type="time" label="Starts" value={from} disabled={allDay} onChange={event => { setFrom(event.target.value); setError(undefined); if (event.target.value >= to) setTo(clock(Math.min(minutes(event.target.value) + 60, 23 * 60 + 45))); }} />
            <Input type="time" label="Ends" value={to} disabled={allDay} error={error?.field === "time" ? error.text : undefined} onChange={event => { setTo(event.target.value); setError(undefined); }} />
          </div>
        </div>
        <Input label="Location" value={location} placeholder="Room, address or link" onChange={event => setLocation(event.target.value)} />
        <div className={styles.checkRow}><Checkbox label="Add a Zoom link" description="Guests get the link with the invite" checked={call} onCheckedChange={value => setCall(value === true)} /></div>
        <div className={styles.field}>
          <span className={styles.fieldLabel} id="month-calendar-guests">Guests</span>
          <div className={styles.guestPicker} role="group" aria-labelledby="month-calendar-guests">{teammates.map(person => { const on = guests.includes(person.id); return <button key={person.id} type="button" className={styles.guestToggle} aria-pressed={on} aria-label={person.name}
            onClick={() => setGuests(list => on ? list.filter(item => item !== person.id) : [...list, person.id])}>
            <Avatar name={person.name} src={person.avatar} size="sm" aria-hidden="true" className={styles.guestFace} />
          </button>; })}</div>
          <span className={styles.fieldHint}>{guests.length ? `${guests.map(guest => kit.person(guest).name.split(" ")[0]).join(", ")} will get an invite` : "Invite teammates, or keep it to yourself"}</span>
        </div>
        <Select label="Calendar" options={kit.calendars.map(calendar => ({ value: calendar.id, label: calendar.name }))} value={calendarId} onValueChange={setCalendarId} />
        <p className={styles.error} data-on={error?.field === "form" ? "" : undefined} role="alert">{error?.field === "form" ? error.text : ""}</p>
      </div>
    </Pane>
  </form>;
}
