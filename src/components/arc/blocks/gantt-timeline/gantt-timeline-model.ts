import type { PersonId } from "../../lib/media";
import { person } from "../../lib/media";
import type { GanttGroup, GanttTask, GanttTeam, GanttTone } from "./gantt-timeline-data";

export type GanttZoom = "day" | "week" | "month";
export type GanttGrouping = "phase" | "team" | "owner";
export type GanttStatus = "done" | "on-track" | "behind" | "conflict" | "upcoming";

export const DAY = 86_400_000;
export const parse = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return Date.UTC(y, m - 1, d); };
export const toIso = (time: number) => new Date(time).toISOString().slice(0, 10);
export const short = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
export const weekdayShort = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
export const monthName = new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" });
export const monthShort = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });
export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
export const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");

/** A task placed on the calendar: day offsets from the origin, its derived status, and its team colour. */
export interface Plan {
  task: GanttTask;
  start: number;
  /** Length in days; 0 for a milestone. */
  len: number;
  late: boolean;
  status: GanttStatus;
  tone: GanttTone;
}

export interface Lane {
  id: string;
  name: string;
  tone?: GanttTone;
  team?: GanttTeam;
  person?: PersonId;
  members: Plan[];
}

export const STATUS_LABEL: Record<GanttStatus, string> = { done: "Done", "on-track": "On track", behind: "Behind", conflict: "Conflict", upcoming: "Not started" };

/** Working days between two day offsets, inclusive, counting from a calendar origin. */
export function workdays(origin: number, start: number, len: number) {
  let count = 0;
  for (let day = start; day < start + len; day++) { const weekday = new Date(origin + day * DAY).getUTCDay(); if (weekday !== 0 && weekday !== 6) count++; }
  return count;
}

export function buildPlans(tasks: GanttTask[], origin: number, todayDay: number, teams: GanttTeam[]): Plan[] {
  const base = tasks.map(task => {
    const start = Math.round((parse(task.start) - origin) / DAY);
    return { task, start, len: task.milestone ? 0 : Math.max(1, Math.round((parse(task.end) - parse(task.start)) / DAY) + 1) };
  });
  const byId = new Map(base.map(plan => [plan.task.id, plan]));
  return base.map(plan => {
    const late = !!plan.task.dependsOn?.some(id => { const before = byId.get(id); return before && plan.start < before.start + before.len; });
    const progress = plan.task.progress ?? 0;
    let status: GanttStatus;
    if (plan.task.milestone) status = plan.start < todayDay ? "done" : late ? "conflict" : "upcoming";
    else if (progress >= 1) status = "done";
    else if (late) status = "conflict";
    else if (plan.start > todayDay) status = progress > 0 ? "on-track" : "upcoming";
    else {
      const expected = clamp((todayDay - plan.start + 1) / plan.len, 0, 1);
      // Two days in before a slow start counts as behind, so a task that began today is not flagged.
      status = todayDay - plan.start >= 2 && progress < expected - .15 ? "behind" : "on-track";
    }
    const tone = teams.find(team => team.id === plan.task.team)?.tone ?? "sky";
    return { ...plan, late, status, tone };
  });
}

export function buildLanes(grouping: GanttGrouping, plans: Plan[], groups: GanttGroup[], teams: GanttTeam[]): Lane[] {
  if (grouping === "phase") return groups.map(group => ({ id: group.id, name: group.name, members: plans.filter(plan => plan.task.group === group.id) }));
  if (grouping === "team") {
    const lanes: Lane[] = teams.map(team => ({ id: `team:${team.id}`, name: team.name, tone: team.tone, team, members: plans.filter(plan => plan.task.team === team.id) }));
    const loose = plans.filter(plan => !teams.some(team => team.id === plan.task.team));
    if (loose.length) lanes.push({ id: "team:none", name: "No team", members: loose });
    return lanes.filter(lane => lane.members.length);
  }
  const owners: PersonId[] = [];
  plans.forEach(plan => { if (plan.task.assignee && !owners.includes(plan.task.assignee)) owners.push(plan.task.assignee); });
  const lanes: Lane[] = owners.map(id => ({ id: `owner:${id}`, name: person(id).name, person: id, members: plans.filter(plan => plan.task.assignee === id) }));
  const loose = plans.filter(plan => !plan.task.assignee);
  if (loose.length) lanes.push({ id: "owner:none", name: "Unassigned", members: loose });
  return lanes;
}

/** Share of the work done, weighted by length. Milestones carry no work. */
export function doneShare(plans: Plan[]) {
  const work = plans.filter(plan => !plan.task.milestone), total = work.reduce((sum, plan) => sum + plan.len, 0);
  return total ? work.reduce((sum, plan) => sum + plan.len * (plan.task.progress ?? 0), 0) / total : 0;
}
