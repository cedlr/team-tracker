import { format, parse } from "date-fns";

/** Arc boards show dates as "Nov 12". */
export const toShort = (iso?: string) => (iso ? format(new Date(`${iso}T00:00:00`), "MMM d") : undefined);
export function fromShort(short?: string, year = new Date().getFullYear()) {
  if (!short) return undefined;
  const date = parse(`${short} ${year}`, "MMM d yyyy", new Date());
  return Number.isNaN(date.getTime()) ? undefined : format(date, "yyyy-MM-dd");
}
