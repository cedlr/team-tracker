"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { animate, AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Globe, Link2 } from "lucide-react";
import { motionTokens } from "../../lib/motion-tokens";
import type { LogoId, Metric } from "./metrics-dashboard-data";
import { formatAxis, formatMetric, longDayFormat, dayFormat } from "./metrics-dashboard-data";
import styles from "./metrics-dashboard.module.css";

export const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");
export const instant = { duration: 0 } as const;

/* ------------------------------------------------------------------ Brand marks
 * Simple Icons paths (CC0), drawn inline in each brand's own colour. X and GitHub use the text colour. Marks are sample
 * content, not endorsements. */

const logoPaths: Partial<Record<LogoId, { d: string; color?: string }>> = {
  google: { color: "#4285F4", d: "M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" },
  x: { d: "M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" },
  github: { d: "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" },
  linkedin: { color: "#0A66C2", d: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" },
  youtube: { color: "#FF0000", d: "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" },
  bluesky: { color: "#1185FE", d: "M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364.136-.02.275-.039.415-.056-.138.022-.276.04-.415.056-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.308 1.172-6.498-2.74-7.078a8.741 8.741 0 0 1-.415-.056c.14.017.279.036.415.056 2.67.297 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.69-.139-1.861-.902-2.206-.659-.298-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8Z" },
  hackernews: { color: "#FF6600", d: "M0 24V0h24v24H0zM6.951 5.896l4.112 7.708v5.064h1.583v-4.972l4.148-7.799h-1.749l-2.457 4.875c-.372.745-.688 1.434-.688 1.434s-.297-.708-.651-1.434L8.831 5.896h-1.88z" },
  substack: { color: "#FF6719", d: "M22.539 8.242H1.46V5.406h21.08v2.836zM1.46 10.812V24L12 18.11 22.54 24V10.812H1.46zM22.54 0H1.46v2.836h21.08V0z" },
};

export function Logo({ id, size = 16 }: { id?: LogoId; size?: number }) {
  if (!id) return null;
  if (id === "direct") return <Link2 size={size} strokeWidth={1.75} className={styles.logoMuted} aria-hidden="true" />;
  if (id === "web") return <Globe size={size} strokeWidth={1.75} className={styles.logoMuted} aria-hidden="true" />;
  const mark = logoPaths[id];
  if (!mark) return null;
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={styles.logo} style={{ color: mark.color }}><path d={mark.d} fill="currentColor" /></svg>;
}

/* ------------------------------------------------------------------ Counting values */

/** Counts a number to its new value with tabular numerals; reduced motion swaps it instantly. */
export function CountValue({ value, format }: { value: number; format: (value: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(value);
  const formatRef = useRef(format);
  const [initial] = useState(() => format(value));
  const reduce = useReducedMotion();
  useEffect(() => { formatRef.current = format; });
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (reduce || shown.current === value) { shown.current = value; node.textContent = formatRef.current(value); return; }
    const controls = animate(shown.current, value, {
      duration: motionTokens.duration.standard,
      ease: motionTokens.ease.standard,
      onUpdate: v => { shown.current = v; node.textContent = formatRef.current(v); },
    });
    return () => controls.stop();
  }, [value, reduce]);
  return <span ref={ref}>{initial}</span>;
}

/* ------------------------------------------------------------------ Edge fades */

/** Marks a scroller's cut edges with data attributes so CSS can fade them, without re-rendering. */
export function useEdgeFade<T extends HTMLElement>(axis: "y" | "x" = "y") {
  const ref = useRef<T>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => {
      if (axis === "y") {
        element.toggleAttribute("data-fade-start", element.scrollTop > 1);
        element.toggleAttribute("data-fade-end", element.scrollTop + element.clientHeight < element.scrollHeight - 1);
      } else {
        element.toggleAttribute("data-fade-start", element.scrollLeft > 1);
        element.toggleAttribute("data-fade-end", element.scrollLeft + element.clientWidth < element.scrollWidth - 1);
      }
    };
    update();
    element.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(element);
    for (const child of element.children) observer.observe(child);
    const mutations = new MutationObserver(update);
    mutations.observe(element, { childList: true, subtree: true });
    return () => { element.removeEventListener("scroll", update); observer.disconnect(); mutations.disconnect(); };
  }, [axis]);
  return ref;
}

/* ------------------------------------------------------------------ Chart helpers */

function niceScale(min: number, max: number, floorAtZero: boolean) {
  const lo = floorAtZero ? 0 : Math.max(0, min - (max - min) * .8);
  const span = max - lo || 1;
  const raw = span / 3;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) ?? raw;
  const start = Math.floor(lo / step) * step;
  return { min: start, max: start + step * 3, ticks: [0, 1, 2, 3].map(i => start + step * i) };
}

/** Monotone cubic path: smooth without overshooting past the real data points. */
export function smoothPath(pts: [number, number][]) {
  if (pts.length < 3) return pts.map(([x, y], i) => (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1)).join(" ");
  const n = pts.length;
  const slope = pts.slice(1).map(([x, y], i) => (y - pts[i][1]) / (x - pts[i][0]));
  const tangent = pts.map((_, i) => {
    if (i === 0) return slope[0];
    if (i === n - 1) return slope[n - 2];
    const a = slope[i - 1], b = slope[i];
    return a * b <= 0 ? 0 : (2 * a * b) / (a + b);
  });
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], h = (x1 - x0) / 3;
    d += ` C${(x0 + h).toFixed(1)} ${(y0 + tangent[i] * h).toFixed(1)} ${(x1 - h).toFixed(1)} ${(y1 - tangent[i + 1] * h).toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  }
  return d;
}

export interface ChartPoint { date: Date; value: number; previous: number }

const W = 1000;
const H = 240;

/**
 * The main chart: an area for the current period and a dashed line for the previous one. Hover or arrow keys inspect a
 * day; dragging across the plot (or Shift with the arrows, then Enter) selects days to zoom into.
 */
export function MainChart({ points, metric, compare, viewKey, onZoom }: { points: ChartPoint[]; metric: Metric; compare: boolean; viewKey: string; onZoom: (from: number, to: number) => void }) {
  const reduce = useReducedMotion();
  const [active, setActive] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ from: number; to: number } | null>(null);
  const dragging = useRef(false);
  const plotRef = useRef<HTMLDivElement>(null);
  const descId = useId();
  const [plotWidth, setPlotWidth] = useState(800);
  useEffect(() => {
    const element = plotRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setPlotWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // A new view clears the inspected point. Adjusting state during render rather than in an effect.
  const [lastKey, setLastKey] = useState(viewKey);
  if (lastKey !== viewKey) { setLastKey(viewKey); setActive(null); setDrag(null); }

  const chart = useMemo(() => {
    const values = points.flatMap(p => (compare ? [p.value, p.previous] : [p.value]));
    const scale = niceScale(Math.min(...values), Math.max(...values), metric.unit === "count");
    const x = (i: number) => (points.length === 1 ? W / 2 : (i / (points.length - 1)) * W);
    const y = (v: number) => H - ((v - scale.min) / (scale.max - scale.min || 1)) * H;
    const line = (key: "value" | "previous") => smoothPath(points.map((p, i) => [x(i), y(p[key])]));
    const current = line("value");
    return { scale, x, y, current, previous: line("previous"), area: current + ` L${W} ${H} L0 ${H} Z` };
  }, [points, compare, metric.unit]);

  const indexAt = useCallback((clientX: number) => {
    const box = plotRef.current!.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - box.left) / box.width));
    return Math.round(ratio * (points.length - 1));
  }, [points.length]);

  const onDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const i = indexAt(event.clientX);
    event.currentTarget.setPointerCapture(event.pointerId);
    dragging.current = true;
    setDrag({ from: i, to: i });
    setActive(i);
  };
  const onMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const i = indexAt(event.clientX);
    setActive(i);
    if (dragging.current) setDrag(current => current && { ...current, to: i });
  };
  const onUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    if (drag && Math.abs(drag.to - drag.from) >= 2) { onZoom(Math.min(drag.from, drag.to), Math.max(drag.from, drag.to)); setActive(null); }
    setDrag(null);
  };
  const onKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const last = points.length - 1;
    if (event.key === "Enter" && drag && Math.abs(drag.to - drag.from) >= 2) { event.preventDefault(); onZoom(Math.min(drag.from, drag.to), Math.max(drag.from, drag.to)); setDrag(null); return; }
    if (event.key === "Escape" && (drag || active !== null)) { event.preventDefault(); event.stopPropagation(); setDrag(null); setActive(null); return; }
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const from = active ?? last;
    const next = event.key === "Home" ? 0 : event.key === "End" ? last : Math.min(last, Math.max(0, from + (event.key === "ArrowRight" ? 1 : -1)));
    if (event.shiftKey) setDrag(current => ({ from: current?.from ?? from, to: next }));
    else setDrag(null);
    setActive(next);
  };

  const focus = active === null ? null : points[active];
  // About one date label per 120px, so labels never collide on narrow frames.
  const labelCount = Math.max(2, Math.min(7, Math.floor(plotWidth / 120)));
  const labelEvery = Math.max(1, Math.ceil(points.length / labelCount));
  const left = (i: number) => (chart.x(i) / W) * 100;
  const rescale = reduce ? instant : motionTokens.spring.smooth;
  const delta = focus && focus.previous ? ((focus.value - focus.previous) / focus.previous) * 100 : 0;

  return <div className={styles.plot}>
    <div className={styles.yAxis} aria-hidden="true">
      {[...chart.scale.ticks].reverse().map(t => <span key={t}>{formatAxis(metric, t)}</span>)}
    </div>
    <div ref={plotRef} className={styles.chartArea} tabIndex={0} role="img" aria-describedby={descId}
      aria-label={`${metric.label} by day. Arrow keys inspect a day; hold Shift to select days, then Enter to zoom.`}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
      onPointerLeave={event => { if (event.pointerType === "mouse" && !dragging.current) setActive(null); }}
      onKeyDown={onKey} onBlur={() => { setActive(null); setDrag(null); }}>
      <div className={styles.grid} aria-hidden="true">{chart.scale.ticks.map(t => <span key={t} />)}</div>
      <AnimatePresence initial={false}>
        <motion.svg key={viewKey} className={styles.svg} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true"
          initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : motionTokens.duration.standard, ease: motionTokens.ease.standard }}>
          {/* Compare rescales the axis, so the paths morph to the new scale in place instead of snapping. */}
          <motion.path className={styles.area} initial={false} animate={{ d: chart.area }} transition={rescale} />
          <motion.path className={styles.previous} initial={false} animate={{ d: chart.previous, opacity: compare ? 1 : 0 }} transition={rescale} />
          <motion.path className={styles.line} initial={false} animate={{ d: chart.current }} transition={rescale} />
        </motion.svg>
      </AnimatePresence>
      {drag && drag.from !== drag.to && <span className={styles.selection} style={{ left: `${left(Math.min(drag.from, drag.to))}%`, width: `${left(Math.max(drag.from, drag.to)) - left(Math.min(drag.from, drag.to))}%` }} aria-hidden="true" />}
      {focus && <>
        <span className={styles.crosshair} style={{ left: `${left(active!)}%` }} aria-hidden="true" />
        {compare && <span className={styles.dotPrevious} style={{ left: `${left(active!)}%`, top: `${(chart.y(focus.previous) / H) * 100}%` }} aria-hidden="true" />}
        <span className={styles.dot} style={{ left: `${left(active!)}%`, top: `${(chart.y(focus.value) / H) * 100}%` }} aria-hidden="true" />
        <div className={styles.tooltip} data-side={left(active!) > 55 ? "left" : "right"} style={{ left: `${left(active!)}%` }}>
          <span className={styles.tooltipDate}>{longDayFormat.format(focus.date)}</span>
          <span className={styles.tooltipRow}><i className={styles.swatch} />{metric.label}<b>{formatMetric(metric, focus.value)}</b></span>
          {compare && <span className={styles.tooltipRow}><i className={styles.swatchPrevious} />Previous<b>{formatMetric(metric, focus.previous)}</b></span>}
          {compare && metric.unit === "count" && <span className={styles.tooltipDelta} data-good={delta >= 0 ? "" : undefined}>{delta >= 0 ? "+" : ""}{delta.toFixed(1)}% on the previous period</span>}
        </div>
      </>}
      <span id={descId} className={styles.srOnly} role="status">{focus ? `${longDayFormat.format(focus.date)}: ${formatMetric(metric, focus.value)}${compare ? `, previous ${formatMetric(metric, focus.previous)}` : ""}` : ""}</span>
    </div>
    <div className={styles.xAxis} aria-hidden="true">
      {points.map((p, i) => {
        if (i % labelEvery !== 0 && i !== points.length - 1) return null;
        if (i !== points.length - 1 && points.length - 1 - i < labelEvery * .6) return null;
        const pct = left(i);
        return <span key={i} style={{ left: `${pct}%`, transform: `translateX(${i === 0 ? 0 : i === points.length - 1 ? -100 : -50}%)` }}>{dayFormat.format(p.date)}</span>;
      })}
    </div>
  </div>;
}

/** A quiet trend for the detail panel. */
export function Sparkline({ values, label }: { values: number[]; label: string }) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const pts = values.map((v, i) => [values.length === 1 ? 150 : (i / (values.length - 1)) * 300, 72 - ((v - min) / (max - min || 1)) * 64] as [number, number]);
  const line = smoothPath(pts);
  return <svg className={styles.spark} viewBox="0 0 300 72" preserveAspectRatio="none" role="img" aria-label={label}>
    <path className={styles.area} d={`${line} L300 72 L0 72 Z`} />
    <path className={styles.line} d={line} />
  </svg>;
}
