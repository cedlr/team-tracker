import type { Metadata } from "next";
import { KanbanView } from "@/components/app/kanban-view";
import { requireViewer } from "@/lib/session";
import { boardData, currentCycle } from "@/lib/board-data";

export const metadata: Metadata = { title: "Tasks" };

export default async function TasksPage() {
  const { team, member } = await requireViewer();
  const { tasks, projects, people } = await boardData(team);
  return <KanbanView key={team.id} tasks={tasks} projects={projects} people={people} currentUser={member.id} teamName={team.name} cycle={currentCycle()} />;
}
