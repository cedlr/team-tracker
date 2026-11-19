"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plane, Trash2 } from "lucide-react";
import { SortableDataTable, type DataColumn } from "@/components/arc/sortable-data-table/sortable-data-table";
import { MetricCard } from "@/components/arc/metric-card/metric-card";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { Badge } from "@/components/arc/badge/badge";
import { Button } from "@/components/arc/button/button";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { deleteLeave } from "@/app/actions/leave";
import { AppScreen } from "./app-screen";

type Row = { id: string; memberId: string; name: string; type: string; from: string; to: string; days: number; note: string } & Record<string, unknown>;
const leaveLabel: Record<string, string> = { annual: "Annual leave", sick: "Sick leave", personal: "Personal day", parental: "Parental leave", unpaid: "Unpaid leave" };

export function LeaveView({ rows, today, teamName, canEdit }: { rows: Row[]; today: string; teamName: string; canEdit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [view, setView] = useState("upcoming");
  const year = today.slice(0, 4);
  const onNow = rows.filter(r => today >= r.from && today <= r.to);
  const upcoming = rows.filter(r => r.to >= today);
  const shown = (view === "upcoming" ? upcoming : rows).slice().sort((a, b) => view === "upcoming" ? a.from.localeCompare(b.from) : b.from.localeCompare(a.from));

  const columns: DataColumn<Row>[] = [
    { key: "name", label: "Person", sortable: true, render: (value, row) => <Link href={`/people/${row.memberId}`} className="tt-link">{String(value)}</Link> },
    { key: "type", label: "Type", sortable: true, render: value => leaveLabel[String(value)] },
    { key: "from", label: "From", sortable: true, render: (value, row) => <span className="tt-row">{String(value)}{today >= row.from && today <= row.to && <Badge tone="warning" size="sm">On leave</Badge>}</span> },
    { key: "to", label: "To", sortable: true },
    { key: "days", label: "Working days", sortable: true, numeric: true },
    { key: "note", label: "Note", render: value => value ? <span className="tt-person-meta">{String(value)}</span> : "—" },
    ...(canEdit ? [{ key: "id", label: "", width: 56, render: (value: unknown, row: Row) => (
      <Button variant="ghost" size="sm" aria-label={`Remove ${row.name}'s leave`} loading={pending} onClick={() => start(async () => {
        const result = await deleteLeave(String(value));
        if (!result.ok) window.alert(result.error);
        router.refresh();
      })}><Trash2 size={16} strokeWidth={1.75} aria-hidden="true" /></Button>
    ) } satisfies DataColumn<Row>] : []),
  ];

  return (
    <AppScreen title="Leave" meta={`${teamName} · approvals happen by email`}
      actions={<SegmentedControl label="Show" value={view} onValueChange={setView} options={[{ value: "upcoming", label: "Upcoming" }, { value: "all", label: "All" }]} />}>
      <div className="tt-page">
        <section className="tt-kpis" aria-label="Leave summary">
          <MetricCard label="On leave today" value={new Set(onNow.map(r => r.memberId)).size} context="People" />
          <MetricCard label="Upcoming" value={upcoming.length} context="Leave records from today" />
          <MetricCard label={`Days in ${year}`} value={rows.filter(r => r.from.startsWith(year)).reduce((s, r) => s + r.days, 0)} suffix="d" context="Working days, whole team" />
        </section>
        {shown.length ? (
          <section className="tt-panel">
            <SortableDataTable rows={shown} columns={columns} rowKey="id" caption={`Leave in ${teamName}`} itemName={{ one: "leave record", other: "leave records" }} />
          </section>
        ) : (
          <EmptyState icon={<Plane size={20} strokeWidth={1.75} aria-hidden="true" />} title={view === "upcoming" ? "No upcoming leave" : "No leave recorded"}
            description={canEdit ? "Once leave is approved by email, add it with Add leave in the sidebar. It comes off capacity in utilization." : "Leave approved by email shows here once a lead adds it."} />
        )}
      </div>
    </AppScreen>
  );
}
