"use client";

import { memo, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode, RefObject } from "react";
import { motion } from "motion/react";
import { AlignLeft, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Copy, MapPin, Phone, Trash2, Users, X } from "lucide-react";
import { motionTokens } from "../../lib/motion-tokens";
import { Avatar } from "../../avatar/avatar";
import { Button } from "../../button/button";
import SegmentedControl from "../../segmented-control/segmented-control";
import { Select } from "../../select/select";
import { DAY, dateDay, dayOf, minuteOf, startOfWeek, type CalendarFormat, type Wall } from "./calendar-time";
import type { CalendarAttendee, CalendarConference, CalendarEvent, CalendarResponse, CalendarSource } from "./week-calendar-data";
import styles from "./week-calendar.module.css";

const { duration, ease } = motionTokens;
const standardEase = [...ease.standard] as [number, number, number, number];
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Built in names map to Arc's categorical tones, tuned for light and dark; blue is the sky tone. */
const BUILT_IN: Record<string, string> = { blue: "sky", sky: "sky", green: "green", violet: "violet", orchid: "orchid", amber: "amber", rose: "rose", teal: "teal" };
/** A calendar's color as a CSS value: built in names map to tone tokens, anything else is used as is. */
export const colorOf = (calendar: CalendarSource | undefined) => !calendar ? "var(--text-muted)" : BUILT_IN[calendar.color] ? `var(--tone-${BUILT_IN[calendar.color]})` : calendar.color;

/* Brand marks: Google and Apple are Simple Icons paths (CC0); the Zoom tile is drawn simply. Sample content, not endorsements. */
export function GoogleMark({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={styles.brand}>
    <path fill="#4285F4" d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
  </svg>;
}
export function AppleMark({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={styles.brand}>
    <path fill="currentColor" d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
  </svg>;
}
export function ZoomMark({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={styles.brand}>
    <rect width="24" height="24" rx="6" fill="#0B5CFF" />
    <rect x="4.5" y="8" width="10.5" height="8" rx="2" fill="#fff" />
    <path d="M16 11l3.6-2.4a.5.5 0 0 1 .8.4v6a.5.5 0 0 1-.8.4L16 13z" fill="#fff" />
  </svg>;
}
export function ConferenceMark({ conference, size = 16 }: { conference: CalendarConference; size?: number }) {
  return conference.provider === "zoom" ? <ZoomMark size={size} /> : conference.provider === "meet" ? <GoogleMark size={size} /> : <Phone size={size} strokeWidth={1.75} aria-hidden="true" />;
}
export const conferenceName = (conference: CalendarConference) => conference.provider === "zoom" ? "Zoom" : conference.provider === "meet" ? "Google Meet" : "Phone";

/** Copies text and reports how it went, for buttons that confirm in place. */
export function useCopy() {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async (text: string) => {
    clearTimeout(timer.current);
    try { await navigator.clipboard.writeText(text); setState("copied"); } catch { setState("error"); }
    timer.current = setTimeout(() => setState("idle"), 1600);
  };
  return { state, copy };
}
export const tint = (color: string): CSSProperties => ({ ["--cal" as string]: color });

/** A calendar's mark: its portrait for a person, otherwise its icon tinted with the calendar color. Never a coloured dot. */
export function CalendarGlyph({ calendar, size = 16 }: { calendar: CalendarSource | undefined; size?: number }) {
  if (calendar?.avatar) return <Avatar name={calendar.name} src={calendar.avatar} size="sm" className={styles.glyphFace} style={{ width: size + 2, height: size + 2 }} aria-hidden="true" />;
  const Icon = calendar?.icon ?? CalendarDays;
  return <span className={styles.glyph} style={tint(colorOf(calendar))} aria-hidden="true"><Icon size={size} strokeWidth={1.75} /></span>;
}

/** The copy button used across the calendar: a fixed width so the confirmation never moves its neighbours. */
export function CopyButton({ text, label = "Copy link", ariaLabel }: { text: string; label?: string; ariaLabel?: string }) {
  const { state, copy } = useCopy();
  return <Button type="button" variant="secondary" size="sm" className={styles.copyButton} data-copy={state} onClick={() => copy(text)}
    aria-label={state === "copied" ? "Link copied" : state === "error" ? "Copy failed" : ariaLabel}>
    {state === "copied" ? <Check size={14} strokeWidth={2} aria-hidden="true" /> : state === "error" ? <X size={14} strokeWidth={2} aria-hidden="true" /> : <Copy size={14} strokeWidth={1.75} aria-hidden="true" />}
    <span>{state === "copied" ? "Copied" : state === "error" ? "Failed" : label}</span>
  </Button>;
}

export const initials = (name: string) => name.split(/\s+/).map(part => part[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

export function Faces({ people, size = 20, max = 4 }: { people: CalendarAttendee[]; size?: number; max?: number }) {
  const shown = people.slice(0, max), extra = people.length - shown.length;
  return <span className={styles.faces} aria-hidden="true">
    {shown.map(person => <Avatar key={person.name} name={person.name} src={person.avatar} size="sm" className={styles.face} style={{ width: size, height: size, fontSize: Math.max(8, Math.round(size * .4)) }} />)}
    {extra > 0 && <span className={styles.face} data-initials="" style={{ width: size, height: size }}>+{extra}</span>}
  </span>;
}

type PopoverProps = {
  /** Returns the element the popover points at. */
  anchor: () => HTMLElement | null;
  rootRef: RefObject<HTMLElement | null>;
  scrollerRef?: RefObject<HTMLElement | null>;
  placement?: "side" | "below";
  width?: number;
  reduced: boolean;
  label: string;
  onClose: () => void;
  /** Presses on this element do not count as outside, so its own toggle can close the popover. */
  ignore?: () => HTMLElement | null;
  children: ReactNode;
};

/**
 * A floating layer in the calendar. It sits beside the event it belongs to (or below a button), follows it while the
 * day scrolls, and scales in from the edge that faces its anchor. Escape and a press outside close it.
 */
export function CalendarPopover({ anchor, rootRef, scrollerRef, placement = "side", width = 340, reduced, label, onClose, ignore, children }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const place = () => {
      const root = rootRef.current, node = ref.current;
      if (!root || !node) return;
      const bounds = root.getBoundingClientRect();
      const w = Math.min(width, bounds.width - 16);
      node.style.width = `${w}px`;
      const h = node.offsetHeight;
      const target = anchor()?.getBoundingClientRect();
      const box = target
        ? { left: target.left - bounds.left, right: target.right - bounds.left, top: target.top - bounds.top, bottom: target.bottom - bounds.top }
        : { left: bounds.width / 2, right: bounds.width / 2, top: 96, bottom: 96 };
      // Keep the whole layer inside what is visible: the scrolling day and the browser window.
      const scroller = scrollerRef?.current?.getBoundingClientRect();
      const visibleTop = Math.max(scroller ? scroller.top - bounds.top : 0, -bounds.top) + 8;
      const visibleBottom = Math.min(scroller ? scroller.bottom - bounds.top : bounds.height, window.innerHeight - bounds.top) - 8;
      const maxTop = Math.max(visibleTop, visibleBottom - h);
      let left: number, top: number, origin: string;
      if (placement === "side" && bounds.width >= 640 && box.right + 10 + w <= bounds.width - 8) {
        left = box.right + 10; top = clamp(box.top - 6, visibleTop, maxTop); origin = "left top";
      } else if (placement === "side" && bounds.width >= 640 && box.left - 10 - w >= 8) {
        left = box.left - 10 - w; top = clamp(box.top - 6, visibleTop, maxTop); origin = "right top";
      } else {
        left = clamp(placement === "below" ? box.right - w : (box.left + box.right) / 2 - w / 2, 8, bounds.width - w - 8);
        const below = box.bottom + 8, above = box.top - 8 - h;
        if (placement === "below" || below + h <= visibleBottom) { top = below; origin = "center top"; }
        else if (above >= visibleTop) { top = above; origin = "center bottom"; }
        else { top = maxTop; origin = "center bottom"; }
      }
      node.style.left = `${Math.round(left)}px`;
      node.style.top = `${Math.round(top)}px`;
      node.style.transformOrigin = origin;
    };
    place();
    const scroller = scrollerRef?.current;
    scroller?.addEventListener("scroll", place, { passive: true });
    window.addEventListener("resize", place);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(place);
    if (ref.current) observer?.observe(ref.current);
    return () => { scroller?.removeEventListener("scroll", place); window.removeEventListener("resize", place); observer?.disconnect(); };
  }, [anchor, placement, rootRef, scrollerRef, width]);

  useEffect(() => { ref.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus({ preventScroll: true }); }, []);
  useEffect(() => {
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (ref.current?.contains(target) || ignore?.()?.contains(target)) return;
      onClose();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [ignore, onClose]);

  return <motion.div ref={ref} className={styles.popover} role="dialog" aria-label={label}
    initial={reduced ? { opacity: 0 } : { opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }}
    exit={reduced ? { opacity: 0, transition: { duration: duration.instant } } : { opacity: 0, scale: .98, transition: { duration: duration.instant, ease: standardEase } }}
    transition={reduced ? { duration: duration.fast } : { opacity: { duration: duration.fast }, scale: motionTokens.spring.smooth }}
    // A select open inside handles its own Escape (Radix marks it handled), so only that list closes.
    onKeyDown={event => { if (event.key === "Escape" && !event.defaultPrevented) { event.preventDefault(); event.stopPropagation(); onClose(); } }}
    onPointerDown={event => event.stopPropagation()}>
    {children}
  </motion.div>;
}

export function CalendarPicker({ calendars, value, onChange }: { calendars: CalendarSource[]; value: string; onChange: (id: string) => void }) {
  return <div className={styles.picker} role="radiogroup" aria-label="Calendar">
    {calendars.map(calendar => <button key={calendar.id} type="button" role="radio" aria-checked={value === calendar.id} className={styles.chip} style={tint(colorOf(calendar))}
      onClick={() => onChange(calendar.id)}>
      <CalendarGlyph calendar={calendar} size={14} />{calendar.name}
    </button>)}
  </div>;
}

type QuickCreateProps = {
  fmt: CalendarFormat; start: Wall; end: Wall; calendars: CalendarSource[]; calendarId: string;
  onCalendar: (id: string) => void; onSave: (title: string) => void; onCancel: () => void;
};

/** The small form that follows drawing a new event: name it, pick a calendar, press Enter. */
export function QuickCreate({ fmt, start, end, calendars, calendarId, onCalendar, onSave, onCancel }: QuickCreateProps) {
  const [title, setTitle] = useState("");
  const titleId = useId();
  return <form className={styles.popBody} onSubmit={event => { event.preventDefault(); onSave(title); }}>
    <label htmlFor={titleId} className={styles.srOnly}>Event title</label>
    <input id={titleId} data-autofocus className={styles.titleInput} value={title} onChange={event => setTitle(event.target.value)} placeholder="Add title" autoComplete="off" enterKeyHint="done" />
    <p className={styles.row}>
      <Clock3 size={16} strokeWidth={1.75} aria-hidden="true" />
      <span><span>{fmt.shortDate(dayOf(start))}</span> <span className={styles.muted}>{fmt.range(start, end)}, {fmt.length(end - start)}</span></span>
    </p>
    <CalendarPicker calendars={calendars} value={calendarId} onChange={onCalendar} />
    <div className={styles.popFoot}>
      <span className={styles.hint} aria-hidden="true">Press Enter to save</span>
      <div className={styles.footActions}>
        <Button type="button" variant="ghost" size="sm" className={styles.popButton} onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary" size="sm" className={styles.popButton}>Save</Button>
      </div>
    </div>
  </form>;
}

type DetailsProps = {
  fmt: CalendarFormat; event: CalendarEvent; start: Wall; end: Wall; calendars: CalendarSource[];
  onTitle: (title: string) => void; onTime: (start: Wall, end: Wall) => void; onCalendar: (id: string) => void;
  onRsvp?: (rsvp: CalendarResponse) => void; onDelete: () => void; onClose: () => void;
  /** Someone else's event: the calendar picker and delete are left out. */
  readOnly?: boolean; calendarName?: string;
};

const ANSWERS: { value: CalendarResponse; label: string }[] = [{ value: "yes", label: "Yes" }, { value: "maybe", label: "Maybe" }, { value: "no", label: "No" }];
const STATUS_TEXT: Record<CalendarResponse, string> = { yes: "Going", maybe: "Maybe", no: "Declined", pending: "Awaiting" };

const STEPS = Array.from({ length: 96 }, (_, i) => i * 15);

/** Event details, editable in place: title, day, start and end on 15 minute steps, and calendar. */
export function EventDetails({ fmt, event, start, end, calendars, onTitle, onTime, onCalendar, onRsvp, onDelete, onClose, readOnly, calendarName }: DetailsProps) {
  const [title, setTitle] = useState(event.title);
  const ids = useId();
  const day = dayOf(start), from = minuteOf(start), span = end - start;
  const commitTitle = () => { const next = title.trim() || "Untitled event"; if (next !== event.title) onTitle(next); };
  const starts = STEPS.includes(from) ? STEPS : [...STEPS, from].sort((a, b) => a - b);
  const ends = Array.from({ length: Math.max(1, Math.floor((DAY - from) / 15)) }, (_, i) => start + (i + 1) * 15);
  if (!ends.includes(end)) { ends.push(end); ends.sort((a, b) => a - b); }
  const lastDay = event.allDay ? dayOf(end - 1) : day;

  return <div className={styles.popBody}>
    <div className={styles.popHead}>
      <span className={styles.bar}><CalendarGlyph calendar={readOnly ? undefined : calendars.find(c => c.id === event.calendarId)} /></span>
      <label htmlFor={`${ids}-title`} className={styles.srOnly}>Event title</label>
      <input id={`${ids}-title`} data-autofocus className={styles.titleInput} value={title} onChange={e => setTitle(e.target.value)} onBlur={commitTitle}
        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); commitTitle(); onClose(); } }} placeholder="Untitled event" autoComplete="off" />
      <button type="button" className={styles.iconButton} onClick={() => { commitTitle(); onClose(); }} aria-label="Close details"><X size={18} strokeWidth={1.75} aria-hidden="true" /></button>
    </div>

    {event.allDay
      ? <p className={styles.row}><Clock3 size={16} strokeWidth={1.75} aria-hidden="true" /><span>{lastDay === day ? fmt.longDate(day) : `${fmt.shortDate(day)} to ${fmt.shortDate(lastDay)}`} <span className={styles.muted}>All day</span></span></p>
      : <div className={styles.row}>
        <Clock3 size={16} strokeWidth={1.75} aria-hidden="true" />
        <div className={styles.timeFields}>
          <label className={styles.srOnly} htmlFor={`${ids}-day`}>Day</label>
          <input id={`${ids}-day`} type="date" className={styles.field} value={fmt.iso(day)} required
            onChange={e => { const next = fmt.fromIso(e.target.value); if (next !== null) onTime(next * DAY + from, next * DAY + from + span); }} />
          <div className={styles.timeRange}>
            <Select id={`${ids}-start`} label="Starts" className={styles.timeSelect} value={String(from)} options={starts.map(m => ({ value: String(m), label: fmt.time(m) }))}
              onValueChange={value => { const next = day * DAY + Number(value); onTime(next, next + span); }} />
            <span className={styles.muted} aria-hidden="true">to</span>
            <Select id={`${ids}-end`} label="Ends" className={styles.timeSelect} value={String(end)} options={ends.map(w => ({ value: String(w), label: fmt.time(w) }))}
              onValueChange={value => onTime(start, Number(value))} />
          </div>
          <span className={styles.duration}>{fmt.length(span)}</span>
        </div>
      </div>}

    {event.rsvp && onRsvp && <div className={styles.rsvp}>
      <span className={styles.rsvpLabel}>{event.rsvp === "pending" ? "Going?" : "Your answer"}</span>
      <SegmentedControl className={styles.rsvpChoices} label="Your answer" options={ANSWERS} value={event.rsvp === "pending" ? "" : event.rsvp} onValueChange={value => onRsvp(value as CalendarResponse)} />
    </div>}

    {event.conference && <div className={styles.row} data-center="">
      <span className={styles.rowMark}><ConferenceMark conference={event.conference} /></span>
      <span className={styles.conference}>
        <span>{conferenceName(event.conference)}<span className={styles.conferenceUrl}>{event.conference.url}</span></span>
        <CopyButton text={`https://${event.conference.url}`} ariaLabel="Copy meeting link" />
      </span>
    </div>}
    {event.location && !event.conference && <p className={styles.row}><MapPin size={16} strokeWidth={1.75} aria-hidden="true" /><span>{event.location}</span></p>}
    {event.attendees && event.attendees.length > 0 && <div className={styles.row}>
      <Users size={16} strokeWidth={1.75} aria-hidden="true" />
      <div className={styles.people}>
        <span className={styles.peopleCount}>{event.attendees.length + 1} people<span className={styles.muted}>{event.attendees.filter(person => person.status === "yes").length + (event.rsvp === "yes" || !event.rsvp ? 1 : 0)} going</span></span>
        <ul className={styles.attendees}>
          {event.attendees.slice(0, 4).map(person => <li key={person.name} className={styles.attendee}>
            <Faces people={[person]} size={22} max={1} />
            <span className={styles.attendeeName}>{person.name}</span>
            <span className={styles.attendeeStatus} data-status={person === event.organizer ? "yes" : person.status}>{person === event.organizer ? "Organizer" : STATUS_TEXT[person.status ?? "pending"]}</span>
          </li>)}
          {event.attendees.length > 4 && <li className={styles.attendeeMore}>and {event.attendees.length - 4} more</li>}
        </ul>
      </div>
    </div>}
    {event.description && <p className={styles.row}><AlignLeft size={16} strokeWidth={1.75} aria-hidden="true" /><span className={styles.description}>{event.description}</span></p>}

    {readOnly
      ? <p className={styles.row}><Users size={16} strokeWidth={1.75} aria-hidden="true" /><span className={styles.muted}>On {calendarName ?? "a shared"} calendar, view only</span></p>
      : <CalendarPicker calendars={calendars} value={event.calendarId} onChange={onCalendar} />}

    <div className={styles.popFoot}>
      {readOnly ? <span /> : <Button type="button" variant="ghost" size="sm" className={styles.deleteButton} onClick={onDelete}><Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />Delete</Button>}
      <Button type="button" variant="primary" size="sm" className={styles.popButton} onClick={() => { commitTitle(); onClose(); }}>Done</Button>
    </div>
  </div>;
}

export const CalendarList = memo(function CalendarList({ calendars, hidden, onToggle }: { calendars: CalendarSource[]; hidden: ReadonlySet<string>; onToggle: (id: string) => void }) {
  return <ul className={styles.calendarList} aria-label="Calendars">
    {calendars.map(calendar => {
      const on = !hidden.has(calendar.id);
      return <li key={calendar.id}>
        <button type="button" role="checkbox" aria-checked={on} className={styles.calendarItem} style={tint(colorOf(calendar))} onClick={() => onToggle(calendar.id)}>
          <span className={styles.check} aria-hidden="true">{on && <Check size={12} strokeWidth={2.5} />}</span>
          <span className={styles.calendarName}>{calendar.name}</span>
        </button>
      </li>;
    })}
  </ul>;
});

const partsOf = (day: number) => { const d = new Date(day * 86400000); return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 }; };
export const monthOf = (day: number) => { const { year, month } = partsOf(day); return dateDay(year, month, 1); };
export const addCalendarMonths = (first: number, delta: number) => { const { year, month } = partsOf(first); return dateDay(year, month + delta, 1); };

type MiniMonthProps = {
  fmt: CalendarFormat; month: number; weekStartsOn: number; today: number | null; range: readonly number[];
  onMonth: (month: number) => void; onPick: (day: number) => void;
};

/** A small month for jumping to a date. The shown range is a quiet band; today is the accent. */
export const MiniMonth = memo(function MiniMonth({ fmt, month, weekStartsOn, today, range, onMonth, onPick }: MiniMonthProps) {
  const first = startOfWeek(month, weekStartsOn);
  const next = addCalendarMonths(month, 1);
  const weeks = Math.ceil((next - first) / 7);
  const inRange = new Set(range);
  return <div className={styles.mini}>
    <div className={styles.miniHead}>
      <span className={styles.miniTitle}>{fmt.monthYear(month)}</span>
      <span className={styles.miniNav}>
        <Button type="button" variant="ghost" size="sm" className={styles.miniArrow} onClick={() => onMonth(addCalendarMonths(month, -1))} aria-label="Previous month"><ChevronLeft size={16} strokeWidth={1.75} aria-hidden="true" /></Button>
        <Button type="button" variant="ghost" size="sm" className={styles.miniArrow} onClick={() => onMonth(next)} aria-label="Next month"><ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" /></Button>
      </span>
    </div>
    <div className={styles.miniGrid}>
      {Array.from({ length: 7 }, (_, i) => <span key={`h${i}`} className={styles.miniWeekday} aria-hidden="true">{fmt.weekdayNarrow(first + i)}</span>)}
      {Array.from({ length: weeks * 7 }, (_, i) => {
        const day = first + i;
        const outside = day < month || day >= next;
        return <button key={day} type="button" className={styles.miniDay} data-outside={outside || undefined} data-range={inRange.has(day) || undefined}
          data-range-start={inRange.has(day) && !inRange.has(day - 1) || undefined} data-range-end={inRange.has(day) && !inRange.has(day + 1) || undefined}
          data-today={day === today || undefined} aria-current={day === today ? "date" : undefined} aria-label={fmt.longDate(day)} onClick={() => onPick(day)}>
          <span>{fmt.date(day)}</span>
        </button>;
      })}
    </div>
  </div>;
});

/** The undo toast: one line, one action, gone after a few seconds. */
export function CalendarUndoToast({ message, onUndo, onDismiss, reduced }: { message: string; onUndo?: () => void; onDismiss: () => void; reduced: boolean }) {
  useEffect(() => { const id = setTimeout(onDismiss, 6000); return () => clearTimeout(id); }, [onDismiss]);
  return <motion.div className={styles.toast} role="status"
    initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
    exit={reduced ? { opacity: 0 } : { opacity: 0, y: 8, transition: { duration: duration.fast, ease: standardEase } }}
    transition={reduced ? { duration: duration.fast } : motionTokens.spring.smooth}>
    <span className={styles.toastText}>{message}</span>
    {onUndo && <button type="button" className={styles.toastAction} onClick={onUndo}>Undo</button>}
    <button type="button" className={styles.iconButton} data-small="" onClick={onDismiss} aria-label="Dismiss"><X size={16} strokeWidth={1.75} aria-hidden="true" /></button>
  </motion.div>;
}
