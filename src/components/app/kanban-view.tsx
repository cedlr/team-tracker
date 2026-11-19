"use client";

import { useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { FolderKanban } from "lucide-react";
import { KanbanBoard, type KanbanCard, type KanbanColumn, type KanbanPerson, type KanbanProject } from "@/components/arc/blocks/kanban-board/kanban-board";
import { moveTasks, upsertTask } from "@/app/actions/tasks";
import type { Project, Task, TaskStatus } from "@/lib/schemas";
import { fromShort, toShort } from "./dates";

const columns: KanbanColumn[] = [
  { id: "backlog", name: "Backlog", kind: "backlog" },
  { id: "todo", name: "Todo", kind: "unstarted" },
  { id: "progress", name: "In progress", kind: "started" },
  { id: "review", name: "In review", kind: "review" },
  { id: "done", name: "Done", kind: "done" },
];

export interface KanbanViewProps {
  tasks: Task[];
  projects: Project[];
  people: KanbanPerson[];
  currentUser: string;
  teamName: string;
  defaultProject?: string;
  cycle: { name: string; start: string; end: string };
}

const toCard = (task: Task): KanbanCard => ({
  id: task.id, title: task.title, column: task.status, assignee: task.assigneeId ?? "", priority: task.priority,
  project: task.projectId, due: toShort(task.due), points: task.points ?? (task.estimateHours ? Math.round(task.estimateHours / 8) : undefined), description: task.description,
});
const sameEdit = (a: KanbanCard, b: KanbanCard) =>
  a.title === b.title && a.assignee === b.assignee && a.priority === b.priority && a.due === b.due && a.points === b.points && a.description === b.description && a.project === b.project;

/** Arc's kanban board on real tasks: every move or edit is diffed and saved through Server Actions. */
export function KanbanView({ tasks, projects, people, currentUser, teamName, defaultProject, cycle }: KanbanViewProps) {
  const router = useRouter();
  const initial = useMemo(() => tasks.map(toCard), [tasks]);
  const saved = useRef(new Map(initial.map((card, index) => [card.id, { card, order: index }])));
  const timer = useRef<number | undefined>(undefined);
  const kanbanProjects: KanbanProject[] = [...projects].sort((a, b) => Number(a.id === "general") - Number(b.id === "general")).map(p => ({ id: p.id, name: p.name, key: p.key, tone: p.tone, icon: FolderKanban }));

  function persist(cards: KanbanCard[]) {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      const moves: { id: string; status: string; order: number }[] = [];
      const writes: Promise<unknown>[] = [];
      cards.forEach((card, order) => {
        const before = saved.current.get(card.id);
        if (!before || !sameEdit(before.card, card)) {
          writes.push(upsertTask({
            id: card.id, projectId: card.project ?? defaultProject ?? projects[0]?.id, title: card.title, description: card.description,
            status: card.column as TaskStatus, priority: card.priority, assigneeId: card.assignee || undefined, points: card.points,
            due: fromShort(card.due), order,
          }));
        } else if (before.card.column !== card.column || before.order !== order) {
          moves.push({ id: card.id, status: card.column, order });
        }
        saved.current.set(card.id, { card, order });
      });
      if (moves.length) writes.push(moveTasks(moves));
      await Promise.all(writes);
      if (writes.length) router.refresh();
    }, 600);
  }

  return (
    <div className="tt-screen">
      <KanbanBoard
        columns={columns}
        people={people}
        defaultCards={initial}
        onCardsChange={persist}
        currentUser={currentUser}
        projects={kanbanProjects}
        labels={[]}
        defaultProject={defaultProject}
        defaultView={defaultProject ? undefined : "all"}
        workspace={teamName}
        today={toShort(new Date().toISOString().slice(0, 10))}
        cycle={cycle}
        activity={{}}
      />
    </div>
  );
}
