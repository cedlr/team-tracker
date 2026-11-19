"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { AnimatePresence, Reorder, motion, useDragControls, useReducedMotion } from "motion/react";
import type { Transition } from "motion/react";
import { ArrowUp, Check, CircleAlert, CircleCheck, GripVertical, ListTodo, Pencil, RotateCcw, Sparkles, Square, X } from "lucide-react";
import { Button } from "../../button/button";
import { TextShimmer } from "../../text-shimmer/text-shimmer";
import { addWorkdays, days, demoAlternates, demoGoal, demoIssue, demoOwners, demoTasks, schedule, shortDate, workdaysBetween } from "./task-breakdown-data";
import type { CreatedIssue, IssueTarget, TaskDraft, TaskOwner } from "./task-breakdown-data";
import { ClaudeMark, JiraMark, LinearMark } from "./task-breakdown-marks";
import styles from "./task-breakdown.module.css";
import { motionTokens } from "../../lib/motion-tokens";

export type { CreatedIssue, IssueTarget, TaskDraft, TaskOwner } from "./task-breakdown-data";
export { demoGoal, demoOwners, demoTasks } from "./task-breakdown-data";

export interface TaskBreakdownProps {
  /** Goal shown in the input on first render. */
  defaultGoal?: string;
  /** Tasks to start with. When set, the block opens ready instead of empty and does not auto start. */
  defaultTasks?: TaskDraft[];
  /** People tasks can be assigned to. */
  owners?: TaskOwner[];
  /** Breaks a goal into tasks. Rows stream in as soon as it resolves. Simulated when omitted. */
  generate?: (goal: string, signal: AbortSignal) => Promise<TaskDraft[]>;
  /** Rewrites one task. Return the fields to replace; id and dependencies are kept. Simulated when omitted. */
  regenerate?: (task: TaskDraft, context: { goal: string; tasks: TaskDraft[] }, signal: AbortSignal) => Promise<Partial<Omit<TaskDraft, "id">>>;
  /** Creates one issue in Linear or Jira. Called once per task, in list order. Simulated when omitted. */
  createIssue?: (target: IssueTarget, task: TaskDraft, signal: AbortSignal) => Promise<CreatedIssue>;
  /** Trackers offered in the footer. */
  targets?: IssueTarget[];
  /** First working day of the plan. */
  startDate?: Date | string;
  /** The date the goal must ship by. */
  deadline?: Date | string;
  /** Model named in the footer. */
  model?: string;
  /** Run the breakdown once when the block scrolls into view. Defaults to true without `defaultTasks`. */
  autoStart?: boolean;
  /** Called after any edit, reorder or regeneration. */
  onTasksChange?: (tasks: TaskDraft[]) => void;
  /** Called when every issue was created. */
  onSent?: (target: IssueTarget, issues: Record<string, CreatedIssue>) => void;
  className?: string;
}

type Phase = "idle" | "thinking" | "streaming" | "ready" | "error" | "sending" | "sent";
type IssueState = CreatedIssue | "creating" | "failed";

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");
const RESERVED_ROWS = 7;
const ROW = 44;
const WORDS_PER_TICK = 3;
const TICK = 36;
const ease = [0.22, 1, 0.36, 1] as const;
const glide: Transition = { ...motionTokens.spring.snappy };
const trackerName: Record<IssueTarget, string> = { linear: "Linear", jira: "Jira" };
const skeletonWidths = [72, 54, 64, 48, 68, 58, 44];

const wait = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal.aborted) { reject(new DOMException("Aborted", "AbortError")); return; }
  const timer = setTimeout(resolve, ms);
  signal.addEventListener("abort", () => { clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); }, { once: true });
});
const aborted = (error: unknown) => error instanceof DOMException && error.name === "AbortError";
const words = (text: string) => text.split(/\s+/).filter(Boolean);

function TrackerMark({ target }: { target: IssueTarget }) {
  return target === "linear" ? <LinearMark className={styles.mark} aria-hidden="true" /> : <JiraMark className={styles.mark} aria-hidden="true" />;
}

/** A single crossfade: old out in 100ms, new in over 150ms with a 2px rise. */
function Swap({ swapKey, children, className, reduced }: { swapKey: string | number; children: ReactNode; className?: string; reduced: boolean }) {
  return <span className={cx(styles.swap, className)}>
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span key={swapKey} className={styles.swapItem}
        initial={{ opacity: 0, y: reduced ? 0 : 2 }}
        animate={{ opacity: 1, y: 0, transition: { duration: motionTokens.duration.fast, ease } }}
        exit={{ opacity: 0, y: 0, transition: { duration: motionTokens.duration.instant, ease } }}>
        {children}
      </motion.span>
    </AnimatePresence>
  </span>;
}

function OwnerAvatar({ owner }: { owner?: TaskOwner }) {
  if (!owner) return <span className={cx(styles.avatar, styles.avatarEmpty)} title="Unassigned"><span className={styles.srOnly}>Unassigned</span></span>;
  const initials = owner.name.split(" ").map(part => part[0]).slice(0, 2).join("");
  return <span className={styles.avatar} title={owner.name}>
    {/* eslint-disable-next-line @next/next/no-img-element -- 20px portrait, no optimization needed */}
    {owner.avatar ? <img src={owner.avatar} alt="" draggable={false} /> : <span aria-hidden="true">{initials}</span>}
    <span className={styles.srOnly}>Owner {owner.name}</span>
  </span>;
}

interface RowProps {
  task: TaskDraft;
  index: number;
  count: number;
  owner?: TaskOwner;
  dep?: { text: string; blocked: boolean };
  /** Words of the title revealed so far, or Infinity once the row has landed. 0 shows a placeholder. */
  revealed: number;
  streaming: boolean;
  busy: boolean;
  locked: boolean;
  editing: boolean;
  issue?: IssueState;
  simulated: boolean;
  reduced: boolean;
  onEdit: () => void;
  onSave: (patch: Pick<TaskDraft, "title" | "estimate">) => void;
  onCancel: () => void;
  onRegenerate: () => void;
  onMove: (delta: number) => void;
  onHover: (hovered: boolean) => void;
  onRetry: () => void;
  onIssueClick: (key: string) => void;
}

function Row({ task, index, count, owner, dep, revealed, streaming, busy, locked, editing, issue, simulated, reduced, onEdit, onSave, onCancel, onRegenerate, onMove, onHover, onRetry, onIssueClick }: RowProps) {
  const controls = useDragControls();
  const [draft, setDraft] = useState({ title: task.title, estimate: String(task.estimate) });
  const titleInput = useRef<HTMLInputElement>(null);
  const landed = revealed === Infinity;
  const placeholder = revealed === 0;
  const canDrag = !locked && !editing && landed;

  useEffect(() => {
    if (!editing) return;
    const frame = requestAnimationFrame(() => { titleInput.current?.focus(); titleInput.current?.select(); });
    return () => cancelAnimationFrame(frame);
  }, [editing]);
  const beginEdit = () => { setDraft({ title: task.title, estimate: String(task.estimate) }); onEdit(); };

  const save = () => {
    const estimate = Math.min(60, Math.max(0.5, Math.round((Number(draft.estimate) || task.estimate) * 2) / 2));
    onSave({ title: draft.title.trim() || task.title, estimate });
  };
  const onEditKey = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") { event.preventDefault(); save(); }
    if (event.key === "Escape") { event.preventDefault(); onCancel(); }
  };
  const onGripKey = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") { event.preventDefault(); onMove(event.key === "ArrowUp" ? -1 : 1); }
  };

  const titleWords = words(task.title);
  const chunks: string[] = [];
  if (!landed && !placeholder) for (let at = 0; at < Math.min(revealed, titleWords.length); at += WORDS_PER_TICK) chunks.push(titleWords.slice(at, at + WORDS_PER_TICK).join(" "));

  let title: ReactNode;
  if (placeholder) title = <span className={styles.skeleton} style={{ width: `${skeletonWidths[index % skeletonWidths.length]}%` }} aria-hidden="true" />;
  else if (editing) title = <input ref={titleInput} className={styles.titleInput} value={draft.title} aria-label={`Task ${index + 1} title`} onChange={event => setDraft(value => ({ ...value, title: event.target.value }))} onKeyDown={onEditKey} />;
  else if (!landed) title = <span className={styles.titleText}>{chunks.map((chunk, at) => <span key={at} className={styles.chunk}>{at ? " " : ""}{chunk}</span>)}</span>;
  else if (busy) title = <span className={styles.titleText}><TextShimmer>{task.title}</TextShimmer></span>;
  else title = <Swap swapKey={task.title} reduced={reduced} className={styles.titleSwap}><span className={styles.titleText} onDoubleClick={locked ? undefined : beginEdit}>{task.title}</span></Swap>;

  let slot: ReactNode;
  let slotKey: string;
  if (issue === "creating") { slotKey = "creating"; slot = <span className={styles.slotStatus}><span className={styles.spinner} aria-hidden="true" /><span className={styles.srOnly}>Creating</span></span>; }
  else if (issue === "failed") { slotKey = "failed"; slot = <button type="button" className={cx(styles.iconButton, styles.failed)} onClick={onRetry} aria-label={`Retry creating task ${index + 1}`} title="Failed, retry"><CircleAlert aria-hidden="true" /></button>; }
  else if (issue) { slotKey = issue.key; slot = <a className={styles.issueKey} href={issue.url} target="_blank" rel="noreferrer" onClick={simulated ? event => { event.preventDefault(); onIssueClick(issue.key); } : undefined}>{issue.key}</a>; }
  else if (editing) {
    slotKey = "editing";
    slot = <span className={styles.actions} data-visible="true">
      <button type="button" className={styles.iconButton} onMouseDown={event => event.preventDefault()} onClick={save} aria-label="Save task"><Check aria-hidden="true" /></button>
      <button type="button" className={styles.iconButton} onMouseDown={event => event.preventDefault()} onClick={onCancel} aria-label="Cancel editing"><X aria-hidden="true" /></button>
    </span>;
  } else {
    slotKey = "actions";
    slot = <span className={styles.actions} data-visible={busy || undefined}>
      <button type="button" className={styles.iconButton} disabled={locked || busy || !landed} onClick={onRegenerate} aria-label={`Regenerate task ${index + 1}`} title="Regenerate"><RotateCcw aria-hidden="true" /></button>
      <button type="button" className={styles.iconButton} disabled={locked || busy || !landed} onClick={beginEdit} aria-label={`Edit task ${index + 1}`} title="Edit"><Pencil aria-hidden="true" /></button>
    </span>;
  }

  const metaShown = landed || (!placeholder && revealed >= titleWords.length);

  return <Reorder.Item as="li" value={task} dragListener={false} dragControls={controls} drag={canDrag ? "y" : false} layout="position"
    className={cx(styles.row, editing && styles.editing, busy && styles.busy)}
    transition={reduced ? { duration: 0 } : glide}
    dragTransition={{ bounceStiffness: 700, bounceDamping: 60 }}
    whileDrag={{ zIndex: 2, boxShadow: "var(--shadow-floating)", backgroundColor: "var(--surface-raised)" }}
    onPointerEnter={() => onHover(true)} onPointerLeave={() => onHover(false)}
    aria-busy={busy || (!landed && streaming) || undefined}>
    <button type="button" className={styles.grip} data-grip={task.id} disabled={!canDrag} tabIndex={canDrag ? 0 : -1}
      aria-label={`Reorder ${task.title}, position ${index + 1} of ${count}. Use the up and down arrow keys.`}
      onPointerDown={event => { if (canDrag) { event.preventDefault(); controls.start(event); } }} onKeyDown={onGripKey}>
      <GripVertical aria-hidden="true" />
    </button>
    <span className={styles.index} aria-hidden="true">{index + 1}</span>
    <span className={styles.title}>{title}</span>
    <motion.span className={styles.meta} initial={false} animate={{ opacity: metaShown ? 1 : 0 }} transition={{ duration: reduced ? 0 : 0.16, ease }}>
      <span className={cx(styles.dep, dep?.blocked && styles.blocked)}>
        {dep && <Swap swapKey={dep.text} reduced={reduced}>{dep.blocked ? <CircleAlert className={styles.depIcon} aria-hidden="true" /> : <ArrowUp className={styles.depIcon} aria-hidden="true" />}<span className={styles.depText}>{dep.text}</span></Swap>}
      </span>
      <span className={styles.estimate}>
        {editing
          ? <input className={styles.estimateInput} inputMode="decimal" value={draft.estimate} aria-label={`Task ${index + 1} estimate in days`} onChange={event => setDraft(value => ({ ...value, estimate: event.target.value.replace(/[^0-9.]/g, "") }))} onKeyDown={onEditKey} />
          : <Swap swapKey={task.estimate} reduced={reduced}>{days(task.estimate)}</Swap>}
      </span>
      <Swap swapKey={owner?.id ?? "none"} reduced={reduced} className={styles.owner}><OwnerAvatar owner={owner} /></Swap>
    </motion.span>
    <span className={styles.slot}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={slotKey} className={styles.slotItem} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: motionTokens.duration.fast, ease } }} exit={{ opacity: 0, transition: { duration: motionTokens.duration.instant, ease } }}>{slot}</motion.span>
      </AnimatePresence>
    </span>
  </Reorder.Item>;
}

/**
 * Task breakdown. Paste a goal and the model drafts a plan: tasks with estimates, owners and dependencies stream in,
 * the total and the timeline to the deadline update live, rows can be edited, reordered and regenerated, and the
 * plan is sent to Linear or Jira with per-issue progress and links. With no props it plays a simulated demo.
 */
export function TaskBreakdown({
  defaultGoal = demoGoal,
  defaultTasks,
  owners = demoOwners,
  generate,
  regenerate,
  createIssue,
  targets = ["linear", "jira"],
  startDate = "2026-10-27T12:00:00",
  deadline = "2026-12-01T12:00:00",
  model = "Claude Sonnet 5.5",
  autoStart,
  onTasksChange,
  onSent,
  className,
}: TaskBreakdownProps) {
  const reduced = !!useReducedMotion();
  const id = useId();
  const root = useRef<HTMLElement>(null);
  const [goal, setGoal] = useState(defaultGoal);
  const [tasks, setTasks] = useState<TaskDraft[]>(defaultTasks ?? []);
  const [phase, setPhase] = useState<Phase>(defaultTasks?.length ? "ready" : "idle");
  const [stream, setStream] = useState({ row: 0, words: 0 });
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [issues, setIssues] = useState<Record<string, IssueState>>({});
  const [target, setTarget] = useState<IssueTarget | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const generation = useRef<AbortController | null>(null);
  const sending = useRef<AbortController | null>(null);
  const rewrites = useRef(new Map<string, AbortController>());
  const variantAt = useRef(new Map<string, number>());
  const originals = useRef(new Map<string, Omit<TaskDraft, "id" | "dependsOn">>());
  const started = useRef(false);
  const simulatedGenerate = !generate, simulatedSend = !createIssue;

  const ownerById = useMemo(() => new Map(owners.map(owner => [owner.id, owner])), [owners]);

  /* Breakdown ------------------------------------------------------------------------------------------------------ */
  const breakDown = useCallback(async () => {
    const text = goal.trim();
    if (!text) return;
    generation.current?.abort();
    rewrites.current.forEach(controller => controller.abort());
    rewrites.current.clear();
    const controller = new AbortController();
    generation.current = controller;
    setEditing(null); setBusy({}); setIssues({}); setTarget(null);
    setTasks([]); setPhase("thinking"); setStatus("Planning tasks");
    try {
      const result = generate ? await generate(text, controller.signal) : await wait(900, controller.signal).then(() => demoTasks);
      if (controller.signal.aborted) return;
      originals.current = new Map(result.map(task => [task.id, { title: task.title, estimate: task.estimate, ownerId: task.ownerId }]));
      variantAt.current.clear();
      setTasks(result);
      if (reduced || !result.length) {
        setStream({ row: result.length, words: 0 });
        setPhase(result.length ? "ready" : "idle");
        setStatus(`${result.length} tasks drafted${simulatedGenerate ? ". Simulated sample plan" : ""}`);
      } else {
        setStream({ row: 0, words: 0 });
        setPhase("streaming");
      }
    } catch (error) {
      if (aborted(error)) return;
      setPhase("error"); setStatus("Could not draft tasks. Try again.");
    }
  }, [generate, goal, reduced, simulatedGenerate]);

  const stop = () => {
    generation.current?.abort();
    if (phase === "streaming") {
      const kept = tasks.slice(0, stream.row);
      setTasks(kept); setStream({ row: kept.length, words: 0 });
      setPhase(kept.length ? "ready" : "idle");
      setStatus(`Stopped with ${kept.length} tasks`);
    } else { setPhase("idle"); setStatus("Stopped"); }
  };

  // Chunked streaming: three words per 36ms tick; each row's meta fades in as its title completes.
  useEffect(() => {
    if (phase !== "streaming") return;
    // The interval owns the cursor; streaming always starts at the first word of the first row.
    let current = { row: 0, words: 0 };
    const timer = setInterval(() => {
      const task = tasks[current.row];
      const nextWords = current.words + WORDS_PER_TICK;
      const next = !task || nextWords >= words(task.title).length + WORDS_PER_TICK ? { row: current.row + 1, words: 0 } : { row: current.row, words: nextWords };
      current = next;
      setStream(next);
      if (next.row >= tasks.length) {
        clearInterval(timer);
        setPhase("ready");
        setStatus(`${tasks.length} tasks drafted${simulatedGenerate ? ". Simulated sample plan" : ""}`);
      }
    }, TICK);
    return () => clearInterval(timer);
  }, [phase, tasks, simulatedGenerate]);

  // Auto start once, when the block is on screen.
  const shouldAutoStart = autoStart ?? !defaultTasks?.length;
  useEffect(() => {
    const node = root.current;
    if (!shouldAutoStart || started.current || !node || typeof IntersectionObserver === "undefined") return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting || started.current) return;
      started.current = true;
      observer.disconnect();
      timer = setTimeout(() => { void breakDown(); }, 500);
    }, { threshold: 0.4 });
    observer.observe(node);
    return () => { observer.disconnect(); if (timer) clearTimeout(timer); };
  }, [shouldAutoStart, breakDown]);

  useEffect(() => () => { generation.current?.abort(); sending.current?.abort(); rewrites.current.forEach(controller => controller.abort()); }, []);

  const firstChange = useRef(true);
  useEffect(() => {
    if (firstChange.current) { firstChange.current = false; return; }
    if (phase === "ready") onTasksChange?.(tasks);
    // Only edits, reorders and rewrites in the ready state are reported.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks]);

  /* Row actions ---------------------------------------------------------------------------------------------------- */
  const indexOf = (taskId: string) => tasks.findIndex(task => task.id === taskId);

  const saveTask = (taskId: string, patch: Pick<TaskDraft, "title" | "estimate">) => {
    setTasks(list => list.map(task => task.id === taskId ? { ...task, ...patch } : task));
    setEditing(null);
    setStatus(`Task ${indexOf(taskId) + 1} saved`);
  };

  const regenerateTask = async (taskId: string) => {
    const task = tasks.find(item => item.id === taskId);
    if (!task) return;
    const controller = new AbortController();
    rewrites.current.get(taskId)?.abort();
    rewrites.current.set(taskId, controller);
    setBusy(map => ({ ...map, [taskId]: true }));
    setStatus(`Regenerating task ${indexOf(taskId) + 1}`);
    try {
      let patch: Partial<Omit<TaskDraft, "id">>;
      if (regenerate) patch = await regenerate(task, { goal, tasks }, controller.signal);
      else {
        await wait(760, controller.signal);
        const variants = [originals.current.get(taskId), ...(demoAlternates[taskId] ?? [])].filter(Boolean) as Omit<TaskDraft, "id" | "dependsOn">[];
        const at = ((variantAt.current.get(taskId) ?? 0) + 1) % Math.max(1, variants.length);
        variantAt.current.set(taskId, at);
        patch = variants[at] ?? {};
      }
      const { id: _ignored, ...rest } = patch as TaskDraft;
      void _ignored;
      setTasks(list => list.map(item => item.id === taskId ? { ...item, ...rest, dependsOn: rest.dependsOn ?? item.dependsOn } : item));
      setStatus(`Task ${indexOf(taskId) + 1} rewritten${regenerate ? "" : ". Simulated"}`);
    } catch (error) {
      if (!aborted(error)) setStatus(`Could not regenerate task ${indexOf(taskId) + 1}`);
    } finally {
      if (rewrites.current.get(taskId) === controller) rewrites.current.delete(taskId);
      setBusy(map => { const next = { ...map }; delete next[taskId]; return next; });
    }
  };

  const moveTask = (taskId: string, delta: number) => {
    const from = indexOf(taskId), to = from + delta;
    if (from < 0 || to < 0 || to >= tasks.length) return;
    const next = [...tasks];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setTasks(next);
    setStatus(`Moved to position ${to + 1} of ${tasks.length}`);
    requestAnimationFrame(() => root.current?.querySelector<HTMLElement>(`[data-grip="${CSS.escape(taskId)}"]`)?.focus());
  };

  /* Send ----------------------------------------------------------------------------------------------------------- */
  const createOne = async (tracker: IssueTarget, task: TaskDraft, position: number, signal: AbortSignal): Promise<CreatedIssue> => {
    if (createIssue) return createIssue(tracker, task, signal);
    await wait(220, signal);
    const config = demoIssue[tracker];
    const key = `${config.prefix}-${config.first + position}`;
    return { key, url: config.url(key) };
  };

  const send = async (tracker: IssueTarget, only?: string[]) => {
    sending.current?.abort();
    const controller = new AbortController();
    sending.current = controller;
    setEditing(null); setTarget(tracker); setPhase("sending");
    const list = tasks;
    const result: Record<string, IssueState> = only ? { ...issues } : {};
    if (!only) setIssues({});
    setStatus(`Creating ${list.length} issues in ${trackerName[tracker]}`);
    for (const [position, task] of list.entries()) {
      if (only && !only.includes(task.id)) continue;
      result[task.id] = "creating";
      setIssues({ ...result });
      try {
        result[task.id] = await createOne(tracker, task, position, controller.signal);
      } catch (error) {
        if (aborted(error)) return;
        result[task.id] = "failed";
      }
      setIssues({ ...result });
    }
    const created = Object.fromEntries(Object.entries(result).filter((entry): entry is [string, CreatedIssue] => typeof entry[1] === "object"));
    const count = Object.keys(created).length;
    setPhase("sent");
    setStatus(count === list.length
      ? `${count} issues created in ${trackerName[tracker]}${simulatedSend ? ". Simulated, nothing was sent" : ""}`
      : `${count} of ${list.length} issues created. ${list.length - count} failed`);
    if (count === list.length) onSent?.(tracker, created);
  };

  const startOver = () => {
    sending.current?.abort();
    setIssues({}); setTarget(null); setPhase(tasks.length ? "ready" : "idle");
    setStatus("Plan unlocked for editing");
  };

  /* Derived -------------------------------------------------------------------------------------------------------- */
  const visible = phase === "streaming" ? tasks.slice(0, stream.row) : tasks;
  const plan = useMemo(() => schedule(visible), [visible]);
  const start = useMemo(() => new Date(startDate), [startDate]);
  const deadlineDay = useMemo(() => workdaysBetween(startDate, deadline), [startDate, deadline]);
  const scale = Math.max(deadlineDay + 4, plan.span);
  const shipDate = plan.span ? addWorkdays(start, plan.span) : null;
  const slack = deadlineDay - Math.ceil(plan.span);
  const late = plan.span > 0 && slack < 0;
  const createdCount = Object.values(issues).filter(value => typeof value === "object").length;
  const failedIds = Object.entries(issues).filter(([, value]) => value === "failed").map(([key]) => key);
  const generating = phase === "thinking" || phase === "streaming";
  const locked = phase === "sending" || phase === "sent" || generating;
  const canSend = phase === "ready" && tasks.length > 0 && !editing && !Object.keys(busy).length;
  const rows = Math.max(RESERVED_ROWS, tasks.length);
  const hoveredOnPath = hovered && plan.critical.includes(hovered) ? hovered : null;

  const depFor = (task: TaskDraft, index: number) => {
    const positions = (task.dependsOn ?? []).map(dep => tasks.findIndex(item => item.id === dep)).filter(position => position >= 0).sort((a, b) => a - b);
    if (!positions.length) return undefined;
    const blocked = positions.some(position => position > index);
    return { text: `${blocked ? "Waits on" : "After"} ${positions.map(position => position + 1).join(", ")}`, blocked };
  };

  const revealedFor = (index: number) => {
    if (phase !== "streaming") return Infinity;
    if (index < stream.row) return Infinity;
    if (index === stream.row) return stream.words;
    return 0;
  };

  /* Render --------------------------------------------------------------------------------------------------------- */
  const summary = phase === "thinking"
    ? <TextShimmer>Planning tasks</TextShimmer>
    : visible.length
      ? <span className={styles.totals}>
        <span className={styles.total}><Swap swapKey={visible.length} reduced={reduced} className={styles.num}>{visible.length}</Swap> {visible.length === 1 ? "task" : "tasks"}</span>
        <span className={styles.dot} aria-hidden="true" />
        <span className={styles.total}><Swap swapKey={plan.effort} reduced={reduced} className={styles.num}>{days(plan.effort)}</Swap> effort</span>
      </span>
      : <span className={styles.muted}>No tasks yet</span>;

  const shipLabel = shipDate
    ? late
      ? { key: `late-${shortDate(shipDate)}`, icon: <CircleAlert aria-hidden="true" />, text: `Ships ${shortDate(shipDate)}, ${-slack}d late`, tone: styles.warning }
      : { key: `ok-${shortDate(shipDate)}-${slack}`, icon: <CircleCheck aria-hidden="true" />, text: `Ships ${shortDate(shipDate)}, ${slack}d early`, tone: styles.success }
    : { key: "none", icon: null, text: `Due ${shortDate(new Date(deadline))}`, tone: styles.muted };

  let footerKey: string;
  let footer: ReactNode;
  if (phase === "sending" && target) { footerKey = "sending"; footer = <><TrackerMark target={target} /><span className={styles.footerText}>Creating <Swap swapKey={Math.min(createdCount + 1, tasks.length)} reduced={reduced} className={styles.num}>{Math.min(createdCount + 1, tasks.length)}</Swap> of {tasks.length} in {trackerName[target]}</span></>; }
  else if (phase === "sent" && target) {
    const ok = !failedIds.length;
    footerKey = ok ? "sent" : "partial";
    footer = <>{ok ? <CircleCheck className={cx(styles.statusIcon, styles.success)} aria-hidden="true" /> : <CircleAlert className={cx(styles.statusIcon, styles.warning)} aria-hidden="true" />}<span className={styles.footerText}>{ok ? `${createdCount} issues created in ${trackerName[target]}` : `${createdCount} of ${tasks.length} created`}</span></>;
  } else { footerKey = "model"; footer = <><ClaudeMark className={cx(styles.mark, styles.claude)} aria-hidden="true" /><span className={styles.footerText}>{model}</span></>; }

  let actionsKey: string;
  let actions: ReactNode;
  if (phase === "sent" && target) {
    actionsKey = failedIds.length ? "retry" : "done";
    actions = <>
      <Button size="sm" variant="ghost" onClick={startOver}>Start over</Button>
      {failedIds.length
        ? <Button size="sm" variant="primary" onClick={() => void send(target, failedIds)}><RotateCcw aria-hidden="true" />Retry failed</Button>
        : <Button size="sm" variant="secondary" onClick={() => setStatus(simulatedSend ? `Simulated, the ${trackerName[target]} project was not opened` : `Open the project in ${trackerName[target]}`)}><TrackerMark target={target} /><span><span className={styles.long}>Open in </span>{trackerName[target]}</span></Button>}
    </>;
  } else {
    actionsKey = "send";
    actions = targets.map((tracker, at) => <Button key={tracker} size="sm" variant={at === 0 ? "primary" : "secondary"} disabled={!canSend && !(phase === "sending" && target === tracker)} loading={phase === "sending" && target === tracker} onClick={() => void send(tracker)} aria-label={`Send to ${trackerName[tracker]}`}>
      <TrackerMark target={tracker} /><span><span className={styles.long}>Send to </span>{trackerName[tracker]}</span>
    </Button>);
  }

  return <section ref={root} className={cx(styles.root, className)} aria-labelledby={`${id}-goal-label`}>
    <form className={styles.goal} onSubmit={event => { event.preventDefault(); if (generating) stop(); else void breakDown(); }}>
      <label id={`${id}-goal-label`} htmlFor={`${id}-goal`} className={styles.srOnly}>Goal</label>
      <Sparkles className={styles.goalIcon} aria-hidden="true" />
      <input id={`${id}-goal`} className={styles.goalInput} value={goal} placeholder="Paste a goal, like Launch usage-based billing by Dec 1" autoComplete="off" spellCheck={false}
        disabled={phase === "sending"} onChange={event => setGoal(event.target.value)} />
      <Button type="submit" size="sm" variant={generating ? "secondary" : "primary"} disabled={phase === "sending" || (!generating && !goal.trim())}>
        {generating ? <><Square className={styles.stopIcon} aria-hidden="true" />Stop</> : <>Break down</>}
      </Button>
    </form>

    <div className={styles.summary}>
      <div className={styles.summaryRow}>
        <span className={styles.summaryLeft}>{summary}</span>
        <Swap swapKey={shipLabel.key} reduced={reduced} className={cx(styles.ship, shipLabel.tone)}>{shipLabel.icon}<span className={styles.shipText}>{shipLabel.text}</span></Swap>
      </div>
      <div className={styles.track} role="img" aria-label={shipDate ? `Critical path of ${days(plan.span)} ships ${shortDate(shipDate)}, deadline ${shortDate(new Date(deadline))}` : "Timeline empty"}>
        <div className={styles.rail}>
          <AnimatePresence initial={false}>
            {plan.critical.map(taskId => {
              const left = ((plan.start.get(taskId) ?? 0) / scale) * 100, width = (((plan.finish.get(taskId) ?? 0) - (plan.start.get(taskId) ?? 0)) / scale) * 100;
              return <motion.span key={taskId} className={cx(styles.segment, late && styles.segmentLate, hoveredOnPath && hoveredOnPath !== taskId && styles.segmentDim)}
                initial={{ left: `${left}%`, width: "0%", opacity: 1 }} animate={{ left: `${left}%`, width: `${width}%`, opacity: 1 }} exit={{ opacity: 0, transition: { duration: motionTokens.duration.instant } }}
                transition={reduced ? { duration: 0 } : glide} />;
            })}
          </AnimatePresence>
          <span className={styles.deadline} style={{ left: `${(deadlineDay / scale) * 100}%` }} aria-hidden="true" />
        </div>
        <div className={styles.axis} aria-hidden="true">
          <span>{shortDate(addWorkdays(start, 1))}</span>
          <span className={styles.deadlineLabel} style={{ left: `${(deadlineDay / scale) * 100}%` }}>{shortDate(new Date(deadline))}</span>
        </div>
      </div>
    </div>

    <motion.div className={styles.listArea} initial={false} animate={{ height: rows * ROW + 8 }} transition={reduced ? { duration: 0 } : glide}>
      <AnimatePresence initial={false}>
        {(phase === "idle" || phase === "error") && !tasks.length && <motion.div key={phase} className={styles.empty} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: motionTokens.duration.fast } }} exit={{ opacity: 0, transition: { duration: motionTokens.duration.instant } }}>
          {phase === "error"
            ? <><CircleAlert className={cx(styles.emptyIcon, styles.warning)} aria-hidden="true" /><span>Could not draft tasks</span><Button size="sm" variant="secondary" onClick={() => void breakDown()}><RotateCcw aria-hidden="true" />Try again</Button></>
            : <><ListTodo className={styles.emptyIcon} aria-hidden="true" /><span>Tasks, estimates and owners appear here</span><span className={styles.muted}>Paste a goal and press Break down</span></>}
        </motion.div>}
      </AnimatePresence>
      {phase === "thinking" && <ol className={styles.list} aria-hidden="true">
        {Array.from({ length: RESERVED_ROWS }, (_, index) => <li key={index} className={cx(styles.row, styles.skeletonRow)}>
          <span className={styles.grip} />
          <span className={styles.index}>{index + 1}</span>
          <span className={styles.title}><span className={styles.skeleton} style={{ width: `${skeletonWidths[index]}%` }} /></span>
        </li>)}
      </ol>}
      {tasks.length > 0 && <Reorder.Group as="ol" axis="y" values={tasks} onReorder={next => { if (!locked) setTasks(next); }} className={styles.list} aria-label="Tasks">
        {tasks.map((task, index) => <Row key={task.id} task={task} index={index} count={tasks.length}
          owner={task.ownerId ? ownerById.get(task.ownerId) : undefined}
          dep={depFor(task, index)} revealed={revealedFor(index)} streaming={phase === "streaming"}
          busy={!!busy[task.id]} locked={locked} editing={editing === task.id} issue={issues[task.id]} simulated={simulatedSend} reduced={reduced}
          onEdit={() => setEditing(task.id)} onSave={patch => saveTask(task.id, patch)} onCancel={() => setEditing(null)}
          onRegenerate={() => void regenerateTask(task.id)} onMove={delta => moveTask(task.id, delta)}
          onHover={on => setHovered(current => on ? task.id : current === task.id ? null : current)}
          onRetry={() => target && void send(target, [task.id])}
          onIssueClick={key => setStatus(`Simulated, ${key} does not exist in ${target ? trackerName[target] : "the tracker"}`)} />)}
      </Reorder.Group>}
    </motion.div>

    <div className={styles.footer}>
      <Swap swapKey={footerKey} reduced={reduced} className={styles.footerStatus}>{footer}</Swap>
      <span className={styles.footerActions}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span key={actionsKey} className={styles.footerActionsInner} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: motionTokens.duration.fast, ease } }} exit={{ opacity: 0, transition: { duration: motionTokens.duration.instant, ease } }}>{actions}</motion.span>
        </AnimatePresence>
      </span>
    </div>
    <p className={styles.srOnly} role="status" aria-live="polite">{status}{simulatedGenerate && phase === "thinking" ? ". Simulated" : ""}</p>
  </section>;
}

export default TaskBreakdown;
