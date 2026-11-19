import { eachDayOfInterval, isWeekend, parseISO, format } from "date-fns";
import type { Leave, PublicMember, TimeEntry } from "./schemas";

export interface Utilization {
  memberId: string;
  name: string;
  capacityHours: number;
  leaveHours: number;
  availableHours: number;
  loggedHours: number;
  /** logged / (capacity - leave), 0 when nothing is available. */
  rate: number;
}

export const workdays = (from: string, to: string) =>
  eachDayOfInterval({ start: parseISO(from), end: parseISO(to) }).filter(day => !isWeekend(day)).map(day => format(day, "yyyy-MM-dd"));

/**
 * Utilization for one team over [from, to]: hours logged on the team's tasks divided by
 * (capacity given to the team minus approved leave on working days).
 */
export function utilizationFor(
  members: PublicMember[], teamId: string, from: string, to: string,
  leaves: Leave[], timeLogs: Record<string, Record<string, Record<string, TimeEntry>>>,
): Utilization[] {
  const days = workdays(from, to);
  return members.map(member => {
    const allocation = member.memberships.find(m => m.teamId === teamId)?.allocation ?? 0;
    const dailyHours = (member.weeklyCapacityHours / 5) * allocation;
    const capacityHours = dailyHours * days.length;
    const leaveDays = new Set<string>();
    for (const leave of leaves) {
      if (leave.memberId !== member.id || leave.status !== "approved") continue;
      for (const day of days) if (day >= leave.from && day <= leave.to) leaveDays.add(day);
    }
    const leaveHours = leaveDays.size * dailyHours;
    let loggedHours = 0;
    for (const entries of Object.values(timeLogs[member.id] ?? {}))
      for (const entry of Object.values(entries)) if (entry.teamId === teamId) loggedHours += entry.hours;
    const availableHours = Math.max(0, capacityHours - leaveHours);
    return { memberId: member.id, name: member.name, capacityHours, leaveHours, availableHours, loggedHours, rate: availableHours ? loggedHours / availableHours : 0 };
  });
}
