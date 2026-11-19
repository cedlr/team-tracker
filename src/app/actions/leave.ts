"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { requireViewer } from "@/lib/session";
import { getLeave, saveLeave, setAttendanceDay } from "@/lib/db";
import { leaveDecisionInput, leaveRequestInput } from "@/lib/schemas";
import { workdays } from "@/lib/utilization";

export async function requestLeave(input: unknown) {
  const parsed = leaveRequestInput.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid request" };
  const { member, team } = await requireViewer();
  const days = workdays(parsed.data.from, parsed.data.to).length;
  if (!days) return { ok: false as const, error: "Those dates have no working days." };
  const leave = await saveLeave({
    id: randomUUID(), teamId: team.id, memberId: member.id, ...parsed.data, days, status: "pending", createdAt: new Date().toISOString(),
  });
  revalidatePath("/leave"); revalidatePath("/calendar"); revalidatePath("/people");
  return { ok: true as const, leave };
}

/** Leads approve or decline. Approved leave also marks those days as "leave" in attendance. */
export async function decideLeave(input: unknown) {
  const parsed = leaveDecisionInput.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid decision" };
  const { member, team, isLead } = await requireViewer();
  if (!isLead) return { ok: false as const, error: "Only team leads can approve leave." };
  const leave = await getLeave(parsed.data.id);
  if (!leave || leave.teamId !== team.id) return { ok: false as const, error: "Request not found in this team." };
  const status = parsed.data.decision === "approve" ? "approved" : "declined";
  await saveLeave({ ...leave, status, decidedBy: member.id });
  if (status === "approved") {
    const at = new Date().toISOString();
    for (const day of workdays(leave.from, leave.to)) await setAttendanceDay(leave.memberId, day, { status: "leave", teamId: team.id, at });
  }
  revalidatePath("/leave"); revalidatePath("/calendar"); revalidatePath("/people"); revalidatePath("/utilization");
  return { ok: true as const };
}
