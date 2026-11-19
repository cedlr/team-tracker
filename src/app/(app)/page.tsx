import type { Metadata } from "next";
import { format, subDays } from "date-fns";
import { DashboardView } from "@/components/app/dashboard-view";
import { requireViewer } from "@/lib/session";
import { getAttendance, getTimeLogs, listLeaves, listMembers, listTasks } from "@/lib/db";
import { utilizationFor, workdays } from "@/lib/utilization";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { team } = await requireViewer();
  const now = new Date();
  const today = format(now, "yyyy-MM-dd");
  const from14 = format(subDays(now, 13), "yyyy-MM-dd");
  const from90 = format(subDays(now, 89), "yyyy-MM-dd");
  const [members, tasks, leaves] = await Promise.all([listMembers(team.id), listTasks({ teamId: team.id }), listLeaves(team.id)]);
  const ids = members.map(m => m.id);
  const [attendance, logs] = await Promise.all([getAttendance(ids, from90, today), getTimeLogs(ids, from14, today)]);

  const weekAgo = subDays(now, 7).toISOString();
  const open = tasks.filter(t => t.status !== "done").length;
  const doneThisWeek = tasks.filter(t => t.status === "done" && t.updatedAt >= weekAgo).length;
  const overdue = tasks.filter(t => t.status !== "done" && t.due && t.due < today).length;
  const checkedIn = ids.filter(id => ["present", "remote"].includes(attendance[id]?.[today]?.status ?? "")).length;
  const util = utilizationFor(members, team.id, from14, today, leaves, logs);
  const available = util.reduce((sum, u) => sum + u.availableHours, 0);
  const logged = util.reduce((sum, u) => sum + u.loggedHours, 0);
  const pendingLeave = leaves.filter(l => l.status === "pending").length;

  const hours = workdays(from14, today).map(date => ({
    key: date,
    label: format(new Date(`${date}T00:00:00`), "EEE, MMM d"),
    axisLabel: format(new Date(`${date}T00:00:00`), "EEEEE"),
    value: Math.round(ids.reduce((sum, id) => sum + Object.values(logs[id]?.[date] ?? {}).filter(e => e.teamId === team.id).reduce((s, e) => s + e.hours, 0), 0) * 10) / 10,
  }));
  const checkIns: { date: string; count: number }[] = [];
  for (let d = subDays(now, 89); format(d, "yyyy-MM-dd") <= today; d = new Date(d.getTime() + 86_400_000)) {
    const date = format(d, "yyyy-MM-dd");
    checkIns.push({ date, count: ids.filter(id => ["present", "remote"].includes(attendance[id]?.[date]?.status ?? "")).length });
  }

  return <DashboardView data={{
    teamName: team.name,
    metrics: [
      { label: "Open tasks", value: open, context: `${overdue} overdue`, change: `${doneThisWeek} done this week` },
      { label: "Checked in today", value: checkedIn, suffix: ` / ${members.length}`, context: "Team members" },
      { label: "Utilization", value: available ? Math.round((logged / available) * 100) : 0, suffix: "%", context: "Last 14 days, after leave" },
      { label: "Pending leave", value: pendingLeave, context: "Requests waiting for a lead" },
    ],
    hours,
    hoursPeriod: `${format(subDays(now, 13), "MMM d")} – ${format(now, "MMM d, yyyy")}`,
    checkIns,
    checkInPeriod: "the last 90 days",
  }} />;
}
