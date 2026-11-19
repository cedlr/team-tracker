import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PersonView } from "@/components/app/person-view";
import { requireViewer } from "@/lib/session";
import { teamWork } from "@/lib/people";

export const metadata: Metadata = { title: "Person" };

export default async function PersonPage({ params }: PageProps<"/people/[id]">) {
  const { id } = await params;
  const { team } = await requireViewer();
  const { rows, tasks, projects, leaves, today } = await teamWork(team);
  const person = rows.find(row => row.id === id);
  if (!person) notFound();
  const projectName = new Map(projects.map(p => [p.id, p.name]));
  const current = tasks.filter(t => t.assigneeId === id && t.status !== "done")
    .sort((a, b) => ["progress", "review", "todo", "backlog"].indexOf(a.status) - ["progress", "review", "todo", "backlog"].indexOf(b.status) || (a.due ?? "9999").localeCompare(b.due ?? "9999"))
    .map(t => ({ id: t.id, title: t.title, project: projectName.get(t.projectId) ?? "", projectId: t.projectId, status: t.status, priority: t.priority, due: t.due ?? "" }));
  const leave = leaves.filter(l => l.memberId === id && l.to >= today).sort((a, b) => a.from.localeCompare(b.from)).map(l => ({ id: l.id, type: l.type, from: l.from, to: l.to, days: l.days }));
  return <PersonView person={person} tasks={current} leave={leave} teamName={team.name} />;
}
