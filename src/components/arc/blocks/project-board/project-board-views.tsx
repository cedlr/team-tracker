"use client";

import { useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, ReactNode, RefObject } from "react";
import { AnimatePresence, Reorder, motion, useDragControls, useReducedMotion } from "motion/react";
import { CalendarDays, ChevronRight, GripVertical, Plus, X } from "lucide-react";
import { motionTokens } from "../../lib/motion-tokens";
import { avatar, type PersonId } from "../../lib/media";
import { AnimatedCounter } from "../../animated-counter/animated-counter";
import { AvatarGroup } from "../../avatar-group/avatar-group";
import { Button } from "../../button/button";
import { Progress } from "../../progress/progress";
import SegmentedControl from "../../segmented-control/segmented-control";
import { Tooltip } from "../../tooltip/tooltip";
import { ME, TODAY, daysBetween, dayLabel, firstName, formatDate, groupOrder, isOverdue, isThisWeek, personName, statuses, type Activity, type Milestone, type Project, type Task } from "./project-board-data";
import { useBoard, type Scope } from "./project-board-context";
import { ProjectIcon, StageIcon, statusIcon } from "./project-board-marks";
import { ActivityLine, Avatar, Picker, PickerValue, ProjectTag, StageButton, StatusBadge, TaskRowContent, instant, onRowKeys, useEdgeFade, useFade } from "./project-board-parts";
import styles from "./project-board.module.css";

/* ------------------------------------------------------------------ Shared helpers */

const team = (ids: PersonId[]) => ids.map(id => ({ name: personName(id), src: avatar(id) }));

export function milestoneStats(milestone: Milestone, tasks: Task[]) {
  const own = tasks.filter(task => task.milestone === milestone.id);
  const done = own.filter(task => task.stage === "Done").length;
  return { total: own.length, done, open: own.length - done, share: own.length ? done / own.length : 0, complete: own.length > 0 && done === own.length };
}

function TaskList({ tasks, label, showProject, showMilestone }: { tasks: Task[]; label: string; showProject?: boolean; showMilestone?: boolean }) {
  const s = useBoard();
  const reduce = useReducedMotion();
  const fade = useFade();
  return <ul className={styles.rows} aria-label={label} onKeyDown={onRowKeys}>
    <AnimatePresence initial={false}>
      {tasks.map(task => <motion.li key={task.id} className={styles.row} data-selected={s.selectedTask === task.id ? "" : undefined} data-done={task.stage === "Done" ? "" : undefined}
        layout={reduce ? false : "position"} transition={reduce ? instant : motionTokens.spring.smooth} {...fade}>
        <StageButton task={task} onToggle={() => s.toggleDone(task.id)} />
        <button type="button" data-row="" className={styles.rowMain} aria-current={s.selectedTask === task.id ? "true" : undefined} onClick={() => s.openTask(task.id)}
          onKeyDown={event => { if (event.key.toLowerCase() === "x" && !event.metaKey && !event.ctrlKey) { event.preventDefault(); s.toggleDone(task.id); } }}>
          <TaskRowContent task={task} comments={s.comments(task.id).length} showId={false}
            project={showProject ? s.projects.find(project => project.id === task.project) : undefined}
            milestone={showMilestone ? s.milestones.find(milestone => milestone.id === task.milestone)?.name : undefined} />
        </button>
      </motion.li>)}
    </AnimatePresence>
  </ul>;
}

function SectionHead({ title, meta, action }: { title: string; meta?: string; action?: { label: string; onSelect: () => void } }) {
  return <div className={styles.sectionHead}>
    <h2>{title}</h2>
    {meta && <span className={styles.sectionMeta}>{meta}</span>}
    {action && <Button variant="ghost" size="sm" className={styles.linkButton} onClick={action.onSelect}>{action.label}<ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" /></Button>}
  </div>;
}

function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return <div className={styles.empty}><p>{title}</p>{children}</div>;
}

/* ------------------------------------------------------------------ Overview */

export function Overview({ project }: { project: Project }) {
  const s = useBoard();
  const reduce = useReducedMotion();
  const fade = useFade();
  const milestones = s.milestones.filter(milestone => milestone.project === project.id);
  const tasks = s.tasks.filter(task => task.project === project.id);
  const current = milestones.find(milestone => !milestoneStats(milestone, tasks).complete) ?? milestones.at(-1);
  const [picked, setPicked] = useState<string | undefined>(current?.id);
  const trackRef = useEdgeFade<HTMLDivElement>("x");
  const selected = milestones.find(milestone => milestone.id === picked) ?? current;

  const done = tasks.filter(task => task.stage === "Done").length;
  const open = tasks.length - done;
  const inProgress = tasks.filter(task => task.stage === "In progress" || task.stage === "Review").length;
  const week = tasks.filter(isThisWeek).length;
  const overdue = tasks.filter(isOverdue).length;
  const share = tasks.length ? Math.round(done / tasks.length * 100) : 0;
  const days = Math.max(0, daysBetween(TODAY, project.end));
  const list = selected ? tasks.filter(task => task.milestone === selected.id) : tasks.filter(task => !task.milestone);
  const selectedStats = selected ? milestoneStats(selected, tasks) : null;

  const pick = (id: string) => setPicked(id);
  const onTrackKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const index = milestones.findIndex(milestone => milestone.id === selected?.id);
    const next = event.key === "ArrowRight" ? milestones[index + 1] : event.key === "ArrowLeft" ? milestones[index - 1] : event.key === "Home" ? milestones[0] : event.key === "End" ? milestones.at(-1) : undefined;
    if (!next) return;
    event.preventDefault();
    pick(next.id);
    const button = event.currentTarget.querySelector<HTMLElement>(`[data-milestone="${next.id}"]`);
    button?.focus({ preventScroll: true });
    button?.scrollIntoView({ block: "nearest", inline: "nearest" });
  };

  return <div className={styles.page}>
    <header className={styles.projectHead}>
      <h1 className={styles.pageTitle}><ProjectIcon project={project} size={20} />{project.name}</h1>
      <p className={styles.summary}>{project.summary}</p>
      <div className={styles.props}>
        <Picker label="Project status" value={project.status} onChange={status => s.setStatus(project.id, status)} className={styles.statusPicker}
          options={statuses.map(status => { const Icon = statusIcon[status]; return { value: status, label: status, icon: <Icon size={16} strokeWidth={1.75} className={styles.statusIcon} data-status={status} aria-hidden="true" /> }; })}>
          <PickerValue><StatusBadge status={project.status} /></PickerValue>
        </Picker>
        <span className={styles.prop}><Avatar id={project.lead} size={20} /><span>{personName(project.lead)}</span><span className={styles.propMuted}>lead</span></span>
        <span className={styles.prop}><CalendarDays size={16} strokeWidth={1.75} aria-hidden="true" className={styles.propIcon} /><span className={styles.tabular}>{formatDate(project.start)} to {formatDate(project.end)}</span></span>
        <span className={styles.propTeam}><AvatarGroup members={team(project.team)} max={5} size="sm" label={`Team of ${project.team.length}`} /></span>
      </div>
    </header>

    <dl className={styles.stats}>
      <div className={styles.stat}>
        <dt>Complete</dt>
        <dd><AnimatedCounter value={share} suffix="%" /></dd>
        <Progress value={share} aria-hidden className={styles.statProgress} />
      </div>
      <div className={styles.stat}><dt>Open tasks</dt><dd><AnimatedCounter value={open} /></dd><span className={styles.statNote}><span className={styles.tabular}>{inProgress}</span> in progress or review</span></div>
      <div className={styles.stat}><dt>Due this week</dt><dd><AnimatedCounter value={week} /></dd><span className={styles.statNote} data-tone={overdue ? "danger" : undefined}>{overdue ? <><span className={styles.tabular}>{overdue}</span> overdue</> : "Nothing overdue"}</span></div>
      <div className={styles.stat}><dt>Until launch</dt><dd><AnimatedCounter value={days} /><span className={styles.statUnit}>days</span></dd><span className={styles.statNote}>{weekdayShort(project.end)}, {formatDate(project.end)}</span></div>
    </dl>

    <section className={styles.block} aria-label="Milestones">
      <SectionHead title="Milestones" meta={milestones.length ? `${milestones.filter(milestone => milestoneStats(milestone, tasks).complete).length} of ${milestones.length} done` : undefined} />
      {milestones.length === 0
        ? <Empty title="No milestones yet. Group tasks into milestones to track dates." />
        : <div ref={trackRef} className={styles.track} role="radiogroup" aria-label="Milestones" onKeyDown={onTrackKey} style={{ "--pb-count": milestones.length } as CSSProperties}>
          {milestones.map(milestone => {
            const stats = milestoneStats(milestone, tasks);
            const active = milestone.id === selected?.id;
            const state = stats.complete ? "Done" : stats.done ? `${Math.round(stats.share * 100)}%` : `${stats.total} ${stats.total === 1 ? "task" : "tasks"}`;
            return <button key={milestone.id} type="button" role="radio" aria-checked={active} tabIndex={active ? 0 : -1} data-milestone={milestone.id} className={styles.milestone} data-complete={stats.complete ? "" : undefined}
              onClick={() => pick(milestone.id)}>
              <span className={styles.milestoneBar} aria-hidden="true"><motion.span initial={false} animate={{ scaleX: stats.share }} transition={reduce ? instant : motionTokens.spring.smooth} /></span>
              <span className={styles.milestoneName}>{milestone.name}</span>
              <span className={styles.milestoneMeta}><span className={styles.tabular}>{formatDate(milestone.date)}</span><span aria-hidden="true">·</span><span className={styles.tabular}>{state}</span></span>
            </button>;
          })}
        </div>}
    </section>

    <section className={styles.block} aria-label={selected ? `${selected.name} tasks` : "Tasks"}>
      <SectionHead title={selected?.name ?? "Tasks"} meta={selectedStats ? `${selectedStats.open} open` : `${list.length} tasks`}
        action={{ label: "All tasks", onSelect: () => { s.setQuery({ milestone: selected?.id ?? "all", person: "all", scope: "all" }); s.setTab("tasks"); } }} />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={selected?.id ?? "none"} {...fade}>
          {list.length
            ? <TaskList tasks={list} label={selected ? `${selected.name} tasks` : "Tasks"} />
            : <Empty title="No tasks in this milestone yet"><Button variant="secondary" size="sm" onClick={() => s.newTask(selected?.id)}><Plus size={16} strokeWidth={1.75} aria-hidden="true" />New task</Button></Empty>}
        </motion.div>
      </AnimatePresence>
    </section>
  </div>;
}

const weekdayShort = (iso: string) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(`${iso}T00:00:00Z`).getUTCDay()];

/** Unread items for you say so in words and in the accent colour of their time, not with a dot. */
function ActivityItem({ item, showProject }: { item: Activity; showProject?: boolean }) {
  const s = useBoard();
  const task = item.task ? s.tasks.find(entry => entry.id === item.task) : undefined;
  const project = showProject ? s.projects.find(entry => entry.id === item.project) : undefined;
  const unread = item.forMe && !item.read;
  const body = <>
    <ActivityLine item={item} taskTitle={task?.title} />
    <span className={styles.activitySide}>
      {project && <ProjectTag project={project} />}
      <span className={styles.activityTime}>{unread && <span className={styles.srOnly}>Unread, </span>}{item.at}</span>
    </span>
  </>;
  return <li className={styles.activityRow} data-unread={unread ? "" : undefined}>
    {task
      ? <button type="button" data-row="" className={styles.activityMain} onClick={() => { s.markRead(item.id); s.openTask(task.id); }}>{body}</button>
      : <div className={styles.activityMain} data-static="">{body}</div>}
  </li>;
}

/* ------------------------------------------------------------------ Tasks */

function ReorderRow({ task, onMove, showProject, showMilestone, bounds }: { task: Task; onMove: (direction: -1 | 1) => void; showProject?: boolean; showMilestone?: boolean; bounds: RefObject<HTMLUListElement | null> }) {
  const s = useBoard();
  const reduce = useReducedMotion();
  const controls = useDragControls();
  const [dragging, setDragging] = useState(false);
  return <Reorder.Item value={task.id} dragListener={false} dragControls={controls} dragConstraints={bounds} dragElastic={0.08} className={styles.row} data-dragging={dragging ? "" : undefined}
    data-selected={s.selectedTask === task.id ? "" : undefined} data-done={task.stage === "Done" ? "" : undefined}
    transition={reduce ? instant : motionTokens.spring.smooth} onDragStart={() => setDragging(true)} onDragEnd={() => setDragging(false)}
    initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: reduce ? instant : { duration: motionTokens.duration.exit } }}>
    <span className={styles.grip} aria-hidden="true" onPointerDown={event => { event.preventDefault(); controls.start(event); }}><GripVertical size={14} strokeWidth={1.75} /></span>
    <StageButton task={task} onToggle={() => s.toggleDone(task.id)} />
    <button type="button" data-row="" className={styles.rowMain} aria-current={s.selectedTask === task.id ? "true" : undefined} aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown X"
      onClick={() => s.openTask(task.id)}
      onKeyDown={event => {
        if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) { event.preventDefault(); onMove(event.key === "ArrowUp" ? -1 : 1); return; }
        if (event.key.toLowerCase() === "x" && !event.metaKey && !event.ctrlKey) { event.preventDefault(); s.toggleDone(task.id); }
      }}>
      <TaskRowContent task={task} comments={s.comments(task.id).length}
        project={showProject ? s.projects.find(project => project.id === task.project) : undefined}
        milestone={showMilestone ? s.milestones.find(milestone => milestone.id === task.milestone)?.name : undefined} />
    </button>
  </Reorder.Item>;
}

/** One stage's rows. Drags stay inside the group, since a row changes stage through its status, not by position. */
function TaskGroup({ ids, onReorder, children }: { ids: string[]; onReorder: (ids: string[]) => void; children: (bounds: RefObject<HTMLUListElement | null>) => ReactNode }) {
  const bounds = useRef<HTMLUListElement>(null);
  return <Reorder.Group ref={bounds} as="ul" axis="y" values={ids} onReorder={onReorder} className={styles.rows} onKeyDown={onRowKeys}>
    <AnimatePresence initial={false}>{children(bounds)}</AnimatePresence>
  </Reorder.Group>;
}

export function TasksView({ projectId }: { projectId: string | null }) {
  const s = useBoard();
  const fade = useFade();
  const mine = projectId === null;
  const { scope, milestone, person } = s.query;
  const [showDone, setShowDone] = useState(false);
  const [announce, setAnnounce] = useState("");
  const project = s.projects.find(entry => entry.id === projectId);
  const milestones = s.milestones.filter(entry => entry.project === projectId);
  const base = s.tasks.filter(task => mine ? task.assignee === ME : task.project === projectId);
  const effectiveScope: Scope = mine && scope === "mine" ? "all" : scope;
  const visible = base.filter(task => (effectiveScope !== "mine" || task.assignee === ME) && (effectiveScope !== "week" || isThisWeek(task))
    && (mine || milestone === "all" || task.milestone === milestone) && (mine || person === "all" || task.assignee === person));
  const filtered = !mine && (effectiveScope !== "all" || milestone !== "all" || person !== "all") || mine && effectiveScope !== "all";
  const team: PersonId[] = project?.team ?? [];
  const groups = groupOrder.map(stage => ({ stage, items: visible.filter(task => task.stage === stage) })).filter(group => group.items.length);
  const key = `${projectId}-${effectiveScope}-${milestone}-${person}`;

  const move = (ids: string[], id: string, direction: -1 | 1) => {
    const index = ids.indexOf(id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    const next = [...ids];
    [next[index], next[target]] = [next[target], next[index]];
    s.reorder(next);
    const title = s.tasks.find(task => task.id === id)?.title;
    setAnnounce(`${title} moved to position ${target + 1} of ${ids.length}`);
  };

  return <div className={styles.page}>
    <div className={styles.toolbar}>
      <SegmentedControl label="Show" value={effectiveScope} onValueChange={value => s.setQuery({ scope: value as Scope })}
        options={mine ? [{ value: "all", label: "All" }, { value: "week", label: "This week" }] : [{ value: "all", label: "All" }, { value: "mine", label: "Mine" }, { value: "week", label: "This week" }]} />
      {!mine && milestones.length > 0 && <Picker label="Milestone" variant="field" value={milestone} onChange={value => s.setQuery({ milestone: value })}
        options={[{ value: "all", label: "All milestones" }, ...milestones.map(entry => ({ value: entry.id, label: entry.name, detail: formatDate(entry.date) }))]}>
        <PickerValue>{milestone === "all" ? "All milestones" : milestones.find(entry => entry.id === milestone)?.name}</PickerValue>
      </Picker>}
      {!mine && team.length > 0 && <div className={styles.people} role="group" aria-label="Filter by person">
        {team.map(id => <Tooltip key={id} content={personName(id)} side="bottom">
          <button type="button" className={styles.personToggle} aria-pressed={person === id} data-dim={person !== "all" && person !== id ? "" : undefined}
            aria-label={`Only ${personName(id)}`} onClick={() => s.setQuery({ person: person === id ? "all" : id })}><Avatar id={id} size={24} /></button>
        </Tooltip>)}
      </div>}
      <span className={styles.toolbarEnd}>
        <span className={styles.toolbarCount}><span className={styles.tabular}>{visible.filter(task => task.stage !== "Done").length}</span> open</span>
        {filtered && <Button variant="ghost" size="sm" className={styles.linkButton} onClick={() => s.setQuery({ scope: "all", milestone: "all", person: "all" })}><X size={16} strokeWidth={1.75} aria-hidden="true" />Clear</Button>}
      </span>
    </div>

    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={key} {...fade}>
        {groups.length === 0
          ? <Empty title={base.length ? "No tasks match these filters" : mine ? "Nothing is assigned to you" : "No tasks yet"}>
            {base.length ? <Button variant="secondary" size="sm" onClick={() => s.setQuery({ scope: "all", milestone: "all", person: "all" })}>Clear filters</Button>
              : <Button variant="secondary" size="sm" onClick={() => s.newTask()}><Plus size={16} strokeWidth={1.75} aria-hidden="true" />New task</Button>}
          </Empty>
          : groups.map(group => {
            const collapsed = group.stage === "Done" && !showDone;
            const ids = group.items.map(task => task.id);
            return <section key={group.stage} className={styles.group} aria-label={`${group.stage}, ${group.items.length}`}>
              <h3 className={styles.groupHead}>
                {group.stage === "Done"
                  ? <button type="button" className={styles.groupToggle} aria-expanded={!collapsed} onClick={() => setShowDone(value => !value)}>
                    <StageIcon stage={group.stage} size={15} />{group.stage}<span className={styles.groupCount}>{group.items.length}</span>
                    <ChevronRight size={14} strokeWidth={1.75} className={styles.groupChevron} data-open={collapsed ? undefined : ""} aria-hidden="true" />
                  </button>
                  : <span className={styles.groupLabel}><StageIcon stage={group.stage} size={15} />{group.stage}<span className={styles.groupCount}>{group.items.length}</span></span>}
              </h3>
              {!collapsed && <TaskGroup ids={ids} onReorder={next => s.reorder(next)}>
                {bounds => group.items.map(task => <ReorderRow key={task.id} task={task} bounds={bounds} showProject={mine} showMilestone={!mine && milestone === "all"} onMove={direction => move(ids, task.id, direction)} />)}
              </TaskGroup>}
            </section>;
          })}
      </motion.div>
    </AnimatePresence>
    <p className={styles.hint}>Drag the handle or press Alt and an arrow key to reorder. Press X to complete the focused task.</p>
    <span className={styles.srOnly} role="status">{announce}</span>
  </div>;
}

/* ------------------------------------------------------------------ Activity and inbox */

type ActivityFilter = "all" | "comments" | "updates" | "work";

function DayGroups({ items, showProject }: { items: Activity[]; showProject?: boolean }) {
  const days = [...new Set(items.map(item => item.day))];
  return <>{days.map(day => <section key={day} className={styles.group} aria-label={dayLabel(day)}>
    <h3 className={styles.dayHead}>{dayLabel(day)}</h3>
    <ul className={styles.activityList} onKeyDown={onRowKeys}>{items.filter(item => item.day === day).map(item => <ActivityItem key={item.id} item={item} showProject={showProject} />)}</ul>
  </section>)}</>;
}

export function ActivityView({ project }: { project: Project }) {
  const s = useBoard();
  const fade = useFade();
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const all = s.activity.filter(item => item.project === project.id);
  const match = (item: Activity) => filter === "all" || (filter === "comments" ? item.kind === "comment" : filter === "updates" ? item.kind === "status" || item.kind === "task" : item.kind === "code" || item.kind === "design");
  const items = all.filter(match);
  return <div className={styles.page}>
    <div className={styles.toolbar}>
      <SegmentedControl label="Activity type" value={filter} onValueChange={value => setFilter(value as ActivityFilter)}
        options={[{ value: "all", label: "All" }, { value: "comments", label: "Comments" }, { value: "updates", label: "Updates" }, { value: "work", label: "Code and design" }]} />
      <span className={styles.toolbarEnd}><span className={styles.toolbarCount}><span className={styles.tabular}>{items.length}</span> {items.length === 1 ? "event" : "events"}</span></span>
    </div>
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={filter} {...fade}>
        {items.length ? <DayGroups items={items} /> : <Empty title="No activity of this kind yet" />}
      </motion.div>
    </AnimatePresence>
  </div>;
}

export function InboxView() {
  const s = useBoard();
  const items = s.activity.filter(item => item.forMe);
  return <div className={styles.page}>
    {items.length ? <DayGroups items={items} showProject /> : <Empty title="You're all caught up" />}
  </div>;
}

/* ------------------------------------------------------------------ Home */

export function HomeView() {
  const s = useBoard();
  const due = useMemo(() => s.tasks.filter(task => task.assignee === ME && isThisWeek(task)).sort((a, b) => a.due.localeCompare(b.due)), [s.tasks]);
  return <div className={styles.page}>
    <header className={styles.projectHead}>
      <h1 className={styles.pageTitle}>Good morning, {firstName(ME)}</h1>
      <p className={styles.summary}>{due.length ? `You have ${due.length} ${due.length === 1 ? "task" : "tasks"} due by Sunday${due.some(isOverdue) ? ", and some are overdue" : ""}.` : "Nothing of yours is due this week."}</p>
    </header>
    <section className={styles.block} aria-label="Projects">
      <SectionHead title="Projects" meta={`${s.projects.length} active`} />
      <ul className={styles.projectRows} onKeyDown={onRowKeys}>
        {s.projects.map(project => {
          const tasks = s.tasks.filter(task => task.project === project.id);
          const share = tasks.length ? tasks.filter(task => task.stage === "Done").length / tasks.length : 0;
          const next = s.milestones.filter(milestone => milestone.project === project.id).find(milestone => !milestoneStats(milestone, tasks).complete);
          return <li key={project.id}>
            <button type="button" data-row="" className={styles.projectRow} onClick={() => s.go(project.id)}>
              <span className={styles.projectName}><ProjectIcon project={project} />{project.name}</span>
              <span className={styles.projectLead}><Avatar id={project.lead} size={20} />{personName(project.lead)}</span>
              <span className={styles.projectProgress}>
                <Progress value={Math.round(share * 100)} aria-hidden className={styles.rowProgress} />
                <span className={styles.tabular}>{Math.round(share * 100)}%</span>
              </span>
              <span className={styles.projectStatus}><StatusBadge status={project.status} /></span>
              <span className={styles.projectNext}>{next ? <>{next.name}<span className={styles.tabular}> · {formatDate(next.date)}</span></> : "No upcoming milestone"}</span>
            </button>
          </li>;
        })}
      </ul>
    </section>
    <section className={styles.block} aria-label="Due this week">
      <SectionHead title="Due this week" meta={`${due.length} ${due.length === 1 ? "task" : "tasks"}`} action={{ label: "My tasks", onSelect: () => s.go("my-tasks") }} />
      {due.length ? <TaskList tasks={due} label="Due this week" showProject /> : <Empty title="Nothing due this week" />}
    </section>
  </div>;
}


