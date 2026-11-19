"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SortableDataTable, type DataColumn } from "@/components/arc/sortable-data-table/sortable-data-table";
import { UsageMeter } from "@/components/arc/usage-meter/usage-meter";
import { BarChart } from "@/components/arc/bar-chart/bar-chart";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { Button } from "@/components/arc/button/button";
import { Input } from "@/components/arc/input/input";
import { Select } from "@/components/arc/select/select";
import { logHours } from "@/app/actions/hours";
import { AppScreen } from "./app-screen";

export type UtilRow = { memberId: string; name: string; capacity: number; leave: number; available: number; logged: number; rate: number } & Record<string, unknown>;

const columns: DataColumn<UtilRow>[] = [
  { key: "name", label: "Person", sortable: true },
  { key: "capacity", label: "Capacity (h)", sortable: true, numeric: true },
  { key: "leave", label: "Leave (h)", sortable: true, numeric: true },
  { key: "available", label: "Available (h)", sortable: true, numeric: true },
  { key: "logged", label: "Logged (h)", sortable: true, numeric: true },
  { key: "rate", label: "Utilization", sortable: true, numeric: true, render: value => `${value}%` },
];

export function UtilizationView({ rows, teamName, period, range, tasks }: { rows: UtilRow[]; teamName: string; period: string; range: string; tasks: { id: string; title: string }[] }) {
  const router = useRouter();
  const [taskId, setTaskId] = useState(tasks[0]?.id ?? "");
  const [hours, setHours] = useState("1");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  return (
    <AppScreen
      title="Utilization"
      meta={`${teamName} · ${period}`}
      actions={<SegmentedControl label="Range" value={range} onValueChange={(value: string) => router.push(`/utilization?range=${value}`)}
        options={[{ value: "week", label: "This week" }, { value: "month", label: "This month" }, { value: "30d", label: "Last 30 days" }]} />}
    >
      <div className="tt-stack">
        {tasks.length > 0 && <form className="tt-row" onSubmit={event => {
          event.preventDefault();
          const value = Number(hours);
          if (!taskId || !Number.isFinite(value)) return;
          start(async () => {
            const result = await logHours({ taskId, hours: value });
            setNote(result.ok ? `Logged ${result.hours}h on ${result.date}` : result.error);
            if (result.ok) router.refresh();
          });
        }}>
          <Select label="Task" value={taskId} onValueChange={setTaskId} options={tasks.map(task => ({ value: task.id, label: `${task.id} ${task.title}` }))} />
          <Input label="Hours" type="number" min={0.5} max={24} step={0.5} value={hours} onChange={event => setHours(event.target.value)} />
          <Button type="submit" loading={pending}>Log hours</Button>
          {note && <p role="status">{note}</p>}
        </form>}
        <BarChart data={rows.map(r => ({ key: r.memberId, label: r.name, axisLabel: r.name.split(" ")[0], value: r.rate }))} label="Utilization by person" period={period} unit="%" averageLabel="Team average" valueLabel="Utilization" categoryLabel="Person" />
        <SortableDataTable rows={rows} columns={columns} rowKey="memberId" caption={`Utilization in ${teamName}`} itemName={{ one: "person", other: "people" }} defaultSort={{ key: "rate", direction: "desc" }} />
        <div className="tt-grid">
          {rows.map(r => <UsageMeter key={r.memberId} label={r.name} unit="h" decimals={0} limit={Math.max(r.available, 1)} freeLabel="Unlogged" overLabel="Over capacity" segments={[{ id: "logged", label: "Logged", value: r.logged }]} />)}
        </div>
      </div>
    </AppScreen>
  );
}
