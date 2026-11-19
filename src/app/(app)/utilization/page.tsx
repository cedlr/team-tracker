import type { Metadata } from "next";
import { format, startOfMonth, startOfWeek, subDays } from "date-fns";
import { UtilizationView } from "@/components/app/utilization-view";
import { requireViewer } from "@/lib/session";
import { getTimeLogs, listLeaves, listMembers } from "@/lib/db";
import { utilizationFor } from "@/lib/utilization";

export const metadata: Metadata = { title: "Utilization" };

export default async function UtilizationPage({ searchParams }: PageProps<"/utilization">) {
  const { range: raw } = await searchParams;
  const range = raw === "week" || raw === "30d" ? raw : "month";
  const { team } = await requireViewer();
  const now = new Date();
  const fromDate = range === "week" ? startOfWeek(now, { weekStartsOn: 1 }) : range === "30d" ? subDays(now, 29) : startOfMonth(now);
  const from = format(fromDate, "yyyy-MM-dd");
  const to = format(now, "yyyy-MM-dd");
  const members = await listMembers(team.id);
  const [leaves, logs] = await Promise.all([listLeaves(team.id), getTimeLogs(members.map(m => m.id), from, to)]);
  const round = (n: number) => Math.round(n * 10) / 10;
  const rows = utilizationFor(members, team.id, from, to, leaves, logs).map(u => ({
    memberId: u.memberId, name: u.name, capacity: round(u.capacityHours), leave: round(u.leaveHours), available: round(u.availableHours),
    logged: round(u.loggedHours), rate: Math.round(u.rate * 100),
  }));
  return <UtilizationView rows={rows} teamName={team.name} range={range} period={`${format(fromDate, "MMM d")} – ${format(now, "MMM d, yyyy")}`} />;
}
