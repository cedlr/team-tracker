"use client";

import { memo, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { AnimatePresence, LayoutGroup, MotionConfig, motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import type { Transition } from "motion/react";
import {
  AlertTriangle, CalendarDays, Check, ChevronDown, ChevronUp, CircleUserRound, FolderKanban, IterationCcw,
  Keyboard, Layers, Link2, LogOut, MessageSquare, Plus, Tag, X,
} from "lucide-react";
import { motionTokens } from "../../lib/motion-tokens";
import { AnimatedCounter } from "../../animated-counter/animated-counter";
import { Avatar } from "../../avatar/avatar";
import { Badge } from "../../badge/badge";
import { Button } from "../../button/button";
import { Checkbox } from "../../checkbox/checkbox";
import { Kbd } from "../../kbd/kbd";
import { Popover, PopoverContent, PopoverTrigger } from "../../popover/popover";
import { Progress } from "../../progress/progress";
import { SearchField } from "../../search-field/search-field";
import SegmentedControl from "../../segmented-control/segmented-control";
import { Tooltip } from "../../tooltip/tooltip";
import { ScreenShell, ScreenShellButton, ScreenShellMark, useScreenShell } from "../../screen-shell/screen-shell";
import type { ScreenShellSection } from "../../screen-shell/screen-shell";
import { sampleActivity, sampleCards, sampleColumns, sampleLabels, samplePeople, sampleProjects } from "./kanban-board-data";
import type { KanbanActivity, KanbanCard, KanbanColumn, KanbanLabel, KanbanPerson, KanbanPriority, KanbanProject, KanbanStatusKind, KanbanTone } from "./kanban-board-data";
import styles from "./kanban-board.module.css";

/**
 * A full project board screen inside the Arc screen shell: issue views and projects in the sidebar with the running cycle at
 * its foot, a board header with filters, and columns of issue cards with assignees, labels, priority, sub-issues and linked
 * pull requests.
 *
 * Cards drag physically: the lifted card follows the pointer from where you grabbed it and tilts with its speed, a slot
 * opens where it will land while neighbours glide aside, the board and the column scroll at their edges, and on release the
 * card settles into the slot. Group by assignee for swimlanes. Clicking a card opens a details panel over the right side
 * of the board, so nothing else moves. Arrow keys move between cards, Space lifts one, Enter opens it.
 */

export type { KanbanActivity, KanbanCard, KanbanChecklistItem, KanbanColumn, KanbanIcon, KanbanLabel, KanbanLink, KanbanPerson, KanbanPriority, KanbanProject, KanbanStatusKind, KanbanTone } from "./kanban-board-data";
export type KanbanGroupBy = "status" | "assignee";

export interface KanbanBoardProps {
  columns?: KanbanColumn[];
  people?: KanbanPerson[];
  /** Controlled cards, in board order. */
  cards?: KanbanCard[];
  /** Initial cards when uncontrolled. */
  defaultCards?: KanbanCard[];
  /** Called with the full card list after every move, edit, or new card. */
  onCardsChange?: (cards: KanbanCard[]) => void;
  defaultGroupBy?: KanbanGroupBy;
  /** Person id that new cards are assigned to, and whose issues "My issues" shows. */
  currentUser?: string;
  /** Renames the first project, which the board opens on. */
  title?: string;
  /** Projects listed in the sidebar. Cards without a project belong to the first one. */
  projects?: KanbanProject[];
  /** Labels cards can carry, matched by id or name. */
  labels?: KanbanLabel[];
  /** Project the board opens on. Defaults to the first project. */
  defaultProject?: string;
  /** Workspace name in the sidebar and the trail. */
  workspace?: string;
  /** Today's date in the same "Nov 12" form as card due dates, for due soon and overdue marks. */
  today?: string;
  /** The running cycle shown at the foot of the sidebar and in the details panel. Its dates use the same "Nov 12" form. */
  cycle?: { name: string; start: string; end: string };
  /** Seeded history for the details panel, by card id. */
  activity?: Record<string, KanbanActivity[]>;
  className?: string;
}

interface DragState { id: string; cell: string; index: number; width: number; height: number; origin: { cell: string; index: number }; dropping: boolean }
interface Pending { id: string; x: number; y: number; pointerId: number; touch: boolean; element: HTMLElement; armed: boolean; timer?: number }
interface Filters { query: string; priorities: string[]; labels: string[]; assignees: string[] }

const EMPTY_FILTERS: Filters = { query: "", priorities: [], labels: [], assignees: [] };
const DEFAULT_CYCLE = { name: "Cycle 24", start: "Nov 9", end: "Nov 22" };
const SEP = "|";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const PRIORITIES: { id: KanbanPriority; label: string }[] = [
  { id: "urgent", label: "Urgent" }, { id: "high", label: "High" }, { id: "medium", label: "Medium" }, { id: "low", label: "Low" }, { id: "none", label: "No priority" },
];
const ESTIMATES = [1, 2, 3, 5, 8];
const DUE_OPTIONS = ["Nov 12", "Nov 13", "Nov 14", "Nov 19", "Nov 22"];
const NEW_TONES: KanbanTone[] = ["green", "rose", "orchid", "teal"];
const GROUPS = [{ value: "status", label: "Status" }, { value: "assignee", label: "Assignee" }];

const cellKey = (column: string, lane?: string) => lane ? `${lane}${SEP}${column}` : column;
const parseCell = (key: string) => { const at = key.indexOf(SEP); return at < 0 ? { column: key, lane: undefined } : { lane: key.slice(0, at), column: key.slice(at + 1) }; };
const cx = (...names: (string | false | undefined | null)[]) => names.filter(Boolean).join(" ");
const inCell = (card: KanbanCard, key: string) => { const { column, lane } = parseCell(key); return card.column === column && (!lane || card.assignee === lane); };
const toneVar = (tone?: KanbanTone) => ({ "--kb-tone": tone ? `var(--tone-${tone})` : "var(--text-muted)" }) as CSSProperties;
const dayOf = (value?: string) => { const match = /^([A-Z][a-z]{2}) (\d{1,2})$/.exec(value ?? ""); const month = match ? MONTHS.indexOf(match[1]) : -1; return match && month >= 0 ? month * 31 + Number(match[2]) : null; };
const typing = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
const kindOf = (column: KanbanColumn | undefined, index: number, total: number): KanbanStatusKind => column?.kind ?? (index === total - 1 ? "done" : index === 0 ? "unstarted" : "started");

/* ------------------------------------------------------------------------------------------------------------------
 * Small marks
 * ---------------------------------------------------------------------------------------------------------------- */

/** Arc's animated counter at the surrounding text size: digits roll to the new count and a new digit opens its own column. */
function Count({ value }: { value: number }) {
  return <span className={styles.count}><AnimatedCounter value={value} /></span>;
}

/** Arc's Avatar at the board's sizes. The name is always written beside it or in the card's label, so it is hidden from assistive tech. */
function Face({ person, size = 20 }: { person?: KanbanPerson; size?: number }) {
  if (!person) return <span className={cx(styles.face, styles.faceEmpty)} style={{ width: size, height: size }} aria-hidden="true" />;
  return <Avatar name={person.name} src={person.avatar} size="sm" className={styles.face} style={{ width: size, height: size }} aria-hidden="true" />;
}

/** A label's own icon in its tone, so labels read by shape and colour instead of a dot. */
function LabelIcon({ label, size = 12 }: { label: KanbanLabel; size?: number }) {
  const Icon = label.icon ?? Tag;
  return <Icon size={size} strokeWidth={1.75} className={styles.toneIcon} style={toneVar(label.tone)} />;
}

function ProjectIcon({ project, size = 14 }: { project: KanbanProject; size?: number }) {
  const Icon = project.icon ?? FolderKanban;
  return <Icon size={size} strokeWidth={1.75} className={styles.toneIcon} style={toneVar(project.tone)} />;
}

/** One label as an Arc badge: a neutral chip with the label's icon in its tone. */
function LabelBadge({ label }: { label: KanbanLabel }) {
  return <Badge size="sm" className={styles.labelBadge} icon={<LabelIcon label={label} />}>{label.name}</Badge>;
}

function PriorityIcon({ value = "none" }: { value?: KanbanPriority }) {
  if (value === "urgent") return <svg className={styles.priority} data-priority="urgent" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
    <rect x="1.5" y="1.5" width="13" height="13" rx="3.5" fill="currentColor" />
    <path d="M8 4.6v4.1M8 11.2v.2" fill="none" stroke="var(--background)" strokeWidth="1.8" strokeLinecap="round" />
  </svg>;
  if (value === "none") return <svg className={styles.priority} data-priority="none" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
    <path d="M2.8 8h1.6M7.2 8h1.6M11.6 8h1.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>;
  const level = value === "high" ? 3 : value === "medium" ? 2 : 1;
  return <svg className={styles.priority} data-priority={value} viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
    {[0, 1, 2].map(index => <rect key={index} x={2.25 + index * 4.25} y={14 - (4 + index * 3)} width="3" height={4 + index * 3} rx="1" fill="currentColor" opacity={index < level ? 1 : .26} />)}
  </svg>;
}

function StatusIcon({ kind, size = 14 }: { kind: KanbanStatusKind; size?: number }) {
  return <svg className={styles.status} data-kind={kind} viewBox="0 0 16 16" width={size} height={size} aria-hidden="true">
    {kind === "done"
      ? <><circle cx="8" cy="8" r="6.75" fill="currentColor" /><path d="M5.2 8.2l1.9 1.9 3.7-4" fill="none" stroke="var(--background)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></>
      : <>
        <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray={kind === "backlog" ? "2.2 2.1" : undefined} />
        {kind === "started" && <path d="M8 4.6a3.4 3.4 0 0 1 0 6.8z" fill="currentColor" />}
        {kind === "review" && <path d="M8 4.6a3.4 3.4 0 1 1-3.4 3.4H8z" fill="currentColor" />}
      </>}
  </svg>;
}

/** GitHub mark, Simple Icons (CC0). */
function GitHubMark({ size = 13 }: { size?: number }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" /></svg>;
}

/** Figma mark, drawn from the published geometry. */
function FigmaMark({ size = 13 }: { size?: number }) {
  return <svg viewBox="0 0 38 57" width={size * 38 / 57} height={size} aria-hidden="true">
    <path d="M19 0H9.5a9.5 9.5 0 0 0 0 19H19z" fill="#F24E1E" />
    <path d="M19 0h9.5a9.5 9.5 0 0 1 0 19H19z" fill="#FF7262" />
    <path d="M19 19H9.5a9.5 9.5 0 0 0 0 19H19z" fill="#A259FF" />
    <circle cx="28.5" cy="28.5" r="9.5" fill="#1ABCFE" />
    <path d="M9.5 57A9.5 9.5 0 0 0 19 47.5V38H9.5a9.5 9.5 0 0 0 0 19z" fill="#0ACF83" />
  </svg>;
}

function SubRing({ done, total }: { done: number; total: number }) {
  const length = 2 * Math.PI * 5;
  return <svg className={styles.ring} data-complete={done === total || undefined} viewBox="0 0 14 14" width="13" height="13" aria-hidden="true">
    <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeOpacity=".22" strokeWidth="2" />
    <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray={`${length * done / Math.max(1, total)} ${length}`} transform="rotate(-90 7 7)" />
  </svg>;
}

/* ------------------------------------------------------------------------------------------------------------------
 * Picker: a listbox inside Arc's Popover. The trigger anchors it, so it answers a press with colour only.
 * ---------------------------------------------------------------------------------------------------------------- */

interface PickerOption { id: string; label: string; icon?: ReactNode; hint?: string }
interface PickerProps {
  label: string;
  options: PickerOption[];
  value: string[];
  multiple?: boolean;
  onChange: (value: string[]) => void;
  className?: string;
  align?: "start" | "end";
  active?: boolean;
  children: ReactNode;
}

function Picker({ label, options, value, multiple, onChange, className, align = "start", active: highlighted, children }: PickerProps) {
  const id = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);

  const onOpenChange = (next: boolean) => {
    if (next) setCursor(Math.max(0, options.findIndex(option => value.includes(option.id))));
    setOpen(next);
  };
  const choose = (optionId: string) => {
    if (multiple) { onChange(value.includes(optionId) ? value.filter(item => item !== optionId) : [...value, optionId]); return; }
    onChange([optionId]);
    setOpen(false);
  };

  const onKeyDown = (event: ReactKeyboardEvent) => {
    // The keyboard highlight lands instantly; only the pointer gets a fill on hover. Escape and Tab belong to the popover.
    if (event.key === "ArrowDown") { event.preventDefault(); setCursor(index => (index + 1) % options.length); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setCursor(index => (index - 1 + options.length) % options.length); }
    else if (event.key === "Home") { event.preventDefault(); setCursor(0); }
    else if (event.key === "End") { event.preventDefault(); setCursor(options.length - 1); }
    else if (event.key === "Enter" || event.key === " ") { event.preventDefault(); const option = options[cursor]; if (option) choose(option.id); }
    else if (event.key === "Tab") setOpen(false);
  };

  return <Popover open={open} onOpenChange={onOpenChange}>
    <PopoverTrigger className={className} aria-haspopup="listbox" data-active={highlighted || undefined}
      onKeyDown={event => { if (event.key === "ArrowDown" && !open) { event.preventDefault(); onOpenChange(true); } }}>
      {children}
    </PopoverTrigger>
    <PopoverContent ref={listRef} id={id} align={align} className={styles.menu} role="listbox" tabIndex={-1} aria-label={label} aria-multiselectable={multiple || undefined}
      aria-activedescendant={`${id}-${cursor}`} data-kb-picker="" onKeyDown={onKeyDown}
      onOpenAutoFocus={event => { event.preventDefault(); listRef.current?.focus({ preventScroll: true }); }}>
      {options.map((option, index) => {
        const selected = value.includes(option.id);
        return <div key={option.id} id={`${id}-${index}`} role="option" aria-selected={selected} className={styles.option} data-cursor={index === cursor || undefined}
          onPointerMove={() => { if (cursor !== index) setCursor(index); }} onClick={() => choose(option.id)}>
          {multiple && <span className={styles.optionBox} data-on={selected || undefined} aria-hidden="true"><Check size={11} strokeWidth={2.4} /></span>}
          {option.icon && <span className={styles.optionIcon}>{option.icon}</span>}
          <span className={styles.optionLabel}>{option.label}</span>
          {option.hint && <span className={styles.optionHint}>{option.hint}</span>}
          {!multiple && selected && <Check size={16} strokeWidth={1.75} className={styles.optionCheck} aria-hidden="true" />}
        </div>;
      })}
    </PopoverContent>
  </Popover>;
}

/* ------------------------------------------------------------------------------------------------------------------
 * Card
 * ---------------------------------------------------------------------------------------------------------------- */

interface CardViewProps { card: KanbanCard; person?: KanbanPerson; labels: KanbanLabel[]; project?: KanbanProject; showProject: boolean; dueState?: "soon" | "overdue"; lifted?: boolean; selected?: boolean }
const CardView = memo(function CardView({ card, person, labels, project, showProject, dueState, lifted, selected }: CardViewProps) {
  const done = card.checklist?.filter(item => item.done).length ?? 0;
  const total = card.checklist?.length ?? 0;
  const pr = card.links?.find(link => link.kind === "github");
  const figma = card.links?.some(link => link.kind === "figma");
  const priority = PRIORITIES.find(item => item.id === (card.priority ?? "none"));
  return <div className={styles.cardInner} data-lifted={lifted || undefined} data-selected={selected || undefined}>
    <div className={styles.cardTop}>
      {showProject && project && <span className={styles.cardProject} title={project.name}><ProjectIcon project={project} /></span>}
      <span className={styles.cardId}>{card.id}</span>
      {pr && <span className={styles.cardLink} data-state={pr.state}><GitHubMark size={12} />{pr.title.split(" ")[0]}</span>}
      {figma && <span className={styles.cardLink}><FigmaMark size={12} /></span>}
      <span className={styles.cardFace}><Face person={person} size={20} /></span>
    </div>
    <p className={styles.cardTitle}>{card.title}</p>
    <div className={styles.cardMeta}>
      <span className={styles.cardPriority} title={`Priority: ${priority?.label}`}><PriorityIcon value={card.priority} /><span className={styles.srOnly}>Priority {priority?.label}</span></span>
      {labels.slice(0, 2).map(label => <LabelBadge key={label.id} label={label} />)}
      {labels.length > 2 && <Badge size="sm" className={styles.labelBadge}>{`+${labels.length - 2}`}</Badge>}
      <span className={styles.stats}>
        {total > 0 && <span className={styles.stat} data-complete={done === total || undefined} aria-label={`${done} of ${total} sub-issues done`}><SubRing done={done} total={total} />{done}/{total}</span>}
        {card.comments ? <span className={styles.stat} aria-label={`${card.comments} comments`}><MessageSquare size={12} strokeWidth={1.75} aria-hidden="true" />{card.comments}</span> : null}
        {card.due && <span className={styles.stat} data-due={dueState} aria-label={`Due ${card.due}${dueState === "overdue" ? ", overdue" : dueState === "soon" ? ", due soon" : ""}`}><CalendarDays size={12} strokeWidth={1.75} aria-hidden="true" />{card.due}</span>}
      </span>
    </div>
  </div>;
});

/* ------------------------------------------------------------------------------------------------------------------
 * Edge fades: any element with a fade class gets data attributes for the edges that cut content off.
 * ---------------------------------------------------------------------------------------------------------------- */

function updateFade(element: HTMLElement) {
  const axes = element.dataset.fade ?? "";
  if (axes.includes("x")) {
    element.toggleAttribute("data-fl", element.scrollLeft > 1);
    element.toggleAttribute("data-fr", element.scrollLeft + element.clientWidth < element.scrollWidth - 1);
  }
  if (axes.includes("y")) {
    element.toggleAttribute("data-ft", element.scrollTop > 1);
    element.toggleAttribute("data-fb", element.scrollTop + element.clientHeight < element.scrollHeight - 1);
  }
}

/* ------------------------------------------------------------------------------------------------------------------
 * Board screen
 * ---------------------------------------------------------------------------------------------------------------- */

export function KanbanBoard({
  columns = sampleColumns,
  people = samplePeople,
  cards: controlled,
  defaultCards = sampleCards,
  onCardsChange,
  defaultGroupBy = "status",
  currentUser,
  title,
  projects: projectsProp = sampleProjects,
  labels: labelList = sampleLabels,
  defaultProject,
  workspace = "Larkspur",
  today = "Nov 12",
  cycle = DEFAULT_CYCLE,
  activity: seededActivity = sampleActivity,
  className,
}: KanbanBoardProps) {
  const uid = useId();
  const reduced = useReducedMotion() ?? false;
  const me = currentUser ?? people[0]?.id ?? "";
  const [inner, setInner] = useState(defaultCards);
  const cards = controlled ?? inner;
  const cardsRef = useRef(cards);
  useLayoutEffect(() => { cardsRef.current = cards; });
  const commit = useCallback((next: KanbanCard[]) => { cardsRef.current = next; if (!controlled) setInner(next); onCardsChange?.(next); }, [controlled, onCardsChange]);

  const [extraProjects, setExtraProjects] = useState<KanbanProject[]>([]);
  const projects = useMemo(() => [...projectsProp.map((project, index) => index === 0 && title ? { ...project, name: title } : project), ...extraProjects], [projectsProp, extraProjects, title]);
  const firstProject = projects[0]?.id ?? "";
  const [view, setViewState] = useState(`p-${defaultProject ?? firstProject}`);
  const [workspaceId, setWorkspaceId] = useState("main");
  const [groupBy, setGroupBy] = useState<KanbanGroupBy>(defaultGroupBy);
  const [filters, setFiltersState] = useState<Filters>(EMPTY_FILTERS);
  const [fresh, setFresh] = useState<string[]>([]);
  const [drag, setDragState] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const setDrag = (next: DragState | null) => { dragRef.current = next; setDragState(next); };
  const [generation, setGeneration] = useState<Record<string, number>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [lifted, setLifted] = useState<{ id: string; snapshot: KanbanCard[] } | null>(null);
  const [composer, setComposer] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [events, setEvents] = useState<Record<string, KanbanActivity[]>>({});
  const [signedOut, setSignedOut] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  const [copied, setCopied] = useState<"ok" | "error" | null>(null);
  // Keyboard driven changes (typing a filter, moving a lifted card) land at once; the pointer gets the glide.
  const [instant, setInstant] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const regionRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const pending = useRef<Pending | null>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const grab = useRef({ x: 0, y: 0 });
  const velocity = useRef({ x: 0, y: 0, t: 0, px: 0, py: 0 });
  const suppressClick = useRef(false);
  const returnFocus = useRef<string | null>(null);
  const copyTimer = useRef<number | undefined>(undefined);

  const ox = useMotionValue(0);
  const oy = useMotionValue(0);
  // The tilt is a physical effect that follows throw speed; it is critically damped so it settles without wobble.
  const tilt = useSpring(0, { stiffness: 340, damping: 37 });

  const personById = useMemo(() => new Map(people.map(person => [person.id, person])), [people]);
  const projectById = useMemo(() => new Map(projects.map(project => [project.id, project])), [projects]);
  const labelByKey = useMemo(() => { const map = new Map<string, KanbanLabel>(); labelList.forEach(label => { map.set(label.id, label); map.set(label.name.toLowerCase(), label); }); return map; }, [labelList]);
  const labelsOf = useCallback((card: KanbanCard) => (card.labels ?? (card.label ? [card.label] : [])).map(key => labelByKey.get(key) ?? labelByKey.get(key.toLowerCase()) ?? { id: key, name: key, tone: "sky" as KanbanTone }), [labelByKey]);
  const columnName = useCallback((id: string) => columns.find(column => column.id === id)?.name ?? id, [columns]);
  const columnKind = useCallback((id: string) => { const index = columns.findIndex(column => column.id === id); return kindOf(columns[index], index, columns.length); }, [columns]);
  const projectOf = useCallback((card: KanbanCard) => projectById.get(card.project ?? firstProject), [projectById, firstProject]);
  const todayDay = dayOf(today);
  const dueStateOf = useCallback((card: KanbanCard): "soon" | "overdue" | undefined => {
    const day = dayOf(card.due);
    if (day === null || todayDay === null || columnKind(card.column) === "done") return undefined;
    return day < todayDay ? "overdue" : day <= todayDay + 1 ? "soon" : undefined;
  }, [todayDay, columnKind]);

  /* Views */
  const doneColumn = columns.find((column, index) => kindOf(column, index, columns.length) === "done")?.id;
  const backlogColumn = columns.find((column, index) => kindOf(column, index, columns.length) === "backlog")?.id;
  const inView = useCallback((card: KanbanCard, id: string) => {
    if (id.startsWith("p-")) return (card.project ?? firstProject) === id.slice(2);
    if (id === "my") return card.assignee === me;
    if (id === "cycle") return card.column !== backlogColumn;
    return true;
  }, [firstProject, me, backlogColumn]);
  const matches = useCallback((card: KanbanCard) => {
    const query = filters.query.trim().toLowerCase();
    if (query && !card.title.toLowerCase().includes(query) && !card.id.toLowerCase().includes(query)) return false;
    if (filters.priorities.length && !filters.priorities.includes(card.priority ?? "none")) return false;
    if (filters.labels.length && !labelsOf(card).some(label => filters.labels.includes(label.id))) return false;
    if (filters.assignees.length && !filters.assignees.includes(card.assignee)) return false;
    return true;
  }, [filters, labelsOf]);
  const isVisible = useCallback((card: KanbanCard) => fresh.includes(card.id) || (inView(card, view) && matches(card)), [fresh, inView, view, matches]);
  const visibleRef = useRef(isVisible);
  useLayoutEffect(() => { visibleRef.current = isVisible; });

  const setView = (id: string) => { setViewState(id); setFresh([]); setOpenId(null); setComposer(null); };
  const setFilters = (update: (current: Filters) => Filters) => { setFiltersState(update); setFresh([]); };
  const filtersActive = filters.query.trim() !== "" || filters.priorities.length > 0 || filters.labels.length > 0 || filters.assignees.length > 0;
  const keep = (id: string) => setFresh(list => list.includes(id) ? list : [...list, id]);
  const log = useCallback((id: string, text: string, kind: KanbanActivity["kind"] = "event") =>
    setEvents(map => ({ ...map, [id]: [...(map[id] ?? []), { id: `e${Date.now()}${Math.random().toString(36).slice(2, 6)}`, person: me, kind, text, at: "Just now" }] })), [me]);

  /** Moves a card into a cell at an index counted among that cell's visible cards. */
  const move = useCallback((list: KanbanCard[], id: string, key: string, index: number) => {
    const card = list.find(item => item.id === id);
    if (!card) return list;
    const { column, lane } = parseCell(key);
    const moved = { ...card, column, assignee: lane ?? card.assignee };
    const rest = list.filter(item => item.id !== id);
    const peers = rest.filter(item => inCell(item, key) && (visibleRef.current(item) || item.id === id));
    const before = peers[index];
    const at = before ? rest.indexOf(before) : peers.length ? rest.indexOf(peers[peers.length - 1]) + 1 : rest.length;
    return [...rest.slice(0, at), moved, ...rest.slice(at)];
  }, []);

  const cellOf = useCallback((id: string, list = cardsRef.current) => {
    const card = list.find(item => item.id === id);
    if (!card) return null;
    const key = cellKey(card.column, groupBy === "assignee" ? card.assignee : undefined);
    return { key, index: list.filter(item => inCell(item, key) && visibleRef.current(item)).findIndex(item => item.id === id) };
  }, [groupBy]);

  /* ----------------------------------------------------------------------------------------------------------------
   * Pointer drag
   * -------------------------------------------------------------------------------------------------------------- */

  const locate = useCallback((x: number, y: number) => {
    const region = regionRef.current;
    if (!region) return null;
    const cells = Array.from(region.querySelectorAll<HTMLElement>("[data-cell]"));
    let target: HTMLElement | undefined;
    let best = Infinity;
    for (const element of cells) {
      const rect = element.getBoundingClientRect();
      if (y < rect.top - 12 || y > rect.bottom + 12) continue;
      const distance = x < rect.left ? rect.left - x : x > rect.right ? x - rect.right : 0;
      if (distance < best) { best = distance; target = element; }
    }
    if (!target || best > 40) return null;
    const items = Array.from(target.querySelectorAll<HTMLElement>("[data-card-id]"));
    let index = items.length;
    for (let i = 0; i < items.length; i++) {
      const rect = items[i].getBoundingClientRect();
      if (y < rect.top + rect.height / 2) { index = i; break; }
    }
    return { cell: target.dataset.cell!, index };
  }, []);

  const relocate = useCallback(() => {
    const current = dragRef.current;
    if (!current || current.dropping) return;
    const spot = locate(pointer.current.x, pointer.current.y);
    if (spot && (spot.cell !== current.cell || spot.index !== current.index)) setDrag({ ...current, ...spot });
  }, [locate]);

  const placeOverlay = useCallback(() => {
    const region = regionRef.current;
    if (!region) return;
    const rect = region.getBoundingClientRect();
    ox.set(pointer.current.x - rect.left - grab.current.x);
    oy.set(pointer.current.y - rect.top - grab.current.y);
  }, [ox, oy]);

  const begin = useCallback((info: Pending) => {
    const region = regionRef.current;
    const spot = cellOf(info.id);
    if (!region || !spot) return;
    const rect = info.element.getBoundingClientRect();
    const regionRect = region.getBoundingClientRect();
    grab.current = { x: info.x - rect.left, y: info.y - rect.top };
    ox.set(rect.left - regionRect.left);
    oy.set(rect.top - regionRect.top);
    velocity.current = { x: 0, y: 0, t: performance.now(), px: info.x, py: info.y };
    setDrag({ id: info.id, cell: spot.key, index: spot.index, width: rect.width, height: rect.height, origin: { cell: spot.key, index: spot.index }, dropping: false });
    suppressClick.current = true;
    const card = cardsRef.current.find(item => item.id === info.id);
    setAnnouncement(`Picked up ${card?.title}.`);
  }, [cellOf, ox, oy]);

  // Auto scroll: the closer the pointer is to an edge, the faster the board (sideways) or the column under it (up and down) scrolls.
  useEffect(() => {
    if (!drag || drag.dropping) return;
    let frame = 0, last = 0;
    const tick = (now: number) => {
      // Speeds are px per 60Hz frame, scaled by the real frame length so a 120Hz screen scrolls at the same pace.
      const rate = last ? Math.min(64, now - last) * 60 / 1000 : 1;
      last = now;
      const { x, y } = pointer.current;
      const speed = (distance: number, edge: number) => distance <= 0 ? 0 : Math.ceil(18 * Math.min(1, distance / edge) ** 2 * rate);
      const scroller = scrollerRef.current;
      let moved = false;
      if (scroller) {
        const rect = scroller.getBoundingClientRect();
        const edge = Math.min(72, rect.width / 5);
        const dx = -speed(rect.left + edge - x, edge) + speed(x - (rect.right - edge), edge);
        const dy = groupBy === "assignee" ? -speed(rect.top + edge - y, edge) + speed(y - (rect.bottom - edge), edge) : 0;
        if (dx || dy) {
          const left = scroller.scrollLeft, top = scroller.scrollTop;
          scroller.scrollLeft += dx;
          scroller.scrollTop += dy;
          moved ||= scroller.scrollLeft !== left || scroller.scrollTop !== top;
        }
        if (groupBy === "status") {
          const cell = Array.from(scroller.querySelectorAll<HTMLElement>("[data-cell]")).find(element => { const r = element.getBoundingClientRect(); return x >= r.left && x <= r.right; });
          if (cell) {
            const r = cell.getBoundingClientRect();
            const edgeY = Math.min(64, r.height / 4);
            const dyCell = -speed(r.top + edgeY - y, edgeY) + speed(y - (r.bottom - edgeY), edgeY);
            if (dyCell) { const top = cell.scrollTop; cell.scrollTop += dyCell; moved ||= cell.scrollTop !== top; }
          }
        }
      }
      if (moved) relocate();
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [drag, relocate, groupBy]);

  const drop = useCallback((cancel = false) => {
    const current = dragRef.current;
    if (!current || current.dropping) return;
    const next = cancel ? { ...current, ...current.origin, dropping: true } : { ...current, dropping: true };
    setDrag(next);
    tilt.set(0);
    const { column: target, lane } = parseCell(next.cell);
    const card = cardsRef.current.find(item => item.id === next.id);
    setAnnouncement(cancel ? `${card?.title} returned.` : `Dropped ${card?.title} in ${columnName(target)}.`);
    const finish = () => {
      if (!cancel && card) {
        commit(move(cardsRef.current, next.id, next.cell, next.index));
        if (card.column !== target) log(card.id, `moved it from ${columnName(card.column)} to ${columnName(target)}`);
        if (lane && card.assignee !== lane) log(card.id, `assigned it to ${personById.get(lane)?.name ?? lane}`);
        keep(card.id);
      }
      setGeneration(map => ({ ...map, [next.id]: (map[next.id] ?? 0) + 1 }));
      setDrag(null);
    };
    if (reduced) { requestAnimationFrame(finish); return; }
    // The card settles into the slot with a small critically damped spring that chases the slot's live position, so it
    // lands correctly even while neighbours are still gliding. It needs live targets, which a preset transition cannot follow.
    let vx = velocity.current.x * .4, vy = velocity.current.y * .4, last = performance.now();
    const k = 520, c = 2 * Math.sqrt(k);
    const step = (now: number) => {
      const region = regionRef.current;
      const slot = region?.querySelector<HTMLElement>("[data-placeholder]");
      if (!region || !slot) { finish(); return; }
      const dt = Math.min(.032, (now - last) / 1000);
      last = now;
      const regionRect = region.getBoundingClientRect();
      const slotRect = slot.getBoundingClientRect();
      const tx = slotRect.left - regionRect.left, ty = slotRect.top - regionRect.top;
      const x = ox.get(), y = oy.get();
      vx += (k * (tx - x) - c * vx) * dt;
      vy += (k * (ty - y) - c * vy) * dt;
      ox.set(x + vx * dt);
      oy.set(y + vy * dt);
      if (Math.abs(tx - x) < .5 && Math.abs(ty - y) < .5 && Math.abs(vx) < 20 && Math.abs(vy) < 20) { ox.set(tx); oy.set(ty); finish(); return; }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [commit, move, reduced, ox, oy, tilt, columnName, log, personById]);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const info = pending.current;
      pointer.current = { x: event.clientX, y: event.clientY };
      if (info && event.pointerId === info.pointerId && !dragRef.current) {
        const distance = Math.hypot(event.clientX - info.x, event.clientY - info.y);
        if (info.touch && !info.armed) { if (distance > 8) { window.clearTimeout(info.timer); pending.current = null; } return; }
        if (distance > 5) begin(info);
        else return;
      }
      const current = dragRef.current;
      if (!current || current.dropping || (info && event.pointerId !== info.pointerId)) return;
      const now = performance.now();
      const v = velocity.current;
      const dt = Math.max(1, now - v.t);
      v.x = v.x * .6 + ((event.clientX - v.px) / dt * 1000) * .4;
      v.y = v.y * .6 + ((event.clientY - v.py) / dt * 1000) * .4;
      v.t = now; v.px = event.clientX; v.py = event.clientY;
      if (!reduced) tilt.set(Math.max(-5, Math.min(5, v.x / 200)));
      placeOverlay();
      relocate();
    };
    const onUp = (event: PointerEvent) => {
      const info = pending.current;
      if (info && event.pointerId !== info.pointerId) return;
      if (info) window.clearTimeout(info.timer);
      pending.current = null;
      if (dragRef.current) drop(event.type === "pointercancel");
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && dragRef.current) { event.preventDefault(); drop(true); } };
    const onTouchMove = (event: TouchEvent) => { if (dragRef.current || pending.current?.armed) event.preventDefault(); };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("keydown", onKey);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("touchmove", onTouchMove);
    };
  }, [begin, drop, placeOverlay, reduced, relocate, tilt]);

  const onCardPointerDown = (event: ReactPointerEvent<HTMLElement>, id: string) => {
    if (event.button !== 0 || dragRef.current || lifted) return;
    suppressClick.current = false;
    const touch = event.pointerType !== "mouse";
    const info: Pending = { id, x: event.clientX, y: event.clientY, pointerId: event.pointerId, touch, element: event.currentTarget, armed: !touch };
    pointer.current = { x: event.clientX, y: event.clientY };
    // Touch waits for a short press, so a swipe still scrolls the board.
    if (touch) info.timer = window.setTimeout(() => { if (pending.current === info) { info.armed = true; begin(info); } }, 240);
    pending.current = info;
  };

  /* ----------------------------------------------------------------------------------------------------------------
   * Keyboard: roving focus between cards, Space lifts, Enter opens
   * -------------------------------------------------------------------------------------------------------------- */

  const focusCard = useCallback((id: string) => {
    setFocusId(id);
    requestAnimationFrame(() => {
      const element = regionRef.current?.querySelector<HTMLElement>(`[data-card-id="${CSS.escape(id)}"]`);
      if (!element) return;
      element.focus({ preventScroll: true });
      element.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
  }, []);

  const visibleCards = cards.filter(isVisible);
  const peopleWithCards = new Set(visibleCards.map(card => card.assignee));
  const lanes: (string | undefined)[] = groupBy === "assignee" ? people.filter(person => person.id === me || peopleWithCards.has(person.id) || (drag && parseCell(drag.cell).lane === person.id)).map(person => person.id) : [undefined];
  const cellCards = (key: string) => visibleCards.filter(card => inCell(card, key));

  const stepFocus = (card: KanbanCard, key: string) => {
    const spot = cellOf(card.id);
    if (!spot) return;
    const { column, lane } = parseCell(spot.key);
    const columnIndex = columns.findIndex(item => item.id === column);
    const laneIndex = lanes.indexOf(lane);
    const list = cellCards(spot.key);
    let target: KanbanCard | undefined;
    if (key === "ArrowUp") target = list[spot.index - 1] ?? (laneIndex > 0 ? cellCards(cellKey(column, lanes[laneIndex - 1])).at(-1) : undefined);
    else if (key === "ArrowDown") target = list[spot.index + 1] ?? (laneIndex >= 0 && laneIndex < lanes.length - 1 ? cellCards(cellKey(column, lanes[laneIndex + 1]))[0] : undefined);
    else {
      const direction = key === "ArrowLeft" ? -1 : 1;
      for (let index = columnIndex + direction; index >= 0 && index < columns.length; index += direction) {
        const next = cellCards(cellKey(columns[index].id, lane));
        if (next.length) { target = next[Math.min(spot.index, next.length - 1)]; break; }
      }
    }
    if (target) focusCard(target.id);
  };

  const onCardKeyDown = (event: ReactKeyboardEvent<HTMLElement>, card: KanbanCard) => {
    if (!lifted) {
      if (event.key === "Enter") { event.preventDefault(); openCard(card.id); return; }
      if (event.key === " ") {
        event.preventDefault();
        setLifted({ id: card.id, snapshot: cardsRef.current });
        setInstant(true);
        const spot = cellOf(card.id);
        setAnnouncement(`Lifted ${card.title}. ${columnName(card.column)}, position ${(spot?.index ?? 0) + 1}. Use arrow keys to move, space to drop, escape to cancel.`);
        return;
      }
      if (event.key.startsWith("Arrow")) { event.preventDefault(); stepFocus(card, event.key); }
      return;
    }
    if (lifted.id !== card.id) return;
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      const original = lifted.snapshot.find(item => item.id === card.id);
      if (original && original.column !== card.column) log(card.id, `moved it from ${columnName(original.column)} to ${columnName(card.column)}`);
      if (original && original.assignee !== card.assignee) log(card.id, `assigned it to ${personById.get(card.assignee)?.name ?? card.assignee}`);
      setLifted(null);
      setAnnouncement(`Dropped ${card.title} in ${columnName(card.column)}.`);
      return;
    }
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); commit(lifted.snapshot); setLifted(null); setAnnouncement(`${card.title} returned.`); focusCard(card.id); return; }
    const spot = cellOf(card.id);
    if (!spot) return;
    const { column, lane } = parseCell(spot.key);
    const columnIndex = columns.findIndex(item => item.id === column);
    let key = spot.key, index = spot.index;
    const laneIndex = lanes.indexOf(lane);
    if (event.key === "ArrowUp" && event.shiftKey && lane) { if (laneIndex > 0) key = cellKey(column, lanes[laneIndex - 1]); }
    else if (event.key === "ArrowDown" && event.shiftKey && lane) { if (laneIndex < lanes.length - 1) key = cellKey(column, lanes[laneIndex + 1]); }
    else if (event.key === "ArrowUp") index = Math.max(0, index - 1);
    else if (event.key === "ArrowDown") index = index + 1;
    else if (event.key === "ArrowLeft" && columnIndex > 0) key = cellKey(columns[columnIndex - 1].id, lane);
    else if (event.key === "ArrowRight" && columnIndex < columns.length - 1) key = cellKey(columns[columnIndex + 1].id, lane);
    else return;
    event.preventDefault();
    if (key !== spot.key) index = Math.min(index, cardsRef.current.filter(item => item.id !== card.id && inCell(item, key) && visibleRef.current(item)).length);
    const next = move(cardsRef.current, card.id, key, index);
    keep(card.id);
    commit(next);
    const target = parseCell(key);
    const position = next.filter(item => inCell(item, key) && (visibleRef.current(item) || item.id === card.id)).findIndex(item => item.id === card.id) + 1;
    setAnnouncement(`${columnName(target.column)}${target.lane ? `, ${personById.get(target.lane)?.name}` : ""}, position ${position}.`);
    focusCard(card.id);
  };

  /* ----------------------------------------------------------------------------------------------------------------
   * Quick add, details and edits
   * -------------------------------------------------------------------------------------------------------------- */

  const targetProject = view.startsWith("p-") ? projectById.get(view.slice(2)) ?? projects[0] : projects[0];
  const firstOpenColumn = columns.find((column, index) => kindOf(column, index, columns.length) === "unstarted")?.id ?? columns[0]?.id;

  const addCard = (key: string) => {
    const text = draft.trim();
    if (!text) { setComposer(null); return; }
    const { column, lane } = parseCell(key);
    const prefix = targetProject?.key ?? "NEW";
    const highest = cardsRef.current.filter(card => card.id.startsWith(`${prefix}-`)).reduce((max, card) => Math.max(max, Number(card.id.replace(/\D/g, "")) || 0), 0);
    const card: KanbanCard = { id: `${prefix}-${highest + 1}`, title: text, column, assignee: lane ?? me, project: targetProject?.id, priority: "none", labels: [] };
    keep(card.id);
    commit(move([...cardsRef.current, card], card.id, key, Number.MAX_SAFE_INTEGER));
    log(card.id, "created the issue");
    setDraft("");
    setAnnouncement(`Added ${text} to ${columnName(column)}.`);
  };

  const startComposer = (key: string) => { setDraft(""); setComposer(key); };
  const newIssue = () => { if (!firstOpenColumn) return; startComposer(cellKey(firstOpenColumn, groupBy === "assignee" ? me : undefined)); };

  const openCard = (id: string) => { returnFocus.current = id; setFocusId(id); setOpenId(id); };
  const closeCard = useCallback(() => { setOpenId(null); if (returnFocus.current) focusCard(returnFocus.current); }, [focusCard]);

  const updateCard = (id: string, patch: Partial<KanbanCard>) => {
    const before = cardsRef.current.find(card => card.id === id);
    if (!before) return;
    commit(cardsRef.current.map(card => card.id === id ? { ...card, ...patch } : card));
    keep(id);
    if (patch.column && patch.column !== before.column) log(id, `moved it from ${columnName(before.column)} to ${columnName(patch.column)}`);
    if (patch.priority && patch.priority !== before.priority) log(id, `set priority to ${PRIORITIES.find(item => item.id === patch.priority)?.label}`);
    if (patch.assignee && patch.assignee !== before.assignee) log(id, `assigned it to ${personById.get(patch.assignee)?.name ?? patch.assignee}`);
    if (patch.points && patch.points !== before.points) log(id, `set the estimate to ${patch.points} points`);
    if (patch.due !== undefined && patch.due !== before.due) log(id, patch.due ? `set the due date to ${patch.due}` : "removed the due date");
    if (patch.labels) log(id, patch.labels.length ? `set labels to ${patch.labels.map(key => labelByKey.get(key)?.name ?? key).join(", ")}` : "removed all labels");
    if (patch.checklist && before.checklist) {
      const finished = patch.checklist.find(item => item.done && !before.checklist?.find(entry => entry.id === item.id)?.done);
      if (finished) log(id, `completed ${finished.text}`);
    }
  };

  const copyLink = (id?: string) => {
    const url = `https://track.larkspur.shop/${id ? `issue/${id}` : `board/${view}`}`;
    window.clearTimeout(copyTimer.current);
    const done = (state: "ok" | "error") => { setCopied(state); setAnnouncement(state === "ok" ? "Link copied" : "Could not copy the link"); copyTimer.current = window.setTimeout(() => setCopied(null), 1600); };
    if (!navigator.clipboard) { done("error"); return; }
    navigator.clipboard.writeText(url).then(() => done("ok"), () => done("error"));
  };
  useEffect(() => () => window.clearTimeout(copyTimer.current), []);

  // Shortcuts: / filters, c creates, ? lists shortcuts, Escape closes the details panel.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const root = rootRef.current;
      if (!root || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (!(root.contains(event.target as Node) || event.target === document.body)) return;
      if (event.key === "Escape" && openId && !dragRef.current && !lifted) { closeCard(); return; }
      if (typing(event.target) || signedOut) return;
      if (event.key === "/") { event.preventDefault(); searchRef.current?.focus(); }
      else if (event.key === "c") { event.preventDefault(); newIssue(); }
      else if (event.key === "?") { event.preventDefault(); setShortcuts(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Edge fades for the board, the columns, the filter row and the details panel.
  useLayoutEffect(() => { rootRef.current?.querySelectorAll<HTMLElement>("[data-fade]").forEach(updateFade); });
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onScroll = (event: Event) => { const target = event.target as HTMLElement; if (target?.dataset?.fade) updateFade(target); };
    const observer = new ResizeObserver(() => root.querySelectorAll<HTMLElement>("[data-fade]").forEach(updateFade));
    observer.observe(root);
    root.addEventListener("scroll", onScroll, true);
    return () => { observer.disconnect(); root.removeEventListener("scroll", onScroll, true); };
  }, []);

  /* ----------------------------------------------------------------------------------------------------------------
   * Render
   * -------------------------------------------------------------------------------------------------------------- */

  const dragCard = drag ? cards.find(card => card.id === drag.id) : undefined;
  const counts = new Map(columns.map(column => [column.id, visibleCards.filter(card => card.column === column.id).length]));
  if (drag && dragCard) {
    const target = parseCell(drag.cell).column;
    counts.set(dragCard.column, (counts.get(dragCard.column) ?? 1) - 1);
    counts.set(target, (counts.get(target) ?? 0) + 1);
  }
  const over = (column: KanbanColumn) => column.limit !== undefined && (counts.get(column.id) ?? 0) > column.limit;
  const layoutTransition: Transition = reduced || instant ? { duration: 0 } : motionTokens.spring.smooth;
  const openCardData = openId ? cards.find(card => card.id === openId) : undefined;
  const crossProject = !view.startsWith("p-");
  const rovingId = focusId && visibleCards.some(card => card.id === focusId) ? focusId : visibleCards[0]?.id;

  const openCount = (predicate: (card: KanbanCard) => boolean) => cards.filter(card => predicate(card) && card.column !== doneColumn).length;
  const cycleCards = cards.filter(card => card.column !== backlogColumn);
  const cyclePoints = cycleCards.reduce((sum, card) => sum + (card.points ?? 0), 0);
  const cycleDone = cycleCards.filter(card => card.column === doneColumn).reduce((sum, card) => sum + (card.points ?? 0), 0);
  const visiblePoints = visibleCards.reduce((sum, card) => sum + (card.points ?? 0), 0);

  const cycleStart = dayOf(cycle.start), cycleEnd = dayOf(cycle.end);
  const cycleLength = cycleStart !== null && cycleEnd !== null ? cycleEnd - cycleStart + 1 : 0;
  const cycleDay = cycleStart !== null && todayDay !== null ? Math.min(cycleLength, Math.max(1, todayDay - cycleStart + 1)) : 0;
  const daysLeft = cycleEnd !== null && todayDay !== null ? Math.max(0, cycleEnd - todayDay) : 0;

  const viewTitle = view.startsWith("p-") ? projectById.get(view.slice(2))?.name ?? "Project"
    : ({ my: "My issues", cycle: cycle.name, all: "All issues" } as Record<string, string>)[view] ?? "Issues";
  const trail = view.startsWith("p-") ? "Projects" : null;

  const sections: ScreenShellSection[] = [
    {
      id: "projects", label: "Projects",
      action: { label: "New project", onSelect: () => {
        const n = extraProjects.length + 1;
        const project: KanbanProject = { id: `new-${n}`, name: `Untitled project ${n}`, key: `NP${n}`, tone: NEW_TONES[(n - 1) % NEW_TONES.length] };
        setExtraProjects(list => [...list, project]);
        setView(`p-${project.id}`);
      } },
      // Each project keeps its own icon in its tone, so the list reads by product instead of by colour alone.
      items: projects.map(project => ({ id: `p-${project.id}`, label: project.name, icon: project.icon ?? FolderKanban, tone: project.tone, count: openCount(card => (card.project ?? firstProject) === project.id) || undefined })),
    },
  ];

  /* The running cycle at the foot of the sidebar: the one number a sprint board is judged by, and the way into the cycle view. */
  const cycleFooter = <button type="button" className={styles.cycle} aria-current={view === "cycle" ? "page" : undefined} onClick={() => setView("cycle")}
    aria-label={`${cycle.name}, ${cycleDone} of ${cyclePoints} points done, ${daysLeft} days left`}>
    <span className={styles.cycleHead}>
      <IterationCcw size={16} strokeWidth={1.75} className={styles.cycleIcon} aria-hidden="true" />
      <span className={styles.cycleName}>{cycle.name}</span>
      <span className={styles.cycleLeft}>{daysLeft === 0 ? "Ends today" : `${daysLeft} ${daysLeft === 1 ? "day" : "days"} left`}</span>
    </span>
    <Progress className={styles.cycleBar} value={cycleDone} max={Math.max(1, cyclePoints)} aria-hidden="true" />
    <span className={styles.cycleMeta}>
      <span>{cycleDone} of {cyclePoints} points</span>
      {cycleLength > 0 && <span>Day {cycleDay} of {cycleLength}</span>}
    </span>
  </button>;

  const renderCell = (column: KanbanColumn, lane?: string) => {
    const key = cellKey(column.id, lane);
    const list = visibleCards.filter(card => inCell(card, key) && card.id !== drag?.id);
    const slot = drag && drag.cell === key ? drag.index : -1;
    const warn = drag && drag.cell === key && over(column);
    const items: ReactNode[] = list.map(card => {
      const isLifted = lifted?.id === card.id;
      const person = personById.get(card.assignee);
      return <motion.div
        key={card.id}
        layoutId={`${uid}-${card.id}-${generation[card.id] ?? 0}`}
        layout="position"
        transition={layoutTransition}
        className={styles.card}
        data-card-id={card.id}
        data-lifted={isLifted || undefined}
        role="button"
        tabIndex={card.id === rovingId ? 0 : -1}
        aria-roledescription="Draggable card"
        aria-label={`${card.id}, ${card.title}, ${person?.name ?? "Unassigned"}, ${PRIORITIES.find(item => item.id === (card.priority ?? "none"))?.label} priority`}
        aria-pressed={isLifted || undefined}
        aria-current={openId === card.id || undefined}
        onFocus={() => { if (focusId !== card.id) setFocusId(card.id); }}
        onPointerDown={event => onCardPointerDown(event, card.id)}
        onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } if (!lifted) openCard(card.id); }}
        onKeyDown={event => onCardKeyDown(event, card)}
      >
        <CardView card={card} person={person} labels={labelsOf(card)} project={projectOf(card)} showProject={crossProject} dueState={dueStateOf(card)} lifted={isLifted} selected={openId === card.id} />
      </motion.div>;
    });
    if (slot >= 0) items.splice(slot, 0, <motion.div key="placeholder" layout="position" transition={layoutTransition} data-placeholder="" className={styles.placeholder} data-warn={warn || undefined} style={{ height: drag!.height }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {warn ? <span className={styles.placeholderNote}><AlertTriangle size={16} strokeWidth={1.75} aria-hidden="true" /> Over the limit of {column.limit}</span> : null}
    </motion.div>);
    const composing = composer === key;
    return <motion.div key={key} layoutScroll={groupBy === "status"} className={styles.cell} data-cell={key} data-fade={groupBy === "status" ? "y" : undefined}
      data-over={over(column) || undefined} data-target={drag && drag.cell === key && !drag.dropping ? "" : undefined}>
      {items}
      <AnimatePresence initial={false}>
        {composing ? <motion.form key="composer" className={styles.composer} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={layoutTransition} onSubmit={event => { event.preventDefault(); addCard(key); }}>
          <textarea autoFocus rows={2} value={draft} placeholder="Issue title" aria-label={`New issue in ${column.name}`} onChange={event => setDraft(event.target.value)} onBlur={() => { if (!draft.trim()) setComposer(null); }}
            onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); addCard(key); } if (event.key === "Escape") { event.preventDefault(); setComposer(null); setDraft(""); } }} />
          <div className={styles.composerActions}>
            <span className={styles.composerHint}>{targetProject?.name}</span>
            <Button type="button" variant="ghost" size="sm" className={styles.smallButton} onMouseDown={event => event.preventDefault()} onClick={() => { setComposer(null); setDraft(""); }}>Cancel</Button>
            <Button type="submit" variant="primary" size="sm" className={styles.smallButton} disabled={!draft.trim()}>Create</Button>
          </div>
        </motion.form> : groupBy === "status" ? <motion.div key="add" layout="position" transition={layoutTransition} className={styles.addSlot}>
          <Button type="button" variant="ghost" size="sm" className={styles.addRow} onClick={() => startComposer(key)}><Plus size={16} strokeWidth={1.75} aria-hidden="true" />New issue</Button>
        </motion.div> : null}
      </AnimatePresence>
    </motion.div>;
  };

  const activityFor = (card: KanbanCard): KanbanActivity[] => {
    const seeded = seededActivity[card.id] ?? [
      { id: "g1", person: people[(card.id.length + card.title.length) % Math.max(1, people.length)]?.id ?? me, kind: "event" as const, text: "created the issue", at: "Nov 4" },
      ...(columnKind(card.column) !== "backlog" && columnKind(card.column) !== "unstarted" ? [{ id: "g2", person: card.assignee, kind: "event" as const, text: `moved it to ${columnName(card.column)}`, at: "Nov 10" }] : []),
    ];
    return [...seeded, ...(events[card.id] ?? [])];
  };

  // On a phone the bar wraps: search and the grouping switch share the first row, the filters scroll in the second.
  const filterBar = <div className={styles.filterBar}>
    <div className={styles.searchWrap} data-filled={filters.query ? "" : undefined}>
      <SearchField ref={searchRef} label="Filter issues by title or id" value={filters.query} placeholder="Filter issues" autoComplete="off" spellCheck={false}
        onValueChange={query => { setInstant(true); setFilters(current => ({ ...current, query })); }}
        onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); if (filters.query) setFilters(current => ({ ...current, query: "" })); else event.currentTarget.blur(); } }} />
      <Kbd size="sm" className={styles.searchKey} aria-hidden="true">/</Kbd>
    </div>
    <div className={styles.filterRow} data-fade="x">
      <Picker label="Priority" multiple className={styles.filterButton} active={filters.priorities.length > 0}
        options={PRIORITIES.map(item => ({ id: item.id, label: item.label, icon: <PriorityIcon value={item.id} />, hint: String(visibleCards.filter(card => (card.priority ?? "none") === item.id).length) }))}
        value={filters.priorities} onChange={priorities => setFilters(current => ({ ...current, priorities }))}>
        <FilterLead icon={<PriorityIcon value="high" />} count={filters.priorities.length} />Priority
      </Picker>
      <Picker label="Labels" multiple className={styles.filterButton} active={filters.labels.length > 0}
        options={labelList.map(label => ({ id: label.id, label: label.name, icon: <LabelIcon label={label} size={16} /> }))}
        value={filters.labels} onChange={labels => setFilters(current => ({ ...current, labels }))}>
        <FilterLead icon={<Tag size={16} strokeWidth={1.75} aria-hidden="true" />} count={filters.labels.length} />Labels
      </Picker>
      <Picker label="Assignee" multiple className={styles.filterButton} active={filters.assignees.length > 0}
        options={people.map(person => ({ id: person.id, label: person.id === me ? `${person.name} (you)` : person.name, icon: <Face person={person} size={20} />, hint: String(visibleCards.filter(card => card.assignee === person.id).length) }))}
        value={filters.assignees} onChange={assignees => setFilters(current => ({ ...current, assignees }))}>
        <FilterLead icon={<CircleUserRound size={16} strokeWidth={1.75} aria-hidden="true" />} count={filters.assignees.length} />Assignee
      </Picker>
      <AnimatePresence initial={false}>
        {filtersActive && <motion.div key="clear" className={styles.clearSlot}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: reduced ? 0 : motionTokens.duration.exit } }} transition={{ duration: reduced ? 0 : motionTokens.duration.fast }}>
          <Button variant="ghost" size="sm" className={styles.smallButton} onClick={() => setFilters(() => EMPTY_FILTERS)}>Clear</Button>
        </motion.div>}
      </AnimatePresence>
    </div>
    <div className={styles.filterEnd}>
      <SegmentedControl className={styles.groupBy} label="Group by" options={GROUPS} value={groupBy} onValueChange={option => { setInstant(false); setGroupBy(option as KanbanGroupBy); setComposer(null); }} />
    </div>
  </div>;

  const harbor = workspaceId !== "main";
  const page = signedOut
    ? <div className={styles.notice}><p className={styles.noticeTitle}>You signed out of {workspace}</p><p className={styles.noticeBody}>This is a local preview, so nothing left this page.</p><ScreenShellButton variant="secondary" onClick={() => setSignedOut(false)}>Sign back in</ScreenShellButton></div>
    : harbor
      ? <div className={styles.notice}><p className={styles.noticeTitle}>Quarry has no projects yet</p><p className={styles.noticeBody}>Projects you create here show up in the sidebar.</p><ScreenShellButton variant="secondary" onClick={() => setWorkspaceId("main")}>Back to {workspace}</ScreenShellButton></div>
      : <div ref={regionRef} className={styles.region} data-dragging={drag ? "" : undefined} data-peek-open={openCardData ? "" : undefined}
        onPointerDownCapture={() => { if (instant) setInstant(false); }}
        onClick={event => { if (openId && !(event.target as HTMLElement).closest("[data-card-id], button, a, input, textarea, form, [data-peek], [data-kb-picker]")) closeCard(); }}>
        <LayoutGroup id={uid}>
          <motion.div ref={scrollerRef} layoutScroll className={styles.scroller} data-fade={groupBy === "assignee" ? "xy" : "x"} data-mode={groupBy}>
            <div className={styles.board} style={{ ["--cols" as string]: columns.length }} data-mode={groupBy}>
              <div className={styles.headRow}>
                {columns.map((column, index) => {
                  const count = counts.get(column.id) ?? 0;
                  const isOver = over(column);
                  const kind = kindOf(column, index, columns.length);
                  return <div key={column.id} className={styles.columnHead} data-over={isOver || undefined}>
                    <StatusIcon kind={kind} />
                    <span className={styles.columnName}>{column.name}</span>
                    <span className={styles.columnCount} aria-label={column.limit ? `${count} of ${column.limit}` : `${count} issues`}><Count value={count} />{column.limit ? <span className={styles.limit}>/{column.limit}</span> : null}</span>
                    <AnimatePresence initial={false}>{isOver ? <motion.span key="over" className={styles.overTag} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : motionTokens.duration.fast }}><Badge size="sm" tone="warning">Over limit</Badge></motion.span> : null}</AnimatePresence>
                    <ScreenShellButton variant="ghost" icon={Plus} iconOnly className={styles.columnAdd} aria-label={`New issue in ${column.name}`} onClick={() => startComposer(cellKey(column.id, groupBy === "assignee" ? me : undefined))} />
                  </div>;
                })}
              </div>
              {lanes.map(lane => {
                const person = lane ? personById.get(lane) : undefined;
                return <section key={lane ?? "all"} className={styles.lane} aria-label={person ? `${person.name}` : undefined}>
                  {person ? <div className={styles.laneHead}><Face person={person} size={20} /><span>{person.name}</span><span className={styles.laneCount}><Count value={visibleCards.filter(card => card.assignee === lane && card.id !== drag?.id).length + (drag && parseCell(drag.cell).lane === lane ? 1 : 0)} /></span></div> : null}
                  <div className={styles.row}>{columns.map(column => renderCell(column, lane))}</div>
                </section>;
              })}
            </div>
          </motion.div>
        </LayoutGroup>

        <AnimatePresence>
          {visibleCards.length === 0 && filtersActive && <motion.div key="empty" className={styles.empty} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : motionTokens.duration.fast }}>
            <p>No issues match these filters</p>
            <ScreenShellButton variant="secondary" onClick={() => setFilters(() => EMPTY_FILTERS)}>Clear filters</ScreenShellButton>
          </motion.div>}
        </AnimatePresence>

        {drag && dragCard ? <motion.div className={styles.overlay} style={{ x: ox, y: oy, rotate: tilt, width: drag.width }} aria-hidden="true">
          <motion.div className={styles.overlayCard} initial={{ scale: 1 }} animate={{ scale: drag.dropping ? 1 : 1.02 }} transition={reduced ? { duration: 0 } : motionTokens.spring.snappy} data-dropping={drag.dropping || undefined}>
            <CardView card={dragCard} person={personById.get(dragCard.assignee)} labels={labelsOf(dragCard)} project={projectOf(dragCard)} showProject={crossProject} dueState={dueStateOf(dragCard)} />
          </motion.div>
        </motion.div> : null}

        <AnimatePresence>
          {openCardData ? <Peek key="peek" uid={uid} card={openCardData} columns={columns} people={people} labels={labelList} project={projectOf(openCardData)} cycle={cycle}
            cardLabels={labelsOf(openCardData)} activity={activityFor(openCardData)} personById={personById} dueState={dueStateOf(openCardData)} copied={copied}
            position={{ index: visibleCards.findIndex(card => card.id === openCardData.id), total: visibleCards.length }}
            onStep={direction => { const index = visibleCards.findIndex(card => card.id === openCardData.id); const next = visibleCards[index + direction]; if (next) { returnFocus.current = next.id; setFocusId(next.id); setOpenId(next.id); } }}
            onClose={closeCard} onCopy={() => copyLink(openCardData.id)} onComment={text => log(openCardData.id, text, "comment")} onChange={patch => updateCard(openCardData.id, patch)} /> : null}
        </AnimatePresence>

        <AnimatePresence>
          {shortcuts && <Shortcuts key="shortcuts" onClose={() => setShortcuts(false)} />}
        </AnimatePresence>
      </div>;

  return <MotionConfig reducedMotion="user">
    <div ref={rootRef} className={cx(styles.root, className)}>
      <ScreenShell
        aria-label={`${workspace} workspace`}
        workspace={{
          name: workspace,
          activeId: workspaceId,
          onSelect: id => { setWorkspaceId(id); setOpenId(null); },
          // Larkspur's mark: three leaning bars, work moving across the board.
          options: [
            { id: "main", name: workspace, detail: `Product team · ${people.length} members`, mark: <ScreenShellMark name={workspace} variant="terrace" tone="sky" />, tone: "sky" },
            { id: "quarry", name: "Quarry", detail: "Side project · 2 members", mark: <ScreenShellMark name="Quarry" variant="cube" tone="amber" />, tone: "amber" },
          ],
        }}
        nav={[
          { id: "my", label: "My issues", icon: CircleUserRound, count: openCount(card => card.assignee === me) || undefined },
          { id: "cycle", label: "Current cycle", icon: IterationCcw, count: openCount(card => card.column !== backlogColumn) || undefined },
          { id: "all", label: "All issues", icon: Layers },
        ]}
        sections={sections}
        activeId={view}
        onNavigate={id => setView(id)}
        sidebarFooter={signedOut || harbor ? undefined : cycleFooter}
        account={{
          name: personById.get(me)?.name ?? "You", detail: `${me}@larkspur.shop`, avatar: personById.get(me)?.avatar,
          menu: [
            { id: "shortcuts", label: "Keyboard shortcuts", icon: Keyboard, shortcut: "?", onSelect: () => setShortcuts(true) },
            { id: "signout", label: "Sign out", icon: LogOut, danger: true, separatorBefore: true, onSelect: () => { setSignedOut(true); setOpenId(null); } },
          ],
        }}
        header={signedOut || harbor ? { title: harbor ? "Quarry" : workspace } : {
          breadcrumbs: [{ id: "workspace", label: workspace, onSelect: () => setView("all") }, ...(trail ? [{ id: "trail", label: trail }] : [])],
          title: viewTitle,
          meta: `${visibleCards.length} issues · ${visiblePoints} points`,
          actions: <HeaderActions copied={copied} onShare={() => copyLink()} onNew={newIssue} />,
          below: filterBar,
        }}
        scroll={false}
        padding="none"
      >
        {page}
      </ScreenShell>
      <p className={styles.srOnly} aria-live="polite">{announcement}</p>
    </div>
  </MotionConfig>;
}

/** The trigger's icon gives way to the number of active choices in the same 18px slot, so the trigger never changes width. */
function FilterLead({ icon, count }: { icon: ReactNode; count: number }) {
  return <span className={styles.lead} data-count={count > 0 || undefined}>
    <span className={styles.leadIcon}>{icon}</span>
    <span className={styles.leadCount} aria-hidden={count === 0 || undefined}>{count > 0 ? <><span className={styles.srOnly}>, </span>{count}<span className={styles.srOnly}> selected</span></> : null}</span>
  </span>;
}

/** The copy button's icon follows the result, so success and failure show in place without changing the button's size. */
function CopyGlyph(copied: "ok" | "error" | null) {
  return copied === "ok" ? Check : copied === "error" ? X : Link2;
}

/** Header actions read the shell's size, so the phone layout keeps only icons. */
function HeaderActions({ copied, onShare, onNew }: { copied: "ok" | "error" | null; onShare: () => void; onNew: () => void }) {
  const { size } = useScreenShell();
  const phone = size === "phone";
  return <>
    <ScreenShellButton variant="secondary" icon={copied === "ok" ? Check : copied === "error" ? X : Link2} iconOnly={phone} aria-label={phone ? "Copy board link" : undefined} onClick={onShare}>
      {phone ? null : "Share"}
    </ScreenShellButton>
    <ScreenShellButton variant="primary" icon={Plus} iconOnly={phone} aria-label={phone ? "New issue" : undefined} aria-keyshortcuts="C" onClick={onNew}>{phone ? null : "New issue"}</ScreenShellButton>
  </>;
}

/* ------------------------------------------------------------------------------------------------------------------
 * Details panel: floats over the right of the board, so opening it never moves the columns.
 * ---------------------------------------------------------------------------------------------------------------- */

interface PeekProps {
  uid: string;
  card: KanbanCard;
  columns: KanbanColumn[];
  people: KanbanPerson[];
  labels: KanbanLabel[];
  cardLabels: KanbanLabel[];
  project?: KanbanProject;
  cycle: { name: string; start: string; end: string };
  activity: KanbanActivity[];
  personById: Map<string, KanbanPerson>;
  dueState?: "soon" | "overdue";
  copied: "ok" | "error" | null;
  position: { index: number; total: number };
  onStep: (direction: 1 | -1) => void;
  onClose: () => void;
  onCopy: () => void;
  onComment: (text: string) => void;
  onChange: (patch: Partial<KanbanCard>) => void;
}

function Peek({ uid, card, columns, people, labels, cardLabels, project, cycle, activity, personById, dueState, copied, position, onStep, onClose, onCopy, onComment, onChange }: PeekProps) {
  const reduced = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const [newItem, setNewItem] = useState("");
  const [comment, setComment] = useState("");
  const done = card.checklist?.filter(item => item.done).length ?? 0;
  const total = card.checklist?.length ?? 0;
  const columnIndex = columns.findIndex(column => column.id === card.column);
  const kind = kindOf(columns[columnIndex], columnIndex, columns.length);
  const assignee = personById.get(card.assignee);
  const priority = PRIORITIES.find(item => item.id === (card.priority ?? "none"));

  useEffect(() => { panelRef.current?.focus({ preventScroll: true }); }, []);
  // Title and description grow with their text instead of scrolling inside a fixed box.
  useLayoutEffect(() => {
    for (const element of [titleRef.current, descriptionRef.current]) { if (!element) continue; element.style.height = "auto"; element.style.height = `${element.scrollHeight}px`; }
  }, [card.title, card.description, card.id]);

  const onKeyDown = (event: ReactKeyboardEvent) => {
    if (typing(event.target)) return;
    if (event.key === "j" || event.key === "ArrowDown" && event.altKey) { event.preventDefault(); onStep(1); }
    else if (event.key === "k" || event.key === "ArrowUp" && event.altKey) { event.preventDefault(); onStep(-1); }
  };

  const enter: Transition = reduced ? { duration: 0 } : motionTokens.spring.smooth;
  const fade: Transition = reduced ? { duration: 0 } : { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] };
  const prLinks = card.links?.filter(link => link.kind === "github") ?? [];
  const otherLinks = card.links?.filter(link => link.kind !== "github") ?? [];

  return <motion.div ref={panelRef} className={styles.peek} data-peek="" role="region" aria-label={`${card.id} details`} tabIndex={-1} onKeyDown={onKeyDown}
    initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0, transition: enter }} exit={{ opacity: 0, x: 16, transition: reduced ? { duration: 0 } : { duration: motionTokens.duration.exit, ease: [...motionTokens.ease.standard] } }}>
    <div className={styles.peekBar}>
      <span className={styles.peekTrail}>
        {project && <><ProjectIcon project={project} size={16} /><span className={styles.peekProject}>{project.name}</span><span className={styles.peekSep} aria-hidden="true">/</span></>}
        <span className={styles.peekId}>{card.id}</span>
      </span>
      {position.index >= 0 && <span className={styles.peekCount}>{position.index + 1} of {position.total}</span>}
      <Tooltip content="Previous issue · K" side="bottom"><ScreenShellButton variant="ghost" icon={ChevronUp} iconOnly aria-label="Previous issue" aria-keyshortcuts="k" disabled={position.index <= 0} onClick={() => onStep(-1)} /></Tooltip>
      <Tooltip content="Next issue · J" side="bottom"><ScreenShellButton variant="ghost" icon={ChevronDown} iconOnly aria-label="Next issue" aria-keyshortcuts="j" disabled={position.index < 0 || position.index >= position.total - 1} onClick={() => onStep(1)} /></Tooltip>
      <Tooltip content={copied === "ok" ? "Link copied" : copied === "error" ? "Could not copy" : "Copy issue link"} side="bottom">
        <ScreenShellButton variant="ghost" iconOnly className={styles.copyButton} data-copied={copied ?? undefined} aria-label={copied === "ok" ? "Link copied" : copied === "error" ? "Could not copy the link" : "Copy issue link"} onClick={onCopy} icon={CopyGlyph(copied)} />
      </Tooltip>
      <Tooltip content="Close · Esc" side="bottom"><ScreenShellButton variant="ghost" icon={X} iconOnly aria-label="Close details" onClick={onClose} /></Tooltip>
    </div>

    <motion.div key={card.id} className={styles.peekScroll} data-fade="y" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: fade }}>
      <textarea ref={titleRef} className={styles.peekTitle} value={card.title} rows={1} aria-label="Title" onChange={event => onChange({ title: event.target.value.replace(/\n/g, " ") })} />
      <textarea ref={descriptionRef} className={styles.peekDescription} value={card.description ?? ""} rows={2} placeholder="Add a description" aria-label="Description" onChange={event => onChange({ description: event.target.value })} />

      <dl className={styles.props}>
        <div>
          <dt>Status</dt>
          <dd><Picker label="Status" className={styles.propButton} value={[card.column]} onChange={([column]) => onChange({ column })}
            options={columns.map((column, index) => ({ id: column.id, label: column.name, icon: <StatusIcon kind={kindOf(column, index, columns.length)} /> }))}>
            <StatusIcon kind={kind} />{columns[columnIndex]?.name}
          </Picker></dd>
        </div>
        <div>
          <dt>Priority</dt>
          <dd><Picker label="Priority" className={styles.propButton} value={[card.priority ?? "none"]} onChange={([value]) => onChange({ priority: value as KanbanPriority })}
            options={PRIORITIES.map(item => ({ id: item.id, label: item.label, icon: <PriorityIcon value={item.id} /> }))}>
            <PriorityIcon value={card.priority} />{priority?.label}
          </Picker></dd>
        </div>
        <div>
          <dt>Assignee</dt>
          <dd><Picker label="Assignee" className={styles.propButton} value={[card.assignee]} onChange={([value]) => onChange({ assignee: value })}
            options={people.map(person => ({ id: person.id, label: person.name, icon: <Face person={person} size={18} /> }))}>
            <Face person={assignee} size={18} />{assignee?.name ?? "Unassigned"}
          </Picker></dd>
        </div>
        <div>
          <dt>Labels</dt>
          <dd><Picker label="Labels" multiple className={styles.propButton} value={cardLabels.map(label => label.id)} onChange={value => onChange({ labels: value, label: undefined })}
            options={labels.map(label => ({ id: label.id, label: label.name, icon: <LabelIcon label={label} size={16} /> }))}>
            {cardLabels.length ? cardLabels.map(label => <LabelBadge key={label.id} label={label} />) : <span className={styles.propEmpty}>Add labels</span>}
          </Picker></dd>
        </div>
        <div>
          <dt>Estimate</dt>
          <dd><Picker label="Estimate" className={styles.propButton} value={card.points ? [String(card.points)] : []} onChange={([value]) => onChange({ points: Number(value) })}
            options={ESTIMATES.map(points => ({ id: String(points), label: `${points} ${points === 1 ? "point" : "points"}` }))}>
            {card.points ? `${card.points} ${card.points === 1 ? "point" : "points"}` : <span className={styles.propEmpty}>No estimate</span>}
          </Picker></dd>
        </div>
        <div>
          <dt>Due date</dt>
          <dd><Picker label="Due date" className={styles.propButton} value={[card.due ?? "none"]} onChange={([value]) => onChange({ due: value === "none" ? "" : value })}
            options={[...DUE_OPTIONS.map(day => ({ id: day, label: day, hint: day === "Nov 12" ? "Today" : day === "Nov 13" ? "Tomorrow" : day === "Nov 22" ? "Cycle ends" : undefined })), { id: "none", label: "No due date" }]}>
            <CalendarDays size={16} strokeWidth={1.75} aria-hidden="true" />
            {card.due ? <span data-due={dueState} className={styles.propDue}>{card.due}{dueState === "overdue" ? " · overdue" : dueState === "soon" ? " · due soon" : ""}</span> : <span className={styles.propEmpty}>No due date</span>}
          </Picker></dd>
        </div>
        <div>
          <dt>Cycle</dt>
          <dd><span className={styles.propStatic}><IterationCcw size={16} strokeWidth={1.75} aria-hidden="true" />{kind === "backlog" ? "Not in a cycle" : `${cycle.name} · ${cycle.start} to ${cycle.end}`}</span></dd>
        </div>
      </dl>

      <section className={styles.peekSection} aria-labelledby={`${uid}-subs`}>
        <div className={styles.sectionHead}>
          <h3 id={`${uid}-subs`}>Sub-issues</h3>
          {total > 0 && <span className={styles.sectionMeta}><Count value={done} />/{total}</span>}
        </div>
        {total > 0 && <Progress className={styles.subProgress} value={done} max={total} aria-hidden="true" />}
        <ul className={styles.checklist}>
          <AnimatePresence initial={false}>
            {card.checklist?.map(item => <motion.li key={item.id} className={styles.checkRow} data-done={item.done || undefined} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={reduced ? { duration: 0 } : motionTokens.spring.smooth}>
              <Checkbox label={item.text} checked={item.done} onCheckedChange={() => onChange({ checklist: card.checklist!.map(entry => entry.id === item.id ? { ...entry, done: !entry.done } : entry) })} />
            </motion.li>)}
          </AnimatePresence>
        </ul>
        <form className={styles.inlineForm} onSubmit={event => { event.preventDefault(); if (!newItem.trim()) return; onChange({ checklist: [...(card.checklist ?? []), { id: `n${Date.now()}`, text: newItem.trim(), done: false }] }); setNewItem(""); }}>
          <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
          <input value={newItem} placeholder="Add a sub-issue" aria-label="New sub-issue" onChange={event => setNewItem(event.target.value)} />
          {/* The slot is reserved, so the field never changes width when the button appears. */}
          <span className={styles.inlineAction}>{newItem.trim() && <Button type="submit" variant="ghost" size="sm" className={styles.smallButton}>Add</Button>}</span>
        </form>
      </section>

      {(prLinks.length > 0 || otherLinks.length > 0) && <section className={styles.peekSection} aria-labelledby={`${uid}-links`}>
        <div className={styles.sectionHead}><h3 id={`${uid}-links`}>Links</h3></div>
        <ul className={styles.links}>
          {[...prLinks, ...otherLinks].map(link => <li key={link.title + (link.detail ?? "")} className={styles.linkRow}>
            <span className={styles.linkMark}>{link.kind === "github" ? <GitHubMark size={15} /> : <FigmaMark size={15} />}</span>
            <span className={styles.linkText}><span className={styles.linkTitle}>{link.title}</span><span className={styles.linkDetail}>{link.kind === "github" ? "larkspur/storefront" : link.detail}</span></span>
            {link.state && <Badge size="sm" tone={link.state === "open" ? "success" : "neutral"} color={link.state === "merged" ? "violet" : undefined}>{link.state === "merged" ? "Merged" : link.state === "draft" ? "Draft" : "Open"}</Badge>}
          </li>)}
        </ul>
      </section>}

      <section className={styles.peekSection} aria-labelledby={`${uid}-activity`}>
        <div className={styles.sectionHead}><h3 id={`${uid}-activity`}>Activity</h3></div>
        <ol className={styles.activity}>
          <AnimatePresence initial={false}>
            {activity.map(entry => {
              const person = personById.get(entry.person);
              return <motion.li key={entry.id} className={styles.activityItem} data-kind={entry.kind} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} transition={reduced ? { duration: 0 } : motionTokens.spring.smooth}>
                <Face person={person} size={entry.kind === "comment" ? 22 : 18} />
                {entry.kind === "comment"
                  ? <div className={styles.comment}><p className={styles.commentHead}><span>{person?.name ?? entry.person}</span><time>{entry.at}</time></p><p className={styles.commentBody}>{entry.text}</p></div>
                  : <p className={styles.eventText}><span>{person?.name ?? entry.person}</span> {entry.text} <time>· {entry.at}</time></p>}
              </motion.li>;
            })}
          </AnimatePresence>
        </ol>
        <form className={styles.commentForm} onSubmit={event => { event.preventDefault(); if (!comment.trim()) return; onComment(comment.trim()); setComment(""); }}>
          <textarea value={comment} rows={2} placeholder="Leave a comment" aria-label="Comment" onChange={event => setComment(event.target.value)}
            onKeyDown={event => { if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} />
          <div className={styles.commentActions}><span className={styles.composerHint}><Kbd size="sm" keys={["meta", "enter"]} /> to send</span><Button type="submit" variant="primary" size="sm" className={styles.smallButton} disabled={!comment.trim()}>Comment</Button></div>
        </form>
      </section>
    </motion.div>
  </motion.div>;
}

/* ------------------------------------------------------------------------------------------------------------------
 * Shortcuts
 * ---------------------------------------------------------------------------------------------------------------- */

const SHORTCUTS: [string[], string][] = [
  [["left", "up", "down", "right"], "Move between cards"], [["enter"], "Open the focused card"], [["space"], "Lift a card, arrows move it, Space drops it"],
  [["shift+up", "shift+down"], "Move a lifted card to the next lane"], [["j", "k"], "Next and previous issue in details"], [["/"], "Filter issues"], [["c"], "New issue"], [["esc"], "Close details or cancel a drag"],
];

function Shortcuts({ onClose }: { onClose: () => void }) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const previous = useRef<HTMLElement | null>(null);
  useEffect(() => {
    previous.current = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
    const back = previous;
    return () => { back.current?.focus?.({ preventScroll: true }); };
  }, []);
  return <>
    <motion.div className={styles.scrim} onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : motionTokens.duration.fast }} />
    <motion.div ref={ref} className={styles.dialog} role="dialog" aria-modal="true" aria-label="Keyboard shortcuts"
      onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); } if (event.key === "Tab") { event.preventDefault(); ref.current?.querySelector<HTMLElement>("button")?.focus(); } }}
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: reduced ? { duration: 0 } : motionTokens.spring.smooth }} exit={{ opacity: 0, transition: { duration: reduced ? 0 : motionTokens.duration.exit } }}>
      <div className={styles.dialogHead}><h3>Keyboard shortcuts</h3><ScreenShellButton variant="ghost" icon={X} iconOnly aria-label="Close shortcuts" onClick={onClose} /></div>
      <dl className={styles.shortcutList}>{SHORTCUTS.map(([keys, text]) => <div key={text}><dt>{text}</dt><dd className={styles.shortcutKeys}>{keys.map(key => <Kbd key={key} size="sm" keys={key} />)}</dd></div>)}</dl>
    </motion.div>
  </>;
}

export default KanbanBoard;
