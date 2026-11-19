"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "motion/react";
import { CalendarClock, CalendarDays, ChevronLeft, ChevronRight, EyeOff, Inbox, Keyboard, Layers, LogOut, Plus, UserPlus, Users, X } from "lucide-react";
import { ScreenShell, ScreenShellButton, ScreenShellMark, useScreenShell } from "../../screen-shell/screen-shell";
import type { ScreenShellContextValue, ScreenShellSection } from "../../screen-shell/screen-shell";
import { Button } from "../../button/button";
import { Kbd } from "../../kbd/kbd";
import { SearchField } from "../../search-field/search-field";
import { motionTokens } from "../../lib/motion-tokens";
import { samplePeople, sampleCalendars, sampleEvents } from "./month-calendar-data";
import type { CalendarEvent, CalendarPerson, CalendarRsvp, CalendarSource } from "./month-calendar-data";
import { CreatePanel, DayPanel, EventPanel, EventRow } from "./month-calendar-panel";
import { addDays, between, byStart, covers, createKit, cx, lastDay, layoutWeek, clock, shiftMonth, useEdgeFade, weekday } from "./month-calendar-utils";
import type { CalendarKit } from "./month-calendar-utils";
import { InvitationsView, UpcomingView } from "./month-calendar-views";
import styles from "./month-calendar.module.css";

export type { CalendarAttendee, CalendarEvent, CalendarIcon, CalendarPerson, CalendarRsvp, CalendarSource, CalendarVideo } from "./month-calendar-data";

export interface MonthCalendarProps {
  events?: CalendarEvent[];
  calendars?: CalendarSource[];
  /** ISO date treated as today. Defaults to the sample's today. */
  today?: string;
  /** Controlled month as "YYYY-MM". Pair with onMonthChange. */
  month?: string;
  defaultMonth?: string;
  onMonthChange?: (month: string) => void;
  /** 0 for Sunday, 1 for Monday. The account menu can switch it. */
  weekStartsOn?: 0 | 1;
  locale?: string;
  /** Persists a new event. Throw to keep the form open and show the message. */
  onEventCreate?: (event: CalendarEvent) => void | Promise<void>;
  onEventDelete?: (event: CalendarEvent) => void | Promise<void>;
  /** Called after an event is moved, answered or put on another calendar. */
  onEventChange?: (event: CalendarEvent) => void;
  /** People referenced by attendees and organizers, and the team in the sidebar. */
  people?: CalendarPerson[];
  /** The signed in person's id in `people`. */
  userId?: string;
  /** Shows Saturday and Sunday. The account menu can switch it. Default true. */
  showWeekends?: boolean;
  className?: string;
}

type View = "calendar" | "upcoming" | "invites" | `person:${string}`;
type Pane = { mode: "day" } | { mode: "event"; id: string } | { mode: "create"; start: string; end: string };
type Drag =
  | { kind: "range"; anchor: string; current: string }
  | { kind: "move"; id: string; origin: string; over: string; startX: number; startY: number; x: number; y: number; offX: number; offY: number; rootX: number; rootY: number; width: number; active: boolean };
type Toast = { id: number; text: string; undo?: () => void; action?: { label: string; run: () => void } };

const LANE = 21;
const HEAD = 29;
const instant = { duration: 0 };
const easeEnter = [...motionTokens.ease.enter] as [number, number, number, number];
const DEFAULT_TEAM = ["marcus-johnson", "jasmine-brooks", "olivia-bennett", "chloe-nguyen", "daniel-kim"];
const WORKSPACE = "Copperline";

/** Lets the screen reach the shell's panel and size from outside the shell's tree. */
function ShellBridge({ onShell }: { onShell: (shell: ScreenShellContextValue) => void }) {
  const shell = useScreenShell();
  useLayoutEffect(() => { onShell(shell); });
  return null;
}

/**
 * A calendar app's month view inside the Arc screen shell: event chips packed into lanes with +N more, a day panel with
 * free gaps you can turn into focus time, event details with replies and guests, filters by calendar and text, drag to
 * reschedule or to plan across days, invitations, an upcoming list and teammates' calendars.
 */
export function MonthCalendar({
  events: eventsProp = sampleEvents,
  calendars = sampleCalendars,
  today = "2026-11-12",
  month: monthProp,
  defaultMonth,
  onMonthChange,
  weekStartsOn = 1,
  locale = "en-US",
  onEventCreate,
  onEventDelete,
  onEventChange,
  people = samplePeople,
  userId = "emma-collins",
  showWeekends: showWeekendsProp = true,
  className,
}: MonthCalendarProps) {
  const reduced = !!useReducedMotion();
  const uid = useId();
  const kit = useMemo(() => createKit({ locale, today, meId: userId, calendars, people }), [locale, today, userId, calendars, people]);
  const me = kit.person(userId);

  const [events, setEvents] = useState(eventsProp);
  const [monthState, setMonthState] = useState(defaultMonth ?? today.slice(0, 7));
  const month = monthProp ?? monthState;
  const [direction, setDirection] = useState(0);
  const [selected, setSelected] = useState(today);
  const [focusDate, setFocusDate] = useState(today);
  const [pane, setPane] = useState<Pane>({ mode: "day" });
  const [view, setView] = useState<View>("calendar");
  const [hidden, setHidden] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [weekStart, setWeekStart] = useState<0 | 1>(weekStartsOn);
  const [weekends, setWeekends] = useState(showWeekendsProp);
  const [team, setTeam] = useState(() => DEFAULT_TEAM.filter(id => people.some(person => person.id === id)));
  const [workspaceId, setWorkspaceId] = useState("copperline");
  const [signedOut, setSignedOut] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [lanes, setLanes] = useState(4);
  const [rootWidth, setRootWidth] = useState(1440);
  const [pageWidth, setPageWidth] = useState(900);
  const [fresh, setFresh] = useState<string>();
  const [toast, setToast] = useState<Toast | null>(null);
  const [announce, setAnnounce] = useState("");

  const rootRef = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement | null>(null);
  const bridge = useRef<ScreenShellContextValue | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const focusPending = useRef<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchBelowRef = useRef<HTMLInputElement>(null);
  const seq = useRef(0);
  const setBridge = useCallback((shell: ScreenShellContextValue) => { bridge.current = shell; }, []);
  // The month grid is keyed, so the outgoing grid unmounts after the incoming one mounts. Keep the last live node.
  const gridRef = useCallback((node: HTMLDivElement | null) => { if (node) grid.current = node; }, []);
  const [pageNode, setPageNode] = useState<HTMLDivElement | null>(null);

  const docked = rootWidth >= 1080;
  const dots = pageWidth < 560;
  const person = view.startsWith("person:") ? view.slice(7) : null;
  const harbor = workspaceId === "harbor";

  /* Measurement: the root decides docked or sheet panels, the page decides chips or dots. */
  useLayoutEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setRootWidth(entry.contentRect.width));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    if (!pageNode) return;
    const observer = new ResizeObserver(([entry]) => setPageWidth(entry.contentRect.width));
    observer.observe(pageNode);
    return () => observer.disconnect();
  }, [pageNode]);

  /* Derived data */
  const scoped = useMemo(() => events.filter(event => !hidden.includes(event.calendarId) && (!person || event.attendees?.some(attendee => attendee.id === person))), [events, hidden, person]);
  const needle = query.trim().toLowerCase();
  const matches = useCallback((event: CalendarEvent) => !needle || `${event.title} ${event.location ?? ""}`.toLowerCase().includes(needle), [needle]);
  const first = `${month}-01`;
  const offset = (weekday(first) - weekStart + 7) % 7;
  const gridStart = addDays(first, -offset);
  const daysInMonth = between(first, `${shiftMonth(month, 1)}-01`);
  const weeks = useMemo(() => Array.from({ length: Math.ceil((offset + daysInMonth) / 7) }, (_, week) => {
    const all = Array.from({ length: 7 }, (_, day) => addDays(gridStart, week * 7 + day));
    return weekends ? all : all.filter(day => weekday(day) !== 0 && weekday(day) !== 6);
  }), [gridStart, offset, daysInMonth, weekends]);
  const layouts = useMemo(() => weeks.map(days => layoutWeek(days, scoped)), [weeks, scoped]);
  const inMonth = scoped.filter(event => event.start <= `${month}-31` && lastDay(event) >= first);
  const monthMatches = needle ? inMonth.filter(matches).length : inMonth.length;
  const invites = events.filter(event => event.rsvp === "pending").sort(byStart);
  const selectedEvents = scoped.filter(event => covers(event, selected)).sort(byStart);
  const paneEvent = pane.mode === "event" ? events.find(event => event.id === pane.id) : undefined;

  /* Focus after keyboard moves, once the target has rendered. */
  useEffect(() => {
    const target = focusPending.current;
    if (!target) return;
    focusPending.current = null;
    const node = target.startsWith("event:")
      ? rootRef.current?.querySelector<HTMLElement>(`[data-event-id="${target.slice(6)}"]`)
      : grid.current?.querySelector<HTMLElement>(`[data-day-button="${target}"]`);
    node?.focus({ preventScroll: true });
  });

  /* Lanes follow the real row height. */
  useLayoutEffect(() => {
    const body = grid.current;
    if (!body || dots) return;
    const measure = () => {
      const row = body.querySelector<HTMLElement>("[data-week]");
      if (row) setLanes(Math.max(1, Math.floor((row.clientHeight - HEAD - 4) / LANE)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(body);
    return () => observer.disconnect();
  }, [weeks.length, month, dots, view, pageNode]);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  /* Actions */
  const showToast = (next: Omit<Toast, "id">) => {
    window.clearTimeout(toastTimer.current);
    setToast({ ...next, id: ++seq.current });
    setAnnounce(next.text);
    toastTimer.current = window.setTimeout(() => setToast(null), 5000);
  };
  const reveal = () => { const shell = bridge.current; if (shell && !shell.panelOpen) shell.setPanelOpen(true); };
  const setMonth = (next: string, delta: number) => {
    if (next === month) return;
    setDirection(delta);
    if (monthProp === undefined) setMonthState(next);
    onMonthChange?.(next);
  };
  const selectDay = (day: string, open = !docked) => {
    setSelected(day);
    setFocusDate(day);
    setPane({ mode: "day" });
    if (day.slice(0, 7) !== month) setMonth(day.slice(0, 7), day > first ? 1 : -1);
    if (open) reveal();
  };
  const goToday = () => { selectDay(today, false); focusPending.current = null; };
  const openEvent = (event: CalendarEvent, day = covers(event, selected) ? selected : event.start) => {
    setSelected(day);
    setFocusDate(day);
    setPane({ mode: "event", id: event.id });
    reveal();
  };
  const openCreate = (start: string, end = start) => {
    setSelected(start);
    setPane({ mode: "create", start, end });
    reveal();
  };
  const backToDay = () => setPane({ mode: "day" });

  const replace = (id: string, patch: Partial<CalendarEvent>, text?: string) => {
    const before = events;
    const target = events.find(event => event.id === id);
    if (!target) return;
    const next = { ...target, ...patch };
    setEvents(list => list.map(event => event.id === id ? next : event));
    onEventChange?.(next);
    if (text) showToast({ text, undo: () => { setEvents(before); onEventChange?.(target); } });
  };
  const moveEvent = (event: CalendarEvent, days: number) => {
    if (!days) return;
    const start = addDays(event.start, days);
    const end = event.end ? addDays(event.end, days) : undefined;
    replace(event.id, { start, end }, `Moved ${event.title} to ${kit.date(start, "short")}`);
    setFresh(event.id);
    if (pane.mode === "event" && pane.id === event.id) setSelected(start);
  };
  const removeEvent = async (event: CalendarEvent) => {
    const before = events;
    try { await onEventDelete?.(event); } catch { showToast({ text: `Could not delete ${event.title}` }); return; }
    setEvents(list => list.filter(item => item.id !== event.id));
    if (pane.mode === "event" && pane.id === event.id) setPane({ mode: "day" });
    showToast({ text: `Deleted ${event.title}`, undo: () => { setEvents(before); void onEventCreate?.(event); } });
  };
  const createEvent = async (draft: CalendarEvent) => {
    await onEventCreate?.(draft);
    setEvents(list => [...list, draft]);
    setFresh(draft.id);
    setHidden(list => list.filter(id => id !== draft.calendarId));
    setSelected(draft.start);
    setPane({ mode: "event", id: draft.id });
    showToast({ text: `Added ${draft.title} on ${kit.date(draft.start, "short")}` });
  };
  const blockFocus = (day: string, from: number, to: number) => {
    const draft: CalendarEvent = { id: `focus-${++seq.current}`, title: "Focus time", calendarId: calendars[0]?.id ?? "work", start: day, time: clock(from), endTime: clock(to), notes: "Blocked from a free gap. Notifications stay quiet until it ends." };
    setEvents(list => [...list, draft]);
    setFresh(draft.id);
    void onEventCreate?.(draft);
    showToast({ text: `Blocked ${kit.time(draft.time!)} to ${kit.time(draft.endTime!)} for focus`, undo: () => setEvents(list => list.filter(event => event.id !== draft.id)) });
  };
  const reply = (event: CalendarEvent, rsvp: CalendarRsvp) => {
    const label = rsvp === "yes" ? "Accepted" : rsvp === "maybe" ? "Replied maybe to" : "Declined";
    const view = () => { setView("calendar"); selectDay(event.start, false); openEvent(event, event.start); };
    replace(event.id, { rsvp, attendees: event.attendees?.map(attendee => attendee.id === userId ? { ...attendee, status: rsvp } : attendee) });
    showToast({ text: `${label} ${event.title}`, action: rsvp === "no" ? undefined : { label: "View", run: view } });
  };
  const changeCalendar = (event: CalendarEvent, calendarId: string) => {
    if (event.calendarId === calendarId) return;
    replace(event.id, { calendarId });
    setHidden(list => list.filter(id => id !== calendarId));
  };
  const navigate = (id: string) => {
    setView(id as View);
    if (id !== "calendar" && !id.startsWith("person:")) setPane(current => current.mode === "create" ? { mode: "day" } : current);
  };

  /* Grid pointer input: press and drag across days to plan a span; drag a chip to reschedule; a plain press selects. */
  // Chips sit in a layer above the cells, so look through the whole stack under the pointer for the day cell.
  const dateAt = (x: number, y: number) => (document.elementsFromPoint(x, y).find(node => node instanceof HTMLElement && node.dataset.date) as HTMLElement | undefined)?.dataset.date;
  const updateDrag = (next: Drag | null) => { dragRef.current = next; setDrag(next); };
  const onGridDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || dots) return;
    const target = event.target as HTMLElement;
    if (target.closest("[data-more]")) return;
    const chip = target.closest<HTMLElement>("[data-event-id]");
    const day = dateAt(event.clientX, event.clientY);
    if (!day) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (chip) {
      const box = chip.getBoundingClientRect();
      const frame = rootRef.current?.getBoundingClientRect();
      updateDrag({ kind: "move", id: chip.dataset.eventId!, origin: day, over: day, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, offX: event.clientX - box.left, offY: event.clientY - box.top, rootX: frame?.left ?? 0, rootY: frame?.top ?? 0, width: box.width, active: false });
    } else updateDrag({ kind: "range", anchor: day, current: day });
  };
  const onGridMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = dragRef.current;
    if (!current) return;
    if (current.kind === "range") {
      const day = dateAt(event.clientX, event.clientY);
      if (day && day !== current.current) updateDrag({ ...current, current: day });
      return;
    }
    const active = current.active || Math.hypot(event.clientX - current.startX, event.clientY - current.startY) > 4;
    const day = active ? dateAt(event.clientX, event.clientY) ?? current.over : current.over;
    updateDrag({ ...current, x: event.clientX, y: event.clientY, active, over: day });
  };
  const onGridUp = () => {
    const current = dragRef.current;
    updateDrag(null);
    if (!current) return;
    if (current.kind === "range") {
      const [start, end] = [current.anchor, current.current].sort();
      if (start === end) selectDay(start);
      else openCreate(start, end);
      return;
    }
    const target = events.find(event => event.id === current.id);
    if (!target) return;
    if (!current.active) openEvent(target, current.origin);
    else moveEvent(target, between(current.origin, current.over));
  };
  const onGridCancel = () => updateDrag(null);

  const onDayKey = (event: ReactKeyboardEvent<HTMLButtonElement>, day: string) => {
    const width = weeks[0].length;
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (event.key in moves) {
      event.preventDefault();
      let next = addDays(day, moves[event.key]);
      if (width === 5) while (weekday(next) === 0 || weekday(next) === 6) next = addDays(next, Math.sign(moves[event.key]));
      focusPending.current = next;
      setFocusDate(next);
      if (next.slice(0, 7) !== month) setMonth(next.slice(0, 7), next > day ? 1 : -1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectDay(day);
    } else if (event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault();
      const delta = event.key === "PageDown" ? 1 : -1;
      const target = shiftMonth(month, delta);
      const candidate = `${target}-${day.slice(8)}`;
      const next = candidate.slice(0, 7) === target && !Number.isNaN(Date.parse(candidate)) && addDays(candidate, 0).slice(0, 7) === target ? candidate : `${target}-01`;
      focusPending.current = next;
      setFocusDate(next);
      setMonth(target, delta);
    }
  };
  const onChipKey = (keyEvent: ReactKeyboardEvent<HTMLButtonElement>, event: CalendarEvent) => {
    if (keyEvent.altKey && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(keyEvent.key)) {
      keyEvent.preventDefault();
      const days = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[keyEvent.key as "ArrowLeft"];
      focusPending.current = `event:${event.id}`;
      moveEvent(event, days);
      const start = addDays(event.start, days);
      if (start.slice(0, 7) !== month) setMonth(start.slice(0, 7), days > 0 ? 1 : -1);
    } else if (keyEvent.key === "Delete" || keyEvent.key === "Backspace") {
      keyEvent.preventDefault();
      void removeEvent(event);
    }
  };

  /* Screen shortcuts, ignored while typing. */
  const onRootKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (event.metaKey || event.ctrlKey || event.altKey || target.closest("input, textarea, select, [contenteditable]") || signedOut || harbor) return;
    if (event.key === "Escape" && shortcuts) { setShortcuts(false); return; }
    if (event.key === "Escape" && pane.mode !== "day") { event.preventDefault(); backToDay(); return; }
    if (event.key === "t" || event.key === "T") { event.preventDefault(); goToday(); }
    else if (event.key === "n" || event.key === "N") { event.preventDefault(); openCreate(selected); }
    else if (event.key === "/") { event.preventDefault(); [searchRef.current, searchBelowRef.current].find(node => node?.getClientRects().length)?.focus(); }
    else if (event.key === "?") { event.preventDefault(); setShortcuts(true); }
  };

  /* Drag highlight: where the moved event would land. */
  const dropRange = drag?.kind === "move" && drag.active ? (() => {
    const target = events.find(event => event.id === drag.id);
    if (!target) return null;
    const start = addDays(target.start, between(drag.origin, drag.over));
    return [start, addDays(start, between(target.start, lastDay(target)))] as const;
  })() : null;
  const range = drag?.kind === "range" ? [drag.anchor, drag.current].sort() : pane.mode === "create" ? [pane.start, pane.end] : null;
  const dragEvent = drag?.kind === "move" && drag.active ? events.find(event => event.id === drag.id) : undefined;

  /* ------------------------------------------------------------------------------------------------ Page parts */

  const weekdays = weeks[0].map(day => ({ day, short: kit.date(day, "weekday"), narrow: kit.date(day, "narrowDay") }));

  const chip = (segment: ReturnType<typeof layoutWeek>["segments"][number], days: string[]) => {
    const event = segment.event;
    const bar = !event.time || segment.from !== segment.to || segment.clipStart || segment.clipEnd;
    const isOpen = pane.mode === "event" && pane.id === event.id;
    const dragging = drag?.kind === "move" && drag.active && drag.id === event.id;
    // Opacity lives in Motion, not CSS, because Motion owns the chip's inline opacity for its fade in.
    const opacity = dragging ? .35 : matches(event) ? 1 : .28;
    return <motion.button key={`${event.id}-${days[0]}-${event.start}`} type="button" data-event-id={event.id} className={styles.chip}
      data-bar={bar || undefined} data-clip-start={segment.clipStart || undefined} data-clip-end={segment.clipEnd || undefined}
      data-open={isOpen || undefined} data-dim={!matches(event) || undefined} data-pending={event.rsvp === "pending" || undefined} data-declined={event.rsvp === "no" || undefined}
      data-dragging={dragging || undefined}
      style={{ gridColumn: `${segment.from + 1} / ${segment.to + 2}`, gridRow: segment.lane + 1, "--event": kit.colorOf(event) } as CSSProperties}
      layout={reduced || drag ? false : "position"}
      initial={event.id === fresh && !reduced ? { opacity: 0 } : false} animate={{ opacity }} exit={{ opacity: 0, transition: reduced ? instant : { duration: motionTokens.duration.exit } }}
      transition={reduced ? instant : { layout: motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.fast } }}
      aria-label={`${event.title}, ${kit.span(event)}${event.rsvp === "pending" ? ", awaiting your reply" : event.rsvp === "no" ? ", declined" : ""}`}
      aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight Alt+ArrowUp Alt+ArrowDown Delete"
      onClick={click => { if (click.detail === 0) openEvent(event, days[segment.from]); }} onKeyDown={keyEvent => onChipKey(keyEvent, event)}>
      {!bar && event.time && <span className={styles.chipTime}>{kit.shortTime(event.time)}</span>}
      <span className={styles.chipTitle}>{event.title}</span>
    </motion.button>;
  };

  const monthGrid = <motion.div key={`${month}-${weekStart}-${weekends}`} ref={gridRef} className={styles.grid} role="grid" aria-label={kit.date(first, "month")} data-dots={dots || undefined}
    style={{ gridTemplateRows: dots ? undefined : `repeat(${weeks.length}, minmax(0, 1fr))`, "--cols": weeks[0].length } as CSSProperties}
    onPointerDown={onGridDown} onPointerMove={onGridMove} onPointerUp={onGridUp} onPointerCancel={onGridCancel} onLostPointerCapture={onGridCancel}
    onDoubleClick={event => { if (dots || (event.target as HTMLElement).closest("[data-event-id], [data-more]")) return; const day = dateAt(event.clientX, event.clientY); if (day) openCreate(day); }}
    initial={reduced || !direction ? { opacity: 0 } : { opacity: 0, x: direction * 12 }} animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, transition: reduced ? instant : { duration: motionTokens.duration.exit } }}
    transition={reduced ? instant : { duration: motionTokens.duration.standard, ease: easeEnter }}>
    {weeks.map((days, week) => {
      const { segments, perDay } = layouts[week];
      const overflow = perDay.map(list => list.length > lanes);
      const fits = (segment: (typeof segments)[number]) => segment.lane < (overflow.slice(segment.from, segment.to + 1).some(Boolean) ? lanes - 1 : lanes);
      return <div key={days[0]} className={styles.week} role="row" data-week="">
        {days.map((day, col) => {
          const count = perDay[col].length;
          const picked = range ? day >= range[0] && day <= range[1] : false;
          const dropping = dropRange ? day >= dropRange[0] && day <= dropRange[1] : false;
          return <div key={day} className={styles.cell} role="gridcell" data-date={day} data-outside={day.slice(0, 7) !== month || undefined} data-weekend={weekday(day) === 0 || weekday(day) === 6 || undefined}
            data-selected={day === selected || undefined} data-range={picked || dropping || undefined} aria-selected={day === selected}>
            <button type="button" className={styles.dayNumber} data-day-button={day} data-today={day === today || undefined} tabIndex={day === focusDate ? 0 : -1}
              aria-label={`${kit.date(day, "long")}${day === today ? ", today" : ""}, ${count ? `${count} ${count === 1 ? "event" : "events"}` : "no events"}`}
              onKeyDown={event => onDayKey(event, day)} onFocus={() => setFocusDate(day)} onClick={event => { if (event.detail === 0 || dots) selectDay(day, !dots && !docked); }}>{+day.slice(8)}</button>
            {/* On phones a day carries a small load meter: one tick per event, up to four. Colour stays on the list below. */}
            {dots && count > 0 && <span className={styles.load} aria-hidden="true">{Array.from({ length: Math.min(count, 4) }, (_, index) => <i key={index} />)}</span>}
          </div>;
        })}
        {!dots && <div className={styles.lanes} style={{ gridTemplateRows: `repeat(${lanes}, ${LANE}px)` }}>
          <AnimatePresence initial={false}>
            {segments.filter(fits).map(segment => chip(segment, days))}
            {days.map((day, col) => {
              const more = perDay[col].length - segments.filter(segment => segment.from <= col && segment.to >= col && fits(segment)).length;
              return more > 0 && <motion.button key={`more-${day}`} type="button" data-more="" className={styles.more} style={{ gridColumn: col + 1, gridRow: lanes }}
                initial={false} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: instant }} aria-label={`${more} more ${more === 1 ? "event" : "events"} on ${kit.date(day, "long")}`}
                onClick={() => selectDay(day, true)}>{more} more</motion.button>;
            })}
          </AnimatePresence>
        </div>}
      </div>;
    })}
  </motion.div>;

  const phoneAgenda = dots && <section className={styles.phoneDay} aria-label={`Schedule for ${kit.date(selected, "long")}`}>
    <div className={styles.phoneDayHead}>
      <h3 className={styles.phoneDayTitle}>{selected === today ? "Today" : kit.date(selected, "long")}</h3>
      <Button variant="secondary" size="sm" onClick={() => openCreate(selected)}><Plus size={16} strokeWidth={1.75} aria-hidden="true" />Add</Button>
    </div>
    {selectedEvents.length
      ? <ul className={styles.rows}>{selectedEvents.map(event => <li key={event.id}><EventRow kit={kit} event={event} dim={!matches(event)} onOpen={(item) => openEvent(item, selected)} /></li>)}</ul>
      : <p className={styles.phoneEmpty}>Nothing scheduled. Tap Add to plan something.</p>}
  </section>;

  const calendarPage = <div ref={setPageNode} className={styles.page} data-dots={dots || undefined}>
    <PhoneScroll enabled={dots}>
      <div className={styles.weekdays} aria-hidden="true" style={{ "--cols": weeks[0].length } as CSSProperties}>
        {weekdays.map(day => <span key={day.day} data-weekend={weekday(day.day) === 0 || weekday(day.day) === 6 || undefined}><span className={styles.long}>{day.short}</span><span className={styles.narrow}>{day.narrow}</span></span>)}
      </div>
      <div className={styles.gridWrap}>
        <AnimatePresence mode="popLayout" initial={false}>{monthGrid}</AnimatePresence>
      </div>
      {phoneAgenda}
    </PhoneScroll>
  </div>;

  const notice = signedOut
    ? <div className={styles.notice}><p className={styles.noticeTitle}>You signed out of {WORKSPACE}</p><p className={styles.noticeBody}>This is a local preview, so nothing left this page.</p><Button variant="secondary" size="sm" onClick={() => setSignedOut(false)}>Sign back in</Button></div>
    : harbor ? <div className={styles.notice}><p className={styles.noticeTitle}>Copperline Labs has no shared calendars yet</p><p className={styles.noticeBody}>Calendars your team shares here show up in the sidebar.</p><Button variant="secondary" size="sm" onClick={() => setWorkspaceId("copperline")}>Back to {WORKSPACE}</Button></div> : null;

  const page = notice ?? (view === "upcoming"
    ? <UpcomingView kit={kit} events={scoped} matches={matches} filtered={hidden.length > 0 || !!needle} onOpen={event => openEvent(event, covers(event, today) ? today : event.start)} onClear={() => { setHidden([]); setQuery(""); }} />
    : view === "invites"
      ? <InvitationsView kit={kit} invites={invites} onReply={reply} onView={event => { setView("calendar"); selectDay(event.start, false); openEvent(event, event.start); }} onBack={() => setView("calendar")} />
      : calendarPage);

  /* ------------------------------------------------------------------------------------------------ Shell config */

  const calendarCounts = new Map(calendars.map(calendar => [calendar.id, events.filter(event => event.calendarId === calendar.id && event.start <= `${month}-31` && lastDay(event) >= first && (!person || event.attendees?.some(attendee => attendee.id === person))).length]));
  const searchable = view !== "invites" && !notice;
  const solo = calendars.length > 1 && hidden.length === calendars.length - 1 ? calendars.find(calendar => !hidden.includes(calendar.id))?.id : undefined;

  const sections: ScreenShellSection[] = [{
    id: "mine", label: "My calendars", icon: Layers, items: [],
    content: <CalendarList kit={kit} hidden={hidden} counts={calendarCounts} solo={solo}
      onToggle={id => setHidden(list => list.includes(id) ? list.filter(item => item !== id) : [...list, id])}
      onSolo={id => setHidden(solo === id ? [] : calendars.filter(calendar => calendar.id !== id).map(calendar => calendar.id))} />,
  }, {
    id: "team", label: "Team calendars", icon: Users,
    action: { label: "Add a teammate", icon: UserPlus, onSelect: () => {
      const next = people.find(item => item.id !== userId && !team.includes(item.id));
      if (next) { setTeam(list => [...list, next.id]); showToast({ text: `Added ${next.name}'s calendar`, action: { label: "Open", run: () => setView(`person:${next.id}`) } }); }
      else showToast({ text: "Everyone on the team is already here" });
    } },
    items: team.map(id => { const item = kit.person(id); return { id: `person:${id}`, label: item.name, avatar: item.avatar }; }),
  }];

  const title = notice ? (harbor ? "Copperline Labs" : WORKSPACE)
    : view === "upcoming" ? "Upcoming" : view === "invites" ? "Invitations"
    : <MonthTitle kit={kit} month={month} direction={direction} reduced={reduced} />;
  const personName = person ? kit.person(person).name : null;
  const meta = notice ? undefined
    : view === "upcoming" ? "Next four weeks"
    : view === "invites" ? (invites.length ? `${invites.length} waiting for a reply` : "All caught up")
    : needle ? `${monthMatches} of ${inMonth.length} match` : `${inMonth.length} events`;

  const panelContent = <div className={styles.paneStack}>
    <AnimatePresence initial={false}>
      <motion.div key={pane.mode === "day" || (pane.mode === "event" && !paneEvent) ? "day" : pane.mode === "event" ? `event-${pane.id}` : `create-${pane.start}-${pane.end}`} className={styles.paneLayer}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: reduced ? instant : { duration: motionTokens.duration.exit } }} transition={reduced ? instant : { duration: motionTokens.duration.standard }}>
        {pane.mode === "create"
          ? <CreatePanel kit={kit} start={pane.start} end={pane.end} onCancel={backToDay} onSave={createEvent} />
          : pane.mode === "event" && paneEvent
            ? <EventPanel kit={kit} event={paneEvent} backLabel={kit.date(selected, "short")} onBack={backToDay} onDelete={event => void removeEvent(event)} onRsvp={reply} onCalendar={changeCalendar} />
            : <DayPanel kit={kit} day={selected} events={selectedEvents} matches={matches} onOpen={event => openEvent(event, selected)} onCreate={day => openCreate(day)} onBlock={blockFocus} />}
      </motion.div>
    </AnimatePresence>
  </div>;

  return <MotionConfig reducedMotion="user">
    <div ref={rootRef} className={cx(styles.root, className)} onKeyDown={onRootKey} data-dragging={drag?.kind === "move" && drag.active || undefined}>
      <ScreenShell
        aria-label={`${WORKSPACE} calendar`}
        workspace={{
          name: WORKSPACE,
          activeId: workspaceId,
          onSelect: id => { setWorkspaceId(id); setPane({ mode: "day" }); },
          options: [
            { id: "copperline", name: WORKSPACE, detail: "Team plan · 18 members", mark: <ScreenShellMark name={WORKSPACE} variant="pocket" tone="rose" size={24} /> },
            { id: "harbor", name: "Copperline Labs", detail: "Free plan · 3 members", mark: <ScreenShellMark name="Copperline Labs" variant="modules" tone="sky" size={24} /> },
          ],
        }}
        nav={[
          { id: "calendar", label: "Calendar", icon: CalendarDays },
          { id: "upcoming", label: "Upcoming", icon: CalendarClock },
          { id: "invites", label: "Invitations", icon: Inbox, count: invites.length || undefined },
        ]}
        sections={sections}
        activeId={view}
        onNavigate={id => navigate(id)}
        account={{
          name: me.name, detail: me.email, avatar: me.avatar,
          menu: [
            { id: "monday", label: "Start weeks on Monday", checked: weekStart === 1, onSelect: () => setWeekStart(value => value === 1 ? 0 : 1) },
            { id: "weekends", label: "Show weekends", checked: weekends, onSelect: () => setWeekends(value => !value) },
            { id: "shortcuts", label: "Keyboard shortcuts", icon: Keyboard, shortcut: "?", separatorBefore: true, onSelect: () => setShortcuts(true) },
            { id: "signout", label: "Sign out", icon: LogOut, danger: true, separatorBefore: true, onSelect: () => { setSignedOut(true); setPane({ mode: "day" }); } },
          ],
        }}
        header={{
          breadcrumbs: notice ? undefined : person ? [{ id: "team", label: "Team calendars" }, { id: "person", label: personName!, onSelect: () => setView("calendar") }] : view === "calendar" ? [{ id: "calendar", label: "Calendar" }] : undefined,
          title,
          meta,
          actions: notice ? undefined : <HeaderActions view={view} onToday={goToday} onPrev={() => setMonth(shiftMonth(month, -1), -1)} onNext={() => setMonth(shiftMonth(month, 1), 1)} onNew={() => openCreate(selected)}
            search={searchable ? <FilterSearch ref={searchRef} className={styles.searchInline} query={query} onQuery={setQuery} /> : null} />,
          // Narrow main areas move the filter under the bar; wide ones keep it in the actions. CSS picks one by the main width.
          below: searchable ? <FilterSearch ref={searchBelowRef} className={styles.searchBelow} query={query} onQuery={setQuery} /> : undefined,
        }}
        rightPanel={notice ? undefined : { label: "Day", content: panelContent, defaultWidth: 340, minWidth: 300, maxWidth: 460 }}
        scroll={false}
        padding="none"
      >
        <ShellBridge onShell={setBridge} />
        {page}
      </ScreenShell>

      {/* The chip being dragged follows the pointer; the original stays faint in place. */}
      {dragEvent && drag?.kind === "move" && (() => {
        return <div className={styles.ghost} data-bar={!dragEvent.time || lastDay(dragEvent) !== dragEvent.start || undefined}
          style={{ left: drag.x - drag.rootX - drag.offX, top: drag.y - drag.rootY - drag.offY, width: Math.min(drag.width, 240), "--event": kit.colorOf(dragEvent) } as CSSProperties} aria-hidden="true">
          {dragEvent.time && lastDay(dragEvent) === dragEvent.start && <span className={styles.chipTime}>{kit.shortTime(dragEvent.time)}</span>}
          <span className={styles.chipTitle}>{dragEvent.title}</span>
        </div>;
      })()}

      <AnimatePresence>
        {toast && <motion.div key={toast.id} className={styles.toast} role="status"
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduced ? 0 : 4, transition: reduced ? instant : { duration: motionTokens.duration.exit } }}
          transition={reduced ? instant : { duration: motionTokens.duration.standard, ease: easeEnter }}>
          <span className={styles.toastText}>{toast.text}</span>
          {toast.undo && <button type="button" className={styles.toastAction} onClick={() => { toast.undo?.(); setToast(null); setAnnounce("Undone"); }}>Undo</button>}
          {toast.action && <button type="button" className={styles.toastAction} onClick={() => { toast.action?.run(); setToast(null); }}>{toast.action.label}</button>}
          <button type="button" className={styles.toastClose} aria-label="Dismiss" onClick={() => setToast(null)}><X size={16} strokeWidth={1.75} aria-hidden="true" /></button>
        </motion.div>}
      </AnimatePresence>

      <AnimatePresence>{shortcuts && <Shortcuts key="shortcuts" id={uid} onClose={() => setShortcuts(false)} />}</AnimatePresence>
      <p className={styles.srOnly} aria-live="polite">{announce}</p>
    </div>
  </MotionConfig>;
}

/* ------------------------------------------------------------------------------------------------------------------
 * Header, filters and small parts
 * ---------------------------------------------------------------------------------------------------------------- */

function MonthTitle({ kit, month, direction, reduced }: { kit: CalendarKit; month: string; direction: number; reduced: boolean }) {
  return <span className={styles.monthTitle}>
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span key={month} initial={reduced ? { opacity: 0 } : { opacity: 0, y: direction * 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: reduced ? instant : { duration: motionTokens.duration.exit } }}
        transition={reduced ? instant : { duration: motionTokens.duration.standard, ease: easeEnter }}>
        <span className={styles.long}>{kit.date(`${month}-01`, "month")}</span><span className={styles.narrow}>{kit.date(`${month}-01`, "monthShort")}</span>
      </motion.span>
    </AnimatePresence>
  </span>;
}

/** Header actions read the shell's size, so phones keep only icons. */
function HeaderActions({ view, search, onToday, onPrev, onNext, onNew }: { view: View; search: ReactNode; onToday: () => void; onPrev: () => void; onNext: () => void; onNew: () => void }) {
  const { size } = useScreenShell();
  const phone = size === "phone";
  const month = view === "calendar" || view.startsWith("person:");
  return <>
    {search}
    {month && !phone && <ScreenShellButton variant="secondary" onClick={onToday} aria-keyshortcuts="T">Today</ScreenShellButton>}
    {month && <span className={styles.arrows}>
      <ScreenShellButton variant="ghost" icon={ChevronLeft} iconOnly aria-label="Previous month" onClick={onPrev} />
      <ScreenShellButton variant="ghost" icon={ChevronRight} iconOnly aria-label="Next month" onClick={onNext} />
    </span>}
    <ScreenShellButton variant="primary" icon={Plus} iconOnly={phone} aria-label={phone ? "New event" : undefined} aria-keyshortcuts="N" onClick={onNew}>{phone ? null : "New event"}</ScreenShellButton>
  </>;
}

/** Arc's search field, sized to the header: filters the month, Upcoming and the day panel by title or place. */
function FilterSearch({ ref, className, query, onQuery }: { ref: { current: HTMLInputElement | null }; className: string; query: string; onQuery: (value: string) => void }) {
  return <div className={cx(styles.search, className)}>
    <SearchField ref={ref} label="Filter events" placeholder="Filter events" value={query} onValueChange={onQuery} aria-keyshortcuts="/" autoComplete="off" spellCheck={false}
      onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); if (query) onQuery(""); else event.currentTarget.blur(); } }} />
  </div>;
}

/**
 * The sidebar's own section: each calendar with its icon in its colour, how many events it has this month, and a
 * toggle to show or hide it. Hovering a row offers "Only" to show that calendar alone, and "All" to undo it.
 */
function CalendarList({ kit, hidden, counts, solo, onToggle, onSolo }: {
  kit: CalendarKit; hidden: string[]; counts: Map<string, number>; solo?: string; onToggle: (id: string) => void; onSolo: (id: string) => void;
}) {
  return <ul className={styles.calList} role="list">
    {kit.calendars.map(calendar => {
      const on = !hidden.includes(calendar.id);
      const Icon = kit.iconOf(calendar.id);
      const count = counts.get(calendar.id) ?? 0;
      return <li key={calendar.id} className={styles.calRow} data-off={!on || undefined}>
        <button type="button" className={styles.calToggle} aria-pressed={on} aria-label={`${calendar.name}, ${count} ${count === 1 ? "event" : "events"} this month`} style={{ "--event": calendar.color } as CSSProperties} onClick={() => onToggle(calendar.id)}>
          <Icon size={16} strokeWidth={1.75} className={styles.calIcon} aria-hidden="true" />
          <span className={styles.calName}>{calendar.name}</span>
          <span className={styles.calCount} aria-hidden="true">{on ? count : <EyeOff size={16} strokeWidth={1.75} />}</span>
        </button>
        <button type="button" className={styles.calOnly} aria-label={solo === calendar.id ? "Show all calendars" : `Show only ${calendar.name}`} onClick={() => onSolo(calendar.id)}>{solo === calendar.id ? "All" : "Only"}</button>
      </li>;
    })}
  </ul>;
}

/** On phones the month and the day's list scroll together; wider, the grid fills the height and nothing scrolls. */
function PhoneScroll({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const ref = useEdgeFade<HTMLDivElement>();
  return <div ref={ref} className={styles.pageScroll} data-fade={enabled ? "y" : undefined} data-scroll={enabled || undefined}>{children}</div>;
}

const shortcutList: [string, string][] = [
  ["Arrow keys", "Move between days"], ["Enter", "Open the focused day"], ["Page up, Page down", "Previous or next month"], ["T", "Jump to today"], ["N", "New event on the selected day"],
  ["/", "Filter events"], ["Alt and arrows", "Move the focused event"], ["Delete", "Delete the focused event"], ["Escape", "Back to the day"], ["⌘K", "Search the sidebar"],
];

function Shortcuts({ id, onClose }: { id: string; onClose: () => void }) {
  const reduced = useReducedMotion();
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    close.current?.focus({ preventScroll: true });
    return () => back?.focus?.({ preventScroll: true });
  }, []);
  return <motion.div className={styles.dialogLayer} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: reduced ? 0 : motionTokens.duration.exit } }} transition={{ duration: reduced ? 0 : motionTokens.duration.fast }}
    onPointerDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <motion.div role="dialog" aria-modal="true" aria-labelledby={`${id}-keys`} className={styles.dialog} initial={reduced ? false : { y: 6 }} animate={{ y: 0 }} transition={reduced ? instant : { duration: motionTokens.duration.standard, ease: easeEnter }}
      onKeyDown={event => { if (event.key === "Escape" || event.key === "Tab") { event.preventDefault(); event.stopPropagation(); if (event.key === "Escape") onClose(); } }}>
      <div className={styles.dialogHead}>
        <h3 id={`${id}-keys`} className={styles.paneTitle}>Keyboard shortcuts</h3>
        <Button ref={close} variant="ghost" size="sm" className={styles.iconAction} aria-label="Close" onClick={onClose}><X size={16} strokeWidth={1.75} aria-hidden="true" /></Button>
      </div>
      <dl className={styles.keys}>{shortcutList.map(([keys, label]) => <div key={keys} className={styles.keyRow}><dt>{label}</dt><dd><Kbd size="sm">{keys}</Kbd></dd></div>)}</dl>
    </motion.div>
  </motion.div>;
}

export default MonthCalendar;
