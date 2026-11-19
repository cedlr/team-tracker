"use client";

import Link from "next/link";
import { Users } from "lucide-react";
import { SortableDataTable, type DataColumn } from "@/components/arc/sortable-data-table/sortable-data-table";
import { MetricCard } from "@/components/arc/metric-card/metric-card";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { Avatar } from "@/components/arc/avatar/avatar";
import { Badge } from "@/components/arc/badge/badge";
import { AppScreen } from "./app-screen";
import type { PersonWork } from "@/lib/people";

type Row = PersonWork & Record<string, unknown>;
const roleLabel = { admin: "Admin", lead: "Lead", member: "Member" } as const;

const columns: DataColumn<Row>[] = [
  { key: "name", label: "Person", sortable: true, width: 260, render: (_, row) => (
    <Link href={`/people/${row.id}`} className="tt-person">
      <Avatar name={row.name} src={row.avatar} size="sm" />
      <span className="tt-person-text"><span className="tt-person-name">{row.name}</span><span className="tt-person-meta">{roleLabel[row.role]}{row.title && row.title !== roleLabel[row.role] && row.title !== "Owner" ? ` · ${row.title}` : ""}</span></span>
    </Link>
  ) },
  { key: "projects", label: "Projects", width: 200, render: value => {
    const list = value as Row["projects"];
    return <span className="tt-person-meta tt-clip" title={list.map(p => p.name).join(", ")}>{list.length ? list.map(p => p.name).join(", ") : "None"}</span>;
  } },
  { key: "progress", label: "In progress", sortable: true, numeric: true },
  { key: "review", label: "In review", sortable: true, numeric: true },
  { key: "todo", label: "To do", sortable: true, numeric: true },
  { key: "done", label: "Done", sortable: true, numeric: true },
  { key: "overdue", label: "Overdue", sortable: true, numeric: true, render: value => Number(value) ? <Badge tone="danger" size="sm">{String(value)}</Badge> : "0" },
  { key: "utilization", label: "Utilization", sortable: true, numeric: true, render: value => { const v = Number(value); return <Badge tone={v > 100 ? "danger" : v >= 70 ? "success" : v > 0 ? "warning" : "neutral"} size="sm">{v}%</Badge>; } },
  { key: "checkIns", label: "Check-ins", sortable: true, numeric: true, render: (value, row) => `${value} / ${row.workdays}` },
  { key: "leaveDays", label: "Leave (yr)", sortable: true, numeric: true, render: (value, row) => row.onLeaveToday ? <Badge tone="warning" size="sm">On leave</Badge> : `${value}d` },
];

export function PeopleView({ rows, teamName }: { rows: PersonWork[]; teamName: string }) {
  const sum = (k: "open" | "progress" | "review" | "overdue") => rows.reduce((s, r) => s + r[k], 0);
  return (
    <AppScreen title="People" meta={`${teamName} · ${rows.length} people`}>
      <div className="tt-page">
        <section className="tt-kpis" aria-label="Team workload">
          <MetricCard label="People" value={rows.length} context="In this team" />
          <MetricCard label="Open tasks" value={sum("open")} context={`${sum("overdue")} overdue`} />
          <MetricCard label="In progress" value={sum("progress")} context={`${sum("review")} in review`} />
          <MetricCard label="On leave today" value={rows.filter(r => r.onLeaveToday).length} context="From leave records" />
        </section>
        {rows.length ? (
          <section className="tt-section">
            <SortableDataTable rows={rows as Row[]} columns={columns} rowKey="id" caption={`People in ${teamName}`} itemName={{ one: "person", other: "people" }} defaultSort={{ key: "progress", direction: "desc" }} />
          </section>
        ) : (
          <EmptyState icon={<Users size={20} strokeWidth={1.75} aria-hidden="true" />} title="No one here yet" description="Invite people from Settings to add them to this team." />
        )}
      </div>
    </AppScreen>
  );
}
