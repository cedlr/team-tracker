"use client";

import Link from "next/link";
import { ListTodo } from "lucide-react";
import { SortableDataTable, type DataColumn } from "@/components/arc/sortable-data-table/sortable-data-table";
import { MetricCard } from "@/components/arc/metric-card/metric-card";
import { Gauge } from "@/components/arc/gauge/gauge";
import { DonutChart } from "@/components/arc/donut-chart/donut-chart";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { Avatar } from "@/components/arc/avatar/avatar";
import { Badge } from "@/components/arc/badge/badge";
import { AppScreen } from "./app-screen";
import type { PersonWork } from "@/lib/people";

type TaskRow = { id: string; title: string; project: string; projectId: string; status: string; priority: string; due: string } & Record<string, unknown>;
type LeaveRow = { id: string; type: string; from: string; to: string; days: number } & Record<string, unknown>;

const statusLabel: Record<string, string> = { backlog: "Backlog", todo: "To do", progress: "In progress", review: "In review", done: "Done" };
const statusTone: Record<string, "neutral" | "info" | "warning" | "success"> = { backlog: "neutral", todo: "neutral", progress: "info", review: "warning", done: "success" };
const priorityTone: Record<string, "neutral" | "info" | "warning" | "danger"> = { urgent: "danger", high: "warning", medium: "info", low: "neutral", none: "neutral" };
const leaveLabel: Record<string, string> = { annual: "Annual leave", sick: "Sick leave", personal: "Personal day", parental: "Parental leave", unpaid: "Unpaid leave" };
const roleLabel = { admin: "Admin", lead: "Lead", member: "Member" } as const;

const taskColumns: DataColumn<TaskRow>[] = [
  { key: "id", label: "Key", sortable: true, width: 90 },
  { key: "title", label: "Task", sortable: true, render: (value, row) => <Link href={`/projects/${row.projectId}`} className="tt-link">{String(value)}</Link> },
  { key: "project", label: "Project", sortable: true },
  { key: "status", label: "Status", sortable: true, render: value => <Badge tone={statusTone[String(value)]} size="sm">{statusLabel[String(value)]}</Badge> },
  { key: "priority", label: "Priority", sortable: true, render: value => value === "none" ? "—" : <Badge tone={priorityTone[String(value)]} size="sm">{String(value)[0].toUpperCase() + String(value).slice(1)}</Badge> },
  { key: "due", label: "Due", sortable: true, render: value => value ? String(value) : "—" },
];
const leaveColumns: DataColumn<LeaveRow>[] = [
  { key: "type", label: "Type", render: value => leaveLabel[String(value)] },
  { key: "from", label: "From", sortable: true },
  { key: "to", label: "To", sortable: true },
  { key: "days", label: "Days", numeric: true },
];

export function PersonView({ person, tasks, leave, teamName }: { person: PersonWork; tasks: TaskRow[]; leave: LeaveRow[]; teamName: string }) {
  return (
    <AppScreen title={person.name} meta={`${person.title || roleLabel[person.role]} · ${teamName}`}>
      <div className="tt-page">
        <section className="tt-panel tt-person-head">
          <Avatar name={person.name} src={person.avatar} size="xl" />
          <div className="tt-person-text">
            <span className="tt-person-title">{person.name}</span>
            <span className="tt-person-meta">{person.email}</span>
            <span className="tt-row">
              <Badge tone={person.role === "member" ? "neutral" : "info"} size="sm">{roleLabel[person.role]}</Badge>
              {person.onLeaveToday && <Badge tone="warning" size="sm">On leave today</Badge>}
              {person.projects.map(p => <Link key={p.id} href={`/projects/${p.id}`}><Badge tone="neutral" size="sm">{p.name}</Badge></Link>)}
            </span>
          </div>
        </section>

        <section className="tt-kpis" aria-label="Work summary">
          <MetricCard label="Open tasks" value={person.open} context={`${person.overdue} overdue`} />
          <MetricCard label="In progress" value={person.progress} context={`${person.review} in review`} />
          <MetricCard label="Done" value={person.done} context="All time" />
          <MetricCard label="Check-ins" value={person.checkIns} suffix={` / ${person.workdays}`} context="Working days this month" />
          <MetricCard label="Leave" value={person.leaveDays} suffix="d" context="This year" />
        </section>

        <section className="tt-split tt-split-even">
          <div className="tt-panel tt-panel-center">
            <Gauge value={person.utilization} max={100} label="Utilization this month" detail={`${person.logged}h of ${person.available}h`}
              thresholds={[{ from: 0, tone: "warning", label: "Low" }, { from: 70, tone: "success", label: "Healthy" }, { from: 100, tone: "danger", label: "Over capacity" }]} />
          </div>
          <div className="tt-panel">
            <DonutChart label="Tasks by status" unit="tasks" totalLabel="Tasks" data={[
              { key: "todo", label: "To do", value: person.todo }, { key: "progress", label: "In progress", value: person.progress },
              { key: "review", label: "In review", value: person.review }, { key: "done", label: "Done", value: person.done },
            ]} />
          </div>
        </section>

        <section className="tt-section">
          <h2 className="tt-section-title">Current tasks</h2>
          {tasks.length ? <SortableDataTable rows={tasks} columns={taskColumns} rowKey="id" caption={`Open tasks for ${person.name}`} itemName={{ one: "task", other: "tasks" }} />
            : <EmptyState icon={<ListTodo size={20} strokeWidth={1.75} aria-hidden="true" />} title="No open tasks" description="Nothing is assigned right now." />}
        </section>

        <section className="tt-section">
          <h2 className="tt-section-title">Upcoming leave</h2>
          {leave.length ? <SortableDataTable rows={leave} columns={leaveColumns} rowKey="id" caption={`Upcoming leave for ${person.name}`} itemName={{ one: "leave", other: "leave" }} />
            : <p className="tt-note">No upcoming leave recorded.</p>}
        </section>
      </div>
    </AppScreen>
  );
}
