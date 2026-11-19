"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { TaskBreakdown } from "@/components/arc/blocks/task-breakdown/task-breakdown";
import type { TaskDraft, TaskOwner } from "@/components/arc/blocks/task-breakdown/task-breakdown";
import { upsertTask } from "@/app/actions/tasks";

/** Arc's task breakdown on one project's real tasks. Edits are saved back onto those tasks. */
export function ProjectBreakdown({ projectId, goal, tasks, owners, start, deadline }: {
  projectId: string;
  goal: string;
  tasks: TaskDraft[];
  owners: TaskOwner[];
  start: string;
  deadline: string;
}) {
  const router = useRouter();
  const saved = useRef(new Map(tasks.map(task => [task.id, JSON.stringify(task)])));
  return (
    <TaskBreakdown
      defaultGoal={goal}
      defaultTasks={tasks}
      owners={owners}
      startDate={`${start}T12:00:00`}
      deadline={`${deadline}T12:00:00`}
      model="Team tracker"
      autoStart={false}
      generate={async () => tasks}
      regenerate={async task => task}
      createIssue={async (_target, task) => {
        await upsertTask({
          id: task.id, projectId, title: task.title, assigneeId: task.ownerId, estimateHours: task.estimate * 8,
        });
        return { key: task.id, url: `/projects/${projectId}` };
      }}
      onTasksChange={next => {
        void (async () => {
          const changed = next.filter(task => saved.current.get(task.id) !== JSON.stringify(task));
          for (const task of changed) {
            saved.current.set(task.id, JSON.stringify(task));
            await upsertTask({ id: task.id, projectId, title: task.title, assigneeId: task.ownerId, estimateHours: task.estimate * 8 });
          }
          if (changed.length) router.refresh();
        })();
      }}
    />
  );
}
