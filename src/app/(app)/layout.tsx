import { format } from "date-fns";
import { AppShell } from "@/components/app/app-shell";
import { requireViewer } from "@/lib/session";
import { getAttendanceMonth, listMembers } from "@/lib/db";
import { avatarSrc } from "@/lib/avatar";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { member, teams, team, isLead } = await requireViewer();
  const today = format(new Date(), "yyyy-MM-dd");
  const [month, counts] = await Promise.all([
    getAttendanceMonth(member.id, today.slice(0, 7)),
    Promise.all(teams.map(async t => (await listMembers(t.id)).length)),
  ]);
  const day = month[today.slice(8, 10)];
  return (
    <AppShell data={{
      teams: teams.map((t, index) => ({ id: t.id, name: t.name, tone: t.tone, detail: `${counts[index]} members` })),
      teamId: team.id,
      account: { name: member.name, email: member.email, avatar: avatarSrc(member.avatar), title: member.title },
      checkedInAt: day && (day.status === "present" || day.status === "remote") ? day.at : null,
      canManage: isLead,
    }}>
      {children}
    </AppShell>
  );
}
