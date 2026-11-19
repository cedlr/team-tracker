import { useEffect, useRef } from "react";
import { CalendarDays } from "lucide-react";
import type { CalendarEvent, CalendarIcon, CalendarPerson, CalendarRsvp, CalendarSource } from "./month-calendar-data";

/* Dates are ISO strings ("2026-11-12") handled in UTC, so no time zone can move a day. */

const DAY = 86_400_000;
export const parse = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
export const toIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (iso: string, days: number) => toIso(parse(iso) + days * DAY);
export const between = (from: string, to: string) => Math.round((parse(to) - parse(from)) / DAY);
export const weekday = (iso: string) => new Date(parse(iso)).getUTCDay();
export const lastDay = (event: CalendarEvent) => event.end && event.end > event.start ? event.end : event.start;
export const covers = (event: CalendarEvent, day: string) => event.start <= day && lastDay(event) >= day;
export const shiftMonth = (month: string, delta: number) => toIso(Date.UTC(+month.slice(0, 4), +month.slice(5, 7) - 1 + delta, 1)).slice(0, 7);
export const minutes = (value: string) => { const [h, m] = value.split(":").map(Number); return h * 60 + m; };
export const clock = (total: number) => `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
/** End time of a timed event; an hour after the start when the event has none. */
export const endOf = (event: CalendarEvent) => event.endTime ?? (event.time ? clock(Math.min(minutes(event.time) + 60, 23 * 60 + 59)) : undefined);
export const duration = (event: CalendarEvent) => event.time ? Math.max(0, minutes(endOf(event)!) - minutes(event.time)) : 0;
export const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");

export function byStart(a: CalendarEvent, b: CalendarEvent) {
  return a.start.localeCompare(b.start) || between(b.start, lastDay(b)) - between(a.start, lastDay(a)) || (a.time ? 1 : 0) - (b.time ? 1 : 0) || (a.time ?? "").localeCompare(b.time ?? "") || a.title.localeCompare(b.title);
}

export type Segment = { event: CalendarEvent; lane: number; from: number; to: number; clipStart: boolean; clipEnd: boolean };

/**
 * Packs a week's events into lanes: earlier and longer spans first, each in the lowest lane free across all of its days.
 * `days` are the visible columns, so hiding weekends simply leaves those dates out.
 */
export function layoutWeek(days: string[], events: CalendarEvent[]) {
  const first = days[0], last = days[days.length - 1];
  const placed = events.flatMap(event => {
    if (event.start > last || lastDay(event) < first) return [];
    const from = days.findIndex(day => day >= event.start);
    let to = -1;
    for (let index = days.length - 1; index >= 0; index--) if (days[index] <= lastDay(event)) { to = index; break; }
    return from === -1 || to < from ? [] : [{ event, from, to }];
  }).sort((a, b) => a.from - b.from || (b.to - b.from) - (a.to - a.from) || byStart(a.event, b.event));
  const taken: boolean[][] = [];
  const segments: Segment[] = placed.map(({ event, from, to }) => {
    let lane = 0;
    while (taken[lane]?.slice(from, to + 1).some(Boolean)) lane++;
    taken[lane] ??= Array(days.length).fill(false);
    for (let col = from; col <= to; col++) taken[lane][col] = true;
    return { event, lane, from, to, clipStart: event.start < days[from], clipEnd: lastDay(event) > days[to] };
  });
  const perDay = days.map((_, col) => segments.filter(segment => segment.from <= col && segment.to >= col).map(segment => segment.event).sort(byStart));
  return { segments, perDay };
}

/** Marks a scroller's cut edges with data-fade-top and data-fade-bottom (or left and right), without re-rendering. */
export function useEdgeFade<T extends HTMLElement>(axis: "y" | "x" = "y") {
  const ref = useRef<T>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => {
      if (axis === "y") {
        element.toggleAttribute("data-fade-start", element.scrollTop > 1);
        element.toggleAttribute("data-fade-end", element.scrollTop + element.clientHeight < element.scrollHeight - 1);
      } else {
        element.toggleAttribute("data-fade-start", element.scrollLeft > 1);
        element.toggleAttribute("data-fade-end", element.scrollLeft + element.clientWidth < element.scrollWidth - 1);
      }
    };
    update();
    element.addEventListener("scroll", update, { passive: true });
    const resize = new ResizeObserver(update);
    resize.observe(element);
    const mutations = new MutationObserver(update);
    mutations.observe(element, { childList: true, subtree: true });
    return () => { element.removeEventListener("scroll", update); resize.disconnect(); mutations.disconnect(); };
  }, [axis]);
  return ref;
}

export type DateFormat = "month" | "monthShort" | "weekday" | "narrowDay" | "long" | "short" | "day" | "weekdayLong";

/** Everything the screen's parts share: formatting, lookups and the current user. */
export interface CalendarKit {
  today: string;
  meId: string;
  date: (iso: string, format: DateFormat) => string;
  time: (value: string) => string;
  /** A tight time for chips in narrow cells: "9:30a" in English locales. */
  shortTime: (value: string) => string;
  span: (event: CalendarEvent) => string;
  calendar: (id: string) => CalendarSource | undefined;
  colorOf: (event: CalendarEvent) => string;
  /** The calendar's own icon, drawn in its color wherever its events appear. */
  iconOf: (calendarId: string) => CalendarIcon;
  person: (id: string) => CalendarPerson;
  calendars: CalendarSource[];
  people: CalendarPerson[];
}

export function createKit({ locale, today, meId, calendars, people }: { locale: string; today: string; meId: string; calendars: CalendarSource[]; people: CalendarPerson[] }): CalendarKit {
  const formats: Record<DateFormat, Intl.DateTimeFormat> = {
    month: new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }),
    monthShort: new Intl.DateTimeFormat(locale, { month: "short", year: "numeric", timeZone: "UTC" }),
    weekday: new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }),
    weekdayLong: new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }),
    narrowDay: new Intl.DateTimeFormat(locale, { weekday: "narrow", timeZone: "UTC" }),
    long: new Intl.DateTimeFormat(locale, { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }),
    short: new Intl.DateTimeFormat(locale, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }),
    day: new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: "UTC" }),
  };
  const timeFormat = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
  const date = (iso: string, format: DateFormat) => formats[format].format(new Date(parse(iso)));
  const time = (value: string) => { const total = minutes(value); return timeFormat.format(Date.UTC(2026, 0, 1, Math.floor(total / 60), total % 60)); };
  const english = locale.startsWith("en");
  const shortTime = (value: string) => english ? time(value).replace(":00", "").replace(/\s?AM$/, "a").replace(/\s?PM$/, "p") : time(value);
  const calendarMap = new Map(calendars.map(item => [item.id, item]));
  const peopleMap = new Map(people.map(item => [item.id, item]));
  const span = (event: CalendarEvent) => {
    const end = lastDay(event);
    const days = end !== event.start ? `${date(event.start, "day")} to ${date(end, "day")}` : date(event.start, "short");
    return event.time ? `${days}, ${time(event.time)} to ${time(endOf(event)!)}` : `${days}, all day`;
  };
  return {
    today, meId, date, time, shortTime, span, calendars, people,
    calendar: id => calendarMap.get(id),
    colorOf: event => calendarMap.get(event.calendarId)?.color ?? "var(--text-muted)",
    iconOf: id => calendarMap.get(id)?.icon ?? CalendarDays,
    person: id => peopleMap.get(id) ?? { id, name: id.split("-").map(part => part[0]?.toUpperCase() + part.slice(1)).join(" ") },
  };
}

export const rsvpLabel: Record<CalendarRsvp, string> = { yes: "Going", maybe: "Maybe", no: "Declined", pending: "Awaiting reply" };

/** Minutes booked on a day by timed events the user has not declined. */
export function bookedMinutes(events: CalendarEvent[]) {
  return events.filter(event => event.time && event.rsvp !== "no" && event.rsvp !== "pending").reduce((sum, event) => sum + duration(event), 0);
}

export function formatDuration(total: number) {
  const h = Math.floor(total / 60), m = total % 60;
  return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`;
}
