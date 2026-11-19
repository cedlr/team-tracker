import "server-only";
import { format, startOfMonth, startOfYear } from "date-fns";
import { getAttendance, getTimeLogs, listLeaves, listMembers, listProjects, listTasks } from "./db";
import { utilizationFor, workdays } from "./utilization";
import { avatarSrc } from "./avatar";
import { zonedISODate } from "./time";
import type { Leave, Project, PublicMember, Task, Team } from "./schemas";

export interface PersonWork {
  id: string; name: string; email: string; title: string; role: "admin" | "lead" | "member"; avatar?: string;
  projects: { id: string; name: string }[];
  todo: number; progress: number; review: number; done: number; open: number; overdue: number;
  utilization: number; logged: number; available: number;
  checkIns: number; workdays: number; leaveDays: number; onLeaveToday: boolean;
}

/** Work facts per person in a team: tasks by status, projects, this month's utilization and check-ins, leave this year. */
export async function teamWork(team: Team) {
  const today = zonedISODate();
  const now = new Date(`${today}T12:00:00Z`);
  const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
  const yearStart = format(startOfYear(now), "yyyy-MM-dd");
  const [members, tasks, projects, leaves] = await Promise.all([listMembers(team.id), listTasks({ teamId: team.id }), listProjects(team.id), listLeaves(team.id)]);
  const people = members.filter(m => (m.memberships.find(s => s.teamId === team.id)?.allocation ?? 0) > 0);
  const ids = people.map(m => m.id);
  const [attendance, logs] = await Promise.all([getAttendance(ids, monthStart, today), getTimeLogs(ids, monthStart, today)]);
  const util = new Map(utilizationFor(people, team.id, monthStart, today, leaves, logs).map(u => [u.memberId, u]));
  const days = workdays(monthStart, today);
  const rows: PersonWork[] = people.map(m => personWork(m, team, tasks, projects, leaves, today, yearStart, {
    util: util.get(m.id), checkIns: days.filter(d => ["present", "remote"].includes(attendance[m.id]?.[d]?.status ?? "")).length, workdays: days.length,
  }));
  return { rows, tasks, projects, leaves, today };
}

function personWork(m: PublicMember, team: Team, tasks: Task[], projects: Project[], leaves: Leave[], today: string, yearStart: string,
  extra: { util?: { rate: number; loggedHours: number; availableHours: number }; checkIns: number; workdays: number }): PersonWork {
  const mine = tasks.filter(t => t.assigneeId === m.id);
  const count = (s: Task["status"]) => mine.filter(t => t.status === s).length;
  const projectIds = new Set([...mine.map(t => t.projectId), ...projects.filter(p => p.memberIds.includes(m.id)).map(p => p.id)]);
  const myLeave = leaves.filter(l => l.memberId === m.id);
  return {
    id: m.id, name: m.name, email: m.email, title: m.title, avatar: avatarSrc(m.avatar),
    role: m.memberships.find(s => s.teamId === team.id)?.role ?? "member",
    projects: projects.filter(p => projectIds.has(p.id)).map(p => ({ id: p.id, name: p.name })),
    todo: count("todo") + count("backlog"), progress: count("progress"), review: count("review"), done: count("done"),
    open: mine.filter(t => t.status !== "done").length, overdue: mine.filter(t => t.status !== "done" && t.due && t.due < today).length,
    utilization: Math.round((extra.util?.rate ?? 0) * 100), logged: Math.round((extra.util?.loggedHours ?? 0) * 10) / 10, available: Math.round((extra.util?.availableHours ?? 0) * 10) / 10,
    checkIns: extra.checkIns, workdays: extra.workdays,
    leaveDays: myLeave.filter(l => l.to >= yearStart).reduce((s, l) => s + l.days, 0),
    onLeaveToday: myLeave.some(l => today >= l.from && today <= l.to),
  };
}
