"use client";

import { useEffect, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, RefObject } from "react";
import { AnimatePresence, animate, motion, motionValue, useMotionValue, useMotionValueEvent, useTransform } from "motion/react";
import type { MotionValue, Transition } from "motion/react";
import { ChevronRight } from "lucide-react";
import { motionTokens } from "../../lib/motion-tokens";
import type { GanttGrouping, GanttZoom, Lane, Plan } from "./gantt-timeline-model";
import { DAY, clamp, monthName, monthShort, short } from "./gantt-timeline-model";
import { Face, StatusIcon, TeamIcon, toneVar } from "./gantt-timeline-parts";
import styles from "./gantt-timeline.module.css";

export const ROW = 36;
const BAR = 22, HEADER = 52, WIDE = 252, NARROW = 136;
export const SCALE: Record<GanttZoom, number> = { day: 34, week: 15, month: 5 };
const { spring, duration, ease } = motionTokens;
/** Bars settle onto their snapped dates with the shared press spring. */
const settle: Transition = spring.snappy;
const r2 = (value: number) => Math.round(value * 100) / 100;

export interface ChartHandle {
  goToToday: () => void;
  reveal: (id: string) => void;
}

/** Live positions. Bars, arrows, group summaries, and the task column all read the same values, so they never drift apart. */
class Stage {
  private tasks = new Map<string, { start: MotionValue<number>; len: MotionValue<number> }>();
  private rows = new Map<string, { y: MotionValue<number>; vis: MotionValue<number> }>();
  task(id: string, start = 0, len = 1) {
    let entry = this.tasks.get(id);
    if (!entry) { entry = { start: motionValue(start), len: motionValue(len) }; this.tasks.set(id, entry); }
    return entry;
  }
  row(id: string, y = 0, vis = 1) {
    let entry = this.rows.get(id);
    if (!entry) { entry = { y: motionValue(y), vis: motionValue(vis) }; this.rows.set(id, entry); }
    return entry;
  }
}

/** An orthogonal route with rounded corners. It always has the same six points, so it bends smoothly between shapes as bars move. */
function route(sx: number, sy: number, tx: number, ty: number) {
  const x1 = sx + 10, x2 = Math.min(x1, tx - 10), ym = sy + (ty >= sy ? 1 : -1) * ROW / 2;
  const points: [number, number][] = [[sx, sy], [x1, sy], [x1, ym], [x2, ym], [x2, ty], [tx, ty]];
  let d = `M${r2(sx)} ${r2(sy)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [ax, ay] = points[i - 1], [px, py] = points[i], [bx, by] = points[i + 1];
    const la = Math.hypot(px - ax, py - ay), lb = Math.hypot(bx - px, by - py);
    const r = Math.min(6, la / 2, lb / 2);
    if (r < .5) { d += ` L${r2(px)} ${r2(py)}`; continue; }
    d += ` L${r2(px - (px - ax) / la * r)} ${r2(py - (py - ay) / la * r)} Q${r2(px)} ${r2(py)} ${r2(px + (bx - px) / lb * r)} ${r2(py + (by - py) / lb * r)}`;
  }
  return `${d} L${r2(tx)} ${r2(ty)} M${r2(tx - 5)} ${r2(ty - 4)} L${r2(tx)} ${r2(ty)} L${r2(tx - 5)} ${r2(ty + 4)}`;
}

function Arrow({ from, to, stage, scale, state }: { from: Plan; to: Plan; stage: Stage; scale: MotionValue<number>; state?: "active" | "dim" }) {
  const a = stage.task(from.task.id), b = stage.task(to.task.id), ra = stage.row(from.task.id), rb = stage.row(to.task.id);
  const fromMilestone = !!from.task.milestone, toMilestone = !!to.task.milestone;
  const d = useTransform(() => {
    const k = scale.get();
    const sx = fromMilestone ? (a.start.get() + .5) * k + 7 : (a.start.get() + a.len.get()) * k + 1;
    const tx = toMilestone ? (b.start.get() + .5) * k - 8 : b.start.get() * k - 2;
    return route(sx, ra.y.get() + ROW / 2, tx, rb.y.get() + ROW / 2);
  });
  // An arrow shows only while both of its ends are on screen: folding or filtering either task hides it.
  const opacity = useTransform(() => Math.min(ra.vis.get(), rb.vis.get()));
  const late = useTransform(() => b.start.get() < a.start.get() + a.len.get() - .02 ? 1 : 0);
  const stroke = useTransform(late, value => value ? "var(--danger)" : "var(--gt-arrow)");
  return <motion.path d={d} style={{ opacity, stroke }} className={styles.arrow} data-state={state} />;
}

function LaneBar({ lane, members, stage, scale }: { lane: Lane; members: Plan[]; stage: Stage; scale: MotionValue<number> }) {
  const live = members.map(plan => stage.task(plan.task.id));
  const row = stage.row(lane.id);
  const x = useTransform(() => Math.min(...live.map(entry => entry.start.get())) * scale.get());
  const width = useTransform(() => Math.max(...live.map(entry => entry.start.get() + Math.max(entry.len.get(), 1))) * scale.get() - x.get());
  const work = members.filter(plan => !plan.task.milestone);
  const total = work.reduce((sum, plan) => sum + plan.len, 0);
  const done = total ? work.reduce((sum, plan) => sum + plan.len * (plan.task.progress ?? 0), 0) / total : 0;
  return <motion.div className={styles.summary} style={{ x, width, y: row.y, opacity: row.vis }} aria-hidden="true">
    <span className={styles.summaryFill} style={{ width: `${done * 100}%` }} />
  </motion.div>;
}

interface BarProps {
  plan: Plan; stage: Stage; scale: MotionValue<number>; days: number; reduced: boolean; hidden: boolean; first: boolean;
  selected: boolean; tabbable: boolean; describedBy: string; leftWidth: number;
  scroller: () => HTMLDivElement | null;
  onCommit: (id: string, start: number, len: number, kind: "move" | "resize") => void;
  onSelect: (id: string | null, open: boolean) => void;
  onFocusBar: (id: string) => void;
  onStep: (id: string, step: 1 | -1) => void;
  register: (id: string, node: HTMLDivElement | null) => void;
  label: (start: number, len: number, milestone?: boolean) => string;
}

function Bar({ plan, stage, scale, days, reduced, hidden, first, selected, tabbable, describedBy, leftWidth, scroller, onCommit, onSelect, onFocusBar, onStep, register, label }: BarProps) {
  const { task, late } = plan;
  const { start, len } = stage.task(task.id, plan.start, plan.len);
  const row = stage.row(task.id);
  const x = useTransform(() => task.milestone ? (start.get() + .5) * scale.get() : start.get() * scale.get());
  const width = useTransform(() => Math.max(1, len.get() * scale.get()));
  const snapX = useTransform(() => (Math.round(start.get()) + (task.milestone ? .5 : 0)) * scale.get());
  const snapWidth = useTransform(() => Math.max(1, Math.round(len.get())) * scale.get());
  const y = useTransform(() => row.y.get() + (ROW - BAR) / 2);
  const [drag, setDrag] = useState<null | "move" | "start" | "end">(null);
  const [snap, setSnap] = useState({ start: plan.start, len: plan.len });
  const session = useRef<{ pointer: number; mode: "move" | "start" | "end"; x: number; scroll: number; start: number; len: number; moved: boolean } | null>(null);

  // Settle on the committed dates. The spring starts from wherever the bar is, at the speed it was moving.
  useEffect(() => {
    if (drag) return;
    if (reduced) { start.jump(plan.start); len.jump(plan.len); return; }
    const a = animate(start, plan.start, settle), b = animate(len, plan.len, settle);
    return () => { a.stop(); b.stop(); };
  }, [drag, len, plan.len, plan.start, reduced, start]);

  const sync = () => {
    if (!session.current?.moved) return;
    const next = { start: Math.round(start.get()), len: task.milestone ? 0 : Math.max(1, Math.round(len.get())) };
    setSnap(current => current.start === next.start && current.len === next.len ? current : next);
  };
  useMotionValueEvent(start, "change", sync);
  useMotionValueEvent(len, "change", sync);

  function begin(event: ReactPointerEvent<HTMLElement>, mode: "move" | "start" | "end") {
    if (event.button !== 0 || session.current) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    session.current = { pointer: event.pointerId, mode, x: event.clientX, scroll: scroller()?.scrollLeft ?? 0, start: start.get(), len: len.get(), moved: false };
  }
  function move(event: ReactPointerEvent<HTMLElement>) {
    const s = session.current, box = scroller();
    if (!s || s.pointer !== event.pointerId || !box) return;
    event.stopPropagation();
    if (!s.moved) {
      if (Math.abs(event.clientX - s.x) < 3) return;
      s.moved = true;
      start.stop(); len.stop();
      setDrag(s.mode);
      onSelect(task.id, false);
    }
    // Near an edge the view scrolls along, and the scrolled distance counts toward the drag.
    const frame = box.getBoundingClientRect();
    if (event.clientX > frame.right - 36) box.scrollLeft += 10;
    else if (event.clientX < frame.left + leftWidth + 36) box.scrollLeft -= 10;
    const px = event.clientX - s.x + box.scrollLeft - s.scroll;
    const dd = px / scale.get();
    // Past the shortest length a bar resists instead of stopping dead.
    const soft = (value: number) => value >= 1 ? value : 1 - (1 - value) * .18;
    if (s.mode === "move") start.set(clamp(s.start + dd, 0, days - Math.max(1, s.len)));
    else if (s.mode === "end") len.set(soft(Math.min(s.len + dd, days - s.start)));
    else {
      const next = Math.max(0, s.start + dd), size = soft(s.start + s.len - next);
      start.set(s.start + s.len - size); len.set(size);
    }
  }
  function end(event: ReactPointerEvent<HTMLElement>) {
    const s = session.current;
    if (!s || s.pointer !== event.pointerId) return;
    event.stopPropagation();
    session.current = null;
    if (!s.moved) { onSelect(task.id, true); return; }
    const nextStart = Math.round(start.get()), nextLen = task.milestone ? 0 : Math.max(1, Math.round(len.get()));
    setDrag(null);
    onCommit(task.id, nextStart, nextLen, s.mode === "move" ? "move" : "resize");
  }

  function onKey(event: ReactKeyboardEvent<HTMLDivElement>) {
    const dir = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (dir && event.altKey) {
      event.preventDefault();
      if (event.shiftKey && !task.milestone) onCommit(task.id, plan.start, clamp(plan.len + dir, 1, days - plan.start), "resize");
      else onCommit(task.id, clamp(plan.start + dir, 0, days - Math.max(1, plan.len)), plan.len, "move");
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); onStep(task.id, event.key === "ArrowDown" ? 1 : -1); return; }
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(task.id, true); return; }
    if (event.key === "Escape" && selected) { event.preventDefault(); onSelect(null, false); }
  }

  const handlers = { onPointerMove: move, onPointerUp: end, onPointerCancel: end };
  const pct = Math.round((task.progress ?? 0) * 100);
  const tip = <AnimatePresence>
    {drag && <motion.span key="tip" className={styles.tip} data-below={first || undefined}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: first ? -4 : 4 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: duration.exit } }} transition={reduced ? { duration: 0 } : { duration: duration.fast, ease: [...ease.enter] }}>
      {label(snap.start, snap.len, task.milestone)}
    </motion.span>}
  </AnimatePresence>;

  return <>
    {drag && <motion.span className={styles.snap} data-milestone={task.milestone || undefined} style={{ x: snapX, width: task.milestone ? undefined : snapWidth, y }} aria-hidden="true" />}
    <motion.div ref={node => register(task.id, node)} role="button" tabIndex={tabbable && !hidden ? 0 : -1} aria-pressed={selected} data-bar={task.id}
      aria-roledescription={task.milestone ? "Milestone" : "Task bar"} aria-label={`${task.name}, ${label(plan.start, plan.len, task.milestone)}${task.milestone ? "" : `, ${pct}% done`}${late ? ", starts before a task it depends on ends" : ""}`}
      aria-describedby={describedBy} aria-hidden={hidden || undefined} inert={hidden}
      className={task.milestone ? styles.milestone : styles.bar} data-selected={selected || undefined} data-drag={drag ?? undefined} data-late={late || undefined} data-done={pct === 100 || undefined}
      style={{ x, width: task.milestone ? undefined : width, y, opacity: row.vis, ...toneVar(plan.tone) }}
      onPointerDown={event => begin(event, "move")} {...handlers}
      onFocus={() => onFocusBar(task.id)} onKeyDown={onKey}>
      {task.milestone ? <>
        <span className={styles.diamond} />
        <span className={styles.milestoneLabel}>{task.name}<span className={styles.milestoneDate}>{label(drag ? snap.start : plan.start, 0, true)}</span></span>
      </> : <>
        <span className={styles.track}>
          <span className={styles.fill} style={{ width: `${pct}%` }} />
          <span className={styles.barLabel}><span className={styles.barName}>{task.name}</span><span className={styles.pct}>{pct}%</span></span>
        </span>
        <span className={styles.handle} data-edge="start" onPointerDown={event => begin(event, "start")} {...handlers} aria-hidden="true" />
        <span className={styles.handle} data-edge="end" onPointerDown={event => begin(event, "end")} {...handlers} aria-hidden="true" />
      </>}
      {tip}
    </motion.div>
  </>;
}

export interface ChartProps {
  handle: RefObject<ChartHandle | null>;
  plans: Plan[];
  lanes: Lane[];
  grouping: GanttGrouping;
  visible: Set<string>;
  collapsed: string[];
  onToggleLane: (id: string) => void;
  zoom: GanttZoom;
  origin: number;
  days: number;
  todayDay: number;
  selectedId: string | null;
  onSelect: (id: string | null, open: boolean) => void;
  onCommit: (id: string, start: number, len: number, kind: "move" | "resize") => void;
  label: (start: number, len: number, milestone?: boolean) => string;
  reduced: boolean;
}

export function Chart({ handle, plans, lanes, grouping, visible, collapsed, onToggleLane, zoom, origin, days, todayDay, selectedId, onSelect, onCommit, label, reduced }: ChartProps) {
  const uid = useId().replace(/[^a-zA-Z0-9-]/g, "");
  const scrollerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const bars = useRef(new Map<string, HTMLDivElement>());
  const anchor = useRef<{ day: number; view: number } | null>(null);
  const glide = useRef<{ stop: () => void } | null>(null);
  const lastGrouping = useRef(grouping);
  const touched = useRef(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [narrow, setNarrow] = useState(false);
  const [stage] = useState(() => new Stage());
  const [initialScale] = useState(() => SCALE[zoom]);
  const scale = useMotionValue(initialScale);
  const left = narrow ? NARROW : WIDE;
  const planOf = useMemo(() => new Map(plans.map(plan => [plan.task.id, plan])), [plans]);

  // Rows: each lane, then its tasks. Folded and filtered tasks slide up into their lane's row and fade; an empty lane hides.
  const layout: { id: string; y: number; vis: number; kind: "lane" | "task" }[] = [];
  let count = 0;
  lanes.forEach(lane => {
    const shown = lane.members.filter(plan => visible.has(plan.task.id));
    const gy = count * ROW;
    layout.push({ id: lane.id, y: gy, vis: shown.length ? 1 : 0, kind: "lane" });
    if (shown.length) count++;
    const folded = collapsed.includes(lane.id);
    lane.members.forEach(plan => {
      const show = !folded && visible.has(plan.task.id);
      layout.push({ id: plan.task.id, y: show ? count * ROW : gy, vis: show ? 1 : 0, kind: "task" });
      if (show) count++;
    });
  });
  layout.forEach(item => stage.row(item.id, item.y, item.vis));
  plans.forEach(plan => stage.task(plan.task.id, plan.start, plan.len));
  const bodyHeight = useMotionValue(count * ROW);
  const signature = layout.map(item => `${item.id}|${item.y}|${item.vis}|${item.kind}`).join(";");
  const shownIds = new Set(layout.filter(item => item.kind === "task" && item.vis).map(item => item.id));
  const order = lanes.flatMap(lane => lane.members.filter(plan => shownIds.has(plan.task.id)));

  useEffect(() => {
    const regrouped = lastGrouping.current !== grouping;
    lastGrouping.current = grouping;
    const controls = signature.split(";").flatMap(entry => {
      const [id, y, vis, kind] = entry.split("|");
      const row = stage.row(id);
      if (reduced) { row.y.jump(Number(y)); row.vis.jump(Number(vis)); return []; }
      // A new grouping brings new lane rows: they appear in place and fade in, while the tasks glide to their new rows.
      if (regrouped && kind === "lane") { row.y.jump(Number(y)); row.vis.jump(0); return [animate(row.vis, Number(vis), { duration: duration.standard, ease: [...ease.standard] })]; }
      return [animate(row.y, Number(y), spring.smooth), animate(row.vis, Number(vis), { duration: Number(vis) ? duration.standard : duration.fast, ease: [...ease.standard] })];
    });
    const rows = signature.split(";").filter(entry => entry.split("|")[2] === "1").length;
    if (reduced) bodyHeight.jump(rows * ROW); else controls.push(animate(bodyHeight, rows * ROW, spring.smooth));
    return () => controls.forEach(control => control.stop());
  }, [bodyHeight, grouping, reduced, signature, stage]);

  // The scale lives in one CSS variable for the grid, and in motion values for the bars; zoom keeps the middle of the view in place.
  useEffect(() => {
    const apply = (value: number) => {
      canvasRef.current?.style.setProperty("--gt-scale", String(value));
      const box = scrollerRef.current, hold = anchor.current;
      if (box && hold) box.scrollLeft = hold.day * value - hold.view / 2;
    };
    apply(scale.get());
    return scale.on("change", apply);
  }, [scale]);

  const zoomed = useRef(zoom);
  useEffect(() => {
    if (zoomed.current === zoom) return;
    zoomed.current = zoom;
    const box = scrollerRef.current;
    if (box) { const view = box.clientWidth - left; anchor.current = { day: (box.scrollLeft + view / 2) / scale.get(), view }; }
    const release = () => { anchor.current = null; };
    if (reduced) { scale.jump(SCALE[zoom]); release(); return; }
    const control = animate(scale, SCALE[zoom], { ...spring.smooth, onComplete: release });
    return () => control.stop();
  }, [zoom, left, reduced, scale]);

  // Edge fades show where the plan continues past the view; the pinned header and task column stay crisp.
  const fades = () => {
    const box = scrollerRef.current;
    if (!box) return;
    box.toggleAttribute("data-fl", box.scrollLeft > 1);
    box.toggleAttribute("data-fr", box.scrollLeft < box.scrollWidth - box.clientWidth - 1);
    box.toggleAttribute("data-ft", box.scrollTop > 1);
    box.toggleAttribute("data-fb", box.scrollTop < box.scrollHeight - box.clientHeight - 1);
  };
  useMotionValueEvent(bodyHeight, "change", fades);

  useLayoutEffect(() => {
    const box = scrollerRef.current;
    if (!box) return;
    // Today sits 30% into the view. The frame can settle on its real size after mount, so this repeats until someone scrolls.
    const place = () => {
      const view = box.clientWidth - (box.clientWidth < 560 ? NARROW : WIDE);
      box.scrollLeft = (todayDay + .5) * scale.get() - view * .3;
    };
    const measure = () => { setNarrow(box.clientWidth < 560); if (!touched.current) place(); fades(); };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
    // Placed once on mount; later moves come from the Today button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // One horizontal glide at a time; a new one, a wheel, or a press takes over from wherever the view is.
  function scrollTo(box: HTMLDivElement, target: number) {
    touched.current = true;
    glide.current?.stop();
    glide.current = null;
    if (reduced) { box.scrollLeft = target; return; }
    glide.current = animate(box.scrollLeft, target, { ...spring.smooth, onUpdate: value => { box.scrollLeft = value; } });
  }

  // The handle can be called right after the plan changes, so reveal reads the latest layout rather than this render's.
  const live = useRef({ layout, planOf, left });
  useLayoutEffect(() => { live.current = { layout, planOf, left }; });

  function reveal(id: string, focus = true) {
    const { layout, planOf, left } = live.current;
    const node = bars.current.get(id), box = scrollerRef.current, plan = planOf.get(id);
    if (!node || !box || !plan) return;
    if (focus) node.focus({ preventScroll: true });
    const k = scale.get(), view = box.clientWidth - left;
    const x0 = plan.start * k, x1 = (plan.start + Math.max(1, plan.len)) * k;
    let target = box.scrollLeft;
    if (x0 < box.scrollLeft + 16) target = x0 - 16; else if (x1 > box.scrollLeft + view - 16) target = Math.min(x0 - 16, x1 - view + 16);
    const layoutRow = layout.find(item => item.id === id);
    const rowY = layoutRow?.y ?? stage.row(id).y.get(), top = box.scrollTop, height = box.clientHeight - HEADER;
    if (rowY < top) box.scrollTop = rowY; else if (rowY + ROW > top + height) box.scrollTop = rowY + ROW - height;
    if (target !== box.scrollLeft) scrollTo(box, clamp(target, 0, box.scrollWidth - box.clientWidth));
  }

  useImperativeHandle(handle, () => ({
    goToToday() {
      const box = scrollerRef.current;
      if (!box) return;
      anchor.current = null;
      scrollTo(box, clamp((todayDay + .5) * scale.get() - (box.clientWidth - left) * .3, 0, box.scrollWidth - box.clientWidth));
    },
    reveal: id => requestAnimationFrame(() => reveal(id, false)),
  }));

  function step(id: string, dir: 1 | -1) {
    const at = order.findIndex(plan => plan.task.id === id);
    const next = order[clamp(at + dir, 0, order.length - 1)];
    if (next && next.task.id !== id) { setFocusId(next.task.id); reveal(next.task.id); }
  }

  // Header scale: a coarse tier on top, a fine tier below, and matching grid lines. Each zoom has its own set, crossfaded.
  const calendar = useMemo(() => Array.from({ length: days }, (_, day) => { const date = new Date(origin + day * DAY); return { day, date: date.getUTCDate(), weekday: date.getUTCDay(), month: date.getUTCMonth(), time: date.getTime() }; }), [days, origin]);
  const monthStarts = calendar.filter(entry => entry.date === 1 || entry.day === 0);
  const top = zoom === "month"
    ? monthStarts.filter(entry => entry.day === 0 || entry.month % 3 === 0).map(entry => ({ day: entry.day, text: `Q${Math.floor(entry.month / 3) + 1} ${new Date(entry.time).getUTCFullYear()}` }))
    : monthStarts.map(entry => ({ day: entry.day, text: `${monthName.format(entry.time)}${entry.month === 0 || entry.day === 0 ? ` ${new Date(entry.time).getUTCFullYear()}` : ""}` }));
  // A label that would run into the next one gives way, such as the partial quarter at the start of the range.
  const room = 84 / SCALE[zoom];
  const coarse = top.filter((entry, index) => !top[index + 1] || top[index + 1].day - entry.day >= room);
  const fine = zoom === "day" ? calendar.map(entry => ({ day: entry.day, text: String(entry.date), soft: entry.weekday === 0 || entry.weekday === 6 }))
    : zoom === "week" ? calendar.filter(entry => entry.weekday === 1).map(entry => ({ day: entry.day, text: String(entry.date), soft: false }))
      : monthStarts.filter(entry => entry.date === 1).map(entry => ({ day: entry.day, text: monthShort.format(entry.time), soft: false }));
  const lines = zoom === "day" ? calendar.map(entry => ({ day: entry.day, strong: entry.weekday === 1 }))
    : zoom === "week" ? calendar.filter(entry => entry.weekday === 1).map(entry => ({ day: entry.day, strong: entry.date <= 7 }))
      : calendar.filter(entry => entry.weekday === 1 || entry.date === 1).map(entry => ({ day: entry.day, strong: entry.date === 1 }));
  const weekends = zoom === "month" ? [] : calendar.filter(entry => entry.weekday === 6).map(entry => entry.day);
  const fade: Transition = { duration: reduced ? 0 : duration.standard, ease: [...ease.standard] };

  const tabId = focusId && shownIds.has(focusId) ? focusId : selectedId && shownIds.has(selectedId) ? selectedId : order[0]?.task.id;
  const dependencies = plans.flatMap(plan => (plan.task.dependsOn ?? []).map(dep => planOf.get(dep)).filter((before): before is Plan => !!before).map(before => ({ from: before, to: plan })));
  const style = { "--gt-left": `${left}px`, "--gt-days": days, "--gt-scale": initialScale, "--gt-row": `${ROW}px`, "--gt-bar": `${BAR}px`, "--gt-header": `${HEADER}px` } as CSSProperties;
  const selectedRow = selectedId && shownIds.has(selectedId) ? stage.row(selectedId) : null;
  const stop = () => { anchor.current = null; glide.current?.stop(); touched.current = true; };

  return <div ref={scrollerRef} className={styles.scroller} data-narrow={narrow || undefined} onScroll={fades} onWheel={stop} onPointerDown={stop}>
    <div ref={canvasRef} className={styles.canvas} style={style}>
      <div className={styles.headRow}>
        <div className={styles.corner}><span>{order.length} {order.length === 1 ? "task" : "tasks"}</span></div>
        <div className={styles.scale} aria-hidden="true">
          <AnimatePresence initial={false}>
            <motion.div key={zoom} className={styles.tiers} data-zoom={zoom} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={fade}>
              {coarse.map(entry => <span key={`t${entry.day}`} className={styles.coarse} style={{ "--d": entry.day } as CSSProperties}>{entry.text}</span>)}
              {fine.map(entry => <span key={`f${entry.day}`} className={styles.fine} data-soft={entry.soft || undefined} style={{ "--d": entry.day } as CSSProperties}>{entry.text}</span>)}
            </motion.div>
          </AnimatePresence>
          <span className={styles.todayTag} style={{ "--d": todayDay } as CSSProperties}>Today</span>
        </div>
      </div>

      <motion.div className={styles.body} style={{ height: bodyHeight }}>
        <div className={styles.names}>
          {selectedRow && <motion.span className={styles.nameBand} style={{ y: selectedRow.y }} aria-hidden="true" />}
          {lanes.map(lane => {
            const folded = collapsed.includes(lane.id);
            const shown = lane.members.filter(plan => visible.has(plan.task.id));
            const row = stage.row(lane.id);
            return <motion.div key={lane.id} className={styles.laneRow} style={{ y: row.y, opacity: row.vis }} aria-hidden={!shown.length || undefined} inert={!shown.length}>
              <button type="button" className={styles.laneToggle} aria-expanded={!folded} onClick={() => onToggleLane(lane.id)}>
                <motion.span className={styles.chevron} initial={false} animate={{ rotate: folded ? 0 : 90 }} transition={reduced ? { duration: 0 } : spring.snappy}><ChevronRight size={14} strokeWidth={1.75} aria-hidden="true" /></motion.span>
                {lane.person ? <Face id={lane.person} size={20} /> : lane.team ? <TeamIcon team={lane.team} /> : null}
                <span className={styles.laneName}>{lane.name}</span>
                <span className={styles.laneCount}>{shown.length}</span>
              </button>
            </motion.div>;
          })}
          {plans.map(plan => {
            const row = stage.row(plan.task.id);
            const hidden = !shownIds.has(plan.task.id);
            return <motion.div key={plan.task.id} className={styles.taskRow} data-selected={selectedId === plan.task.id || undefined} style={{ y: row.y, opacity: row.vis }} aria-hidden={hidden || undefined} inert={hidden}
              onClick={() => { if (!hidden) { onSelect(plan.task.id, true); setFocusId(plan.task.id); reveal(plan.task.id); } }}>
              {plan.task.assignee ? <Face id={plan.task.assignee} size={20} /> : <span className={styles.faceSlot} aria-hidden="true" />}
              <span className={styles.taskName}>{plan.task.name}</span>
              {plan.late && <span className={styles.taskWarn} title="Starts before a task it depends on ends"><StatusIcon status="conflict" size={13} /></span>}
              <span className={styles.taskDate}>{short.format(origin + (plan.start + Math.max(0, plan.len - 1)) * DAY)}</span>
            </motion.div>;
          })}
        </div>

        <div className={styles.chart} onClick={event => { if (!(event.target as HTMLElement).closest("[data-bar]")) onSelect(null, false); }}>
          <AnimatePresence initial={false}>
            <motion.div key={zoom} className={styles.grid} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={fade} aria-hidden="true">
              {weekends.map(day => <span key={`w${day}`} className={styles.weekend} style={{ "--d": day } as CSSProperties} />)}
              {lines.map(line => <span key={`l${line.day}`} className={styles.line} data-strong={line.strong || undefined} style={{ "--d": line.day } as CSSProperties} />)}
            </motion.div>
          </AnimatePresence>
          {selectedRow && <motion.span className={styles.band} style={{ y: selectedRow.y }} aria-hidden="true" />}
          {lanes.map(lane => {
            const members = lane.members.filter(plan => visible.has(plan.task.id));
            return members.length ? <LaneBar key={`${lane.id}:${members.map(plan => plan.task.id).join(",")}`} lane={lane} members={members} stage={stage} scale={scale} /> : null;
          })}
          <svg className={styles.arrows} aria-hidden="true">
            {dependencies.map(({ from, to }) => <Arrow key={`${from.task.id}>${to.task.id}`} from={from} to={to} stage={stage} scale={scale}
              state={selectedId ? (selectedId === from.task.id || selectedId === to.task.id ? "active" : "dim") : undefined} />)}
          </svg>
          <span className={styles.today} style={{ "--d": todayDay } as CSSProperties} aria-hidden="true" />
          {plans.map(plan => <Bar key={plan.task.id} plan={plan} stage={stage} scale={scale} days={days} reduced={reduced} leftWidth={left}
            hidden={!shownIds.has(plan.task.id)} first={order[0]?.task.id === plan.task.id}
            selected={selectedId === plan.task.id} tabbable={tabId === plan.task.id} describedBy={`${uid}-keys`}
            scroller={() => scrollerRef.current} onCommit={onCommit} label={label}
            onSelect={onSelect} onFocusBar={id => setFocusId(id)} onStep={step}
            register={(id, node) => { if (node) bars.current.set(id, node); else bars.current.delete(id); }} />)}
        </div>
      </motion.div>
    </div>
    <p id={`${uid}-keys`} className={styles.srOnly}>Alt and the left or right arrow moves the task by a day. Add Shift to change its end date. Up and down arrows move between tasks. Enter opens its details.</p>
  </div>;
}
