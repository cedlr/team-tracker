import type { Metadata } from "next";
import { LeaveEntry } from "@/components/app/leave-entry";
import { LeaveView } from "@/components/app/leave-view";
import { requireViewer } from "@/lib/session";
import { listLeaves, listMembers } from "@/lib/db";
import { zonedISODate } from "@/lib/time";

export const metadata: Metadata = { title: "Leave" };

/** Leave records. Approvals happen by email; leads and admins record approved leave here. */
export default async function LeavePage() {
  const { team, isLead } = await requireViewer();
  const [members, leaves] = await Promise.all([listMembers(team.id), listLeaves(team.id)]);
  const today = zonedISODate();
  const name = new Map(members.map(m => [m.id, m.name]));
  const rows = leaves.map(l => ({ id: l.id, memberId: l.memberId, name: name.get(l.memberId) ?? "Someone", type: l.type, from: l.from, to: l.to, days: l.days, note: l.note ?? "" }));
  const people = members.filter(m => (m.memberships.find(s => s.teamId === team.id)?.allocation ?? 0) > 0).map(m => ({ id: m.id, name: m.name }));
  return (
    <LeaveEntry canAdd={isLead} people={people}>
      <LeaveView key={team.id} rows={rows} today={today} teamName={team.name} canEdit={isLead} />
    </LeaveEntry>
  );
}
