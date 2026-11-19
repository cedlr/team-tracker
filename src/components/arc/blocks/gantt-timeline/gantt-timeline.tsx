"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { RefObject } from "react";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "motion/react";
import { CalendarClock, ChartGantt, ChevronDown, CircleUserRound, Crosshair, History, Link2, ListFilter, ListTodo, LogOut, Milestone, Plus, RotateCcw, TriangleAlert, Undo2, Users, X, Check } from "lucide-react";
import { motionTokens } from "../../lib/motion-tokens";
import { Button } from "../../button/button";
import { Checkbox } from "../../checkbox/checkbox";
import { Kbd } from "../../kbd/kbd";
import { Popover, PopoverContent, PopoverTrigger } from "../../popover/popover";
import { ScreenShell, ScreenShellButton, ScreenShellMark, useScreenShell } from "../../screen-shell/screen-shell";
import type { ScreenShellSection } from "../../screen-shell/screen-shell";
import { SearchField } from "../../search-field/search-field";
import SegmentedControl from "../../segmented-control/segmented-control";
import { Select } from "../../select/select";
import { COLLAPSED, GROUPS, ME, TASKS, TEAMS, TODAY, UPDATES } from "./gantt-timeline-data";
import type { GanttGroup, GanttTask, GanttTeam, GanttUpdate } from "./gantt-timeline-data";
import type { GanttGrouping, GanttZoom, Plan } from "./gantt-timeline-model";
import { DAY, buildLanes, buildPlans, clamp, cx, doneShare, parse, short, toIso } from "./gantt-timeline-model";
import { Chart } from "./gantt-timeline-chart";
import type { ChartHandle } from "./gantt-timeline-chart";
import { Details, Summary } from "./gantt-timeline-panel";
import { Face, GanttWhoProvider, MilestoneGlyph, StatusIcon, sampleWho, useCopy, useGanttWho } from "./gantt-timeline-parts";
import type { GanttPerson } from "./gantt-timeline-parts";
import { ListView, UpdatesView } from "./gantt-timeline-views";
import styles from "./gantt-timeline.module.css";

export type { GanttGroup, GanttLink, GanttLinkKind, GanttTask, GanttTeam, GanttTone, GanttUpdate } from "./gantt-timeline-data";
export type { GanttGrouping, GanttZoom } from "./gantt-timeline-model";
export interface GanttChange { id: string; start: string; end: string; kind: "move" | "resize" | "undo" | "reset" | "edit" | "add" | "delete" }

/**
 * A full roadmap screen inside the Arc app shell. The timeline groups tasks by phase, team, or owner. Drag a bar to move it
 * and drag either edge to change its dates; both snap to whole days with a live date label. Dependency arrows re-route every
 * frame as bars move, and turn red when a task starts before the one it waits on ends. Zoom glides between day, week, and
 * month around the middle of the view. Selecting a task opens it in the details panel, where owner, team, dates and progress
 * can be edited. A list view and an updates feed read the same plan.
 * Keyboard: Tab to a bar, up and down arrows move between bars, Alt with left or right moves a bar by a day, and Alt with
 * Shift changes its end date. "/" focuses the filter.
 */
export interface GanttTimelineProps {
  /** Project name, in the breadcrumbs and the overview panel. */
  title?: string;
  groups?: GanttGroup[];
  tasks?: GanttTask[];
  defaultTasks?: GanttTask[];
  onTasksChange?: (tasks: GanttTask[], change: GanttChange) => void;
  /** ISO date of today, which places the today line. */
  today?: string;
  zoom?: GanttZoom;
  defaultZoom?: GanttZoom;
  onZoomChange?: (zoom: GanttZoom) => void;
  /** Ids of folded groups. Team lanes use "team:<id>" and owner lanes "owner:<person id>". */
  collapsed?: string[];
  defaultCollapsed?: string[];
  onCollapsedChange?: (ids: string[]) => void;
  /** Teams that own tasks. They colour the bars and power grouping by team. */
  teams?: GanttTeam[];
  /** team-tracker: real people. Owners resolve to these names and photos instead of the sample portraits. */
  people?: GanttPerson[];
  /** team-tracker: the signed-in member, for "My tasks" and new bars. */
  viewerId?: string;
  /** How rows are grouped on first render. */
  defaultGrouping?: GanttGrouping;
  /** Seed entries for the updates feed, newest first. */
  updates?: GanttUpdate[];
  /** Workspace name in the sidebar and breadcrumbs. */
  workspace?: string;
  className?: string;
}

type View = "timeline" | "list" | "updates";
const VIEW_TITLE: Record<View, string> = { timeline: "Timeline", list: "List", updates: "Updates" };
const ZOOMS: { value: GanttZoom; label: string }[] = [{ value: "day", label: "Day" }, { value: "week", label: "Week" }, { value: "month", label: "Month" }];
const GROUPINGS: { value: GanttGrouping; label: string }[] = [{ value: "phase", label: "By phase" }, { value: "team", label: "By team" }, { value: "owner", label: "By owner" }];
const PANEL_DOCKED_FROM = 1080;

const subscribe = () => () => {};
/** Wall clock for update ids and edit merging. Only ever read inside event handlers. */
const clock = () => Date.now();
function useReducedFlag() {
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  return !!useReducedMotion() && hydrated;
}

type ShellApi = ReturnType<typeof useScreenShell>;
/** Hands the shell's controls to the screen, which lives outside the shell's context. */
function ShellBridge({ bridgeRef }: { bridgeRef: RefObject<ShellApi | null> }) {
  const shell = useScreenShell();
  useLayoutEffect(() => { bridgeRef.current = shell; }, [bridgeRef, shell]);
  return null;
}

export function GanttTimeline({
  title = "Atlas 4.0", groups = GROUPS, tasks: tasksProp, defaultTasks = TASKS, onTasksChange, today = TODAY,
  zoom: zoomProp, defaultZoom = "week", onZoomChange, collapsed: collapsedProp, defaultCollapsed = COLLAPSED, onCollapsedChange,
  teams = TEAMS, people: roster, viewerId = ME, defaultGrouping = "phase", updates: seedUpdates = UPDATES, workspace = "Waypoint", className,
}: GanttTimelineProps) {
  const reduced = useReducedFlag();
  const rootRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ChartHandle | null>(null);
  const bridge = useRef<ShellApi | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const lastEdit = useRef<{ key: string; time: number } | null>(null);

  const [innerTasks, setInnerTasks] = useState(defaultTasks);
  const tasks = tasksProp ?? innerTasks;
  const [innerZoom, setInnerZoom] = useState<GanttZoom>(defaultZoom);
  const zoom = zoomProp ?? innerZoom;
  const [innerCollapsed, setInnerCollapsed] = useState(defaultCollapsed);
  const collapsed = collapsedProp ?? innerCollapsed;
  const [grouping, setGrouping] = useState<GanttGrouping>(defaultGrouping);
  const [history, setHistory] = useState<GanttTask[][]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<View>("timeline");
  const [filter, setFilter] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [owners, setOwners] = useState<string[]>([]);
  const who = useCallback((id: string) => {
    const person = roster?.find(entry => entry.id === id);
    return person ? { name: person.name, role: person.role ?? "", src: person.src ?? "" } : sampleWho(id);
  }, [roster]);
  const [feed, setFeed] = useState<GanttUpdate[]>(seedUpdates);
  const [unread, setUnread] = useState(Math.min(3, seedUpdates.length));
  const [unreadShown, setUnreadShown] = useState(0);
  const [status, setStatus] = useState<{ text: string; tone?: "danger" }>({ text: "Drag a bar to move it, or its edges to change dates" });
  const [workspaceId, setWorkspaceId] = useState("waypoint");
  const [signedOut, setSignedOut] = useState(false);
  const [docked, setDocked] = useState(true);
  const [counter, setCounter] = useState(1);
  const { copied, copy } = useCopy();

  // The calendar spans the plan with room on both sides, starting on a Monday.
  const [range] = useState(() => {
    const starts = defaultTasks.map(task => parse(task.start)), ends = defaultTasks.map(task => parse(task.milestone ? task.start : task.end));
    const first = Math.min(...starts, parse(today)) - 7 * DAY, last = Math.max(...ends, parse(today)) + 28 * DAY;
    const origin = first - ((new Date(first).getUTCDay() + 6) % 7) * DAY;
    return { origin, days: Math.ceil((last - origin) / DAY / 7) * 7 };
  });
  const { origin, days } = range;
  const todayDay = Math.round((parse(today) - origin) / DAY);
  const dateOf = (day: number) => origin + day * DAY;
  const label = (start: number, len: number, milestone?: boolean) => milestone || len <= 1
    ? short.format(dateOf(start)) : `${short.format(dateOf(start))} to ${short.format(dateOf(start + len - 1))}, ${len} days`;

  const plans = useMemo(() => buildPlans(tasks, origin, todayDay, teams), [tasks, origin, todayDay, teams]);
  const planOf = new Map(plans.map(plan => [plan.task.id, plan]));
  const lanes = useMemo(() => buildLanes(grouping, plans, groups, teams, id => who(id).name), [grouping, plans, groups, teams, who]);
  const people = useMemo(() => {
    if (roster?.length) return roster.map(person => person.id);
    const list: string[] = [];
    defaultTasks.forEach(task => { if (task.assignee && !list.includes(task.assignee)) list.push(task.assignee); });
    return list;
  }, [defaultTasks, roster]);

  const q = query.trim().toLowerCase();
  const inFilter = (id: string | null, plan: (typeof plans)[number]) => {
    if (!id) return true;
    if (id === "view-mine") return plan.task.assignee === viewerId;
    if (id === "view-risk") return plan.status === "conflict" || plan.status === "behind";
    if (id === "view-soon") return plan.status !== "done" && plan.start <= todayDay + 13 && plan.start + Math.max(1, plan.len) > todayDay;
    return true;
  };
  const visible = new Set(plans.filter(plan => (!q || plan.task.name.toLowerCase().includes(q)) && (!owners.length || (plan.task.assignee && owners.includes(plan.task.assignee))) && inFilter(filter, plan)).map(plan => plan.task.id));
  const share = Math.round(doneShare(plans) * 100);

  useLayoutEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const measure = () => setDocked(node.clientWidth >= PANEL_DOCKED_FROM);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Shortcuts while the screen has focus (or nothing does): "/" filters, Escape returns the panel to the overview.
  const selectedRef = useRef(selectedId);
  useLayoutEffect(() => { selectedRef.current = selectedId; }, [selectedId]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const root = rootRef.current, target = event.target as HTMLElement;
      if (!root || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (!(root.contains(target) || target === document.body)) return;
      if (target.closest("input, textarea, select, [contenteditable]")) return;
      if (event.key === "/" && searchRef.current) { event.preventDefault(); searchRef.current.focus(); }
      // An open sheet or menu takes Escape first; the shell closes it.
      else if (event.key === "Escape" && selectedRef.current && !root.querySelector("[role=menu], [role=listbox], [data-variant][data-sheet], [data-variant][data-panel-sheet]")) setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ------------------------------------------------------------------ Writing the plan */

  function write(next: GanttTask[], change: GanttChange, record = true) {
    if (record) setHistory(list => [...list.slice(-29), tasks]);
    if (tasksProp === undefined) setInnerTasks(next);
    onTasksChange?.(next, change);
  }

  function log(text: string, task?: string, key?: string) {
    const entry: GanttUpdate = { id: `you-${clock()}`, text, task, at: "Just now" };
    setFeed(list => key && lastEdit.current?.key === key && list[0]?.id.startsWith("you-") ? [entry, ...list.slice(1)] : [entry, ...list]);
    setUnread(count => view === "updates" ? count : Math.min(9, count + (key && lastEdit.current?.key === key ? 0 : 1)));
  }

  function commit(id: string, start: number, len: number, kind: "move" | "resize") {
    const plan = planOf.get(id);
    if (!plan || (plan.start === start && plan.len === len)) return;
    const task = plan.task;
    const nextTask = { ...task, start: toIso(dateOf(start)), end: toIso(dateOf(task.milestone ? start : start + len - 1)) };
    lastEdit.current = null;
    write(tasks.map(item => item.id === id ? nextTask : item), { id, start: nextTask.start, end: nextTask.end, kind });
    const blockers = (nextTask.dependsOn ?? []).map(dep => planOf.get(dep)).filter((before): before is NonNullable<typeof before> => !!before && start < before.start + before.len);
    const waiting = plans.filter(other => other.task.dependsOn?.includes(id) && other.start < start + Math.max(len, 0));
    const where = label(start, len, task.milestone);
    if (blockers.length) setStatus({ text: `${task.name} now starts before ${blockers[0].task.name}${blockers[0].task.milestone ? "" : " ends"}`, tone: "danger" });
    else if (waiting.length) setStatus({ text: `${waiting[0].task.name} now starts before ${task.name}${task.milestone ? "" : " ends"}`, tone: "danger" });
    else setStatus({ text: `${task.name}: ${where}` });
    log(`moved ${task.name} to ${task.milestone ? short.format(dateOf(start)) : `${short.format(dateOf(start))} to ${short.format(dateOf(start + len - 1))}`}`, id);
  }

  function edit(id: string, patch: Partial<GanttTask>, text: string) {
    const task = tasks.find(item => item.id === id);
    if (!task) return;
    const key = `${id}:${Object.keys(patch).join(",")}`;
    const now = clock();
    // A slider drag is one change: edits to the same field within a moment fold into one undo step and one update.
    const merge = lastEdit.current?.key === key && now - lastEdit.current.time < 1500;
    write(tasks.map(item => item.id === id ? { ...item, ...patch } : item), { id, start: task.start, end: task.end, kind: "edit" }, !merge);
    log(text, id, merge ? key : undefined);
    lastEdit.current = { key, time: now };
    setStatus({ text: `${text.charAt(0).toUpperCase()}${text.slice(1)}` });
  }

  function undo() {
    const previous = history.at(-1);
    if (!previous) return;
    setHistory(list => list.slice(0, -1));
    lastEdit.current = null;
    const changed = previous.find(task => { const now = tasks.find(item => item.id === task.id); return !now || JSON.stringify(now) !== JSON.stringify(task); }) ?? tasks.find(task => !previous.some(item => item.id === task.id));
    write(previous, { id: changed?.id ?? "", start: changed?.start ?? "", end: changed?.end ?? "", kind: "undo" }, false);
    if (selectedId && !previous.some(task => task.id === selectedId)) setSelectedId(null);
    setStatus({ text: changed ? `Undid the change to ${changed.name}` : "Undone" });
  }

  function reset() {
    setHistory([]);
    lastEdit.current = null;
    write(defaultTasks, { id: "", start: "", end: "", kind: "reset" }, false);
    setSelectedId(null);
    setStatus({ text: "Plan reset to its first version" });
  }

  function addTask() {
    const base = selectedId ? planOf.get(selectedId)?.task : undefined;
    const id = `new-${counter}`;
    setCounter(value => value + 1);
    const start = clamp(todayDay, 0, days - 6);
    const task: GanttTask = { id, name: "Untitled task", group: base?.group ?? groups[0]?.id ?? "build", team: base?.team ?? teams[0]?.id ?? "mobile", start: toIso(dateOf(start)), end: toIso(dateOf(start + 4)), progress: 0, assignee: viewerId };
    const at = base ? tasks.findIndex(item => item.id === base.id) + 1 : tasks.length;
    lastEdit.current = null;
    write([...tasks.slice(0, at), task, ...tasks.slice(at)], { id, start: task.start, end: task.end, kind: "add" });
    // The new task must be on screen: clear what would hide it and unfold its lane.
    setQuery(""); setOwners([]); setFilter(null);
    const laneId = grouping === "phase" ? task.group : grouping === "team" ? `team:${task.team}` : `owner:${viewerId}`;
    if (collapsed.includes(laneId)) setCollapsed(collapsed.filter(item => item !== laneId));
    if (view === "updates") setView("timeline");
    setSelectedId(id);
    openPanel();
    log(`added a task to ${groups.find(group => group.id === task.group)?.name ?? "the plan"}`, id);
    setStatus({ text: "Added Untitled task. Name it in the details panel" });
    chartRef.current?.reveal(id);
  }

  function remove(id: string) {
    const task = tasks.find(item => item.id === id);
    if (!task) return;
    lastEdit.current = null;
    write(tasks.filter(item => item.id !== id).map(item => item.dependsOn?.includes(id) ? { ...item, dependsOn: item.dependsOn.filter(dep => dep !== id) } : item), { id, start: task.start, end: task.end, kind: "delete" });
    setSelectedId(null);
    log(`deleted ${task.name}`);
    setStatus({ text: `Deleted ${task.name}. Undo brings it back` });
  }

  function setCollapsed(next: string[]) {
    if (collapsedProp === undefined) setInnerCollapsed(next);
    onCollapsedChange?.(next);
  }

  function setZoom(next: GanttZoom) {
    if (next === zoom) return;
    if (zoomProp === undefined) setInnerZoom(next);
    onZoomChange?.(next);
  }

  /** The details panel opens on demand: selecting a task or a milestone opens it, docked or as a sheet; the header button opens the overview. */
  function openPanel() { bridge.current?.setPanelOpen(true); }

  function select(id: string | null, open: boolean) {
    setSelectedId(id);
    if (id && open) openPanel();
  }

  function jump(id: string) {
    const plan = planOf.get(id);
    if (!plan) return;
    if (!visible.has(id)) { setQuery(""); setOwners([]); setFilter(null); }
    const laneId = grouping === "phase" ? plan.task.group : grouping === "team" ? `team:${plan.task.team ?? "none"}` : `owner:${plan.task.assignee ?? "none"}`;
    if (collapsed.includes(laneId)) setCollapsed(collapsed.filter(item => item !== laneId));
    setSelectedId(id);
    chartRef.current?.reveal(id);
  }

  /** A milestone in the sidebar opens on the timeline (or the list it is already in) with its details. */
  function openMilestone(id: string) {
    if (view === "updates") setView("timeline");
    jump(id);
    openPanel();
    if (bridge.current?.compact) bridge.current.closeSidebar();
  }

  function navigate(id: string) {
    if (id === "timeline" || id === "list") { setView(id); setFilter(null); return; }
    if (id === "updates") { setView("updates"); setUnreadShown(unread); setUnread(0); return; }
    setFilter(id);
    if (view === "updates") setView("timeline");
  }

  /* ------------------------------------------------------------------ Shell */

  const harbor = workspaceId !== "waypoint";
  const openCount = (predicate: (plan: Plan) => boolean) => plans.filter(plan => plan.status !== "done" && predicate(plan)).length || undefined;
  const milestones = plans.filter(plan => plan.task.milestone).sort((a, b) => a.start - b.start);
  const milestoneList = <ul className={styles.milestones}>
    {milestones.map(plan => <li key={plan.task.id}>
      <button type="button" className={styles.milestoneRow} data-past={plan.status === "done" || undefined} aria-pressed={selectedId === plan.task.id}
        aria-label={`${plan.task.name}, ${short.format(dateOf(plan.start))}${plan.status === "done" ? ", reached" : plan.status === "conflict" ? ", starts before the work it waits on" : ""}`}
        onClick={() => openMilestone(plan.task.id)}>
        <MilestoneGlyph status={plan.status} tone={plan.tone} />
        <span className={styles.milestoneName}>{plan.task.name}</span>
        <span className={styles.milestoneWhen}>{short.format(dateOf(plan.start))}</span>
      </button>
    </li>)}
  </ul>;
  const sections: ScreenShellSection[] = [
    { id: "milestones", label: "Milestones", icon: Milestone, items: [], content: milestoneList },
    {
      id: "views", label: "Saved views", icon: ListFilter, items: [
        { id: "view-mine", label: "My tasks", icon: CircleUserRound, count: openCount(plan => plan.task.assignee === viewerId) },
        { id: "view-risk", label: "At risk", icon: TriangleAlert, count: openCount(plan => plan.status === "conflict" || plan.status === "behind") },
        { id: "view-soon", label: "Next two weeks", icon: CalendarClock, count: openCount(plan => inFilter("view-soon", plan)) },
      ],
    },
  ];
  const filterLabel = filter ? sections.flatMap(section => section.items).find(item => item.id === filter)?.label : undefined;
  const visibleCount = plans.filter(plan => visible.has(plan.task.id)).length;
  const order = lanes.flatMap(lane => lane.members.filter(plan => visible.has(plan.task.id)));
  const selected = selectedId ? planOf.get(selectedId) : undefined;
  const position = selected ? { index: order.findIndex(plan => plan.task.id === selected.task.id), total: order.length } : { index: 0, total: 0 };

  const fadeX = (box: HTMLElement) => {
    box.toggleAttribute("data-fl", box.scrollLeft > 1);
    box.toggleAttribute("data-fr", box.scrollLeft < box.scrollWidth - box.clientWidth - 1);
  };
  const fadeY = (box: HTMLElement) => {
    box.toggleAttribute("data-ft", box.scrollTop > 1);
    box.toggleAttribute("data-fb", box.scrollTop < box.scrollHeight - box.clientHeight - 1);
  };

  const panelContent = harbor || signedOut ? null : <div className={styles.panelScroll} data-fade="y" data-sheet={docked ? undefined : ""} onScroll={event => fadeY(event.currentTarget)} ref={node => { if (node) fadeY(node); }}>
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div key={selected ? "details" : "summary"} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: reduced ? 0 : motionTokens.duration.exit } }}
        transition={{ duration: reduced ? 0 : motionTokens.duration.fast, ease: [...motionTokens.ease.standard] }}>
        {selected
          ? <Details plan={selected} plans={plans} groups={groups} teams={teams} people={people} updates={feed.filter(update => update.task === selected.task.id)}
            origin={origin} days={days} todayDay={todayDay} copied={copied} onCopy={copy} position={position}
            onEdit={(patch, text) => edit(selected.task.id, patch, text)} onDates={(start, len) => commit(selected.task.id, start, len, len === selected.len ? "move" : "resize")}
            onDelete={() => remove(selected.task.id)} onBack={() => setSelectedId(null)} onSelect={jump}
            onStep={dir => { const next = order[position.index + dir]; if (next) jump(next.task.id); }} />
          : <Summary title={title} plans={plans} teams={teams} origin={origin} todayDay={todayDay} onSelect={id => { jump(id); openPanel(); }} visibleCount={visibleCount} />}
      </motion.div>
    </AnimatePresence>
  </div>;

  const ownerCounts = new Map(people.map(id => [id, plans.filter(plan => plan.task.assignee === id).length]));
  const toolbar = <div className={styles.toolbar}>
    <div className={styles.toolbarRow} data-fade="x" onScroll={event => fadeX(event.currentTarget)} ref={node => { if (node) fadeX(node); }}>
      <div className={styles.searchWrap} data-filled={query ? "" : undefined}>
        <SearchField ref={searchRef} label="Filter tasks by name" value={query} onValueChange={setQuery} placeholder="Filter tasks" autoComplete="off" spellCheck={false}
          onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); if (query) setQuery(""); else event.currentTarget.blur(); } }} />
        <Kbd size="sm" className={styles.searchKey} aria-hidden="true">/</Kbd>
      </div>
      <OwnerFilter people={people} owners={owners} counts={ownerCounts} onChange={setOwners} />
      <div className={styles.groupWrap}>
        <Select label="Group rows" value={grouping} options={GROUPINGS} className={styles.groupTrigger}
          onValueChange={id => { setGrouping(id as GanttGrouping); setStatus({ text: `Grouped by ${id}` }); }} />
      </div>
    </div>
    {view === "timeline" && <div className={styles.toolbarEnd}>
      <SegmentedControl label="Zoom" options={ZOOMS} value={zoom} onValueChange={next => setZoom(next as GanttZoom)} className={styles.zoom} />
      <Button variant="secondary" size="sm" className={styles.toolButton} aria-label="Scroll to today"
        onClick={() => { chartRef.current?.goToToday(); setStatus({ text: `Today is ${short.format(dateOf(todayDay))}` }); }}>
        <Crosshair size={16} strokeWidth={1.75} aria-hidden="true" /><span className={styles.toolLabel}>Today</span>
      </Button>
    </div>}
  </div>;

  const emptyNotice = visibleCount === 0 && <div className={styles.emptyState}>
    <p>No tasks match {filterLabel ? `“${filterLabel}”` : "these filters"}</p>
    <ScreenShellButton variant="secondary" onClick={() => { setQuery(""); setOwners([]); setFilter(null); }}>Show all tasks</ScreenShellButton>
  </div>;

  const page = signedOut
    ? <div className={styles.notice}><p className={styles.noticeTitle}>You signed out of {workspace}</p><p className={styles.muted}>This is a local preview, so nothing left this page.</p><ScreenShellButton variant="secondary" onClick={() => setSignedOut(false)}>Sign back in</ScreenShellButton></div>
    : harbor
      ? <div className={styles.notice}><p className={styles.noticeTitle}>Waypoint Labs has no roadmap yet</p><p className={styles.muted}>Plans you create here show up in the sidebar.</p><ScreenShellButton variant="secondary" onClick={() => setWorkspaceId("waypoint")}>Back to {workspace}</ScreenShellButton></div>
      : <motion.div key={view} className={styles.page} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reduced ? 0 : motionTokens.duration.standard, ease: [...motionTokens.ease.standard] }}>
        {view === "timeline" && <>
          <div className={styles.chartWrap}>
            <Chart handle={chartRef} plans={plans} lanes={lanes} grouping={grouping} visible={visible} collapsed={collapsed}
              onToggleLane={id => {
                const folded = collapsed.includes(id);
                setCollapsed(folded ? collapsed.filter(item => item !== id) : [...collapsed, id]);
              }}
              zoom={zoom} origin={origin} days={days} todayDay={todayDay} selectedId={selectedId} onSelect={select} onCommit={commit} label={label} reduced={reduced} />
            <AnimatePresence>{emptyNotice && <motion.div key="empty" className={styles.emptyLayer} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : motionTokens.duration.fast }}>{emptyNotice}</motion.div>}</AnimatePresence>
          </div>
          <footer className={styles.footer}>
            <p className={styles.status} role="status" aria-live="polite">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span key={status.text} className={styles.statusText} data-tone={status.tone} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: reduced ? 0 : motionTokens.duration.exit } }} transition={{ duration: reduced ? 0 : motionTokens.duration.standard, ease: [...motionTokens.ease.standard] }}>
                  {status.tone === "danger" && <StatusIcon status="conflict" size={16} />}<span className={styles.statusLabel}>{status.text}</span>
                </motion.span>
              </AnimatePresence>
            </p>
            <div className={styles.footerActions}>
              <Button variant="ghost" size="sm" className={styles.footButton} onClick={undo} disabled={!history.length} aria-label="Undo"><Undo2 size={16} strokeWidth={1.75} aria-hidden="true" /><span className={styles.toolLabel}>Undo</span></Button>
              <Button variant="ghost" size="sm" className={styles.footButton} onClick={reset} disabled={tasks === defaultTasks} aria-label="Reset the plan"><RotateCcw size={16} strokeWidth={1.75} aria-hidden="true" /><span className={styles.toolLabel}>Reset</span></Button>
            </div>
          </footer>
        </>}
        {view === "list" && <div className={styles.chartWrap}>
          <ListView lanes={lanes} visible={visible} teams={teams} origin={origin} selectedId={selectedId} onSelect={select} onScroll={fadeY} />
          <AnimatePresence>{emptyNotice && <motion.div key="empty" className={styles.emptyLayer} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : motionTokens.duration.fast }}>{emptyNotice}</motion.div>}</AnimatePresence>
        </div>}
        {view === "updates" && <UpdatesView updates={feed} unread={unreadShown} plans={plans} onScroll={fadeY} onOpen={id => { setView("timeline"); jump(id); openPanel(); }} />}
        {view !== "timeline" && <p className={styles.srOnly} role="status" aria-live="polite">{status.text}</p>}
      </motion.div>;

  return <GanttWhoProvider who={who}><MotionConfig reducedMotion="user">
    <div ref={rootRef} className={cx(styles.root, className)}>
      <ScreenShell
        aria-label={`${workspace} workspace`}
        workspace={{
          name: workspace, activeId: workspaceId,
          onSelect: id => { setWorkspaceId(id); setSelectedId(null); },
          options: [
            { id: "waypoint", name: workspace, detail: `Roadmaps · ${people.length} members`, mark: <ScreenShellMark name={workspace} variant="bridge" tone="green" /> },
            { id: "harbor", name: "Waypoint Labs", detail: "Roadmaps · 3 members", mark: <ScreenShellMark name="Waypoint Labs" variant="seed" tone="rose" /> },
          ],
        }}
        nav={[
          { id: "timeline", label: "Timeline", icon: ChartGantt },
          { id: "list", label: "List", icon: ListTodo },
          { id: "updates", label: "Updates", icon: History, count: unread || undefined },
        ]}
        sections={sections}
        activeId={filter ?? view}
        onNavigate={id => navigate(id)}
        account={{
          name: who(viewerId).name, detail: who(viewerId).role || "Member", avatar: who(viewerId).src || undefined,
          menu: [
            { id: "reset", label: "Reset the plan", icon: RotateCcw, onSelect: reset },
            { id: "signout", label: "Sign out", icon: LogOut, danger: true, separatorBefore: true, onSelect: () => { setSignedOut(true); setSelectedId(null); } },
          ],
        }}
        header={signedOut || harbor ? { title: harbor ? "Waypoint Labs" : workspace } : {
          breadcrumbs: [{ id: "workspace", label: workspace, onSelect: () => navigate("timeline") }, { id: "project", label: title }],
          title: VIEW_TITLE[view],
          meta: view === "updates" ? `${feed.length} updates` : filterLabel ? `${filterLabel} · ${visibleCount} of ${plans.length}` : `${plans.length} tasks · ${share}% done`,
          actions: <HeaderActions copied={copied?.key === "share" ? copied.ok : null} onShare={() => copy("share", `https://waypoint.studio/atlas/roadmap?view=${view}`)} onNew={addTask} />,
          below: view === "updates" ? undefined : toolbar,
        }}
        rightPanel={signedOut || harbor ? undefined : { label: "Details", content: panelContent, defaultOpen: false, defaultWidth: 320, minWidth: 280, maxWidth: 440 }}
        scroll={false}
        padding="none"
      >
        <ShellBridge bridgeRef={bridge} />
        {page}
      </ScreenShell>
    </div>
  </MotionConfig></GanttWhoProvider>;
}

/** Header actions read the shell's size, so the phone layout keeps only icons. */
function HeaderActions({ copied, onShare, onNew }: { copied: boolean | null; onShare: () => void; onNew: () => void }) {
  const { size } = useScreenShell();
  const phone = size === "phone";
  return <>
    <ScreenShellButton variant="secondary" icon={copied === true ? Check : copied === false ? X : Link2} iconOnly={phone} aria-label={phone ? "Copy roadmap link" : undefined} onClick={onShare}>
      {phone ? null : <span className={styles.swap}>
        <span data-on={copied === null || undefined} aria-hidden={copied !== null}>Share</span>
        <span data-on={copied === true || undefined} aria-hidden={copied !== true}>Copied</span>
        <span data-on={copied === false || undefined} aria-hidden={copied !== false}>Try again</span>
      </span>}
    </ScreenShellButton>
    <ScreenShellButton variant="primary" icon={Plus} iconOnly={phone} aria-label={phone ? "New task" : undefined} onClick={onNew}>{phone ? null : "New task"}</ScreenShellButton>
  </>;
}

/** Owners in a popover: a checkbox per person, so the toolbar keeps one quiet control instead of a row of faces. The count takes the icon's slot, so the trigger never changes width. */
function OwnerFilter({ people, owners, counts, onChange }: { people: string[]; owners: string[]; counts: Map<string, number>; onChange: (owners: string[]) => void }) {
  const who = useGanttWho();
  const active = owners.length > 0;
  return <Popover>
    <PopoverTrigger className={styles.filterButton} data-active={active || undefined} aria-label={active ? `Filter by owner, ${owners.length} selected` : "Filter by owner"}>
      <span className={styles.lead} data-count={active || undefined} aria-hidden="true">
        <Users size={16} strokeWidth={1.75} className={styles.leadIcon} />
        <span className={styles.leadCount}>{owners.length || 1}</span>
      </span>
      <span className={styles.toolLabel}>Owner</span>
      <ChevronDown size={14} strokeWidth={1.75} className={styles.fieldChevron} aria-hidden="true" />
    </PopoverTrigger>
    <PopoverContent align="start" className={styles.ownerPop}>
      <div className={styles.ownerList} data-fade="y" role="group" aria-label="Show tasks owned by">
        {people.map(id => {
          const on = owners.includes(id);
          return <label key={id} className={styles.ownerRow}>
            <Checkbox checked={on} aria-label={who(id).name} onCheckedChange={next => onChange(next === true ? [...owners, id] : owners.filter(item => item !== id))} />
            <Face id={id} size={20} />
            <span className={styles.ownerName}>{who(id).name}</span>
            <span className={styles.ownerCount}>{counts.get(id) ?? 0}</span>
          </label>;
        })}
      </div>
      <div className={styles.ownerFoot}>
        <span className={styles.muted}>{active ? `${owners.length} of ${people.length}` : "Everyone"}</span>
        <Button variant="ghost" size="sm" className={styles.footButton} disabled={!active} onClick={() => onChange([])}>Clear</Button>
      </div>
    </PopoverContent>
  </Popover>;
}

export default GanttTimeline;
