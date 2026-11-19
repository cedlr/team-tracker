"use server";

import { revalidatePath } from "next/cache";
import { requireViewer } from "@/lib/session";
import { getTask, getTimeLogs, logTime } from "@/lib/db";
import { logHoursInput } from "@/lib/schemas";
import { zonedISODate } from "@/lib/time";

/** Adds hours on a task for a day (today in Asia/Kuala_Lumpur when the date is omitted). */
export async function logHours(input: unknown) {
  const parsed = logHoursInput.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Enter the hours" };
  const { member, team } = await requireViewer();
  const task = await getTask(parsed.data.taskId);
  if (!task || task.teamId !== team.id) return { ok: false as const, error: "Task not found in this team." };
  const date = parsed.data.date ?? zonedISODate();
  const existing = await getTimeLogs([member.id], date, date);
  const previous = existing[member.id]?.[date]?.[task.id]?.hours ?? 0;
  const hours = Math.round(Math.min(24, previous + parsed.data.hours) * 2) / 2;
  await logTime(member.id, date, task.id, { hours, teamId: team.id });
  revalidatePath("/", "layout");
  return { ok: true as const, hours, date };
}
