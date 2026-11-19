"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { TargetAndTransition, Transition } from "motion/react";
import { Check, ChevronDown, MessageCircle } from "lucide-react";
import { motionTokens } from "../../lib/motion-tokens";
import { avatar, type PersonId } from "../../lib/media";
import { Avatar as ArcAvatar } from "../../avatar/avatar";
import { Badge } from "../../badge/badge";
import { Popover, PopoverContent, PopoverTrigger } from "../../popover/popover";
import { formatDate, isOverdue, personName, type Activity, type Project, type ProjectStatus, type Task } from "./project-board-data";
import { PriorityIcon, ProjectIcon, StageIcon, ToolMark, statusIcon, statusTone } from "./project-board-marks";
import styles from "./project-board.module.css";

export const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");
export const instant: Transition = { duration: 0 };

/** One crossfade per change: content in at the standard duration, out a little faster. */
export function useFade(): { initial: TargetAndTransition; animate: TargetAndTransition; exit: TargetAndTransition } {
  const reduce = useReducedMotion();
  return {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: reduce ? instant : { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.standard] } },
    exit: { opacity: 0, transition: reduce ? instant : { duration: motionTokens.duration.exit, ease: [...motionTokens.ease.standard] } },
  };
}

/**
 * Arc's Avatar at the size a dense row needs. The name is always written beside it (or read out by the row), so the image
 * is hidden from assistive technology unless `label` asks for it.
 */
export function Avatar({ id, size = 20, className, label }: { id: PersonId; size?: number; className?: string; label?: boolean }) {
  return <ArcAvatar name={personName(id)} src={avatar(id)} size="sm" className={cx(styles.avatar, className)} style={{ "--pb-av": `${size}px` } as CSSProperties}
    aria-hidden={label ? undefined : true} />;
}

/** Project health as Arc's Badge with a meaningful icon, never a dot. */
export function StatusBadge({ status }: { status: ProjectStatus }) {
  const Icon = statusIcon[status];
  return <Badge tone={statusTone(status)} size="sm" icon={<Icon size={13} strokeWidth={1.75} />}>{status}</Badge>;
}

/** The project's tinted icon and name, used wherever a row names its project. */
export function ProjectTag({ project }: { project: Project }) {
  return <span className={styles.rowTag}><ProjectIcon project={project} size={14} />{project.name}</span>;
}

/** Marks a scroller's cut edges for the CSS mask, without re-rendering. */
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
    const resize = new ResizeObserver(update);
    resize.observe(element);
    const mutations = new MutationObserver(update);
    mutations.observe(element, { childList: true, subtree: true });
    return () => { element.removeEventListener("scroll", update); resize.disconnect(); mutations.disconnect(); };
  }, [axis]);
  return ref;
}

/** The page's own scroller: hidden scrollbar, fades on cut edges, and layoutScroll so moving rows measure correctly. */
export function Scroller({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useEdgeFade<HTMLDivElement>("y");
  return <motion.div ref={ref} layoutScroll className={cx(styles.scroller, className)}>{children}</motion.div>;
}

export interface PickerOption<T extends string> { value: T; label: string; icon?: ReactNode; detail?: string }

/**
 * A property trigger on Arc's Popover with a listbox inside. Focus lands on the chosen option, arrows move instantly,
 * Enter picks, and Escape or an outside press close it and return focus. The trigger anchors the layer, so it answers
 * with colour only.
 */
export function Picker<T extends string>({ label, value, options, onChange, children, className, variant = "inline", align = "start" }: {
  label: string; value: T; options: PickerOption<T>[]; onChange: (value: T) => void; children: ReactNode; className?: string; variant?: "inline" | "field"; align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const list = useRef<HTMLDivElement>(null);

  const onListKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = [...(list.current?.querySelectorAll<HTMLElement>("[role=option]") ?? [])];
    const index = items.indexOf(document.activeElement as HTMLElement);
    const next = event.key === "ArrowDown" ? items[(index + 1) % items.length] : event.key === "ArrowUp" ? items[(index - 1 + items.length) % items.length]
      : event.key === "Home" ? items[0] : event.key === "End" ? items.at(-1) : undefined;
    if (next) { event.preventDefault(); next.focus({ preventScroll: true }); }
  };

  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger className={cx(styles.pickerTrigger, className)} data-variant={variant} aria-haspopup="listbox" aria-label={label}
      onKeyDown={event => { if (event.key === "ArrowDown" && !open) { event.preventDefault(); setOpen(true); } }}>
      {children}
    </PopoverTrigger>
    <PopoverContent align={align} className={styles.pickerList} aria-label={label}
      onOpenAutoFocus={event => { event.preventDefault(); (list.current?.querySelector<HTMLElement>("[aria-selected=true]") ?? list.current?.querySelector<HTMLElement>("[role=option]"))?.focus({ preventScroll: true }); }}>
      <div ref={list} role="listbox" aria-label={label} onKeyDown={onListKey} className={styles.pickerOptions}>
        {options.map(option => <button key={option.value} type="button" role="option" aria-selected={option.value === value} className={styles.pickerOption}
          onClick={() => { onChange(option.value); setOpen(false); }}>
          {option.icon}
          <span className={styles.pickerText}><span>{option.label}</span>{option.detail && <span className={styles.pickerDetail}>{option.detail}</span>}</span>
          {option.value === value && <Check size={16} strokeWidth={1.75} className={styles.pickerCheck} aria-hidden="true" />}
        </button>)}
      </div>
    </PopoverContent>
  </Popover>;
}

export function PickerValue({ children }: { children: ReactNode }) {
  return <><span className={styles.pickerValue}>{children}</span><ChevronDown size={14} strokeWidth={1.75} className={styles.pickerChevron} aria-hidden="true" /></>;
}

/** Arrow keys move between rows in any list that marks its row buttons with data-row. */
export function onRowKeys(event: ReactKeyboardEvent<HTMLElement>) {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp" || event.altKey) return;
  const target = event.target as HTMLElement;
  if (!target.matches("[data-row]")) return;
  const rows = [...event.currentTarget.querySelectorAll<HTMLElement>("[data-row]")];
  const next = rows[rows.indexOf(target) + (event.key === "ArrowDown" ? 1 : -1)];
  if (!next) return;
  event.preventDefault();
  next.focus({ preventScroll: true });
  next.scrollIntoView({ block: "nearest" });
}

export function TaskRowContent({ task, project, milestone, comments, showId = true }: { task: Task; project?: Project; milestone?: string; comments: number; showId?: boolean }) {
  const overdue = isOverdue(task);
  return <>
    {showId && <span className={styles.rowId}>{task.id}</span>}
    <span className={styles.rowTitle}>{task.title}</span>
    {project && <ProjectTag project={project} />}
    {milestone && <span className={styles.rowTag}>{milestone}</span>}
    <span className={styles.rowMeta}>
      {comments > 0 && <span className={styles.rowComments}><MessageCircle size={14} strokeWidth={1.75} aria-hidden="true" /><span className={styles.tabular}>{comments}</span><span className={styles.srOnly}> comments</span></span>}
      <PriorityIcon priority={task.priority} /><span className={styles.srOnly}>{task.priority} priority</span>
    </span>
    <span className={styles.rowDue} data-overdue={overdue ? "" : undefined}>{overdue && <span className={styles.srOnly}>Overdue, </span>}{formatDate(task.due)}</span>
    <Avatar id={task.assignee} size={20} />
    <span className={styles.srOnly}>, {personName(task.assignee)}</span>
  </>;
}

/** The status ring as a button: one press completes a task, another reopens it. */
export function StageButton({ task, onToggle }: { task: Task; onToggle: () => void }) {
  const reduce = useReducedMotion();
  const done = task.stage === "Done";
  return <motion.button type="button" className={styles.stageButton} aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`} aria-pressed={done}
    whileTap={reduce ? undefined : { scale: .97 }} transition={motionTokens.spring.snappy} onClick={onToggle}>
    <StageIcon stage={task.stage} />
  </motion.button>;
}

export function ActivityLine({ item, taskTitle, compact }: { item: Activity; taskTitle?: string; compact?: boolean }) {
  return <>
    <Avatar id={item.who} size={compact ? 20 : 24} className={styles.activityAvatar} />
    <span className={styles.activityText}>
      <span className={styles.activitySentence}>
        <span className={styles.activityWho}>{item.who === "emma-collins" ? "You" : personName(item.who)}</span>{" "}
        <span className={styles.activityVerb}>{item.verb}</span>{" "}
        {item.tool && <ToolMark tool={item.tool} size={12} />}
        {item.task && <span className={styles.activityTarget}>{taskTitle ?? item.task}</span>}
        {item.target && <span className={styles.activityTarget}>{item.target}</span>}
        {item.detail && <> <span className={styles.activityVerb}>{item.detail}</span></>}
      </span>
      {item.body && <span className={styles.activityBody}><span className={styles.activityBodyText}>{item.body}</span></span>}
    </span>
  </>;
}
