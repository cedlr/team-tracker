import type { Metadata } from "next";
import { format, startOfMonth, startOfWeek, subDays } from "date-fns";
import { UtilizationView } from "@/components/app/utilization-view";
import { requireViewer } from "@/lib/session";
import { getTimeLogs, listLeaves, listMembers, listTasks } from "@/lib/db";
import { utilizationFor, workdays } from "@/lib/utilization";
import { zonedISODate } from "@/lib/time";

export const metadata: Metadata = { title: "Utilization" };

export default async function UtilizationPage({ searchParams }: PageProps<"/utilization">) {
  const { range: raw } = await searchParams;
  const range = raw === "week" || raw === "30d" ? raw : "month";
  const { team } = await requireViewer();
  const now = new Date(`${zonedISODate()}T12:00:00Z`);
  const fromDate = range === "week" ? startOfWeek(now, { weekStartsOn: 1 }) : range === "30d" ? subDays(now, 29) : startOfMonth(now);
  const from = format(fromDate, "yyyy-MM-dd");
  const to = format(now, "yyyy-MM-dd");
  const [members, tasks] = await Promise.all([listMembers(team.id), listTasks({ teamId: team.id })]);
  const [leaves, logs] = await Promise.all([listLeaves(team.id), getTimeLogs(members.map(m => m.id), from, to)]);
  const round = (n: number) => Math.round(n * 10) / 10;
  const people = members.filter(m => (m.memberships.find(s => s.teamId === team.id)?.allocation ?? 0) > 0);
  const rows = utilizationFor(people, team.id, from, to, leaves, logs).map(u => ({
    memberId: u.memberId, name: u.name, capacity: round(u.capacityHours), leave: round(u.leaveHours), available: round(u.availableHours),
    logged: round(u.loggedHours), rate: Math.round(u.rate * 100),
  }));

  /* Daily team trend: logged hours against hours available after leave. */
  const trend = workdays(from, to).map(date => {
    let available = 0, logged = 0;
    for (const m of people) {
      const daily = (m.weeklyCapacityHours / 5) * (m.memberships.find(s => s.teamId === team.id)?.allocation ?? 0);
      if (!leaves.some(l => l.memberId === m.id && date >= l.from && date <= l.to)) available += daily;
      for (const entry of Object.values(logs[m.id]?.[date] ?? {})) if (entry.teamId === team.id) logged += entry.hours;
    }
    return { date, label: format(new Date(`${date}T00:00:00`), "EEE, MMM d"), axisLabel: format(new Date(`${date}T00:00:00`), "MMM d"), available: round(available), logged: round(logged) };
  });

  const myTasks = tasks.filter(t => t.status !== "done").map(task => ({ id: task.id, title: task.title }));
  return <UtilizationView rows={rows} trend={trend} teamName={team.name} range={range} tasks={myTasks} period={`${format(fromDate, "MMM d")} – ${format(now, "MMM d, yyyy")}`} />;
}
