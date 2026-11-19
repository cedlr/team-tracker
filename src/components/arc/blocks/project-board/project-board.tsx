"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, FolderKanban, FolderPlus, House, Inbox, Keyboard, Link2, ListTodo, LogOut, Plus } from "lucide-react";
import { ScreenShell, ScreenShellButton, ScreenShellMark, useScreenShell, type ScreenShellContextValue, type ScreenShellTone } from "../../screen-shell/screen-shell";
import { Tabs, TabsList, TabsTrigger } from "../../tabs/tabs";
import { avatar } from "../../lib/media";
import { ME, TODAY, addDays, formatDate, seedActivity, seedMilestones, seedProjects, seedTasks, type Activity, type Milestone, type Project, type Stage, type Task } from "./project-board-data";
import { BoardContext, type BoardStore, type Tab, type TaskQuery } from "./project-board-context";
import { ProgressRing, ProjectIcon } from "./project-board-marks";
import { Scroller, cx, onRowKeys, useFade } from "./project-board-parts";
import { ActivityView, HomeView, InboxView, Overview, TasksView, milestoneStats } from "./project-board-views";
import { ProjectSide, ShortcutsSide, TaskDetail, WeekSide } from "./project-board-panel";
import styles from "./project-board.module.css";

export type { Stage } from "./project-board-data";

export interface ProjectBoardProps {
  /** Called after a task changes stage, from the status ring, the status picker or the keyboard. */
  onTaskMove?: (task: { id: string; title: string; stage: Stage }) => void;
  /** The project that opens first: "checkout", "mobile", "api" or "brand". Default "checkout". */
  defaultProject?: string;
  className?: string;
}

const prefixes: Record<string, string> = { checkout: "CHK", mobile: "MOB", api: "API", brand: "BRD" };
const newTones: ScreenShellTone[] = ["green", "orchid", "rose", "sky"];
const pages = ["home", "my-tasks", "inbox"];

/** Hands the shell's controls to the board, so selecting a task can open the panel sheet on narrow frames. */
function ShellBridge({ onShell }: { onShell: (shell: ScreenShellContextValue) => void }) {
  const shell = useScreenShell();
  useEffect(() => { onShell(shell); }, [shell, onShell]);
  return null;
}

function NewTaskButton({ onClick }: { onClick: () => void }) {
  const { size } = useScreenShell();
  return <ScreenShellButton variant="primary" icon={Plus} iconOnly={size === "phone"} aria-label={size === "phone" ? "New task" : undefined} aria-keyshortcuts="C" onClick={onClick}>New task</ScreenShellButton>;
}

/** Copies the project link. Both labels share one grid cell, so the button keeps its width while they crossfade. */
function ShareButton({ slug }: { slug: string }) {
  const { size } = useScreenShell();
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");
  useEffect(() => {
    if (state === "idle") return;
    const timer = window.setTimeout(() => setState("idle"), 1600);
    return () => window.clearTimeout(timer);
  }, [state]);
  const copy = async () => {
    try { await navigator.clipboard.writeText(`https://tidewater.app/projects/${slug}`); setState("done"); } catch { setState("failed"); }
  };
  if (size === "phone") return null;
  return <ScreenShellButton variant="secondary" icon={state === "done" ? Check : Link2} onClick={copy} aria-label={state === "done" ? "Link copied" : state === "failed" ? "Copy failed" : "Copy project link"}>
    <span className={styles.swap} aria-hidden="true">
      <span data-on={state === "idle" ? "" : undefined}>Share</span>
      <span data-on={state === "done" ? "" : undefined}>Copied</span>
      <span data-on={state === "failed" ? "" : undefined}>Failed</span>
    </span>
  </ScreenShellButton>;
}

/** The header's view switch on Arc's Tabs. The page below is the panel, so the triggers only carry the choice. */
function ViewTabs({ tab, onChange, openCount }: { tab: Tab; onChange: (tab: Tab) => void; openCount: number }) {
  return <div className={styles.viewTabs}>
    <Tabs value={tab} onValueChange={value => onChange(value as Tab)}>
      <TabsList aria-label="Project views">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="tasks">Tasks <span className={styles.tabCount}>{openCount}</span></TabsTrigger>
        <TabsTrigger value="activity">Activity</TabsTrigger>
      </TabsList>
    </Tabs>
  </div>;
}

/**
 * The sidebar's portfolio: every project with its tinted icon, the next milestone it is working towards, and a ring that
 * fills with completed work and takes the colour of the project's health. The current project fills in place.
 */
function SidebarProjects({ projects, tasks, milestones, active, onSelect }: { projects: Project[]; tasks: Task[]; milestones: Milestone[]; active: string; onSelect: (id: string) => void }) {
  return <ul className={styles.sideProjects} onKeyDown={onRowKeys}>
    {projects.map(project => {
      const own = tasks.filter(task => task.project === project.id);
      const share = own.length ? own.filter(task => task.stage === "Done").length / own.length : 0;
      const next = milestones.filter(entry => entry.project === project.id).find(entry => !milestoneStats(entry, own).complete);
      return <li key={project.id}>
        <button type="button" data-row="" className={styles.sideProject} aria-current={active === project.id ? "page" : undefined} onClick={() => onSelect(project.id)}>
          <ProjectIcon project={project} />
          <span className={styles.sideProjectText}>
            <span className={styles.sideProjectName}>{project.name}</span>
            <span className={styles.sideProjectNext}>{next ? <><span className={styles.tabular}>{formatDate(next.date)}</span> · {next.name}</> : "No milestone yet"}</span>
          </span>
          <ProgressRing share={share} status={project.status} />
          <span className={styles.srOnly}>, {Math.round(share * 100)}% complete, {project.status.toLowerCase()}</span>
        </button>
      </li>;
    })}
  </ul>;
}

/**
 * A project overview screen in the Arc app shell: a summary with live stats, a milestone track that picks the task list,
 * recent activity, a tasks view with filters and drag to reorder, an activity log, an inbox and a home page. The right
 * panel shows the team and links, or the selected task with its fields, subtasks and comments. Everything stays local.
 */
export function ProjectBoard({ onTaskMove, defaultProject = "checkout", className }: ProjectBoardProps) {
  const uid = useId();
  const fade = useFade();
  const startProject = seedProjects.some(project => project.id === defaultProject) ? defaultProject : "checkout";
  const [projects, setProjects] = useState<Project[]>(seedProjects);
  const [tasks, setTasks] = useState<Task[]>(seedTasks);
  const [activity, setActivity] = useState<Activity[]>(seedActivity);
  const [view, setView] = useState<string>(startProject);
  const [lastProject, setLastProject] = useState(startProject);
  const [tab, setTab] = useState<Tab>("overview");
  const [query, setQueryState] = useState<TaskQuery>({ scope: "all", milestone: "all", person: "all" });
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [shortcuts, setShortcuts] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const counter = useRef(0);
  const previous = useRef(new Map<string, Stage>());
  const shell = useRef<ScreenShellContextValue | null>(null);
  const bindShell = useCallback((value: ScreenShellContextValue) => { shell.current = value; }, []);

  const project = projects.find(entry => entry.id === view);
  const projectId = project?.id ?? null;
  const unread = activity.filter(item => item.forMe && !item.read).length;
  const myOpen = tasks.filter(task => task.assignee === ME && task.stage !== "Done").length;

  const log = (entry: Omit<Activity, "id" | "day" | "at" | "who">) => {
    counter.current += 1;
    const id = `local-${counter.current}`;
    setActivity(list => [{ ...entry, id, who: ME, day: TODAY, at: "Just now" }, ...list]);
  };

  const setStage = (id: string, stage: Stage) => {
    const task = tasks.find(entry => entry.id === id);
    if (!task || task.stage === stage) return;
    previous.current.set(id, task.stage);
    setTasks(list => list.map(entry => entry.id === id ? { ...entry, stage } : entry));
    log(stage === "Done" ? { project: task.project, kind: "status", verb: "completed", task: id } : { project: task.project, kind: "status", verb: "moved", task: id, detail: `to ${stage}` });
    onTaskMove?.({ id, title: task.title, stage });
  };

  const openTask = (id: string) => {
    setSelectedTask(id);
    setShortcuts(false);
    setFresh(null);
    shell.current?.setPanelOpen(true);
  };

  const newTask = (milestone?: string) => {
    const target = projectId ?? lastProject;
    const own = seedMilestones.filter(entry => entry.project === target);
    const ownTasks = tasks.filter(task => task.project === target);
    const chosen = milestone ?? (projectId && query.milestone !== "all" && tab === "tasks" ? query.milestone : undefined) ?? own.find(entry => !milestoneStats(entry, ownTasks).complete)?.id;
    const prefix = prefixes[target] ?? "NEW";
    const highest = Math.max(100, ...tasks.filter(task => task.id.startsWith(prefix)).map(task => Number(task.id.split("-")[1]) || 0));
    const id = `${prefix}-${highest + 1}`;
    const due = own.find(entry => entry.id === chosen)?.date ?? addDays(TODAY, 7);
    setTasks(list => [{ id, project: target, milestone: chosen, title: "Untitled task", stage: "Planned", assignee: ME, due: due < TODAY ? addDays(TODAY, 7) : due, priority: "Medium" }, ...list]);
    log({ project: target, kind: "task", verb: "created", task: id });
    openTask(id);
    setFresh(id);
  };

  const go = (id: string) => {
    setSelectedTask(null);
    setShortcuts(false);
    setView(id);
    if (!pages.includes(id)) { setLastProject(id); setTab("overview"); setQueryState({ scope: "all", milestone: "all", person: "all" }); }
  };

  const addProject = () => {
    const n = projects.length - seedProjects.length + 1;
    const id = `project-${Date.now()}`;
    setProjects(list => [...list, { id, name: `Untitled project ${n}`, tone: newTones[(n - 1) % newTones.length], lead: ME, status: "On track", start: TODAY, end: addDays(TODAY, 45), summary: "Add a few lines about what this project is for, then plan its first milestone.", team: [ME], links: [] }]);
    go(id);
  };

  const store: BoardStore = {
    projects, milestones: seedMilestones, tasks, activity, selectedTask, fresh, tab, query,
    comments: (taskId: string) => activity.filter(item => item.task === taskId && item.kind === "comment"),
    openTask,
    closeTask: () => setSelectedTask(null),
    toggleDone: (id: string) => {
      const task = tasks.find(entry => entry.id === id);
      if (!task) return;
      setStage(id, task.stage === "Done" ? previous.current.get(id) ?? "Planned" : "Done");
    },
    setStage,
    updateTask: (id: string, patch: Partial<Task>) => setTasks(list => list.map(entry => entry.id === id ? { ...entry, ...patch } : entry)),
    reorder: (ids: string[]) => setTasks(list => {
      const slots = ids.map(id => list.findIndex(entry => entry.id === id)).filter(index => index >= 0).sort((a, b) => a - b);
      const next = [...list];
      slots.forEach((slot, index) => { next[slot] = list.find(entry => entry.id === ids[index]) ?? next[slot]; });
      return next;
    }),
    addComment: (taskId: string, body: string) => {
      const task = tasks.find(entry => entry.id === taskId);
      if (task) log({ project: task.project, kind: "comment", verb: "commented on", task: taskId, body });
    },
    newTask,
    setStatus: (id: string, status: Project["status"]) => setProjects(list => list.map(entry => entry.id === id ? { ...entry, status } : entry)),
    go,
    setTab: (next: Tab) => { setTab(next); },
    setQuery: (patch: Partial<TaskQuery>) => setQueryState(current => ({ ...current, ...patch })),
    markRead: (id: string) => setActivity(list => list.map(item => item.id === id ? { ...item, read: true } : item)),
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("input, textarea, [contenteditable=true], [role=listbox], [role=menu]") || event.metaKey || event.ctrlKey || event.altKey || signedOut) return;
    if (event.key.toLowerCase() === "c" && !event.shiftKey) { event.preventDefault(); newTask(); }
    if (event.key === "Escape" && selectedTask) setSelectedTask(null);
  };

  const task = tasks.find(entry => entry.id === selectedTask);
  const panelKey = task ? `task-${task.id}` : shortcuts ? "shortcuts" : project ? `project-${project.id}` : "week";
  const panelLabel = task ? "Task details" : shortcuts ? "Keyboard shortcuts" : project ? "Project details" : "This week";
  const pageKey = signedOut ? "signed-out" : project ? `${project.id}-${tab}` : view;

  const header = project
    ? {
      breadcrumbs: [{ id: "projects", label: "Projects", onSelect: () => go("home") }],
      title: project.name,
      actions: <><ShareButton slug={project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")} /><NewTaskButton onClick={() => newTask()} /></>,
      below: <ViewTabs tab={tab} onChange={next => setTab(next)} openCount={tasks.filter(entry => entry.project === project.id && entry.stage !== "Done").length} />,
    }
    : view === "inbox"
      ? { title: "Inbox", meta: unread ? `${unread} unread` : "All caught up", actions: <ScreenShellButton variant="secondary" icon={Check} disabled={!unread} onClick={() => setActivity(list => list.map(item => item.forMe ? { ...item, read: true } : item))}>Mark all read</ScreenShellButton> }
      : view === "my-tasks"
        ? { title: "My tasks", meta: `${myOpen} open`, actions: <NewTaskButton onClick={() => newTask()} /> }
        : { title: "Home", meta: "Thursday, Nov 12" };

  const content = signedOut
    ? <div className={styles.signedOut}><p>You signed out of Tidewater. This is a local preview.</p><ScreenShellButton variant="secondary" onClick={() => setSignedOut(false)}>Sign back in</ScreenShellButton></div>
    : project
      ? tab === "overview" ? <Overview key={project.id} project={project} /> : tab === "tasks" ? <TasksView projectId={project.id} /> : <ActivityView project={project} />
      : view === "inbox" ? <InboxView /> : view === "my-tasks" ? <TasksView projectId={null} /> : <HomeView />;

  return <BoardContext.Provider value={store}>
    <div className={cx(styles.root, className)} onKeyDown={onKeyDown}>
      <ScreenShell
        aria-label="Tidewater"
        workspace={{
          name: "Tidewater", detail: "Product team", mark: <ScreenShellMark name="Tidewater" variant="drop" tone="amber" />,
          actions: [
            { id: "new-project", label: "New project", icon: FolderPlus, onSelect: addProject },
            { id: "shortcuts", label: "Keyboard shortcuts", icon: Keyboard, onSelect: () => { setSelectedTask(null); setShortcuts(true); shell.current?.setPanelOpen(true); } },
          ],
        }}
        nav={[
          { id: "home", label: "Home", icon: House },
          { id: "my-tasks", label: "My tasks", icon: ListTodo, count: myOpen },
          { id: "inbox", label: "Inbox", icon: Inbox, count: unread || undefined },
        ]}
        sections={[{
          id: "projects", label: "Projects", icon: FolderKanban, action: { label: "New project", onSelect: addProject }, items: [],
          content: <SidebarProjects projects={projects} tasks={tasks} milestones={seedMilestones} active={view}
            onSelect={id => { go(id); if (shell.current?.compact) shell.current.closeSidebar(); }} />,
        }]}
        activeId={view}
        onNavigate={id => go(id)}
        account={{
          name: "Emma Collins", detail: "emma@tidewater.app", avatar: avatar("emma-collins"),
          menu: [
            { id: "mine", label: "My tasks", icon: ListTodo, onSelect: () => go("my-tasks") },
            { id: "keys", label: "Keyboard shortcuts", icon: Keyboard, onSelect: () => { setSelectedTask(null); setShortcuts(true); shell.current?.setPanelOpen(true); } },
            { id: "out", label: "Sign out", icon: LogOut, danger: true, separatorBefore: true, onSelect: () => { setSelectedTask(null); setSignedOut(true); } },
          ],
        }}
        header={header}
        rightPanel={{
          label: panelLabel,
          defaultWidth: 320,
          minWidth: 280,
          content: <AnimatePresence mode="wait" initial={false}>
            <motion.div key={panelKey} className={styles.panelFill} {...fade}>
              {task ? <TaskDetail task={task} /> : shortcuts ? <ShortcutsSide onClose={() => setShortcuts(false)} /> : project ? <ProjectSide project={project} /> : <WeekSide />}
            </motion.div>
          </AnimatePresence>,
        }}
        scroll={false}
        padding="none"
      >
        <ShellBridge onShell={bindShell} />
        {/* popLayout: the leaving page lifts out of flow and fades while the next one is already in place. Arc's SegmentedControl keeps a
            shared highlight that holds a leaving page until its layout settles, which "wait" would turn into a blank pause. */}
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div key={pageKey} id={`${uid}-panel`} role="region" aria-label={project ? `${project.name}, ${tab}` : header.title} className={styles.pageFill} {...fade}>
            <Scroller>{content}</Scroller>
          </motion.div>
        </AnimatePresence>
      </ScreenShell>
    </div>
  </BoardContext.Provider>;
}

export default ProjectBoard;
