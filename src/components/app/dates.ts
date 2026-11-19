import { format, parse } from "date-fns";

/** Arc boards show dates as "Nov 12". */
export const toShort = (iso?: string) => (iso ? format(new Date(`${iso}T00:00:00`), "MMM d") : undefined);
export function fromShort(short?: string, today = new Date()) {
  if (!short) return undefined;
  const date = parse(`${short} ${today.getFullYear()}`, "MMM d yyyy", today);
  if (Number.isNaN(date.getTime())) return undefined;
  const skew = date.getTime() - today.getTime();
  const shifted = skew < -183 * 86_400_000 ? new Date(date.getFullYear() + 1, date.getMonth(), date.getDate())
    : skew > 183 * 86_400_000 ? new Date(date.getFullYear() - 1, date.getMonth(), date.getDate()) : date;
  return format(shifted, "yyyy-MM-dd");
}
