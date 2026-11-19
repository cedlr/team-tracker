"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { requireViewer } from "@/lib/session";
import { getAttendanceMonth, getLeave, getMember, removeLeave, saveLeave, setAttendanceDay } from "@/lib/db";
import { kv } from "@/lib/kv";
import { keys } from "@/lib/keys";
import { leaveEntryInput } from "@/lib/schemas";
import { workdays } from "@/lib/utilization";

/**
 * Leave is approved by email, outside this app. Leads and admins record it here for a member;
 * it marks those working days as "leave" in attendance and comes off capacity in utilization.
 */
export async function addLeave(input: unknown) {
  const parsed = leaveEntryInput.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid leave" };
  const { member, team, isLead } = await requireViewer();
  if (!isLead) return { ok: false as const, error: "Only team leads and admins can add leave." };
  const person = await getMember(parsed.data.memberId);
  if (!person || !person.memberships.some(m => m.teamId === team.id)) return { ok: false as const, error: "That person is not in this team." };
  const days = workdays(parsed.data.from, parsed.data.to);
  if (!days.length) return { ok: false as const, error: "Those dates have no working days." };
  const leave = await saveLeave({
    id: randomUUID(), teamId: team.id, ...parsed.data, days: days.length, addedBy: member.id, createdAt: new Date().toISOString(),
  });
  const at = new Date().toISOString();
  for (const day of days) await setAttendanceDay(leave.memberId, day, { status: "leave", teamId: team.id, at });
  revalidatePath("/", "layout");
  return { ok: true as const, leave };
}

/** Leads and admins can remove a leave record. Its "leave" attendance days are cleared too. */
export async function deleteLeave(id: string) {
  const { team, isLead } = await requireViewer();
  if (!isLead) return { ok: false as const, error: "Only team leads and admins can remove leave." };
  const leave = await getLeave(id);
  if (!leave || leave.teamId !== team.id) return { ok: false as const, error: "Leave not found in this team." };
  await removeLeave(id);
  await clearLeaveDays(leave.memberId, workdays(leave.from, leave.to));
  revalidatePath("/", "layout");
  return { ok: true as const };
}

async function clearLeaveDays(memberId: string, days: string[]) {
  const byMonth = new Map<string, string[]>();
  for (const day of days) byMonth.set(day.slice(0, 7), [...(byMonth.get(day.slice(0, 7)) ?? []), day]);
  for (const [month, list] of byMonth) {
    const current = await getAttendanceMonth(memberId, month);
    const fields = list.map(day => day.slice(8, 10)).filter(field => current[field]?.status === "leave");
    if (fields.length) await kv.hdel(keys.attendance(memberId, month), ...fields);
  }
}
