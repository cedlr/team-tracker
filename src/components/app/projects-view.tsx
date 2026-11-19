"use client";

import Link from "next/link";
import { SortableDataTable, type DataColumn } from "@/components/arc/sortable-data-table/sortable-data-table";
import { Badge } from "@/components/arc/badge/badge";
import { Progress } from "@/components/arc/progress/progress";
import { AppScreen } from "./app-screen";

export type ProjectRow = { id: string; name: string; key: string; status: string; open: number; done: number; total: number; progress: number; due: string; people: number } & Record<string, unknown>;

const columns: DataColumn<ProjectRow>[] = [
  { key: "name", label: "Project", sortable: true, render: (_, row) => <Link href={`/projects/${row.id}`}>{row.name}</Link> },
  { key: "key", label: "Key", width: 80 },
  { key: "status", label: "Status", render: value => <Badge>{String(value)}</Badge> },
  { key: "progress", label: "Progress", sortable: true, width: 180, render: value => <Progress value={Number(value)} label="Progress" /> },
  { key: "open", label: "Open", sortable: true, numeric: true },
  { key: "done", label: "Done", sortable: true, numeric: true },
  { key: "people", label: "People", numeric: true },
  { key: "due", label: "Ends", sortable: true },
];

export function ProjectsView({ rows, teamName }: { rows: ProjectRow[]; teamName: string }) {
  return (
    <AppScreen title="Projects" meta={teamName}>
      <SortableDataTable rows={rows} columns={columns} rowKey="id" caption={`Projects in ${teamName}`} itemName={{ one: "project", other: "projects" }} defaultSort={{ key: "name", direction: "asc" }} />
    </AppScreen>
  );
}
