import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { KanbanView } from "@/components/app/kanban-view";
import { ProjectBreakdown } from "@/components/app/project-breakdown";
import { requireViewer } from "@/lib/session";
import { boardData, currentCycle } from "@/lib/board-data";
import { avatarSrc } from "@/lib/avatar";

export const metadata: Metadata = { title: "Project" };

/** One project's board, with the task breakdown of that project's real tasks underneath. */
export default async function ProjectPage({ params }: PageProps<"/projects/[id]">) {
  const { id } = await params;
  const { team, member } = await requireViewer();
  const { tasks, projects, people, members } = await boardData(team);
  const project = projects.find(item => item.id === id);
  if (!project) notFound();
  const mine = tasks.filter(task => task.projectId === id);
  return (
    <div className="tt-project">
      <div className="tt-project-board">
        <KanbanView key={`${team.id}:${id}`} tasks={tasks} projects={projects} people={people} currentUser={member.id} teamName={team.name} defaultProject={id} cycle={currentCycle()} />
      </div>
      <div className="tt-project-breakdown">
        <ProjectBreakdown
          projectId={id}
          goal={project.name}
          start={project.start}
          deadline={project.end}
          owners={members.map(person => ({ id: person.id, name: person.name, avatar: avatarSrc(person.avatar) }))}
          tasks={mine.map(task => ({ id: task.id, title: task.title, estimate: Math.max(0.5, (task.estimateHours ?? 8) / 8), ownerId: task.assigneeId }))}
        />
      </div>
    </div>
  );
}
