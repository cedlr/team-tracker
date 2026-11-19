import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { KanbanView } from "@/components/app/kanban-view";
import { requireViewer } from "@/lib/session";
import { boardData, currentCycle } from "@/lib/board-data";

export const metadata: Metadata = { title: "Project" };

/** One project's board. Arc's project-board screen only renders its own sample data, so the kanban board is scoped to the project instead. */
export default async function ProjectPage({ params }: PageProps<"/projects/[id]">) {
  const { id } = await params;
  const { team, member } = await requireViewer();
  const { tasks, projects, people } = await boardData(team);
  if (!projects.some(p => p.id === id)) notFound();
  return <KanbanView key={`${team.id}:${id}`} tasks={tasks} projects={projects} people={people} currentUser={member.id} teamName={team.name} defaultProject={id} cycle={currentCycle()} />;
}
