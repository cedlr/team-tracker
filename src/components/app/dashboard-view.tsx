"use client";

import { MetricCard, type MetricCardProps } from "@/components/arc/metric-card/metric-card";
import { BarChart, type BarChartDatum } from "@/components/arc/bar-chart/bar-chart";
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
  activity: Activity[];
  today: string;
}

export function DashboardView({ data }: { data: DashboardData }) {
  return (
    <AppScreen title="Dashboard" meta={data.teamName}>
      <div className="tt-stack">
        <div className="tt-grid">{data.metrics.map(metric => <MetricCard key={metric.label} {...metric} />)}</div>
        <BarChart data={data.hours} label="Hours logged" period={data.hoursPeriod} unit="h" averageLabel="Daily average" categoryLabel="Day" formatValue={value => value.toFixed(1)} />
        <ActivityHeatmap days={data.checkIns} label="Team check-ins" period={data.checkInPeriod} unit={{ one: "check-in", other: "check-ins" }} weekStartsOn={1} />
        <ActivityFeed items={data.activity} incoming={[]} today={data.today} title="Activity" />
      </div>
    </AppScreen>
  );
}
