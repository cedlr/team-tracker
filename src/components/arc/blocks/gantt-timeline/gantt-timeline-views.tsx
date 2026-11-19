"use client";

import { useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { person } from "../../lib/media";
import type { GanttTeam, GanttUpdate } from "./gantt-timeline-data";
import type { Lane, Plan } from "./gantt-timeline-model";
import { DAY, short } from "./gantt-timeline-model";
import { Face, LinkMark, MilestoneGlyph, StatusBadge, StatusIcon, TeamIcon, toneVar } from "./gantt-timeline-parts";
import styles from "./gantt-timeline.module.css";

type SortKey = "name" | "start" | "due" | "progress";
const COLUMNS: { id: SortKey; label: string; className?: string }[] = [
  { id: "name", label: "Task" },
  { id: "start", label: "Start", className: styles.colStart },
  { id: "due", label: "Due" },
  { id: "progress", label: "Progress", className: styles.colProgress },
];

interface ListProps {
  lanes: Lane[];
  visible: Set<string>;
  teams: GanttTeam[];
  origin: number;
  selectedId: string | null;
  onSelect: (id: string, open: boolean) => void;
  onScroll: (box: HTMLElement) => void;
}

/** The same plan as a table: grouped like the timeline, sortable by any column, one tab stop with arrow keys between rows. */
export function ListView({ lanes, visible, teams, origin, selectedId, onSelect, onScroll }: ListProps) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "start", dir: 1 });
  const [focusId, setFocusId] = useState<string | null>(null);
  const rows = useRef(new Map<string, HTMLButtonElement>());
  const date = (day: number) => short.format(origin + day * DAY);
  const value = (plan: Plan) => sort.key === "name" ? plan.task.name : sort.key === "start" ? plan.start : sort.key === "due" ? plan.start + Math.max(1, plan.len) : plan.task.milestone ? -1 : plan.task.progress ?? 0;
  const sorted = lanes.map(lane => ({
    lane,
    members: lane.members.filter(plan => visible.has(plan.task.id)).sort((a, b) => {
      const va = value(a), vb = value(b);
      return (typeof va === "string" ? va.localeCompare(vb as string) : va - (vb as number)) * sort.dir || a.start - b.start;
    }),
  })).filter(group => group.members.length);
  const order = sorted.flatMap(group => group.members.map(plan => plan.task.id));
  const tabId = focusId && order.includes(focusId) ? focusId : selectedId && order.includes(selectedId) ? selectedId : order[0];

  const onKey = (event: ReactKeyboardEvent, id: string) => {
    const at = order.indexOf(id);
    const next = event.key === "ArrowDown" ? order[at + 1] : event.key === "ArrowUp" ? order[at - 1] : event.key === "Home" ? order[0] : event.key === "End" ? order.at(-1) : undefined;
    if (next) { event.preventDefault(); setFocusId(next); rows.current.get(next)?.focus(); rows.current.get(next)?.scrollIntoView({ block: "nearest" }); }
  };

  return <div className={styles.listScroll} data-fade="y" onScroll={event => onScroll(event.currentTarget)} ref={node => { if (node) onScroll(node); }}>
    {order.length ? <table className={styles.table}>
      <thead>
        <tr>
          {COLUMNS.map(column => <th key={column.id} className={column.className} aria-sort={sort.key === column.id ? (sort.dir === 1 ? "ascending" : "descending") : undefined}>
            <button type="button" className={styles.sortButton} data-on={sort.key === column.id || undefined} onClick={() => setSort(current => ({ key: column.id, dir: current.key === column.id ? (current.dir === 1 ? -1 : 1) : 1 }))}>
              {column.label}
              <span className={styles.sortIcon} aria-hidden="true">{sort.key === column.id ? sort.dir === 1 ? <ArrowUp size={12} strokeWidth={2} /> : <ArrowDown size={12} strokeWidth={2} /> : null}</span>
            </button>
          </th>)}
          <th className={styles.colOwner}>Owner</th>
          <th className={styles.colStatus}>Status</th>
        </tr>
      </thead>
      {sorted.map(({ lane, members }) => <tbody key={lane.id}>
        <tr className={styles.listLane}>
          <th colSpan={6} scope="rowgroup">
            <span className={styles.listLaneInner}>
              {lane.person ? <Face id={lane.person} size={20} /> : lane.team ? <TeamIcon team={lane.team} /> : null}
              {lane.name}<span className={styles.laneCount}>{members.length}</span>
            </span>
          </th>
        </tr>
        {members.map(plan => {
          const pct = Math.round((plan.task.progress ?? 0) * 100);
          const team = teams.find(item => item.id === plan.task.team);
          const link = plan.task.links?.[0];
          return <tr key={plan.task.id} className={styles.listRow} data-selected={selectedId === plan.task.id || undefined} onClick={() => { setFocusId(plan.task.id); onSelect(plan.task.id, true); }}>
            <td>
              <button ref={node => { if (node) rows.current.set(plan.task.id, node); else rows.current.delete(plan.task.id); }} type="button" className={styles.listName}
                tabIndex={tabId === plan.task.id ? 0 : -1} aria-pressed={selectedId === plan.task.id} onKeyDown={event => onKey(event, plan.task.id)}
                onClick={event => { event.stopPropagation(); setFocusId(plan.task.id); onSelect(plan.task.id, true); }}>
                {plan.task.milestone ? <MilestoneGlyph status={plan.status} tone={plan.tone} /> : <TeamIcon team={team} />}
                <span className={styles.taskName}>{plan.task.name}</span>
                {link && <span className={styles.taskMark}><LinkMark kind={link.kind} size={12} /></span>}
              </button>
            </td>
            <td className={`${styles.colStart} ${styles.num}`}>{date(plan.start)}</td>
            <td className={styles.num}>{plan.task.milestone ? <span className={styles.muted}>Milestone</span> : date(plan.start + plan.len - 1)}</td>
            <td className={styles.colProgress}>
              {plan.task.milestone ? null : <span className={styles.listProgress}><span className={styles.listMeter} style={{ "--value": `${pct}%`, ...toneVar(plan.tone) } as CSSProperties} /><span className={styles.num}>{pct}%</span></span>}
            </td>
            <td className={styles.colOwner}>{plan.task.assignee && <span className={styles.listOwner}><Face id={plan.task.assignee} size={20} /><span>{person(plan.task.assignee).name}</span></span>}</td>
            <td className={styles.colStatus}><StatusBadge status={plan.status} label={plan.task.milestone && plan.status === "done" ? "Reached" : undefined} /></td>
          </tr>;
        })}
      </tbody>)}
    </table> : <p className={styles.emptyNote} data-center="">No tasks match these filters</p>}
  </div>;
}

interface UpdatesProps {
  updates: GanttUpdate[];
  unread: number;
  plans: Plan[];
  onOpen: (id: string) => void;
  onScroll: (box: HTMLElement) => void;
}

export function UpdatesView({ updates, unread, plans, onOpen, onScroll }: UpdatesProps) {
  return <div className={styles.listScroll} data-fade="y" onScroll={event => onScroll(event.currentTarget)} ref={node => { if (node) onScroll(node); }}>
    <ol className={styles.feed}>
      {updates.map((update, index) => {
        const plan = update.task ? plans.find(item => item.task.id === update.task) : undefined;
        const who = update.person ? person(update.person).name : "You";
        const body = <>
          <Face id={update.person ?? "emma-collins"} size={28} />
          <span className={styles.feedText}>
            <span><span className={styles.activityWho}>{who}</span> {update.text}</span>
            {plan && <span className={styles.feedTask}><StatusIcon status={plan.status} size={12} />{plan.task.name}</span>}
          </span>
          <span className={styles.feedAt}>{update.at}</span>
          {index < unread && <span className={styles.feedUnread} aria-label="New" />}
        </>;
        return <li key={update.id}>{plan ? <button type="button" className={styles.feedRow} onClick={() => onOpen(plan.task.id)}>{body}</button> : <div className={styles.feedRow}>{body}</div>}</li>;
      })}
    </ol>
  </div>;
}
