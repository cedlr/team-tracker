import "server-only";
import { addDays, differenceInCalendarDays, format, startOfWeek } from "date-fns";
import { listMembers, listProjects, listTasks } from "./db";
import { avatarSrc } from "./avatar";
import type { Team } from "./schemas";

/** Two week cycles counted from the first Monday of the year, for the board's cycle footer. */
export function currentCycle(now = new Date()) {
  const origin = startOfWeek(new Date(now.getFullYear(), 0, 1), { weekStartsOn: 1 });
  const index = Math.floor(differenceInCalendarDays(now, origin) / 14);
  const start = addDays(origin, index * 14);
  return { name: `Cycle ${index + 1}`, start: format(start, "MMM d"), end: format(addDays(start, 13), "MMM d") };
}

export async function boardData(team: Team) {
  const [tasks, projects, members] = await Promise.all([listTasks({ teamId: team.id }), listProjects(team.id), listMembers(team.id)]);
  return { tasks, projects, members, people: members.map(m => ({ id: m.id, name: m.name, avatar: avatarSrc(m.avatar) })) };
}
