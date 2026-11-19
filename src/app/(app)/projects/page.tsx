import type { Metadata } from "next";
import { format } from "date-fns";
import { ProjectsView } from "@/components/app/projects-view";
import { requireViewer } from "@/lib/session";
import { listProjects, listTasks } from "@/lib/db";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const { team } = await requireViewer();
  const [projects, tasks] = await Promise.all([listProjects(team.id), listTasks({ teamId: team.id })]);
  const rows = projects.map(project => {
    const mine = tasks.filter(t => t.projectId === project.id);
    const done = mine.filter(t => t.status === "done").length;
    return {
      id: project.id, name: project.name, key: project.key, status: project.status[0].toUpperCase() + project.status.slice(1),
      open: mine.length - done, done, total: mine.length, progress: mine.length ? Math.round((done / mine.length) * 100) : 0,
      due: format(new Date(`${project.end}T00:00:00`), "MMM d, yyyy"), people: project.memberIds.length,
    };
  });
  return <ProjectsView rows={rows} teamName={team.name} />;
}
