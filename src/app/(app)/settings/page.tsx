import type { Metadata } from "next";
import { format } from "date-fns";
import { SettingsView } from "@/components/app/settings-view";
import { requireViewer } from "@/lib/session";
import { getAttendanceMonth, listLeaves, listMembers, listProjects, listTasks } from "@/lib/db";
import { avatarSrc } from "@/lib/avatar";
import { photos } from "@/components/arc/lib/media";
import { zonedISODate } from "@/lib/time";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { team, member, isLead } = await requireViewer();
  const month = zonedISODate().slice(0, 7);
  const [tasks, projects, members, leaves, attendance] = await Promise.all([
    listTasks({ teamId: team.id }), listProjects(team.id), listMembers(team.id), listLeaves(team.id), getAttendanceMonth(member.id, month),
  ]);
  const people = new Map(members.map(m => [m.id, m]));
  return <SettingsView
    teamName={team.name}
    teamId={team.id}
    isLead={isLead}
    members={members.map(person => ({
      id: person.id, name: person.name, email: person.email, avatar: avatarSrc(person.avatar),
      role: person.memberships.find(entry => entry.teamId === team.id)?.role ?? "member",
    }))}
    grants={team.grants}
    profile={{
      name: member.name, handle: member.email.split("@")[0], headline: member.title, location: member.location || "Kuala Lumpur", website: member.website || "", bio: member.bio || "",
      avatar: avatarSrc(member.avatar), cover: photos.find(p => p.id === "mountain-ridges")?.src, joined: format(new Date(`${member.started}T00:00:00`), "MMMM yyyy"),
    }}
    stats={[
      { id: "open", label: "Open tasks", value: tasks.filter(t => t.assigneeId === member.id && t.status !== "done").length },
      { id: "done", label: "Tasks done", value: tasks.filter(t => t.assigneeId === member.id && t.status === "done").length },
      { id: "present", label: "Days in this month", value: Object.values(attendance).filter(d => d.status === "present" || d.status === "remote").length },
      { id: "leave", label: "Leave days taken", value: leaves.filter(l => l.memberId === member.id).reduce((s, l) => s + l.days, 0) },
    ]}
    projects={projects.filter(p => p.memberIds.includes(member.id)).map((p, i) => ({
      id: p.id, name: p.name, description: `${tasks.filter(t => t.projectId === p.id && t.status !== "done").length} open tasks`,
      cover: photos[(i * 5) % photos.length].src, updated: format(new Date(`${p.start}T00:00:00`), "MMM d"), stars: 0, visibility: "Private",
      collaborators: p.memberIds.map(id => people.get(id)).filter(Boolean).map(m => ({ name: m!.name, avatar: avatarSrc(m!.avatar) })),
    }))}
  />;
}
