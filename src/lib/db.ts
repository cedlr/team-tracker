import "server-only";
import { eachDayOfInterval, format, parseISO } from "date-fns";
import { kv } from "./kv";
import { keys } from "./keys";
import {
  attendanceDaySchema, leaveSchema, memberSchema, projectSchema, taskSchema, teamSchema, timeEntrySchema,
  type AttendanceDay, type Leave, type Member, type Project, type PublicMember, type Task, type Team, type TimeEntry,
} from "./schemas";

const compact = <T,>(values: (T | null)[]) => values.filter((value): value is T => value != null);
const strip = ({ passwordHash: _hash, ...rest }: Member): PublicMember => rest;

/* Teams */
export async function listTeams(): Promise<Team[]> {
  const ids = await kv.smembers(keys.teams);
  return compact(await kv.mget<Team>(ids.map(keys.team))).sort((a, b) => a.name.localeCompare(b.name));
}
export const getTeam = (id: string) => kv.get<Team>(keys.team(id));
export async function saveTeam(team: Team) {
  const value = teamSchema.parse(team);
  await kv.set(keys.team(value.id), value);
  await kv.sadd(keys.teams, value.id);
  return value;
}

/* Members */
export async function getMember(id: string) { const member = await kv.get<Member>(keys.member(id)); return member ? strip(member) : null; }
/** Includes the password hash; only for sign in. */
export async function getMemberForLogin(email: string) {
  const id = await kv.get<string>(keys.memberByEmail(email));
  return id ? kv.get<Member>(keys.member(id)) : null;
}
export async function listMembers(teamId?: string): Promise<PublicMember[]> {
  const ids = await kv.smembers(teamId ? keys.teamMembers(teamId) : keys.members);
  return compact(await kv.mget<Member>(ids.map(keys.member))).map(strip).sort((a, b) => a.name.localeCompare(b.name));
}
export async function saveMember(member: Member) {
  const value = memberSchema.parse(member);
  const previous = await kv.get<Member>(keys.member(value.id));
  await kv.set(keys.member(value.id), value);
  await kv.sadd(keys.members, value.id);
  await kv.set(keys.memberByEmail(value.email), value.id);
  const teamIds = value.memberships.map(m => m.teamId);
  for (const old of previous?.memberships ?? []) if (!teamIds.includes(old.teamId)) await kv.srem(keys.teamMembers(old.teamId), value.id);
  for (const teamId of teamIds) await kv.sadd(keys.teamMembers(teamId), value.id);
  return strip(value);
}

/* Projects */
export async function listProjects(teamId: string): Promise<Project[]> {
  const ids = await kv.smembers(keys.teamProjects(teamId));
  return compact(await kv.mget<Project>(ids.map(keys.project))).sort((a, b) => a.start.localeCompare(b.start));
}
export const getProject = (id: string) => kv.get<Project>(keys.project(id));
export async function saveProject(project: Project) {
  const value = projectSchema.parse(project);
  await kv.set(keys.project(value.id), value);
  await kv.sadd(keys.teamProjects(value.teamId), value.id);
  return value;
}

/* Tasks */
export async function listTasks(scope: { teamId: string } | { projectId: string }): Promise<Task[]> {
  const ids = await kv.smembers("teamId" in scope ? keys.teamTasks(scope.teamId) : keys.projectTasks(scope.projectId));
  return compact(await kv.mget<Task>(ids.map(keys.task))).sort((a, b) => a.order - b.order);
}
export const getTask = (id: string) => kv.get<Task>(keys.task(id));
export async function saveTask(task: Task) {
  const value = taskSchema.parse(task);
  const previous = await kv.get<Task>(keys.task(value.id));
  await kv.set(keys.task(value.id), value);
  await kv.sadd(keys.teamTasks(value.teamId), value.id);
  await kv.sadd(keys.projectTasks(value.projectId), value.id);
  if (previous?.assigneeId && previous.assigneeId !== value.assigneeId) await kv.srem(keys.memberTasks(previous.assigneeId), value.id);
  if (value.assigneeId) await kv.sadd(keys.memberTasks(value.assigneeId), value.id);
  return value;
}

/* Leaves */
export async function listLeaves(teamId: string): Promise<Leave[]> {
  const ids = await kv.smembers(keys.teamLeaves(teamId));
  return compact(await kv.mget<Leave>(ids.map(keys.leave))).sort((a, b) => a.from.localeCompare(b.from));
}
export const getLeave = (id: string) => kv.get<Leave>(keys.leave(id));
export async function saveLeave(leave: Leave) {
  const value = leaveSchema.parse(leave);
  await kv.set(keys.leave(value.id), value);
  await kv.sadd(keys.teamLeaves(value.teamId), value.id);
  return value;
}

/* Attendance: att:{member}:{yyyy-mm}, field = day "01".."31" */
export async function getAttendanceMonth(memberId: string, month: string): Promise<Record<string, AttendanceDay>> {
  return kv.hgetall<AttendanceDay>(keys.attendance(memberId, month));
}
export async function setAttendanceDay(memberId: string, date: string, day: AttendanceDay) {
  const value = attendanceDaySchema.parse(day);
  await kv.hset(keys.attendance(memberId, date.slice(0, 7)), { [date.slice(8, 10)]: value });
}
/** Attendance for many people across a date range, as { memberId: { "yyyy-mm-dd": day } }. One pipeline. */
export async function getAttendance(memberIds: string[], from: string, to: string) {
  const months = Array.from(new Set(eachDayOfInterval({ start: parseISO(from), end: parseISO(to) }).map(d => format(d, "yyyy-MM"))));
  const pairs = memberIds.flatMap(memberId => months.map(month => ({ memberId, month })));
  const hashes = await kv.hgetallMany<AttendanceDay>(pairs.map(p => keys.attendance(p.memberId, p.month)));
  const result: Record<string, Record<string, AttendanceDay>> = Object.fromEntries(memberIds.map(id => [id, {}]));
  pairs.forEach(({ memberId, month }, index) => {
    for (const [day, value] of Object.entries(hashes[index])) {
      const date = `${month}-${day}`;
      if (date >= from && date <= to) result[memberId][date] = value;
    }
  });
  return result;
}

/* Time logs: time:{member}:{yyyy-mm-dd}, field = taskId */
export async function logTime(memberId: string, date: string, taskId: string, entry: TimeEntry) {
  await kv.hset(keys.time(memberId, date), { [taskId]: timeEntrySchema.parse(entry) });
}
export async function getTimeLogs(memberIds: string[], from: string, to: string) {
  const dates = eachDayOfInterval({ start: parseISO(from), end: parseISO(to) }).map(d => format(d, "yyyy-MM-dd"));
  const pairs = memberIds.flatMap(memberId => dates.map(date => ({ memberId, date })));
  const hashes = await kv.hgetallMany<TimeEntry>(pairs.map(p => keys.time(p.memberId, p.date)));
  const result: Record<string, Record<string, Record<string, TimeEntry>>> = Object.fromEntries(memberIds.map(id => [id, {}]));
  pairs.forEach(({ memberId, date }, index) => { if (Object.keys(hashes[index]).length) result[memberId][date] = hashes[index]; });
  return result;
}
