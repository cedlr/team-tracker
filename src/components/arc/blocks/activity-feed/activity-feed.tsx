"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUp, Check, CheckCheck, GitCommitHorizontal, ImageIcon, MessageSquare, Rocket, UserPlus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AnimatedCounter } from "../../animated-counter/animated-counter";
import SegmentedControl from "../../segmented-control/segmented-control";
import { TextMorph } from "../../text-morph/text-morph";
import { motionTokens } from "../../lib/motion-tokens";
import { people, photo } from "../../lib/media";
import { Avatar } from "../../avatar/avatar";
import { activities, activityToday, incomingActivities } from "./activity-feed-data";
import type { Activity, ActivityDetail, ActivityType } from "./activity-feed-data";
import styles from "./activity-feed.module.css";

export type { Activity, ActivityDetail, ActivityType, DiffLine } from "./activity-feed-data";

export type ActivityRange = "today" | "week" | "month";

export interface ActivityFeedProps {
  /** Events, newest first. */
  items?: Activity[];
  /** Events that arrive while the feed is open. They wait behind the new updates button until someone shows them. Pass [] to turn off the simulation. */
  incoming?: Activity[];
  /** Milliseconds between simulated arrivals. */
  incomingInterval?: number;
  /** ISO date the day offsets count back from. */
  today?: string;
  /** How far back the feed reaches. */
  defaultRange?: ActivityRange;
  /** Called when events are marked read, with their ids. */
  onRead?: (ids: string[]) => void;
  title?: string;
  className?: string;
}

type Sweep = { delays: Record<string, number>; duration: number } | null;
type TypeFilter = "all" | Exclude<ActivityType, "member">;

const typeIcon: Record<ActivityType, LucideIcon> = { comment: MessageSquare, change: GitCommitHorizontal, deploy: Rocket, file: ImageIcon, member: UserPlus };
const typeFilters: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "comment", label: "Comments" },
  { value: "change", label: "Changes" },
  { value: "deploy", label: "Deploys" },
  { value: "file", label: "Files" },
];
const rangeDays: Record<ActivityRange, number> = { today: 1, week: 7, month: 30 };
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const sweepEase = motionTokens.ease.inOut;

/** Time (0 to 1) at which the sweep curve reaches a given progress, so each row lets go exactly as the line passes it. */
function sweepTime(progress: number) {
  const [x1, y1, x2, y2] = sweepEase;
  const bez = (t: number, a: number, b: number) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  let lo = 0, hi = 1;
  for (let step = 0; step < 24; step++) { const mid = (lo + hi) / 2; if (bez(mid, y1, y2) < progress) lo = mid; else hi = mid; }
  return bez((lo + hi) / 2, x1, x2);
}

function dayParts(today: string, offset: number) {
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - offset);
  const short = `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
  if (offset === 0) return { title: "Today", date: short };
  if (offset === 1) return { title: "Yesterday", date: short };
  return { title: DAYS[date.getUTCDay()], date: short };
}

function tone(item: Activity) {
  if (item.detail?.kind !== "deploy") return undefined;
  return item.detail.status === "failed" ? "danger" : "success";
}

function Detail({ detail }: { detail: ActivityDetail }) {
  if (detail.kind === "comment") return <blockquote className={styles.comment}>{detail.text}</blockquote>;
  if (detail.kind === "files") return <div className={styles.photos}>{detail.photos.map(id => { const item = photo(id); return <span key={id} className={styles.photo}><Image src={item.src} alt={item.alt} fill sizes="84px" /></span>; })}</div>;
  if (detail.kind === "diff") return <div className={styles.diff}>
    <div className={styles.diffHead}><span>{detail.file}</span><span><span className={styles.plus}>+{detail.additions}</span> <span className={styles.minus}>−{detail.deletions}</span></span></div>
    <pre>{detail.lines.map((line, index) => <span key={index} className={styles.diffLine} data-kind={line.kind}><span aria-hidden="true">{line.kind === "add" ? "+" : line.kind === "remove" ? "−" : " "}</span><span className={styles.srOnly}>{line.kind === "add" ? "Added: " : line.kind === "remove" ? "Removed: " : ""}</span>{line.text}{"\n"}</span>)}</pre>
  </div>;
  return <div className={styles.deploy}>
    <dl>
      <div><dt>Status</dt><dd><span className={styles.state} data-state={detail.status}>{detail.status === "ready" ? "Ready" : "Failed"}</span></dd></div>
      <div><dt>Commit</dt><dd className={styles.mono}>{detail.commit}</dd></div>
      <div><dt>Build time</dt><dd>{detail.duration}</dd></div>
    </dl>
    {detail.log && <pre className={styles.log}>{detail.log.join("\n")}</pre>}
  </div>;
}

function actorOf(actor: Activity["actor"]) {
  if (typeof actor !== "string") return { name: actor.name, src: actor.src };
  const known = people.find(entry => entry.id === actor);
  return { name: known?.name ?? actor, src: known?.src };
}

function Row({ item, open, sweepDelay, onToggle, reduce }: { item: Activity; open: boolean; sweepDelay?: number; onToggle: () => void; reduce: boolean }) {
  const actor = actorOf(item.actor);
  const Icon = typeIcon[item.type];
  const detailId = `${useId()}-detail`;
  const preview = item.detail?.kind === "comment" ? item.detail.text : item.detail?.kind === "deploy" ? item.detail.commit : item.detail?.kind === "diff" ? item.detail.file : undefined;
  const sentence = <>
    <span className={styles.sentence}><strong>{actor.name}</strong> {item.action} <strong>{item.target}</strong><span className={styles.srOnly}>{item.unread ? ", unread" : ""}</span></span>
    <span className={styles.meta}><span className={styles.metaProject}>{item.project}</span>{preview && !open && <><span className={styles.metaDot} aria-hidden="true">·</span><span>{preview}</span></>}</span>
  </>;
  const side = <span className={styles.side}>
    <span className={styles.time}>{item.time}</span>
    <span className={styles.dotSlot} aria-hidden="true"><span className={styles.dot} /></span>
  </span>;
  const style = { "--sweep-delay": `${sweepDelay ?? 0}ms` } as CSSProperties;
  return <motion.li layout={reduce ? false : "position"} className={styles.item} data-id={item.id} data-unread={item.unread} style={style}
    initial={reduce ? { opacity: 0 } : { opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
    transition={reduce ? { duration: motionTokens.duration.instant } : { layout: motionTokens.spring.smooth, y: motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.standard } }}>
    <span className={styles.avatar}>
      <Avatar name={actor.name} src={actor.src} size="sm" />
      <span className={styles.badge} data-tone={tone(item)} aria-hidden="true"><Icon size={10} strokeWidth={2.25} /></span>
    </span>
    <div className={styles.body}>
      {item.detail
        ? <button type="button" className={styles.head} aria-expanded={open} aria-controls={detailId} onClick={onToggle}>
          <span className={styles.headText}>{sentence}</span>
          {side}
        </button>
        : <div className={styles.head}><span className={styles.headText}>{sentence}</span>{side}</div>}
      <AnimatePresence initial={false}>
        {open && item.detail && <motion.div id={detailId} className={styles.detailWrap} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
          transition={reduce ? { duration: 0 } : { height: motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.standard } }}>
          <div className={styles.detail}><Detail detail={item.detail} /></div>
        </motion.div>}
      </AnimatePresence>
    </div>
  </motion.li>;
}

export function ActivityFeed({ items: initialItems = activities, incoming = incomingActivities, incomingInterval = 6000, today = activityToday, defaultRange = "week", onRead, title = "Activity", className }: ActivityFeedProps) {
  const reduce = !!useReducedMotion();
  const [items, setItems] = useState<Activity[]>(initialItems);
  const [pending, setPending] = useState<Activity[]>([]);
  const [kind, setKind] = useState<TypeFilter>("all");
  const [expanded, setExpanded] = useState<string[]>([]);
  const [sweep, setSweep] = useState<Sweep>(null);
  const [status, setStatus] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const line = useRef<HTMLDivElement>(null);
  const timers = useRef(new Set<number>());

  const later = useCallback((run: () => void, ms: number) => {
    const timer = window.setTimeout(() => { timers.current.delete(timer); run(); }, ms);
    timers.current.add(timer);
  }, []);
  useEffect(() => { const pending = timers.current; return () => pending.forEach(timer => window.clearTimeout(timer)); }, []);

  // Simulated arrivals queue behind the new updates button instead of shoving the list while someone reads it.
  useEffect(() => {
    if (!incoming.length) return;
    const ids = incoming.map((item, index) => window.setTimeout(() => setPending(list => list.some(entry => entry.id === item.id) ? list : [item, ...list]), incomingInterval * (index + 1) - 2000));
    return () => ids.forEach(id => window.clearTimeout(id));
  }, [incoming, incomingInterval]);

  const inRange = useMemo(() => items.filter(item => item.day < rangeDays[defaultRange]), [items, defaultRange]);
  const visible = useMemo(() => kind === "all" ? inRange : inRange.filter(item => item.type === kind), [inRange, kind]);
  const groups = useMemo(() => {
    const map = new Map<number, Activity[]>();
    for (const item of visible) map.set(item.day, [...(map.get(item.day) ?? []), item]);
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [visible]);
  const filterOptions = useMemo(() => typeFilters.map(option => {
    const count = option.value === "all" ? inRange.length : inRange.filter(item => item.type === option.value).length;
    return { value: option.value, label: option.label, accessory: <span className={styles.count}>{count}</span> };
  }), [inRange]);
  const unread = items.filter(item => item.unread).length;

  function toggle(item: Activity) {
    setExpanded(list => list.includes(item.id) ? list.filter(id => id !== item.id) : [...list, item.id]);
    if (item.unread) { setItems(list => list.map(entry => entry.id === item.id ? { ...entry, unread: false } : entry)); onRead?.([item.id]); }
  }

  function showPending() {
    if (!pending.length) return;
    const count = pending.length;
    setItems(list => [...pending, ...list]);
    setPending([]);
    setKind("all");
    scroller.current?.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    setStatus(`${count} new ${count === 1 ? "update" : "updates"} shown`);
  }

  /** A hairline travels down the list; each row lets go of its unread dot as the line passes it. */
  function markAllRead() {
    const ids = items.filter(item => item.unread).map(item => item.id);
    if (!ids.length) return;
    const container = list.current;
    const box = scroller.current;
    const delays: Record<string, number> = {};
    let duration = 0;
    if (container && box && !reduce) {
      const top = box.scrollTop;
      const height = Math.min(container.scrollHeight - top, box.clientHeight);
      // motion: the sweep is a one-off timeline scaled to list height, so it keeps its own duration.
      duration = Math.max(700, Math.min(1100, height * 1.6));
      const origin = container.getBoundingClientRect().top + top;
      container.querySelectorAll<HTMLElement>("[data-id]").forEach(node => {
        const y = node.getBoundingClientRect().top - origin;
        delays[node.dataset.id!] = Math.round(sweepTime(Math.min(1, Math.max(0, y / height))) * duration);
      });
      line.current?.animate([{ transform: `translateY(${top}px)`, opacity: 0 }, { opacity: 1, offset: .08 }, { opacity: 1, offset: .88 }, { transform: `translateY(${top + height}px)`, opacity: 0 }], { duration, easing: `cubic-bezier(${sweepEase.join(",")})` });
    }
    setSweep({ delays, duration });
    setItems(list => list.map(item => item.unread ? { ...item, unread: false } : item));
    onRead?.(ids);
    setStatus(`${ids.length} ${ids.length === 1 ? "update" : "updates"} marked read`);
    later(() => setSweep(null), duration + 600);
  }

  return <div className={`${styles.root} ${className ?? ""}`}>
    <div className={styles.frame}>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <h2>{title}</h2>
          <span className={styles.unread}><span className={styles.inherit}><AnimatedCounter value={unread} /></span>&nbsp;unread</span>
        </div>
        <button type="button" className={styles.markAll} onClick={markAllRead} disabled={!unread}>
          {unread ? <CheckCheck size={15} aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}
          <TextMorph>{unread ? "Mark all read" : "All caught up"}</TextMorph>
        </button>
      </header>

      <div className={styles.filters}>
        <SegmentedControl className={styles.segment} options={filterOptions} value={kind} onValueChange={value => setKind(value as TypeFilter)} label="Filter by type" />
      </div>

      <AnimatePresence initial={false}>
        {pending.length > 0 && <motion.div key="incoming" className={styles.incoming}
          initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
          transition={reduce ? { duration: motionTokens.duration.fast } : { height: motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.standard } }}>
          <div className={styles.incomingInner}>
            <button type="button" className={styles.pill} onClick={showPending}>
              <span className={styles.stack} aria-hidden="true">
                <AnimatePresence initial={false}>{pending.slice(0, 3).map(item => { const actor = actorOf(item.actor); return <motion.span key={item.id} className={styles.stackItem} layout={!reduce} initial={reduce ? { opacity: 0 } : { opacity: 0, scale: .6 }} animate={{ opacity: 1, scale: 1 }} transition={reduce ? { duration: 0 } : motionTokens.spring.snappy}><Avatar name={actor.name} src={actor.src} size="sm" /></motion.span>; })}</AnimatePresence>
              </span>
              <span className={styles.pillText}><span className={styles.inherit}><AnimatedCounter value={pending.length} /></span>&nbsp;new&nbsp;<TextMorph>{pending.length === 1 ? "update" : "updates"}</TextMorph></span>
              <ArrowUp size={14} aria-hidden="true" />
            </button>
          </div>
        </motion.div>}
      </AnimatePresence>

      <div className={styles.main}>
        <div ref={scroller} className={styles.scroller}>
          <div ref={list} className={styles.list} data-sweeping={sweep ? "" : undefined}>
            <div ref={line} className={styles.sweepLine} aria-hidden="true" />
            {/* Switching the type filter crossfades the whole list, so rows never slide over each other. */}
            <AnimatePresence initial={false} mode="wait">
              <motion.div key={kind} initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                transition={reduce ? { duration: motionTokens.duration.instant } : { opacity: { duration: motionTokens.duration.fast }, y: motionTokens.spring.smooth }}>
            <AnimatePresence initial={false} mode="popLayout">
              {groups.map(([day, entries]) => { const parts = dayParts(today, day); return <motion.section key={day} layout={reduce ? false : "position"} className={styles.group} aria-label={parts.title}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={reduce ? { duration: 0 } : { layout: motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.standard } }}>
                <h3 className={styles.day}><span>{parts.title}</span><span className={styles.dayDate}>{parts.date}</span></h3>
                <ol className={styles.items}>
                  <AnimatePresence initial={false} mode="popLayout">
                    {entries.map(item => <Row key={item.id} item={item} open={expanded.includes(item.id)} sweepDelay={sweep?.delays[item.id]} onToggle={() => toggle(item)} reduce={reduce} />)}
                  </AnimatePresence>
                </ol>
              </motion.section>; })}
            </AnimatePresence>
            {!groups.length && <div className={styles.empty}>
              <p>Nothing of this type yet</p>
              <button type="button" className={styles.emptyButton} onClick={() => setKind("all")}>Show all activity</button>
            </div>}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
    <p className={styles.srOnly} role="status" aria-live="polite">{status}</p>
  </div>;
}

export default ActivityFeed;
