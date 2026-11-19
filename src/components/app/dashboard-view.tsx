"use client";

import { Clock3 } from "lucide-react";
import { MetricCard, type MetricCardProps } from "@/components/arc/metric-card/metric-card";
import { BarChart, type BarChartDatum } from "@/components/arc/bar-chart/bar-chart";
import { DonutChart, type DonutChartDatum } from "@/components/arc/donut-chart/donut-chart";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { ActivityHeatmap, type ActivityDay } from "@/components/arc/activity-heatmap/activity-heatmap";
import { ActivityFeed } from "@/components/arc/blocks/activity-feed/activity-feed";
import type { Activity } from "@/components/arc/blocks/activity-feed/activity-feed";
import { AppScreen } from "./app-screen";

export interface DashboardData {
  teamName: string;
  metrics: MetricCardProps[];
  hours: BarChartDatum[];
  hoursPeriod: string;
  checkIns: ActivityDay[];
  checkInPeriod: string;
  statusCounts: DonutChartDatum[];
  projectOpen: BarChartDatum[];
  activity: Activity[];
  today: string;
}

export function DashboardView({ data }: { data: DashboardData }) {
  const anyHours = data.hours.some(day => day.value > 0);
  return (
    <AppScreen title="Dashboard" meta={data.teamName}>
      <div className="tt-page">
        <section className="tt-kpis" aria-label="Today">{data.metrics.map(metric => <MetricCard key={metric.label} {...metric} />)}</section>

        <section className="tt-split tt-split-even">
          <div className="tt-panel">
            <DonutChart data={data.statusCounts} label="Tasks by status" unit="tasks" totalLabel="Tasks" />
          </div>
          <div className="tt-panel">
            <BarChart data={data.projectOpen} label="Open tasks by project" period="Not done yet" valueLabel="Open tasks" categoryLabel="Project" averageLabel="Average per project" />
          </div>
        </section>

        <section className="tt-panel">
          {anyHours
            ? <BarChart data={data.hours} label="Hours logged" period={data.hoursPeriod} unit="h" averageLabel="Daily average" categoryLabel="Day" formatValue={value => value.toFixed(1)} />
            : <EmptyState icon={<Clock3 size={20} strokeWidth={1.75} aria-hidden="true" />} title="No hours logged in the last two weeks" description="Hours appear here as people log time on tasks from Utilization." />}
        </section>

        <section className="tt-panel">
          <ActivityHeatmap days={data.checkIns} label="Team check-ins" period={data.checkInPeriod} unit={{ one: "check-in", other: "check-ins" }} weekStartsOn={1} />
        </section>

        <section className="tt-activity">
          <ActivityFeed items={data.activity} incoming={[]} today={data.today} title="Activity" />
        </section>
      </div>
    </AppScreen>
  );
}
