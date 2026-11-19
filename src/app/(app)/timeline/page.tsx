import type { Metadata } from "next";
import { format, subDays } from "date-fns";
import { TimelineView } from "@/components/app/timeline-view";
import { requireViewer } from "@/lib/session";
import { listMembers, listProjects, listTasks } from "@/lib/db";
import { people as arcPeople, type PersonId } from "@/components/arc/lib/media";

export const metadata: Metadata = { title: "Timeline" };

export default async function TimelinePage() {
  const { team } = await requireViewer();
  const [projects, tasks, members] = await Promise.all([listProjects(team.id), listTasks({ teamId: team.id }), listMembers(team.id)]);
  const arcIds = new Set<string>(arcPeople.map(p => p.id));
  const avatarOf = new Map(members.map(m => [m.id, m.avatar]));
  const dated = tasks.filter(t => t.due || t.start).map(t => {
    const end = t.due ?? t.start!;
    const start = t.start ?? format(subDays(new Date(`${end}T00:00:00`), 2), "yyyy-MM-dd");
    const avatar = t.assigneeId ? avatarOf.get(t.assigneeId) : undefined;
    return {
      id: t.id, name: t.title, group: t.projectId, start, end: end < start ? start : end, team: team.id,
      progress: t.status === "done" ? 1 : t.status === "review" ? 0.8 : t.status === "progress" ? 0.4 : 0,
      // Arc's gantt draws owners from its own portrait set, so only members with an Arc portrait id show as owners.
      assignee: avatar && arcIds.has(avatar) ? (avatar as PersonId) : undefined,
    };
  });
  return <TimelineView
    key={team.id}
    title={`${team.name} roadmap`}
    teamName={team.name}
    team={{ id: team.id, name: team.name, tone: team.tone }}
    groups={projects.map(p => ({ id: p.id, name: p.name }))}
    tasks={dated}
    today={format(new Date(), "yyyy-MM-dd")}
  />;
}
