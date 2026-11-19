import type { Metadata } from "next";
import { format } from "date-fns";
import { DirectoryView } from "@/components/app/directory-view";
import { LeaveRequest } from "@/components/app/leave-request";
import { requireViewer } from "@/lib/session";
import { listLeaves, listMembers } from "@/lib/db";
import { toDirectoryPeople, toTimeOff } from "@/lib/directory";

export const metadata: Metadata = { title: "Leave" };

export default async function LeavePage() {
  const { team, member } = await requireViewer();
  const [members, leaves] = await Promise.all([listMembers(team.id), listLeaves(team.id)]);
  const today = format(new Date(), "yyyy-MM-dd");
  return (
    <LeaveRequest>
      <DirectoryView key={team.id} page="timeoff" people={toDirectoryPeople(members, leaves, today)} timeOff={toTimeOff(leaves)} viewerId={member.id} teamName={team.name} />
    </LeaveRequest>
  );
}
