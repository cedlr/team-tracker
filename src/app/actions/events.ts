"use server";

import { revalidatePath } from "next/cache";
import { requireViewer } from "@/lib/session";
import { getLeave, getTask, removeEvent, removeLeave, saveEvent, saveLeave, saveTask } from "@/lib/db";
import { workdays } from "@/lib/utilization";
import { z } from "zod";

const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const eventInput = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  calendarId: z.string().min(1),
  start: iso,
  end: iso.optional(),
  notes: z.string().max(500).optional(),
});

const span = (start: string, end?: string) => (end && end >= start ? end : start);

/** Persists a calendar create: leave requests, holidays, deadlines and focus blocks. */
export async function createCalendarItem(input: unknown) {
  const parsed = eventInput.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid event" };
  const event = parsed.data;
  const { member, team } = await requireViewer();
  const end = span(event.start, event.end);

  if (event.id.startsWith("due-")) {
    const task = await getTask(event.id.slice(4));
    if (!task || task.teamId !== team.id) return { ok: false as const, error: "Task not found in this team." };
    await saveTask({ ...task, due: event.start, updatedAt: new Date().toISOString() });
    revalidatePath("/", "layout");
    return { ok: true as const };
  }

  const storedKind = event.id.startsWith("focus-") ? "focus" : event.calendarId === "holidays" ? "holiday" : event.calendarId === "deadlines" ? "deadline" : null;
  if (storedKind) {
    await saveEvent({
      id: event.id, teamId: team.id, title: event.title, kind: storedKind, start: event.start,
      end: end === event.start ? undefined : end, createdBy: member.id,
    });
    revalidatePath("/", "layout");
    return { ok: true as const };
  }

  const days = workdays(event.start, end).length;
  if (!days) return { ok: false as const, error: "Those dates have no working days." };
  const existing = await getLeave(event.id);
  if (existing && existing.teamId !== team.id) return { ok: false as const, error: "Request not found in this team." };
  await saveLeave({
    id: existing?.id ?? event.id,
    teamId: team.id,
    memberId: existing?.memberId ?? member.id,
    type: existing?.type ?? "annual",
    from: event.start,
    to: end,
    days,
    status: existing?.status ?? "pending",
    note: event.notes || event.title,
    decidedBy: existing?.decidedBy,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  });
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/** Deletes a leave request, a stored event, or a task deadline shown on the calendar. */
export async function deleteCalendarItem(input: unknown) {
  const parsed = eventInput.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid event" };
  const event = parsed.data;
  const { member, team, isLead } = await requireViewer();

  if (event.id.startsWith("due-")) {
    const task = await getTask(event.id.slice(4));
    if (!task || task.teamId !== team.id) return { ok: false as const, error: "Task not found in this team." };
    const rest = { ...task, updatedAt: new Date().toISOString() };
    delete rest.due;
    await saveTask(rest);
    revalidatePath("/", "layout");
    return { ok: true as const };
  }

  const leave = await getLeave(event.id);
  if (leave) {
    if (leave.teamId !== team.id) return { ok: false as const, error: "Request not found in this team." };
    if (!isLead && (leave.memberId !== member.id || leave.status !== "pending")) return { ok: false as const, error: "Only a lead can remove that leave." };
    await removeLeave(leave.id);
    revalidatePath("/", "layout");
    return { ok: true as const };
  }

  await removeEvent(event.id);
  revalidatePath("/", "layout");
  return { ok: true as const };
}
