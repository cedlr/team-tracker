"use server";

import { revalidatePath } from "next/cache";
import { format } from "date-fns";
import { requireViewer } from "@/lib/session";
import { getAttendanceMonth, setAttendanceDay } from "@/lib/db";
import { checkInInput } from "@/lib/schemas";

/** Daily self check-in: one HSET on att:{member}:{yyyy-mm}. Checking in twice the same day keeps the first time. */
export async function checkIn(input: unknown = {}) {
  const parsed = checkInInput.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid check-in" };
  const { member, team } = await requireViewer();
  const now = new Date();
  const date = format(now, "yyyy-MM-dd");
  const month = await getAttendanceMonth(member.id, date.slice(0, 7));
  const existing = month[date.slice(8, 10)];
  if (existing && existing.status !== "absent") return { ok: true as const, already: true, at: existing.at };
  await setAttendanceDay(member.id, date, { status: parsed.data.status, teamId: team.id, at: now.toISOString() });
  revalidatePath("/", "layout");
  return { ok: true as const, already: false, at: now.toISOString() };
}
