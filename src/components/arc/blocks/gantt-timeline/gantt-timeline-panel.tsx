"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Copy, Minus, Plus, Trash2, X } from "lucide-react";
import { AnimatedCounter } from "../../animated-counter/animated-counter";
import { Button } from "../../button/button";
import { Progress } from "../../progress/progress";
import type { GanttGroup, GanttTask, GanttTeam, GanttUpdate } from "./gantt-timeline-data";
import type { Plan } from "./gantt-timeline-model";
import { DAY, clamp, doneShare, short, workdays } from "./gantt-timeline-model";
import { Face, LinkMark, Picker, StatusBadge, StatusIcon, TeamIcon, useGanttWho } from "./gantt-timeline-parts";
import styles from "./gantt-timeline.module.css";

const relative = (days: number) => days === 0 ? "today" : days === 1 ? "tomorrow" : days === -1 ? "yesterday" : days > 0 ? `in ${days} days` : `${-days} days ago`;

interface Shared {
  plans: Plan[];
  origin: number;
  todayDay: number;
  onSelect: (id: string) => void;
}

export interface DetailsProps extends Shared {
  plan: Plan;
  groups: GanttGroup[];
  teams: GanttTeam[];
  people: string[];
  updates: GanttUpdate[];
  days: number;
  copied: { key: string; ok: boolean } | null;
  onCopy: (key: string, text: string) => void;
  onEdit: (patch: Partial<GanttTask>, text: string) => void;
  onDates: (start: number, len: number) => void;
  onDelete: () => void;
  onBack: () => void;
  onStep: (dir: 1 | -1) => void;
  position: { index: number; total: number };
}

export function Details({ plan, plans, groups, teams, people, updates, origin, days, todayDay, copied, onCopy, onEdit, onDates, onDelete, onBack, onSelect, onStep, position }: DetailsProps) {
  const who = useGanttWho();
  const { task } = plan;
  const nameRef = useRef<HTMLInputElement>(null);
  const date = (day: number) => short.format(origin + day * DAY);
  const end = plan.start + Math.max(1, plan.len) - 1;
  const deps = (task.dependsOn ?? []).map(id => plans.find(item => item.task.id === id)).filter((item): item is Plan => !!item);
  const blocks = plans.filter(item => item.task.dependsOn?.includes(task.id));
  const team = teams.find(item => item.id === task.team);
  const group = groups.find(item => item.id === task.group);
  const pct = Math.round((task.progress ?? 0) * 100);
  const gap = (before: Plan) => before.start + before.len - plan.start;

  // A freshly added task arrives with its name selected, ready to type over.
  useEffect(() => {
    if (task.name === "Untitled task") requestAnimationFrame(() => { nameRef.current?.focus({ preventScroll: true }); nameRef.current?.select(); });
  }, [task.id, task.name]);

  return <div className={styles.details}>
    <div className={styles.detailsTop}>
      <Button variant="ghost" size="sm" className={styles.panelButton} onClick={onBack}><ChevronLeft size={16} strokeWidth={1.75} aria-hidden="true" />Overview</Button>
      {/* A task hidden by the filters has no place in the visible order, so the stepper steps aside. */}
      {position.index >= 0 && <span className={styles.detailsStep}>
        <span className={styles.num}>{position.index + 1} of {position.total}</span>
        <Button variant="ghost" size="sm" className={styles.panelIcon} aria-label="Previous task" disabled={position.index <= 0} onClick={() => onStep(-1)}><ChevronLeft size={16} strokeWidth={1.75} aria-hidden="true" /></Button>
        <Button variant="ghost" size="sm" className={styles.panelIcon} aria-label="Next task" disabled={position.index >= position.total - 1} onClick={() => onStep(1)}><ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" /></Button>
      </span>}
    </div>

    <div className={styles.detailsHead}>
      <StatusBadge status={plan.status} label={task.milestone ? (plan.status === "done" ? "Reached" : plan.status === "conflict" ? "Conflict" : "Milestone") : undefined} />
      <input ref={nameRef} key={task.id} className={styles.nameInput} defaultValue={task.name} aria-label="Task name" spellCheck={false}
        onBlur={event => { const value = event.currentTarget.value.trim(); if (value && value !== task.name) onEdit({ name: value }, `renamed ${task.name} to ${value}`); else event.currentTarget.value = task.name; }}
        onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") { event.currentTarget.value = task.name; event.currentTarget.blur(); } }} />
    </div>

    <dl className={styles.fields}>
      <dt>Owner</dt>
      <dd>
        <Picker label="Owner" value={task.assignee ?? ""} className={styles.fieldButton}
          options={people.map(id => ({ id, label: who(id).name, icon: <Face id={id} size={18} />, hint: who(id).role }))}
          onChange={id => { if (id !== task.assignee) onEdit({ assignee: id }, `assigned ${task.name} to ${who(id).name}`); }}>
          {task.assignee ? <><Face id={task.assignee} size={18} /><span className={styles.fieldText}>{who(task.assignee).name}</span></> : <span className={styles.fieldText}>Unassigned</span>}
          <ChevronDown size={13} strokeWidth={1.75} className={styles.fieldChevron} aria-hidden="true" />
        </Picker>
      </dd>
      <dt>Team</dt>
      <dd>
        <Picker label="Team" value={task.team ?? ""} className={styles.fieldButton}
          options={teams.map(item => ({ id: item.id, label: item.name, icon: <TeamIcon team={item} /> }))}
          onChange={id => { if (id !== task.team) onEdit({ team: id }, `moved ${task.name} to the ${teams.find(item => item.id === id)?.name} team`); }}>
          <TeamIcon team={team} /><span className={styles.fieldText}>{team?.name ?? "No team"}</span>
          <ChevronDown size={13} strokeWidth={1.75} className={styles.fieldChevron} aria-hidden="true" />
        </Picker>
      </dd>
      <dt>Phase</dt>
      <dd>
        <Picker label="Phase" value={task.group} className={styles.fieldButton}
          options={groups.map(item => ({ id: item.id, label: item.name }))}
          onChange={id => { if (id !== task.group) onEdit({ group: id }, `moved ${task.name} to ${groups.find(item => item.id === id)?.name}`); }}>
          <span className={styles.fieldText}>{group?.name ?? "None"}</span>
          <ChevronDown size={13} strokeWidth={1.75} className={styles.fieldChevron} aria-hidden="true" />
        </Picker>
      </dd>
      <dt>{task.milestone ? "Date" : "Start"}</dt>
      <dd className={styles.dateField}>
        <span className={styles.num}>{date(plan.start)}</span>
        <span className={styles.stepper}>
          <button type="button" aria-label={`Move ${task.milestone ? "date" : "start"} a day earlier`} disabled={plan.start <= 0}
            onClick={() => task.milestone ? onDates(plan.start - 1, 0) : onDates(plan.start - 1, plan.len + 1)}><Minus size={13} strokeWidth={1.75} aria-hidden="true" /></button>
          <button type="button" aria-label={`Move ${task.milestone ? "date" : "start"} a day later`} disabled={!task.milestone && plan.len <= 1}
            onClick={() => task.milestone ? onDates(plan.start + 1, 0) : onDates(plan.start + 1, plan.len - 1)}><Plus size={13} strokeWidth={1.75} aria-hidden="true" /></button>
        </span>
      </dd>
      {!task.milestone && <>
        <dt>Due</dt>
        <dd className={styles.dateField}>
          <span className={styles.num}>{date(end)}</span>
          <span className={styles.stepper}>
            <button type="button" aria-label="Move the due date a day earlier" disabled={plan.len <= 1} onClick={() => onDates(plan.start, plan.len - 1)}><Minus size={13} strokeWidth={1.75} aria-hidden="true" /></button>
            <button type="button" aria-label="Move the due date a day later" disabled={end >= days - 1} onClick={() => onDates(plan.start, plan.len + 1)}><Plus size={13} strokeWidth={1.75} aria-hidden="true" /></button>
          </span>
        </dd>
        <dt>Length</dt>
        <dd className={styles.fieldPlain}><span className={styles.num}>{plan.len} days</span><span className={styles.muted}>{workdays(origin, plan.start, plan.len)} workdays</span></dd>
        <dt>Progress</dt>
        <dd className={styles.progressField}>
          <input type="range" min={0} max={100} step={5} value={pct} aria-label="Progress" aria-valuetext={`${pct}% done`} className={styles.range} style={{ "--value": `${pct}%` } as CSSProperties}
            onChange={event => onEdit({ progress: Number(event.currentTarget.value) / 100 }, `set ${task.name} to ${event.currentTarget.value}% done`)} />
          <span className={styles.rangeValue}>{pct}%</span>
        </dd>
      </>}
    </dl>

    <Section title="Depends on" count={deps.length}>
      {deps.length ? deps.map(before => <button key={before.task.id} type="button" className={styles.relRow} onClick={() => onSelect(before.task.id)}>
        <StatusIcon status={before.status} size={16} />
        <span className={styles.relName}>{before.task.name}</span>
        <span className={styles.relMeta} data-danger={gap(before) > 0 || undefined}>{gap(before) > 0 ? `${gap(before)} ${gap(before) === 1 ? "day" : "days"} late` : `ends ${date(before.start + Math.max(1, before.len) - 1)}`}</span>
      </button>) : <p className={styles.emptyNote}>Nothing has to finish first</p>}
    </Section>

    <Section title="Blocks" count={blocks.length}>
      {blocks.length ? blocks.map(after => <button key={after.task.id} type="button" className={styles.relRow} onClick={() => onSelect(after.task.id)}>
        <StatusIcon status={after.status} size={16} />
        <span className={styles.relName}>{after.task.name}</span>
        <span className={styles.relMeta} data-danger={after.late || undefined}>{after.task.milestone ? date(after.start) : `starts ${date(after.start)}`}</span>
      </button>) : <p className={styles.emptyNote}>No task waits on this one</p>}
    </Section>

    {!!task.links?.length && <Section title="Links" count={task.links.length}>
      {task.links.map(link => {
        const key = `${task.id}:${link.url}`, done = copied?.key === key;
        return <button key={link.url} type="button" className={styles.linkRow} onClick={() => onCopy(key, link.url)} aria-label={`Copy link to ${link.label}`}>
          <span className={styles.linkMark}><LinkMark kind={link.kind} size={15} /></span>
          <span className={styles.linkText}><span className={styles.relName}>{link.label}</span>{link.detail && <span className={styles.linkDetail}>{link.detail}</span>}</span>
          <span className={styles.linkCopy} data-state={done ? (copied.ok ? "ok" : "error") : undefined}>
            {done ? copied.ok ? <Check size={14} strokeWidth={2} aria-hidden="true" /> : <X size={14} strokeWidth={2} aria-hidden="true" /> : <Copy size={14} strokeWidth={1.75} aria-hidden="true" />}
          </span>
        </button>;
      })}
    </Section>}

    <Section title="Activity" count={updates.length}>
      {updates.length ? <ul className={styles.activity}>
        {updates.slice(0, 5).map(update => <li key={update.id}>
          {update.person ? <Face id={update.person} size={18} /> : <Face id="emma-collins" size={18} />}
          <p><span className={styles.activityWho}>{update.person ? who(update.person).name.split(" ")[0] : "You"}</span> {update.text}<span className={styles.activityAt}>{update.at}</span></p>
        </li>)}
      </ul> : <p className={styles.emptyNote}>No changes yet</p>}
    </Section>

    <div className={styles.detailsFoot}>
      <Button variant="ghost" size="sm" className={styles.dangerGhost} onClick={onDelete}><Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />Delete {task.milestone ? "milestone" : "task"}</Button>
      <span className={styles.muted}>Today is {short.format(origin + todayDay * DAY)}</span>
    </div>
  </div>;
}

function Section({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return <section className={styles.section}>
    <h3 className={styles.sectionTitle}>{title}{count !== undefined && <span className={styles.sectionCount}>{count}</span>}</h3>
    {children}
  </section>;
}

export interface SummaryProps extends Shared {
  title: string;
  teams: GanttTeam[];
  visibleCount: number;
}

export function Summary({ title, plans, teams, origin, todayDay, onSelect }: SummaryProps) {
  const share = Math.round(doneShare(plans) * 100);
  const work = plans.filter(plan => !plan.task.milestone);
  const doneCount = work.filter(plan => plan.status === "done").length;
  const milestones = plans.filter(plan => plan.task.milestone).sort((a, b) => a.start - b.start);
  const launch = milestones.at(-1);
  const attention = plans.filter(plan => plan.status === "conflict" || plan.status === "behind")
    .sort((a, b) => (a.status === "conflict" ? 0 : 1) - (b.status === "conflict" ? 0 : 1) || a.start - b.start);
  const byId = new Map(plans.map(plan => [plan.task.id, plan]));
  const reason = (plan: Plan) => {
    if (plan.status === "conflict") {
      const blocker = (plan.task.dependsOn ?? []).map(id => byId.get(id)).find(before => before && plan.start < before.start + before.len);
      const days = blocker ? blocker.start + blocker.len - plan.start : 0;
      return blocker ? `Starts ${days} ${days === 1 ? "day" : "days"} before ${blocker.task.name}${blocker.task.milestone ? "" : " ends"}` : "Starts too early";
    }
    const expected = clamp((todayDay - plan.start + 1) / Math.max(1, plan.len), 0, 1);
    return `${Math.round((expected - (plan.task.progress ?? 0)) * 100)}% behind plan`;
  };
  const load = teams.map(team => {
    const left = work.filter(plan => plan.task.team === team.id).reduce((sum, plan) => sum + plan.len * (1 - (plan.task.progress ?? 0)), 0);
    return { team, left: Math.round(left) };
  });
  const maxLoad = Math.max(1, ...load.map(item => item.left));

  return <div className={styles.summaryPanel}>
    <div className={styles.summaryHead}>
      <h3 className={styles.summaryTitle}>{title}</h3>
      {launch && <p className={styles.muted}>Public launch {short.format(origin + launch.start * DAY)}, {relative(launch.start - todayDay)}</p>}
    </div>
    <div className={styles.health}>
      <div className={styles.healthTop}><span className={styles.healthValue}><AnimatedCounter value={share} suffix="%" /></span><span className={styles.muted}>done</span></div>
      <Progress value={share} label={`${title} progress`} className={styles.healthBar} />
      <dl className={styles.stats}>
        <div><dt className={styles.statLabel}>Done</dt><dd className={styles.statValue}><AnimatedCounter value={doneCount} /><span className={styles.muted}>/{work.length}</span></dd></div>
        <div><dt className={styles.statLabel}>At risk</dt><dd className={styles.statValue} data-tone={attention.length ? "danger" : undefined}><AnimatedCounter value={attention.length} /></dd></div>
        <div><dt className={styles.statLabel}>Days left</dt><dd className={styles.statValue}><AnimatedCounter value={launch ? Math.max(0, launch.start - todayDay) : 0} /></dd></div>
      </dl>
    </div>

    <Section title="Needs attention" count={attention.length}>
      {attention.length ? attention.map(plan => <button key={plan.task.id} type="button" className={styles.relRow} onClick={() => onSelect(plan.task.id)}>
        <StatusIcon status={plan.status} size={16} />
        <span className={styles.relText}><span className={styles.relName}>{plan.task.name}</span><span className={styles.relSub} data-danger={plan.status === "conflict" || undefined}>{reason(plan)}</span></span>
        {plan.task.assignee && <Face id={plan.task.assignee} size={20} />}
      </button>) : <p className={styles.emptyNote}>Everything is on track</p>}
    </Section>

    <Section title="Work left by team">
      <ul className={styles.load}>
        {load.map(({ team, left }) => <li key={team.id} style={{ "--tone": `var(--tone-${team.tone})` } as CSSProperties}>
          <TeamIcon team={team} />
          <span className={styles.loadName}>{team.name}</span>
          <span className={styles.loadTrack}><span style={{ width: `${(left / maxLoad) * 100}%` }} /></span>
          <span className={styles.loadValue}>{left}d</span>
        </li>)}
      </ul>
    </Section>
  </div>;
}
