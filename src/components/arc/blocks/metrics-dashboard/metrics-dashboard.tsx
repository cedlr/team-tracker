"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Activity, ArrowDown, ArrowDownRight, ArrowUp, ArrowUpRight, Bookmark, CalendarDays, CalendarRange, Check, ChevronRight, Copy, Download, FileText, LayoutDashboard,
  ListFilter, Mail, MapPin, MonitorSmartphone, Plus, RotateCcw, Search, ShieldCheck, Signpost, Target, X,
} from "lucide-react";
import { ScreenShell, ScreenShellMark, useScreenShell } from "../../screen-shell/screen-shell";
import type { ScreenShellNavItem, ScreenShellSection, ScreenShellTone } from "../../screen-shell/screen-shell";
import { Button } from "../../button/button";
import SegmentedControl from "../../segmented-control/segmented-control";
import { DropdownMenu } from "../../dropdown-menu/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "../../popover/popover";
import { SearchField } from "../../search-field/search-field";
import { AnimatedCounter } from "../../animated-counter/animated-counter";
import { Switch } from "../../switch/switch";
import { motionTokens } from "../../lib/motion-tokens";
import { avatar } from "../../lib/media";
import {
  aggregate, breakdown, countFormat, dateAt, dayFormat, dimLabel, formatDuration, goals, metrics, previousSpan, profileFor, rangeOptions, rowsFor,
  seriesFor, sites, slice, spanFor, spanLabel,
} from "./metrics-dashboard-data";
import type { BreakdownRow, Dim, Filter, Goal, MetricKey, RangeKey, RangeSpan, SiteId } from "./metrics-dashboard-data";
import { CountValue, Logo, MainChart, Sparkline, cx, instant, useEdgeFade } from "./metrics-dashboard-parts";
import styles from "./metrics-dashboard.module.css";

/* ------------------------------------------------------------------ Configuration */

type GroupId = "pages" | "sources" | "locations" | "devices";
type PageId = "overview" | GroupId | "goals";

const groups: { id: GroupId; label: string; tabs: { dim: Dim; label: string; noun: string }[] }[] = [
  { id: "pages", label: "Pages", tabs: [{ dim: "page", label: "Top pages", noun: "pages" }, { dim: "entry", label: "Entry pages", noun: "entry pages" }] },
  { id: "sources", label: "Sources", tabs: [{ dim: "source", label: "Referrers", noun: "referrers" }, { dim: "campaign", label: "Campaigns", noun: "campaigns" }] },
  { id: "locations", label: "Locations", tabs: [{ dim: "country", label: "Countries", noun: "countries" }, { dim: "city", label: "Cities", noun: "cities" }] },
  { id: "devices", label: "Devices", tabs: [{ dim: "device", label: "Devices", noun: "device types" }, { dim: "browser", label: "Browsers", noun: "browsers" }, { dim: "os", label: "Systems", noun: "systems" }] },
];

const nav: ScreenShellNavItem[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "pages", label: "Pages", icon: FileText },
  { id: "sources", label: "Sources", icon: Signpost },
  { id: "locations", label: "Locations", icon: MapPin },
  { id: "devices", label: "Devices", icon: MonitorSmartphone },
  { id: "goals", label: "Goals", icon: Target, count: goals.length },
];

/* Halden's mark is the wedge (a disc with one slice lifted, a pie chart in motion); each site wears it in its own tone. */
const siteTone: Record<SiteId, ScreenShellTone> = { web: "violet", docs: "sky", status: "amber" };

interface SavedView { id: string; label: string; site: SiteId; range: RangeKey; custom?: RangeSpan; filters: Filter[] }

const launchStart = 200 - 1 - 8; // 3 Nov, counted back from 11 Nov
const initialViews: SavedView[] = [
  { id: "view-launch", label: "Launch week", site: "web", range: "custom", custom: { start: launchStart, end: launchStart + 6 }, filters: [] },
  { id: "view-pricing", label: "Pricing page", site: "web", range: "30d", filters: [{ dim: "page", id: "/pricing" }] },
  { id: "view-organic", label: "Organic search", site: "web", range: "90d", filters: [{ dim: "source", id: "google" }] },
  { id: "view-dach", label: "DACH visitors", site: "web", range: "30d", filters: [{ dim: "country", id: "DE" }, { dim: "country", id: "CH" }] },
];
const rangeShort: Record<RangeKey, string> = { "7d": "7d", "30d": "30d", "90d": "90d", mtd: "Nov", lastMonth: "Oct", custom: "" };

type Detail = { kind: "row"; dim: Dim; id: string } | { kind: "goal"; id: string };
const detailKey = (detail: Detail) => detail.kind === "goal" ? `goal:${detail.id}` : `${detail.dim}:${detail.id}`;

const percentDelta = (now: number, before: number) => before ? ((now - before) / before) * 100 : 0;

export interface MetricsDashboardProps {
  /** The site the screen opens on. Default "web" (halden.io). */
  defaultSite?: SiteId;
  /** The starting date range. Default "30d". */
  defaultRange?: Exclude<RangeKey, "custom">;
  /** The metric the main chart starts on. Default "visitors". */
  defaultMetric?: MetricKey;
  className?: string;
}

/**
 * A complete product analytics screen inside the Arc screen shell: sites in the workspace switcher, saved views, a date
 * range, filters, five KPI tabs over one inspectable chart with drag to zoom, breakdowns by page, source, location and
 * device, goals, full tables per dimension and a detail panel for any row. All figures are sample data.
 */
export function MetricsDashboard({ defaultSite = "web", defaultRange = "30d", defaultMetric = "visitors", className }: MetricsDashboardProps = {}) {
  const [site, setSite] = useState<SiteId>(defaultSite);
  const [activeId, setActiveId] = useState<string>("overview");
  const [range, setRangeState] = useState<RangeKey>(defaultRange);
  const [custom, setCustom] = useState<RangeSpan | undefined>();
  const [beforeZoom, setBeforeZoom] = useState<RangeKey | null>(null);
  const [metricKey, setMetricKey] = useState<MetricKey>(defaultMetric);
  const [compare, setCompare] = useState(false);
  const [filters, setFiltersState] = useState<Filter[]>([]);
  const [excludeInternal, setExcludeInternal] = useState(true);
  const [weeklyEmail, setWeeklyEmail] = useState(true);
  const [views, setViews] = useState<SavedView[]>(initialViews);
  const [tabs, setTabs] = useState<Record<GroupId, Dim>>({ pages: "page", sources: "source", locations: "country", devices: "device" });
  const [detail, setDetail] = useState<Detail | null>(null);
  const [focusDetail, setFocusDetail] = useState(0);

  const view = views.find(v => v.id === activeId);
  const page: PageId = view ? "overview" : (activeId as PageId);
  const siteInfo = sites.find(s => s.id === site)!;

  /* A saved view stays selected only while it matches what is on screen. */
  const leaveView = useCallback(() => { setActiveId(current => current.startsWith("view-") ? "overview" : current); }, []);
  const setFilters = useCallback((next: Filter[] | ((current: Filter[]) => Filter[])) => { setFiltersState(next); leaveView(); }, [leaveView]);
  const setRange = useCallback((next: RangeKey, span?: RangeSpan) => { setRangeState(next); setCustom(span); if (next !== "custom") setBeforeZoom(null); leaveView(); }, [leaveView]);

  const changeSite = useCallback((id: SiteId) => {
    setSite(id);
    setDetail(null);
    // Pages differ per site, so page filters that do not exist on the new site fall away.
    setFiltersState(current => current.filter(f => rowsFor(id, f.dim).some(row => row.id === f.id)));
    leaveView();
  }, [leaveView]);

  const navigate = (id: string) => {
    const saved = views.find(v => v.id === id);
    setDetail(null);
    if (saved) {
      setSite(saved.site);
      setFiltersState(saved.filters);
      setRangeState(saved.range);
      setCustom(saved.custom);
      setBeforeZoom(null);
    }
    setActiveId(id);
  };

  const saveView = () => {
    const label = filters.length
      ? filters.slice(0, 2).map(f => rowsFor(site, f.dim).find(r => r.id === f.id)?.label ?? f.id).join(", ") + (filters.length > 2 ? ` and ${filters.length - 2} more` : "")
      : range === "custom" && custom ? spanLabel(custom) : rangeOptions.find(o => o.key === range)?.label ?? "New view";
    const id = `view-${Date.now().toString(36)}`;
    setViews(current => [...current.slice(-7), { id, label, site, range, custom, filters }]);
    setActiveId(id);
  };

  const toggleFilter = useCallback((filter: Filter) => {
    setFilters(current => current.some(f => f.dim === filter.dim && f.id === filter.id) ? current.filter(f => !(f.dim === filter.dim && f.id === filter.id)) : [...current, filter]);
  }, [setFilters]);

  /* Data */
  const profile = useMemo(() => profileFor(site, filters, excludeInternal), [site, filters, excludeInternal]);
  const series = useMemo(() => seriesFor(site, profile), [site, profile]);
  const span = spanFor(range, custom);
  const prevSpan = previousSpan(span);
  const current = useMemo(() => slice(series, span), [series, span.start, span.end]); // eslint-disable-line react-hooks/exhaustive-deps
  const previous = useMemo(() => slice(series, prevSpan), [series, prevSpan.start, prevSpan.end]); // eslint-disable-line react-hooks/exhaustive-deps
  const totals = useMemo(() => Object.fromEntries(metrics.map(m => {
    const now = aggregate(current, m.key);
    const before = aggregate(previous, m.key);
    return [m.key, { value: now, previous: before, delta: m.unit === "percent" ? now - before : percentDelta(now, before) }];
  })) as Record<MetricKey, { value: number; previous: number; delta: number }>, [current, previous]);
  const base = useMemo(() => ({
    visitors: totals.visitors.value, previous: totals.visitors.previous,
    ppv: totals.pageviews.value / (totals.visitors.value || 1), bounce: totals.bounce.value, duration: totals.duration.value,
    conv: totals.signups.value / (totals.visitors.value || 1),
  }), [totals]);
  const rowsOf = useCallback((dim: Dim) => breakdown(site, dim, filters, base, profile.key), [site, filters, base, profile.key]);

  const rangeLabel = range === "custom" ? spanLabel(span) : rangeOptions.find(o => o.key === range)!.label;
  const title = view ? view.label : nav.find(n => n.id === page)?.label ?? "Overview";

  /* Export: a real CSV of what the page shows, saved through the browser. */
  const exportCsv = () => {
    let lines: string[][];
    if (page === "overview") lines = [["date", ...metrics.map(m => m.key)], ...current.map((d, i) => [dateAt(span.start + i).toISOString().slice(0, 10), Math.round(d.visitors), Math.round(d.pageviews), Math.round(d.signups), d.bounce.toFixed(1), Math.round(d.duration)].map(String))];
    else if (page === "goals") lines = [["goal", "uniques", "total"], ...goals.map(g => { const u = goalUniques(g, totals); return [g.label, String(Math.round(u)), String(Math.round(u * g.per))]; })];
    else {
      const dim = tabs[page];
      lines = [[dimLabel[dim].toLowerCase(), "visitors", "pageviews", "bounce_rate", "visit_duration_s", "signups"], ...rowsOf(dim).map(r => [r.label, Math.round(r.visitors), Math.round(r.pageviews), r.bounce.toFixed(1), Math.round(r.duration), Math.round(r.signups)].map(String))];
    }
    const blob = new Blob([lines.map(line => line.map(cell => /[",]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell).join(",")).join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${siteInfo.name}-${page}-${dateAt(span.start).toISOString().slice(0, 10)}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const openDetail = useCallback((next: Detail, viaKeyboard: boolean) => {
    setDetail(next);
    if (viaKeyboard) setFocusDetail(n => n + 1);
  }, []);

  /* The sidebar's one section: saved views as real rows (what each one filters, and over which range), not a tag list. */
  const sections: ScreenShellSection[] = [{
    id: "views", label: "Saved views", icon: Bookmark, items: [],
    content: <SavedViews views={views} activeId={activeId} onOpen={navigate} />,
    action: { label: "Save current view", icon: Plus, onSelect: saveView },
  }];

  const pageProps = { site, filters, rowsOf, totals, base, detail, openDetail };

  return <div className={cx(styles.screen, className)}>
    <ScreenShell
      aria-label="Analytics"
      workspace={{
        name: siteInfo.name,
        options: sites.map(s => ({ id: s.id, name: s.name, detail: s.detail, tone: siteTone[s.id], mark: <ScreenShellMark name="Halden" variant="wedge" tone={siteTone[s.id]} /> })),
        activeId: site,
        onSelect: id => changeSite(id as SiteId),
      }}
      nav={nav}
      sections={sections}
      activeId={activeId}
      onNavigate={id => navigate(id)}
      search={{ placeholder: "Search" }}
      account={{
        name: "Chloe Nguyen", detail: "chloe@halden.io", avatar: avatar("chloe-nguyen"),
        menu: [
          { id: "weekly", label: "Weekly email report", icon: Mail, checked: weeklyEmail, onSelect: () => setWeeklyEmail(v => !v) },
          { id: "internal", label: "Exclude internal traffic", icon: ShieldCheck, checked: excludeInternal, onSelect: () => setExcludeInternal(v => !v) },
        ],
      }}
      sidebarFooter={<Realtime site={site} />}
      header={{
        breadcrumbs: view ? [{ id: "site", label: siteInfo.name }, { id: "views", label: "Saved views" }] : [{ id: "site", label: siteInfo.name }],
        title,
        actions: <>
          <RangeMenu range={range} label={rangeLabel} onSelect={key => setRange(key)} />
          <ExportButton onExport={exportCsv} />
        </>,
      }}
      scroll={false}
      padding="none"
    >
      <div className={styles.page}>
        <FilterBar site={site} filters={filters} onToggle={toggleFilter} onClear={() => setFilters([])}
          note={compare && page === "overview" ? `${spanLabel(span)}, compared with ${spanLabel(prevSpan)}` : spanLabel(span)} />
        <div className={styles.body}>
          <PageScroll pageKey={page}>
            {page === "overview" && <Overview {...pageProps} metricKey={metricKey} onMetric={setMetricKey} compare={compare} onCompare={setCompare} series={current} prevSeries={previous} spanStart={span.start}
              viewKey={`${site}-${range}-${span.start}-${span.end}-${metricKey}-${profile.key}`} zoomed={range === "custom"} canReset={beforeZoom !== null}
              onZoom={(from, to) => { if (range !== "custom") setBeforeZoom(range); setRangeState("custom"); setCustom({ start: span.start + from, end: span.start + to }); leaveView(); }}
              onResetZoom={() => { setRange(beforeZoom ?? "30d"); }}
              tabs={tabs} onTab={(group, dim) => setTabs(t => ({ ...t, [group]: dim }))} onViewAll={group => navigate(group)} />}
            {page !== "overview" && page !== "goals" && <DimensionPage {...pageProps} group={groups.find(g => g.id === page)!} dim={tabs[page]} onTab={dim => setTabs(t => ({ ...t, [page]: dim }))} />}
            {page === "goals" && <GoalsPage {...pageProps} />}
          </PageScroll>
          <DetailPanel detail={detail} focusSignal={focusDetail} onClose={() => setDetail(null)} site={site} siteName={siteInfo.name} filters={filters} onToggleFilter={toggleFilter}
            rowsOf={rowsOf} profileKey={profile.key} base={base} totals={totals} series={current} spanStart={span.start} />
        </div>
      </div>
    </ScreenShell>
  </div>;
}

/* ------------------------------------------------------------------ Shared types for pages */

type Totals = Record<MetricKey, { value: number; previous: number; delta: number }>;
type Base = { visitors: number; previous: number; ppv: number; bounce: number; duration: number; conv: number };
interface PageProps {
  site: SiteId; filters: Filter[]; rowsOf: (dim: Dim) => BreakdownRow[]; totals: Totals; base: Base;
  detail: Detail | null; openDetail: (detail: Detail, viaKeyboard: boolean) => void;
}

function goalUniques(goal: Goal, totals: Totals, which: "value" | "previous" = "value") {
  return (goal.base === "signups" ? totals.signups[which] : totals.visitors[which]) * goal.rate;
}

/* ------------------------------------------------------------------ Sidebar parts */

/** What a saved view narrows to, drawn as its own glyph: the source's logo, a page, a place or a date range. */
function ViewGlyph({ view }: { view: SavedView }) {
  const first = view.filters[0];
  const row = first ? rowsFor(view.site, first.dim).find(r => r.id === first.id) : undefined;
  if (row?.logo) return <Logo id={row.logo} size={16} />;
  const Icon = !first ? CalendarRange : first.dim === "page" || first.dim === "entry" ? FileText : first.dim === "country" || first.dim === "city" ? MapPin
    : first.dim === "source" || first.dim === "campaign" ? Signpost : MonitorSmartphone;
  return <Icon size={16} strokeWidth={1.75} aria-hidden="true" />;
}

function viewMeta(view: SavedView) {
  if (view.range === "custom" && view.custom) return dayFormat.format(dateAt(view.custom.start));
  return rangeShort[view.range];
}

/** Saved views as rows: a glyph for what each one filters, its name and its range. The open view takes a calm fill in place. */
function SavedViews({ views, activeId, onOpen }: { views: SavedView[]; activeId: string; onOpen: (id: string) => void }) {
  // Like the shell's own rows, opening a view closes the sidebar sheet on compact frames.
  const { compact, closeSidebar } = useScreenShell();
  return <ul className={styles.views}>
    {views.map(view => {
      const current = view.id === activeId;
      const filterText = view.filters.length > 1 ? `${view.filters.length} filters` : view.filters.length === 1 ? "1 filter" : "No filters";
      return <li key={view.id}>
        <button type="button" className={styles.viewRow} aria-current={current ? "page" : undefined} onClick={() => { onOpen(view.id); if (compact) closeSidebar(); }}
          aria-label={`${view.label}, ${filterText}, ${view.range === "custom" && view.custom ? spanLabel(view.custom) : rangeOptions.find(o => o.key === view.range)?.label ?? ""}`}>
          <span className={styles.viewGlyph}><ViewGlyph view={view} /></span>
          <span className={styles.viewLabel}>{view.label}</span>
          <span className={styles.viewMeta}>{viewMeta(view)}</span>
        </button>
      </li>;
    })}
  </ul>;
}

/** Thirty one-minute buckets ending now, seeded per site. The newest bucket follows the live count. */
function minuteBuckets(site: SiteId, baseline: number) {
  const seed = site === "web" ? 1.3 : site === "docs" ? 2.1 : 3.7;
  return Array.from({ length: 30 }, (_, i) => Math.max(1, baseline * (0.62 + Math.sin(i * 0.55 + seed) * 0.16 + Math.sin(i * 1.9 + seed * 2) * 0.09 + i * 0.006)));
}

/** The realtime footer: who is on the site now and the last half hour by minute. */
function Realtime({ site }: { site: SiteId }) {
  const baseline = site === "web" ? 142 : site === "docs" ? 87 : 19;
  const [live, setLive] = useState(baseline);
  const [lastSite, setLastSite] = useState(site);
  if (lastSite !== site) { setLastSite(site); setLive(baseline); }
  useEffect(() => {
    let step = 0;
    const timer = window.setInterval(() => {
      step += 1;
      setLive(v => Math.max(4, Math.round(v + Math.sin(step * 1.7 + baseline) * baseline * .04)));
    }, 4000);
    return () => window.clearInterval(timer);
  }, [baseline]);
  const buckets = useMemo(() => minuteBuckets(site, baseline), [site, baseline]);
  const bars = [...buckets.slice(0, -1), live * 0.66];
  const max = Math.max(...bars, 1);
  return <div className={styles.realtime} role="group" aria-label="Realtime">
    <div className={styles.realtimeHead}>
      <Activity size={16} strokeWidth={1.75} className={styles.realtimeIcon} aria-hidden="true" />
      <span className={styles.realtimeLabel}>Online now</span>
      <span className={styles.realtimeValue} aria-live="polite"><AnimatedCounter value={live} /></span>
    </div>
    <div className={styles.realtimeBars} aria-hidden="true">
      {bars.map((value, i) => <span key={i} style={{ transform: `scaleY(${Math.max(.08, value / max).toFixed(3)})` }} />)}
    </div>
    <div className={styles.realtimeAxis} aria-hidden="true"><span>30 min ago</span><span>Now</span></div>
  </div>;
}

/* ------------------------------------------------------------------ Header parts */

/** Arc's dropdown menu: the current range carries a check, and the trigger shortens on a phone. */
function RangeMenu({ range, label, onSelect }: { range: RangeKey; label: string; onSelect: (key: Exclude<RangeKey, "custom">) => void }) {
  const { size } = useScreenShell();
  const short = range === "custom" ? label : rangeOptions.find(o => o.key === range)!.short;
  return <DropdownMenu label={size === "phone" ? short : label} icon={<CalendarDays size={16} strokeWidth={1.75} />}
    items={rangeOptions.map(option => ({
      label: option.label,
      icon: range === option.key ? <Check size={16} strokeWidth={1.75} /> : <span />,
      onSelect: () => onSelect(option.key),
    }))} />;
}

/** Exports, then confirms in place with Arc's Button label crossfade. On a phone it is an icon button. */
function ExportButton({ onExport }: { onExport: () => void }) {
  const { size } = useScreenShell();
  const [done, setDone] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const icon = done ? <Check size={16} strokeWidth={1.75} aria-hidden="true" /> : <Download size={16} strokeWidth={1.75} aria-hidden="true" />;
  return <>
    <Button variant="secondary" size="sm" className={size === "phone" ? styles.iconOnly : undefined} aria-label={done ? "Exported" : "Export CSV"}
      onClick={() => { onExport(); setDone(true); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setDone(false), 1800); }}>
      {/* Both labels share one grid cell, so the button keeps the width of "Exported" and nothing moves when it confirms. */}
      {size === "phone" ? icon : <>{icon}<span className={styles.swapLabel} aria-hidden="true"><span data-hidden={done ? "" : undefined}>Export</span><span data-hidden={done ? undefined : ""}>Exported</span></span></>}
    </Button>
    <span className={styles.srOnly} aria-live="polite">{done ? "CSV exported" : ""}</span>
  </>;
}

/* ------------------------------------------------------------------ Filters */

const filterDims: Dim[] = ["page", "source", "campaign", "country", "device", "browser", "os"];

function FilterBar({ site, filters, onToggle, onClear, note }: { site: SiteId; filters: Filter[]; onToggle: (filter: Filter) => void; onClear: () => void; note: string }) {
  const reduce = useReducedMotion();
  return <div className={styles.toolbar}>
    <div className={styles.chips} role="group" aria-label="Filters">
      <AnimatePresence initial={false} mode="popLayout">
        {filters.map(filter => {
          const row = rowsFor(site, filter.dim).find(r => r.id === filter.id);
          const text = `${dimLabel[filter.dim]} is ${row?.label ?? filter.id}`;
          return <motion.button layout={!reduce} key={`${filter.dim}:${filter.id}`} type="button" className={styles.chip} aria-label={`Remove filter: ${text}`} onClick={() => onToggle(filter)}
            initial={reduce ? false : { opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} exit={reduce ? { opacity: 0, transition: instant } : { opacity: 0, scale: .96, transition: { duration: motionTokens.duration.exit } }}
            transition={reduce ? instant : motionTokens.spring.snappy}>
            {row?.logo && <Logo id={row.logo} size={14} />}
            <span className={styles.chipDim}>{dimLabel[filter.dim]} is</span>
            <span className={styles.chipValue}>{row?.label ?? filter.id}</span>
            <X size={13} strokeWidth={1.75} className={styles.chipX} aria-hidden="true" />
          </motion.button>;
        })}
        <motion.div layout={!reduce} key="add" className={styles.chipTools} transition={reduce ? instant : motionTokens.spring.snappy}>
          <AddFilter site={site} filters={filters} onToggle={onToggle} />
          {filters.length > 1 && <Button variant="ghost" size="sm" onClick={onClear}>Clear all</Button>}
        </motion.div>
      </AnimatePresence>
    </div>
    <span className={styles.toolbarNote}>{note}</span>
  </div>;
}

function AddFilter({ site, filters, onToggle }: { site: SiteId; filters: Filter[]; onToggle: (filter: Filter) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const setOpenState = (next: boolean) => { setOpen(next); if (!next) { setQuery(""); setActive(0); } };

  const q = query.trim().toLowerCase();
  const options = filterDims.flatMap(dim => rowsFor(site, dim)
    .filter(row => !q || row.label.toLowerCase().includes(q) || dimLabel[dim].toLowerCase().includes(q))
    .slice(0, q ? 12 : 4)
    .map(row => ({ dim, row, on: filters.some(f => f.dim === dim && f.id === row.id) })));
  const safeActive = Math.min(active, Math.max(0, options.length - 1));

  const onKey = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setActive((safeActive + (event.key === "ArrowDown" ? 1 : -1) + options.length) % Math.max(1, options.length)); }
    if (event.key === "Home" && !query) { event.preventDefault(); setActive(0); }
    if (event.key === "End" && !query) { event.preventDefault(); setActive(options.length - 1); }
    if (event.key === "Enter" && options[safeActive]) { event.preventDefault(); onToggle({ dim: options[safeActive].dim, id: options[safeActive].row.id }); setOpenState(false); }
  };

  return <Popover open={open} onOpenChange={setOpenState}>
    <PopoverTrigger asChild>
      <Button variant="ghost" size="sm" className={styles.addFilter} aria-haspopup="dialog"><ListFilter size={16} strokeWidth={1.75} aria-hidden="true" />Filter</Button>
    </PopoverTrigger>
    <PopoverContent align="start" aria-label="Add a filter" className={styles.filterPop}>
      <label className={styles.filterSearch}>
        <Search size={16} strokeWidth={1.75} aria-hidden="true" />
        <input value={query} onChange={event => { setQuery(event.target.value); setActive(0); }} onKeyDown={onKey} placeholder="Filter by page, source, country…"
          role="combobox" aria-expanded="true" aria-controls={listId} aria-activedescendant={options[safeActive] ? `${listId}-${safeActive}` : undefined} aria-autocomplete="list" spellCheck={false} autoComplete="off" />
      </label>
      <FadeList id={listId} activeIndex={safeActive}>
        {options.length === 0 && <p className={styles.empty}>No values match “{query.trim()}”</p>}
        {options.map((option, index) => {
          const head = index === 0 || options[index - 1].dim !== option.dim;
          return <div key={`${option.dim}:${option.row.id}`}>
            {head && <div className={styles.filterGroup} aria-hidden="true">{dimLabel[option.dim]}</div>}
            <div id={`${listId}-${index}`} role="option" aria-selected={index === safeActive} data-index={index} data-active={index === safeActive ? "" : undefined} className={styles.filterOption}
              onPointerMove={() => setActive(index)} onPointerDown={event => event.preventDefault()}
              onClick={() => { onToggle({ dim: option.dim, id: option.row.id }); setOpenState(false); }}>
              <span className={styles.optionMarker}>{option.row.logo ? <Logo id={option.row.logo} size={16} /> : option.row.code && option.dim === "country" ? <span className={styles.code}>{option.row.code}</span> : null}</span>
              <span className={styles.optionLabel}>{option.row.label}</span>
              {option.on && <Check size={16} strokeWidth={1.75} className={styles.optionCheck} aria-label="Applied" />}
            </div>
          </div>;
        })}
      </FadeList>
    </PopoverContent>
  </Popover>;
}

/** The option list mounts with the popover, so its edge fades attach when it opens. The keyboard highlight lands instantly and stays in view. */
function FadeList({ id, activeIndex, children }: { id: string; activeIndex: number; children: ReactNode }) {
  const ref = useEdgeFade<HTMLDivElement>("y");
  useEffect(() => { ref.current?.querySelector(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: "nearest" }); }, [activeIndex, ref]);
  return <div ref={ref} id={id} role="listbox" aria-label="Filter values" className={styles.filterList}>{children}</div>;
}

/** The detail body scrolls inside the panel with a hidden scrollbar and edge fades; it mounts per row, so the fades attach each time. */
function FadeBody({ children }: { children: ReactNode }) {
  const ref = useEdgeFade<HTMLDivElement>("y");
  return <div ref={ref} className={styles.detailScroll}>{children}</div>;
}

/* ------------------------------------------------------------------ Scroll region */

function PageScroll({ pageKey, children }: { pageKey: string; children: ReactNode }) {
  const ref = useEdgeFade<HTMLDivElement>("y");
  const reduce = useReducedMotion();
  // The first page appears as is; later pages fade in. Adjusting state during render rather than in an effect.
  const [lastKey, setLastKey] = useState(pageKey);
  const [navigated, setNavigated] = useState(false);
  if (lastKey !== pageKey) { setLastKey(pageKey); setNavigated(true); }
  useEffect(() => { ref.current?.scrollTo({ top: 0 }); }, [pageKey, ref]);
  return <div ref={ref} className={styles.scroller}>
    {/* The new page fades in over a cleared region: one quick fade, no wait for the old page to leave. */}
    <motion.div key={pageKey} className={styles.content} initial={reduce || !navigated ? false : { opacity: 0 }} animate={{ opacity: 1 }}
      transition={reduce ? instant : { duration: motionTokens.duration.standard, ease: motionTokens.ease.standard }}>
      {children}
    </motion.div>
  </div>;
}

/* ------------------------------------------------------------------ Overview */

function Delta({ value, unit, lowerIsBetter, compact }: { value: number; unit: "count" | "percent" | "seconds"; lowerIsBetter?: boolean; compact?: boolean }) {
  const good = Math.abs(value) < .05 ? null : lowerIsBetter ? value < 0 : value > 0;
  const text = unit === "percent" ? `${Math.abs(value).toFixed(1)} pts` : `${Math.abs(value).toFixed(1)}%`;
  return <span className={styles.delta} data-good={good === true ? "" : undefined} data-bad={good === false ? "" : undefined} data-compact={compact ? "" : undefined}>
    {value >= 0 ? <ArrowUpRight size={13} strokeWidth={2} aria-hidden="true" /> : <ArrowDownRight size={13} strokeWidth={2} aria-hidden="true" />}
    {text}
    <span className={styles.srOnly}>{value >= 0 ? "up" : "down"} on the previous period</span>
  </span>;
}

/** A KPI figure on Arc's animated counter. A duration rolls its minutes and seconds as two wheels. */
function MetricFigure({ unit, value }: { unit: "count" | "percent" | "seconds"; value: number }) {
  if (unit === "percent") return <AnimatedCounter value={Math.round(value * 10) / 10} decimals={1} suffix="%" />;
  if (unit === "seconds") {
    const s = Math.round(value);
    if (s < 60) return <AnimatedCounter value={s} suffix="s" />;
    return <span className={styles.duration}><AnimatedCounter value={Math.floor(s / 60)} suffix="m" /><AnimatedCounter value={s % 60} suffix="s" /></span>;
  }
  return <AnimatedCounter value={Math.round(value)} />;
}

function Overview({ metricKey, onMetric, compare, onCompare, series, prevSeries, spanStart, viewKey, zoomed, canReset, onZoom, onResetZoom, tabs, onTab, onViewAll, ...page }: PageProps & {
  metricKey: MetricKey; onMetric: (key: MetricKey) => void; compare: boolean; onCompare: (on: boolean) => void; series: ReturnType<typeof slice>; prevSeries: ReturnType<typeof slice>; spanStart: number;
  viewKey: string; zoomed: boolean; canReset: boolean; onZoom: (from: number, to: number) => void; onResetZoom: () => void;
  tabs: Record<GroupId, Dim>; onTab: (group: GroupId, dim: Dim) => void; onViewAll: (group: GroupId) => void;
}) {
  const uid = useId();
  const stripRef = useEdgeFade<HTMLDivElement>("x");
  const metric = metrics.find(m => m.key === metricKey)!;
  const points = useMemo(() => series.map((d, i) => ({ date: dateAt(spanStart + i), value: d[metricKey], previous: prevSeries[i]?.[metricKey] ?? 0 })), [series, prevSeries, metricKey, spanStart]);

  const onTabsKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const index = metrics.findIndex(m => m.key === metricKey);
    const next = event.key === "ArrowRight" ? (index + 1) % metrics.length : event.key === "ArrowLeft" ? (index - 1 + metrics.length) % metrics.length : event.key === "Home" ? 0 : event.key === "End" ? metrics.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault();
    onMetric(metrics[next].key);
    const tab = event.currentTarget.querySelectorAll<HTMLElement>("[role=tab]")[next];
    tab?.focus({ preventScroll: true });
    tab?.scrollIntoView({ block: "nearest", inline: "nearest" });
  };

  return <>
    <section className={styles.chartCard} aria-label="Key metrics">
      <div ref={stripRef} className={styles.kpiStrip}>
        <div className={styles.kpis} role="tablist" aria-label="Metric" onKeyDown={onTabsKey}>
          {metrics.map(m => {
            const total = page.totals[m.key];
            const selected = m.key === metricKey;
            return <button key={m.key} type="button" role="tab" id={`${uid}-${m.key}`} aria-selected={selected} aria-controls={`${uid}-chart`} tabIndex={selected ? 0 : -1} className={styles.kpi}
              onClick={() => onMetric(m.key)}>
              <span className={styles.kpiLabel}>{m.label}</span>
              <span className={styles.kpiValue}><MetricFigure unit={m.unit} value={total.value} /></span>
              <Delta value={total.delta} unit={m.unit} lowerIsBetter={m.lowerIsBetter} />
            </button>;
          })}
        </div>
      </div>
      <div className={styles.chartBody} id={`${uid}-chart`} role="tabpanel" aria-labelledby={`${uid}-${metricKey}`}>
        <div className={styles.chartHead}>
          <div className={styles.legend}>
            <span><i className={styles.swatch} />{metric.label}</span>
            {compare && <span><i className={styles.swatchPrevious} />Previous period</span>}
          </div>
          <div className={styles.chartTools}>
            {zoomed && canReset
              ? <Button variant="ghost" size="sm" onClick={onResetZoom}><RotateCcw size={16} strokeWidth={1.75} aria-hidden="true" />Reset zoom</Button>
              : <span className={styles.chartHint}>Drag across the chart to zoom</span>}
            <Switch className={styles.compare} label="Compare" aria-label="Compare with the previous period" checked={compare} onCheckedChange={onCompare} />
          </div>
        </div>
        <MainChart points={points} metric={metric} compare={compare} viewKey={viewKey} onZoom={onZoom} />
      </div>
    </section>

    <div className={styles.cards}>
      {groups.map(group => <BreakdownCard key={group.id} group={group} dim={tabs[group.id]} onTab={dim => onTab(group.id, dim)} onViewAll={() => onViewAll(group.id)} {...page} />)}
      <GoalsCard {...page} />
    </div>
  </>;
}

/** Roving arrows between the rows of one list or table. */
function onRowKeys(event: ReactKeyboardEvent<HTMLElement>) {
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
  const target = event.target as HTMLElement;
  if (!target.matches("[data-row]")) return;
  const rows = [...event.currentTarget.querySelectorAll<HTMLElement>("[data-row]")];
  const index = rows.indexOf(target);
  const next = event.key === "Home" ? rows[0] : event.key === "End" ? rows.at(-1) : rows[index + (event.key === "ArrowDown" ? 1 : -1)];
  if (!next) return;
  event.preventDefault();
  next.focus({ preventScroll: true });
  next.scrollIntoView({ block: "nearest" });
}

/** Arc's segmented control for the views inside a card or a table page. */
function CardTabs({ tabs, value, onChange, label }: { tabs: { dim: Dim; label: string }[]; value: Dim; onChange: (dim: Dim) => void; label: string }) {
  return <SegmentedControl className={styles.cardTabs} label={label} options={tabs.map(tab => ({ value: tab.dim, label: tab.label }))} value={value} onValueChange={next => onChange(next as Dim)} />;
}

function RowMarker({ row }: { row: { logo?: BreakdownRow["logo"]; code?: string; dim: Dim } }) {
  if (row.logo) return <span className={styles.rowMarker}><Logo id={row.logo} /></span>;
  if (row.code && (row.dim === "country" || row.dim === "city")) return <span className={styles.rowMarker}><span className={styles.code}>{row.code}</span></span>;
  return null;
}

function BreakdownCard({ group, dim, onTab, onViewAll, rowsOf, detail, openDetail }: PageProps & { group: (typeof groups)[number]; dim: Dim; onTab: (dim: Dim) => void; onViewAll: () => void }) {
  const reduce = useReducedMotion();
  const all = rowsOf(dim);
  const rows = all.slice(0, 7);
  const max = Math.max(...rows.map(r => r.visitors), 1);
  const openKey = detail ? detailKey(detail) : null;
  return <section className={styles.card} aria-label={group.label}>
    <div className={styles.cardHead}>
      <CardTabs tabs={group.tabs} value={dim} onChange={onTab} label={group.label} />
      <span className={styles.cardColumn}>Visitors</span>
    </div>
    <AnimatePresence initial={false} mode="wait">
      <motion.ul key={dim} className={styles.list} onKeyDown={onRowKeys} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={reduce ? instant : { duration: motionTokens.duration.fast }}>
        {rows.map(row => {
          const key = `${row.dim}:${row.id}`;
          return <li key={row.id}>
            <button type="button" data-row="" data-detail-key={key} className={styles.listRow} aria-current={openKey === key ? "true" : undefined}
              onClick={event => openDetail({ kind: "row", dim: row.dim, id: row.id }, event.detail === 0)}>
              <span className={styles.bar} style={{ transform: `scaleX(${(row.visitors / max).toFixed(4)})` }} aria-hidden="true" />
              <RowMarker row={row} />
              <span className={styles.rowName} title={row.label}>{row.label}</span>
              <span className={styles.rowShare}>{(row.share * 100).toFixed(row.share < .1 ? 1 : 0)}%</span>
              <span className={styles.rowValue}><CountValue value={row.visitors} format={v => countFormat.format(Math.round(v))} /></span>
            </button>
          </li>;
        })}
        {rows.length === 0 && <li className={styles.empty}>No {group.tabs.find(t => t.dim === dim)?.noun} for these filters</li>}
      </motion.ul>
    </AnimatePresence>
    <button type="button" className={styles.cardFoot} onClick={onViewAll}>
      {all.length > 1 ? `View all ${all.length} ${group.tabs.find(t => t.dim === dim)?.noun}` : "Open the full table"}<ChevronRight size={14} strokeWidth={1.75} aria-hidden="true" />
    </button>
  </section>;
}

function GoalsCard({ totals, detail, openDetail }: PageProps) {
  const openKey = detail ? detailKey(detail) : null;
  const visitors = totals.visitors.value || 1;
  return <section className={cx(styles.card, styles.goalsCard)} aria-label="Goals">
    <div className={styles.cardHead}>
      <h3 className={styles.cardTitle}>Goals</h3>
      <span className={styles.goalCols}><span>Uniques</span><span>Conversion</span></span>
    </div>
    <ul className={styles.list} onKeyDown={onRowKeys}>
      {goals.map(goal => {
        const uniques = goalUniques(goal, totals);
        const key = `goal:${goal.id}`;
        const rate = (uniques / visitors) * 100;
        return <li key={goal.id}>
          <button type="button" data-row="" data-detail-key={key} className={cx(styles.listRow, styles.goalRow)} aria-current={openKey === key ? "true" : undefined}
            onClick={event => openDetail({ kind: "goal", id: goal.id }, event.detail === 0)}>
            <span className={styles.goalText}><span className={styles.rowName}>{goal.label}</span><span className={styles.goalDetail}>{goal.detail}</span></span>
            <span className={styles.rowValue}><CountValue value={uniques} format={v => countFormat.format(Math.round(v))} /></span>
            <span className={styles.goalRate}>
              <span className={styles.meter} aria-hidden="true"><span style={{ transform: `scaleX(${Math.min(1, rate / 6).toFixed(4)})` }} /></span>
              <span className={styles.rowValue}>{rate.toFixed(2)}%</span>
            </span>
          </button>
        </li>;
      })}
    </ul>
  </section>;
}

/* ------------------------------------------------------------------ Tables */

type SortKey = "label" | "visitors" | "change" | "pageviews" | "bounce" | "duration" | "signups";

function SortHeader({ id, label, sort, onSort, className }: { id: SortKey; label: string; sort: { key: SortKey; dir: "asc" | "desc" }; onSort: (key: SortKey) => void; className?: string }) {
  const on = sort.key === id;
  return <th scope="col" className={className} aria-sort={on ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
    <button type="button" className={styles.sortButton} data-on={on ? "" : undefined} onClick={() => onSort(id)}>
      {label}
      <span className={styles.sortIcon} aria-hidden="true">{on && sort.dir === "asc" ? <ArrowUp size={12} strokeWidth={2} /> : <ArrowDown size={12} strokeWidth={2} />}</span>
    </button>
  </th>;
}

function DimensionPage({ group, dim, onTab, rowsOf, base, detail, openDetail }: PageProps & { group: (typeof groups)[number]; dim: Dim; onTab: (dim: Dim) => void }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "visitors", dir: "desc" });
  const [query, setQuery] = useState("");
  const all = rowsOf(dim);
  const q = query.trim().toLowerCase();
  const rows = useMemo(() => {
    const value = (row: BreakdownRow) => sort.key === "label" ? row.label : sort.key === "change" ? percentDelta(row.visitors, row.previous) : row[sort.key];
    return all.filter(row => !q || row.label.toLowerCase().includes(q)).sort((a, b) => {
      const x = value(a), y = value(b);
      const order = typeof x === "string" ? x.localeCompare(String(y)) : x - (y as number);
      return sort.dir === "asc" ? order : -order;
    });
  }, [all, q, sort]);
  const max = Math.max(...all.map(r => r.visitors), 1);
  const openKey = detail ? detailKey(detail) : null;
  const onSort = (key: SortKey) => setSort(current => current.key === key ? { key, dir: current.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "label" ? "asc" : "desc" });
  const tab = group.tabs.find(t => t.dim === dim)!;

  return <section className={styles.tablePage} aria-label={group.label}>
    <div className={styles.tableTools}>
      <CardTabs tabs={group.tabs} value={dim} onChange={d => { onTab(d); setQuery(""); }} label={group.label} />
      <span className={styles.tableCount}>{rows.length} of {all.length} {tab.noun}</span>
      <div className={styles.tableSearch}>
        <SearchField label={`Search ${tab.noun}`} value={query} onValueChange={setQuery} placeholder={`Search ${tab.noun}`} spellCheck={false} autoComplete="off"
          onKeyDown={event => { if (event.key === "Escape" && query) { event.preventDefault(); event.stopPropagation(); setQuery(""); } }} />
      </div>
    </div>
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <SortHeader id="label" label={dimLabel[dim]} sort={sort} onSort={onSort} className={styles.colName} />
            <SortHeader id="visitors" label="Visitors" sort={sort} onSort={onSort} />
            <SortHeader id="change" label="Change" sort={sort} onSort={onSort} className={styles.colChange} />
            <SortHeader id="pageviews" label="Page views" sort={sort} onSort={onSort} className={styles.colViews} />
            <SortHeader id="bounce" label="Bounce rate" sort={sort} onSort={onSort} className={styles.colBounce} />
            <SortHeader id="duration" label="Duration" sort={sort} onSort={onSort} className={styles.colDuration} />
            <SortHeader id="signups" label="Signups" sort={sort} onSort={onSort} className={styles.colSignups} />
          </tr>
        </thead>
        <tbody onKeyDown={onRowKeys}>
          {rows.map(row => {
            const key = `${row.dim}:${row.id}`;
            const change = percentDelta(row.visitors, row.previous);
            return <tr key={row.id} className={styles.tr} aria-current={openKey === key ? "true" : undefined} onClick={() => openDetail({ kind: "row", dim: row.dim, id: row.id }, false)}>
              <td className={styles.colName}>
                <button type="button" data-row="" data-detail-key={key} className={styles.cellButton} onClick={event => { event.stopPropagation(); openDetail({ kind: "row", dim: row.dim, id: row.id }, event.detail === 0); }}>
                  <span className={styles.bar} style={{ transform: `scaleX(${(row.visitors / max).toFixed(4)})` }} aria-hidden="true" />
                  <RowMarker row={row} />
                  <span className={styles.rowName}>{row.label}</span>
                </button>
              </td>
              <td><CountValue value={row.visitors} format={v => countFormat.format(Math.round(v))} /></td>
              <td className={styles.colChange}><Delta value={change} unit="count" compact /></td>
              <td className={styles.colViews}>{countFormat.format(Math.round(row.pageviews))}</td>
              <td className={styles.colBounce}>{row.bounce.toFixed(1)}%</td>
              <td className={styles.colDuration}>{formatDuration(row.duration)}</td>
              <td className={styles.colSignups}>{countFormat.format(Math.round(row.signups))}<span className={styles.cellMuted}> {((row.signups / (row.visitors || 1)) * 100).toFixed(1)}%</span></td>
            </tr>;
          })}
        </tbody>
      </table>
      {rows.length === 0 && <p className={styles.empty}>{q ? `No ${tab.noun} match “${query.trim()}”` : `No ${tab.noun} for these filters`}</p>}
    </div>
    <p className={styles.tableFoot}>Averages for this range: {formatDuration(base.duration)} per visit, {base.bounce.toFixed(1)}% bounce rate, {base.ppv.toFixed(1)} pages per visit.</p>
  </section>;
}

function GoalsPage({ totals, detail, openDetail }: PageProps) {
  const openKey = detail ? detailKey(detail) : null;
  const visitors = totals.visitors.value || 1;
  return <section className={styles.tablePage} aria-label="Goals">
    <div className={styles.tableTools}>
      <span className={styles.tableCount}>{goals.length} goals, counted once per visitor</span>
    </div>
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col" className={styles.colName}><span className={styles.thText}>Goal</span></th>
            <th scope="col"><span className={styles.thText}>Uniques</span></th>
            <th scope="col" className={styles.colViews}><span className={styles.thText}>Total</span></th>
            <th scope="col"><span className={styles.thText}>Conversion</span></th>
            <th scope="col" className={styles.colChange}><span className={styles.thText}>Change</span></th>
          </tr>
        </thead>
        <tbody onKeyDown={onRowKeys}>
          {goals.map(goal => {
            const uniques = goalUniques(goal, totals);
            const before = goalUniques(goal, totals, "previous");
            const key = `goal:${goal.id}`;
            return <tr key={goal.id} className={styles.tr} aria-current={openKey === key ? "true" : undefined} onClick={() => openDetail({ kind: "goal", id: goal.id }, false)}>
              <td className={styles.colName}>
                <button type="button" data-row="" data-detail-key={key} className={styles.cellButton} onClick={event => { event.stopPropagation(); openDetail({ kind: "goal", id: goal.id }, event.detail === 0); }}>
                  <span className={styles.goalText}><span className={styles.rowName}>{goal.label}</span><span className={styles.goalDetail}>{goal.detail}</span></span>
                </button>
              </td>
              <td><CountValue value={uniques} format={v => countFormat.format(Math.round(v))} /></td>
              <td className={styles.colViews}>{countFormat.format(Math.round(uniques * goal.per))}</td>
              <td>{((uniques / visitors) * 100).toFixed(2)}%</td>
              <td className={styles.colChange}><Delta value={percentDelta(uniques, before)} unit="count" compact /></td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>
  </section>;
}

/* ------------------------------------------------------------------ Detail panel */

/**
 * Floats over the right of the page instead of docking, so opening it never reflows the dashboard. It follows the
 * selected row, closes on Escape, the close button or a press outside, and returns focus to the row it came from.
 */
function DetailPanel({ detail, focusSignal, onClose, site, siteName, filters, onToggleFilter, rowsOf, profileKey, base, totals, series, spanStart }: {
  detail: Detail | null; focusSignal: number; onClose: () => void; site: SiteId; siteName: string; filters: Filter[]; onToggleFilter: (filter: Filter) => void;
  rowsOf: (dim: Dim) => BreakdownRow[]; profileKey: string; base: Base; totals: Totals; series: ReturnType<typeof slice>; spanStart: number;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const lastKey = useRef<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(copyTimer.current), []);
  const key = detail ? detailKey(detail) : null;
  useEffect(() => { if (key) lastKey.current = key; }, [key]);

  const close = useCallback((restore: boolean) => {
    onClose();
    const k = lastKey.current;
    if (restore && k) requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-detail-key="${CSS.escape(k)}"]`)?.focus({ preventScroll: true }));
  }, [onClose]);

  useEffect(() => { if (focusSignal) requestAnimationFrame(() => closeRef.current?.focus({ preventScroll: true })); }, [focusSignal]);

  useEffect(() => {
    if (!detail) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (document.querySelector("[role=menu], [role=dialog][aria-label='Add a filter']")) return;
      close(ref.current?.contains(document.activeElement) || (document.activeElement as HTMLElement | null)?.matches("[data-detail-key]") === true);
    };
    const onDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement;
      if (ref.current?.contains(target) || target.closest("[data-detail-key], tr, [role=menu]")) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => { window.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onDown); };
  }, [detail, close, onClose]);

  const content = useMemo(() => {
    if (!detail) return null;
    if (detail.kind === "goal") {
      const goal = goals.find(g => g.id === detail.id)!;
      const uniques = goalUniques(goal, totals);
      const before = goalUniques(goal, totals, "previous");
      const daily = series.map((d, i) => (goal.base === "signups" ? d.signups : d.visitors) * goal.rate * (1 + Math.sin(i * 1.3 + goal.rate * 9) * .08));
      const sources = rowsOf("source").map(r => ({ ...r, value: r.signups * goal.rate })).sort((a, b) => b.value - a.value).slice(0, 5);
      return {
        kind: "Goal", title: goal.label, marker: null as ReactNode, sub: goal.detail, value: uniques, delta: percentDelta(uniques, before), daily,
        stats: [
          { label: "Total events", value: countFormat.format(Math.round(uniques * goal.per)) },
          { label: "Conversion", value: `${((uniques / (totals.visitors.value || 1)) * 100).toFixed(2)}%` },
          { label: "Per visitor", value: goal.per.toFixed(1) },
          { label: "Event name", value: goal.id.replace(/-/g, "_") },
        ],
        listTitle: "Top sources", list: sources.map(r => ({ id: r.id, label: r.label, logo: r.logo, value: r.value })),
        copy: { label: "Copy event name", text: goal.id.replace(/-/g, "_") }, filter: null as Filter | null,
      };
    }
    const row = rowsOf(detail.dim).find(r => r.id === detail.id) ?? breakdown(site, detail.dim, [], base, "").find(r => r.id === detail.id);
    if (!row) return null;
    const otherDim: Dim = detail.dim === "source" || detail.dim === "campaign" ? "page" : detail.dim === "country" ? "city" : "source";
    const scoped = breakdown(site, otherDim, [...filters.filter(f => f.dim !== detail.dim), { dim: detail.dim, id: detail.id }], { ...base, visitors: row.visitors, previous: row.previous }, profileKey + detail.id).slice(0, 5);
    const daily = series.map((d, i) => d.visitors * row.share * (1 + Math.sin(i * .8 + row.label.length) * .12));
    const isPage = detail.dim === "page" || detail.dim === "entry";
    return {
      kind: dimLabel[detail.dim], title: row.label, marker: <RowMarker row={row} />, sub: `${(row.share * 100).toFixed(1)}% of visitors`, value: row.visitors, delta: percentDelta(row.visitors, row.previous), daily,
      stats: [
        { label: "Page views", value: countFormat.format(Math.round(row.pageviews)) },
        { label: "Bounce rate", value: `${row.bounce.toFixed(1)}%` },
        { label: "Visit duration", value: formatDuration(row.duration) },
        { label: "Signups", value: `${countFormat.format(Math.round(row.signups))}` },
      ],
      listTitle: otherDim === "page" ? "Top pages" : otherDim === "city" ? "Top cities" : "Top sources",
      list: scoped.map(r => ({ id: r.id, label: r.label, logo: r.logo, value: r.visitors })),
      copy: isPage ? { label: "Copy URL", text: `https://${siteName}${row.id === "/" ? "" : row.id}` } : null,
      filter: { dim: detail.dim, id: detail.id } as Filter | null,
    };
  }, [detail, rowsOf, site, filters, base, profileKey, series, totals, siteName]);

  const filtered = content?.filter ? filters.some(f => f.dim === content.filter!.dim && f.id === content.filter!.id) : false;
  const listMax = content ? Math.max(...content.list.map(i => i.value), 1) : 1;

  return <AnimatePresence>
    {detail && content && <motion.aside ref={ref} key="panel" className={styles.detail} aria-label={`Details for ${content.title}`}
      initial={reduce ? { opacity: 0 } : { opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0, transition: reduce ? instant : { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] } }}
      exit={{ opacity: 0, x: reduce ? 0 : 12, transition: reduce ? instant : { duration: motionTokens.duration.exit, ease: [...motionTokens.ease.standard] } }}>
      <Button ref={closeRef} variant="ghost" size="sm" className={cx(styles.iconOnly, styles.detailClose)} aria-label="Close details" onClick={() => close(true)}><X size={16} strokeWidth={1.75} aria-hidden="true" /></Button>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.div key={key} className={styles.detailBody} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={reduce ? instant : { duration: motionTokens.duration.fast, ease: motionTokens.ease.standard }}>
          <FadeBody>
          <h3 className={styles.detailTitle}>{content.marker}<span>{content.title}</span></h3>
          <p className={styles.detailSub}>{content.kind}, {content.sub.charAt(0).toLowerCase() + content.sub.slice(1)}</p>
          <div className={styles.detailFigure}>
            <span className={styles.detailValue}><AnimatedCounter value={Math.round(content.value)} /></span>
            <span className={styles.detailUnit}>{detail.kind === "goal" ? "uniques" : "visitors"}</span>
            <Delta value={content.delta} unit="count" />
          </div>
          <Sparkline values={content.daily} label={`Daily ${detail.kind === "goal" ? "uniques" : "visitors"} for ${content.title}`} />
          <div className={styles.sparkAxis} aria-hidden="true"><span>{dayFormat.format(dateAt(spanStart))}</span><span>{dayFormat.format(dateAt(spanStart + series.length - 1))}</span></div>
          <dl className={styles.stats}>
            {content.stats.map(stat => <div key={stat.label}><dt>{stat.label}</dt><dd>{stat.value}</dd></div>)}
          </dl>
          <h4 className={styles.detailListTitle}>{content.listTitle}</h4>
          <ul className={styles.detailList}>
            {content.list.map(item => <li key={item.id}>
              <span className={styles.bar} style={{ transform: `scaleX(${(item.value / listMax).toFixed(4)})` }} aria-hidden="true" />
              {item.logo && <span className={styles.rowMarker}><Logo id={item.logo} /></span>}
              <span className={styles.rowName}>{item.label}</span>
              <span className={styles.rowValue}>{countFormat.format(Math.round(item.value))}</span>
            </li>)}
            {content.list.length === 0 && <li className={styles.empty}>Nothing recorded yet</li>}
          </ul>
          </FadeBody>
        </motion.div>
      </AnimatePresence>
      <div className={styles.detailActions}>
        {content.filter && <Button variant="primary" size="sm" className={styles.detailButton} onClick={() => onToggleFilter(content.filter!)}>
          {filtered ? <><X size={16} strokeWidth={1.75} aria-hidden="true" />Remove filter</> : <><ListFilter size={16} strokeWidth={1.75} aria-hidden="true" />Add filter</>}
        </Button>}
        {content.copy && <Button variant="secondary" size="sm" className={styles.detailButton} onClick={() => {
          const done = () => { setCopied(true); window.clearTimeout(copyTimer.current); copyTimer.current = window.setTimeout(() => setCopied(false), 1600); };
          navigator.clipboard?.writeText(content.copy!.text).then(done, done);
        }}>
          {copied ? <><Check size={16} strokeWidth={1.75} aria-hidden="true" />Copied</> : <><Copy size={16} strokeWidth={1.75} aria-hidden="true" />{content.copy.label}</>}
        </Button>}
        <span className={styles.srOnly} aria-live="polite">{copied ? "Copied" : ""}</span>
      </div>
    </motion.aside>}
  </AnimatePresence>;
}

export default MetricsDashboard;
