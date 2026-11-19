import type { Activity } from "@/components/arc/blocks/activity-feed/activity-feed-data";
import type { AttendanceDay, Leave, Project, PublicMember, Task } from "./schemas";
import { dayOffset, zonedClock } from "./time";

const leaveLabel = { annual: "annual leave", sick: "sick leave", personal: "personal leave", parental: "parental leave", unpaid: "unpaid leave" } as const;

export interface ActivityInput {
  today: string;
  teamId: string;
  teamName: string;
  members: PublicMember[];
  projects: Project[];
  tasks: Task[];
  leaves: Leave[];
  /** memberId -> yyyy-mm-dd -> day */
  attendance: Record<string, Record<string, AttendanceDay>>;
  avatarOf: (member: PublicMember) => string | undefined;
}

/** Recent task, leave and check-in events for the activity feed. Newest first, capped so the page stays small. */
export function teamActivity({ today, teamId, teamName, members, projects, tasks, leaves, attendance, avatarOf }: ActivityInput): Activity[] {
  const byId = new Map(members.map(member => [member.id, member]));
  const projectName = new Map(projects.map(project => [project.id, project.name]));
  const actor = (id?: string): Activity["actor"] => {
    const member = id ? byId.get(id) : undefined;
    return member ? { name: member.name, src: avatarOf(member) } : { name: "Someone" };
  };
  const rows: { at: number; item: Activity }[] = [];

  for (const task of tasks) {
    const at = Date.parse(task.updatedAt);
    if (Number.isNaN(at)) continue;
    const day = dayOffset(today, new Date(at));
    if (day < 0 || day > 30) continue;
    rows.push({
      at,
      item: {
        id: `task-${task.id}-${task.updatedAt}`,
        type: "change",
        actor: actor(task.assigneeId),
        action: task.status === "done" ? "completed" : "updated",
        target: task.title,
        project: projectName.get(task.projectId) ?? teamName,
        day,
        time: zonedClock(new Date(at)),
        unread: day === 0,
      },
    });
  }

  for (const leave of leaves) {
    const at = Date.parse(leave.createdAt);
    if (Number.isNaN(at)) continue;
    const day = dayOffset(today, new Date(at));
    if (day < 0 || day > 30) continue;
    rows.push({
      at,
      item: {
        id: `leave-${leave.id}`,
        type: "comment",
        actor: actor(leave.memberId),
        action: "is on",
        target: leaveLabel[leave.type],
        project: "Leave",
        day,
        time: zonedClock(new Date(at)),
        unread: false,
        detail: { kind: "comment", text: `${leave.from} to ${leave.to}${leave.note ? `. ${leave.note}` : ""}` },
      },
    });
  }

  for (const [memberId, days] of Object.entries(attendance)) {
    for (const [date, day] of Object.entries(days)) {
      if (day.teamId !== teamId || (day.status !== "present" && day.status !== "remote")) continue;
      const at = Date.parse(day.at);
      if (Number.isNaN(at)) continue;
      const offset = dayOffset(today, new Date(at));
      if (offset < 0 || offset > 14) continue;
      rows.push({
        at,
        item: {
          id: `att-${memberId}-${date}`,
          type: "member",
          actor: actor(memberId),
          action: day.outAt ? "checked out from" : day.status === "remote" ? "checked in remotely to" : "checked in to",
          target: teamName,
          project: "Attendance",
          day: offset,
          time: zonedClock(new Date(at)),
          unread: offset === 0,
        },
      });
    }
  }

  return rows.sort((a, b) => b.at - a.at).slice(0, 40).map(row => row.item);
}
