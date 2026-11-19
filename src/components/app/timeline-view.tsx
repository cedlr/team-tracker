"use client";

import { useRouter } from "next/navigation";
import { Users } from "lucide-react";
import { GanttTimeline, type GanttChange } from "@/components/arc/blocks/gantt-timeline/gantt-timeline";
import type { GanttGroup, GanttTask, GanttTeam } from "@/components/arc/blocks/gantt-timeline/gantt-timeline-data";
import { upsertTask } from "@/app/actions/tasks";

export interface TimelineViewProps {
  title: string;
  teamName: string;
  team: Omit<GanttTeam, "icon">;
  groups: GanttGroup[];
  tasks: GanttTask[];
  today: string;
}

/** Arc's gantt timeline on the team's dated tasks; moving or resizing a bar saves start and due. */
export function TimelineView({ title, teamName, team, groups, tasks, today }: TimelineViewProps) {
  const router = useRouter();
  async function save(next: GanttTask[], change: GanttChange) {
    if (change.kind === "delete") return;
    const task = next.find(t => t.id === change.id);
    if (!task) return;
    await upsertTask({ id: task.id, projectId: task.group, title: task.name, start: change.start, due: change.end });
    router.refresh();
  }
  return (
    <div className="tt-screen">
      <GanttTimeline
        title={title}
        workspace={teamName}
        groups={groups}
        defaultTasks={tasks}
        teams={[{ ...team, icon: Users }]}
        today={today}
        updates={[]}
        defaultCollapsed={[]}
        onTasksChange={save}
      />
    </div>
  );
}
