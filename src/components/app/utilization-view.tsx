"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock3 } from "lucide-react";
import { SortableDataTable, type DataColumn } from "@/components/arc/sortable-data-table/sortable-data-table";
import { BarChart } from "@/components/arc/bar-chart/bar-chart";
import { LineChart } from "@/components/arc/line-chart/line-chart";
import { Gauge } from "@/components/arc/gauge/gauge";
import { SplitBar } from "@/components/arc/split-bar/split-bar";
import { MetricCard } from "@/components/arc/metric-card/metric-card";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { Button } from "@/components/arc/button/button";
import { Input } from "@/components/arc/input/input";
import { Select } from "@/components/arc/select/select";
import { Badge } from "@/components/arc/badge/badge";
import { logHours } from "@/app/actions/hours";
import { AppScreen } from "./app-screen";

export type UtilRow = { memberId: string; name: string; capacity: number; leave: number; available: number; logged: number; rate: number } & Record<string, unknown>;
export type UtilTrend = { date: string; label: string; axisLabel: string; available: number; logged: number };

const band = (rate: number) => rate > 100 ? { tone: "danger" as const, label: "Over" } : rate >= 70 ? { tone: "success" as const, label: "Healthy" } : rate > 0 ? { tone: "warning" as const, label: "Low" } : { tone: "neutral" as const, label: "No hours" };

const columns: DataColumn<UtilRow>[] = [
  { key: "name", label: "Person", sortable: true },
  { key: "available", label: "Available", sortable: true, numeric: true, render: value => `${value}h` },
  { key: "leave", label: "Leave", sortable: true, numeric: true, render: value => `${value}h` },
  { key: "logged", label: "Logged", sortable: true, numeric: true, render: value => `${value}h` },
  { key: "rate", label: "Utilization", sortable: true, numeric: true, render: value => {
    const rate = Number(value); const b = band(rate);
    return <span className="tt-row tt-row-end"><span>{rate}%</span><Badge tone={b.tone} size="sm">{b.label}</Badge></span>;
  } },
];

export function UtilizationView({ rows, trend, teamName, period, range, tasks }: { rows: UtilRow[]; trend: UtilTrend[]; teamName: string; period: string; range: string; tasks: { id: string; title: string }[] }) {
  const router = useRouter();
  const [taskId, setTaskId] = useState(tasks[0]?.id ?? "");
  const [hours, setHours] = useState("1");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();

  const sum = (key: "capacity" | "leave" | "available" | "logged") => Math.round(rows.reduce((s, r) => s + r[key], 0) * 10) / 10;
  const available = sum("available"), logged = sum("logged"), leave = sum("leave");
  const teamRate = available ? Math.round((logged / available) * 100) : 0;
  const unlogged = Math.max(0, available - logged);
  const anyLogged = logged > 0;

  return (
    <AppScreen
      title="Utilization"
      meta={`${teamName} · ${period}`}
      actions={<SegmentedControl label="Range" value={range} onValueChange={(value: string) => router.push(`/utilization?range=${value}`)}
        options={[{ value: "week", label: "This week" }, { value: "month", label: "This month" }, { value: "30d", label: "Last 30 days" }]} />}
    >
      <div className="tt-page">
        <section className="tt-kpis" aria-label="Summary">
          <MetricCard label="Team utilization" value={teamRate} suffix="%" context="Logged ÷ available after leave" />
          <MetricCard label="Hours logged" value={logged} suffix="h" context={`${rows.length} people`} />
          <MetricCard label="Hours available" value={available} suffix="h" context="Capacity minus leave" />
          <MetricCard label="Leave" value={leave} suffix="h" context="Recorded leave in range" />
        </section>

        <section className="tt-split">
          <div className="tt-panel tt-panel-center">
            <Gauge value={teamRate} max={120} label="Team utilization" detail={`${logged}h of ${available}h`}
              thresholds={[{ from: 0, tone: "warning", label: "Low" }, { from: 70, tone: "success", label: "Healthy" }, { from: 100, tone: "danger", label: "Over capacity" }]} />
          </div>
          <div className="tt-panel">
            <SplitBar title="Where the hours went" description="Available hours in this range" unit="hours" totalLabel="Capacity"
              segments={[{ id: "logged", label: "Logged", value: logged }, { id: "unlogged", label: "Not logged", value: unlogged }, { id: "leave", label: "Leave", value: leave }]} />
          </div>
        </section>

        <section className="tt-panel">
          <LineChart label="Logged vs available, per day" unit="h" categoryLabel="Day" height={240}
            series={[{ key: "available", label: "Available", dashed: true }, { key: "logged", label: "Logged", area: true }]}
            data={trend.map(d => ({ key: d.date, label: d.label, axisLabel: d.axisLabel, values: { available: d.available, logged: d.logged } }))} />
        </section>

        {anyLogged ? (
          <section className="tt-panel">
            <BarChart data={rows.map(r => ({ key: r.memberId, label: r.name, axisLabel: r.name.split(" ")[0], value: r.rate }))} label="Utilization by person" period={period} unit="%" averageLabel="Team average" valueLabel="Utilization" categoryLabel="Person" />
          </section>
        ) : (
          <EmptyState icon={<Clock3 size={20} strokeWidth={1.75} aria-hidden="true" />} title="No hours logged yet"
            description="Utilization fills in as people log hours on their tasks. Log time below or from a task." />
        )}

        <section className="tt-panel">
          <SortableDataTable rows={rows} columns={columns} rowKey="memberId" caption={`Utilization per person in ${teamName}`} itemName={{ one: "person", other: "people" }} defaultSort={{ key: "rate", direction: "desc" }} />
        </section>

        {tasks.length > 0 && <section className="tt-panel" aria-label="Log hours">
          <form className="tt-form-row" onSubmit={event => {
            event.preventDefault();
            const value = Number(hours);
            if (!taskId || !Number.isFinite(value)) return;
            start(async () => {
              const result = await logHours({ taskId, hours: value });
              setNote(result.ok ? `Logged ${result.hours}h on ${result.date}` : result.error);
              if (result.ok) router.refresh();
            });
          }}>
            <div className="tt-grow"><Select label="Task" value={taskId} onValueChange={setTaskId} options={tasks.map(task => ({ value: task.id, label: `${task.id} · ${task.title}` }))} /></div>
            <div className="tt-narrow"><Input label="Hours today" type="number" min={0.5} max={24} step={0.5} value={hours} onChange={event => setHours(event.target.value)} /></div>
            <Button type="submit" loading={pending}>Log hours</Button>
          </form>
          {note && <p className="tt-note" role="status">{note}</p>}
        </section>}
      </div>
    </AppScreen>
  );
}
