import { parseISO } from "date-fns";

/** The app's default clock. Malaysia has no daylight saving, so a fixed offset is enough for "today". */
export const APP_TIME_ZONE = "Asia/Kuala_Lumpur";

/** Current epoch ms. Kept out of render so the page can pass one clock into client components. */
export function nowMs() {
  return Date.now();
}

/** Calendar date `yyyy-MM-dd` in a time zone. */
export function zonedISODate(date = new Date(), timeZone = APP_TIME_ZONE) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** Hour and minute in a time zone, 24 hour clock. */
export function zonedClock(date = new Date(), timeZone = APP_TIME_ZONE) {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
}

/** Whole days from an instant's zoned calendar date back to `todayIso`. Negative when the instant is still ahead. */
export function dayOffset(todayIso: string, instant: string | Date, timeZone = APP_TIME_ZONE) {
  const eventDay = zonedISODate(instant instanceof Date ? instant : new Date(instant), timeZone);
  return Math.round((parseISO(todayIso).getTime() - parseISO(eventDay).getTime()) / 86_400_000);
}
