"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, Check, Copy, CornerDownLeft } from "lucide-react";
import { motionTokens } from "../../lib/motion-tokens";
import type { PersonId } from "../../lib/media";
import { Button } from "../../button/button";
import { Checkbox } from "../../checkbox/checkbox";
import { Input } from "../../input/input";
import { Kbd } from "../../kbd/kbd";
import { Textarea } from "../../textarea/textarea";
import { ME, TODAY, WEEK, addDays, formatDate, isOverdue, personName, personRole, priorities, stages, weekday, type Project, type ProjectLink, type Task } from "./project-board-data";
import { useBoard } from "./project-board-context";
import { PriorityIcon, ProjectIcon, StageIcon, ToolMark, toolName } from "./project-board-marks";
import { Avatar, Picker, PickerValue, Scroller, StageButton, instant, onRowKeys, useFade } from "./project-board-parts";
import styles from "./project-board.module.css";

/* ------------------------------------------------------------------ Task details */

export function TaskDetail({ task }: { task: Task }) {
  const s = useBoard();
  const reduce = useReducedMotion();
  const project = s.projects.find(entry => entry.id === task.project);
  const milestones = s.milestones.filter(entry => entry.project === task.project);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const [comment, setComment] = useState("");
  const [subtask, setSubtask] = useState("");
  const thread = [...s.comments(task.id)].reverse();
  const subtasks = task.subtasks ?? [];
  const doneSubtasks = subtasks.filter(item => item.done).length;
  const team: PersonId[] = project?.team.includes(task.assignee) ? project.team : [task.assignee, ...(project?.team ?? [])];
  const dueOptions = [...new Set([TODAY, addDays(TODAY, 1), addDays(TODAY, 2), addDays(TODAY, 5), addDays(TODAY, 12), task.due])].sort();

  useEffect(() => {
    if (s.fresh !== task.id) return;
    const frame = requestAnimationFrame(() => { titleRef.current?.focus(); titleRef.current?.select(); });
    return () => cancelAnimationFrame(frame);
  }, [s.fresh, task.id]);

  const post = () => {
    const body = comment.trim();
    if (!body) return;
    s.addComment(task.id, body);
    setComment("");
  };
  const addSubtask = () => {
    const label = subtask.trim();
    if (!label) return;
    s.updateTask(task.id, { subtasks: [...subtasks, { id: `${task.id}-${Date.now()}`, label, done: false }] });
    setSubtask("");
  };

  return <Scroller className={styles.panelScroll}>
    <div className={styles.panelBody}>
      <div className={styles.panelTop}>
        <Button variant="ghost" size="sm" className={styles.backButton} onClick={s.closeTask} aria-label={`Back to ${project?.name ?? "project"} details`}><ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" /></Button>
        {project && <span className={styles.panelCrumb}><ProjectIcon project={project} size={14} />{project.name}</span>}
        <span className={styles.panelId}>{task.id}</span>
      </div>

      <div className={styles.detailTitleRow}>
        <StageButton task={task} onToggle={() => s.toggleDone(task.id)} />
        <textarea ref={titleRef} className={styles.detailTitle} value={task.title} rows={1} aria-label="Task title" placeholder="Task title" spellCheck={false}
          onChange={event => s.updateTask(task.id, { title: event.target.value.replace(/\n/g, "") })}
          onKeyDown={event => { if (event.key === "Enter" || event.key === "Escape") { event.preventDefault(); event.currentTarget.blur(); } }}
          onBlur={() => { if (!task.title.trim()) s.updateTask(task.id, { title: "Untitled task" }); }} />
      </div>

      <dl className={styles.fields}>
        <dt>Status</dt>
        <dd><Picker label="Status" value={task.stage} onChange={stage => s.setStage(task.id, stage)} options={stages.map(stage => ({ value: stage, label: stage, icon: <StageIcon stage={stage} /> }))}>
          <StageIcon stage={task.stage} /><PickerValue>{task.stage}</PickerValue>
        </Picker></dd>
        <dt>Assignee</dt>
        <dd><Picker label="Assignee" value={task.assignee} onChange={id => s.updateTask(task.id, { assignee: id })} options={team.map(id => ({ value: id, label: personName(id), detail: personRole(id), icon: <Avatar id={id} size={20} /> }))}>
          <Avatar id={task.assignee} size={20} /><PickerValue>{personName(task.assignee)}</PickerValue>
        </Picker></dd>
        <dt>Priority</dt>
        <dd><Picker label="Priority" value={task.priority} onChange={priority => s.updateTask(task.id, { priority })} options={priorities.map(priority => ({ value: priority, label: priority, icon: <PriorityIcon priority={priority} /> }))}>
          <PriorityIcon priority={task.priority} /><PickerValue>{task.priority}</PickerValue>
        </Picker></dd>
        <dt>Due</dt>
        <dd><Picker label="Due date" value={task.due} onChange={due => s.updateTask(task.id, { due })} options={dueOptions.map(due => ({ value: due, label: formatDate(due), detail: due === TODAY ? "Today" : due === addDays(TODAY, 1) ? "Tomorrow" : weekday(due) }))}>
          <PickerValue><span className={styles.tabular} data-overdue={isOverdue(task) ? "" : undefined}>{formatDate(task.due)}{isOverdue(task) && " · overdue"}</span></PickerValue>
        </Picker></dd>
        {milestones.length > 0 && <><dt>Milestone</dt>
          <dd><Picker label="Milestone" value={task.milestone ?? ""} onChange={id => s.updateTask(task.id, { milestone: id || undefined })} options={[...milestones.map(entry => ({ value: entry.id, label: entry.name, detail: formatDate(entry.date) })), { value: "", label: "No milestone" }]}>
            <PickerValue>{milestones.find(entry => entry.id === task.milestone)?.name ?? "No milestone"}</PickerValue>
          </Picker></dd></>}
      </dl>

      <textarea className={styles.description} value={task.description ?? ""} placeholder="Add a description" aria-label="Description" rows={3}
        onChange={event => s.updateTask(task.id, { description: event.target.value })} />

      <section className={styles.panelSection} aria-label="Subtasks">
        <div className={styles.panelHead}><h3>Subtasks</h3>{subtasks.length > 0 && <span className={styles.tabular}>{doneSubtasks} of {subtasks.length}</span>}</div>
        <ul className={styles.checklist}>
          <AnimatePresence initial={false}>
            {subtasks.map(item => <motion.li key={item.id} className={styles.check} data-done={item.done ? "" : undefined} initial={reduce ? false : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} transition={reduce ? instant : { height: motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.standard } }}>
              <Checkbox label={item.label} checked={item.done}
                onCheckedChange={() => s.updateTask(task.id, { subtasks: subtasks.map(entry => entry.id === item.id ? { ...entry, done: !entry.done } : entry) })} />
            </motion.li>)}
          </AnimatePresence>
        </ul>
        <div className={styles.inlineAdd}>
          <Input label="Add a subtask" value={subtask} placeholder="Add a subtask" onChange={event => setSubtask(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); addSubtask(); } }} />
        </div>
      </section>

      <section className={styles.panelSection} aria-label="Comments">
        <div className={styles.panelHead}><h3>Comments</h3>{thread.length > 0 && <span className={styles.tabular}>{thread.length}</span>}</div>
        {thread.length > 0 && <ul className={styles.thread}>
          <AnimatePresence initial={false}>
            {thread.map(item => <motion.li key={item.id} className={styles.comment} initial={reduce ? false : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} transition={reduce ? instant : { height: motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.standard } }}>
              <Avatar id={item.who} size={22} />
              <div className={styles.commentBody}>
                <p className={styles.commentHead}><span>{item.who === ME ? "You" : personName(item.who)}</span><span className={styles.tabular}>{item.day === TODAY ? item.at : formatDate(item.day)}</span></p>
                <p className={styles.commentText}>{item.body}</p>
              </div>
            </motion.li>)}
          </AnimatePresence>
        </ul>}
        <div className={styles.composer}>
          <Textarea label="Leave a comment" value={comment} rows={2} placeholder="Leave a comment" onChange={event => setComment(event.target.value)}
            onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); post(); } }} />
          <div className={styles.composerBar}>
            <span className={styles.composerHint}><CornerDownLeft size={14} strokeWidth={1.75} aria-hidden="true" />to send</span>
            <Button variant="primary" size="sm" disabled={!comment.trim()} onClick={post}>Comment</Button>
          </div>
        </div>
      </section>
    </div>
  </Scroller>;
}

/* ------------------------------------------------------------------ Project side: team and links */

function CopyLink({ link }: { link: ProjectLink }) {
  const fade = useFade();
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");
  useEffect(() => {
    if (copied === "idle") return;
    const timer = window.setTimeout(() => setCopied("idle"), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);
  const copy = async () => {
    try { await navigator.clipboard.writeText(link.url); setCopied("done"); } catch { setCopied("failed"); }
  };
  return <li>
    <button type="button" data-row="" className={styles.linkRow} onClick={copy} aria-label={`Copy link to ${link.label} in ${toolName[link.tool]}`}>
      <ToolMark tool={link.tool} size={16} />
      <span className={styles.linkText}><span>{link.label}</span><span className={styles.linkDetail}>{link.detail}</span></span>
      <span className={styles.linkAction} aria-hidden="true">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span key={copied} className={styles.linkActionInner} data-state={copied} {...fade}>
            {copied === "done" ? <><Check size={14} strokeWidth={1.75} />Copied</> : copied === "failed" ? "Copy failed" : <Copy size={14} strokeWidth={1.75} />}
          </motion.span>
        </AnimatePresence>
      </span>
    </button>
    <span className={styles.srOnly} role="status">{copied === "done" ? `Link to ${link.label} copied` : copied === "failed" ? "Copy failed" : ""}</span>
  </li>;
}

export function ProjectSide({ project }: { project: Project }) {
  const s = useBoard();
  const reduce = useReducedMotion();
  const tasks = s.tasks.filter(task => task.project === project.id);
  const load = project.team.map(id => ({ id, open: tasks.filter(task => task.assignee === id && task.stage !== "Done").length }));
  const max = Math.max(1, ...load.map(entry => entry.open));
  return <Scroller className={styles.panelScroll}>
    <div className={styles.panelBody}>
      <section className={styles.panelSection} data-first="" aria-label="Team">
        <div className={styles.panelHead}><h3>Team</h3><span className={styles.tabular}>{project.team.length}</span></div>
        <ul className={styles.teamList} onKeyDown={onRowKeys}>
          {load.map(entry => <li key={entry.id}>
            <button type="button" data-row="" className={styles.teamRow} onClick={() => { s.setQuery({ person: entry.id, scope: "all", milestone: "all" }); s.setTab("tasks"); }} aria-label={`${personName(entry.id)}, ${entry.open} open tasks. Show their tasks`}>
              <Avatar id={entry.id} size={28} />
              <span className={styles.teamText}><span>{personName(entry.id)}{entry.id === project.lead && <span className={styles.propMuted}> · lead</span>}</span><span className={styles.linkDetail}>{personRole(entry.id)}</span></span>
              <span className={styles.load}>
                <span className={styles.loadBar} aria-hidden="true"><motion.span initial={false} animate={{ scaleX: entry.open / max }} transition={reduce ? instant : motionTokens.spring.smooth} /></span>
                <span className={styles.tabular}>{entry.open}</span>
              </span>
            </button>
          </li>)}
        </ul>
      </section>
      {project.links.length > 0 && <section className={styles.panelSection} aria-label="Links">
        <div className={styles.panelHead}><h3>Links</h3></div>
        <ul className={styles.linkList} onKeyDown={onRowKeys}>{project.links.map(link => <CopyLink key={link.url} link={link} />)}</ul>
      </section>}
    </div>
  </Scroller>;
}

/* ------------------------------------------------------------------ Week side for home, my tasks and inbox */

export function WeekSide() {
  const s = useBoard();
  const fade = useFade();
  const [day, setDay] = useState(TODAY);
  const mine = s.tasks.filter(task => task.assignee === ME && task.stage !== "Done");
  const forDay = (iso: string) => mine.filter(task => iso === TODAY ? task.due <= TODAY : task.due === iso);
  const list = forDay(day);
  return <Scroller className={styles.panelScroll}>
    <div className={styles.panelBody}>
      <section className={styles.panelSection} data-first="" aria-label="This week">
        <div className={styles.panelHead}><h3>This week</h3><span>Nov 9 to 15</span></div>
        <div className={styles.week} role="radiogroup" aria-label="Day"
          onKeyDown={event => {
            const index = WEEK.indexOf(day);
            const next = event.key === "ArrowRight" ? WEEK[index + 1] : event.key === "ArrowLeft" ? WEEK[index - 1] : undefined;
            if (!next) return;
            event.preventDefault();
            setDay(next);
            event.currentTarget.querySelector<HTMLElement>(`[data-day="${next}"]`)?.focus();
          }}>
          {WEEK.map(iso => {
            const count = forDay(iso).length;
            return <button key={iso} type="button" role="radio" data-day={iso} aria-checked={iso === day} tabIndex={iso === day ? 0 : -1} className={styles.weekDay} data-today={iso === TODAY ? "" : undefined}
              aria-label={`${weekday(iso)}, ${formatDate(iso)}, ${count} due`} onClick={() => setDay(iso)}>
              <span className={styles.weekName}>{weekday(iso).slice(0, 1)}</span>
              <span className={styles.weekNum}>{Number(iso.slice(8))}</span>
              <span className={styles.weekCount} aria-hidden="true">{count || ""}</span>
            </button>;
          })}
        </div>
      </section>
      <section className={styles.panelSection} aria-label={`Due ${formatDate(day)}`}>
        <div className={styles.panelHead}><h3>{day === TODAY ? "Due today or earlier" : `Due ${weekday(day)}`}</h3><span className={styles.tabular}>{list.length}</span></div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.ul key={day} className={styles.miniList} onKeyDown={onRowKeys} {...fade}>
            {list.length ? list.map(task => {
              const project = s.projects.find(entry => entry.id === task.project);
              return <li key={task.id}><button type="button" data-row="" className={styles.miniRow} onClick={() => s.openTask(task.id)}>
                <StageIcon stage={task.stage} />
                <span className={styles.miniText}><span>{task.title}</span><span className={styles.linkDetail}>{project?.name} · <span data-overdue={isOverdue(task) ? "" : undefined}>{formatDate(task.due)}</span></span></span>
              </button></li>;
            }) : <li className={styles.miniEmpty}>Nothing due</li>}
          </motion.ul>
        </AnimatePresence>
      </section>
    </div>
  </Scroller>;
}

export function ShortcutsSide({ onClose }: { onClose: () => void }) {
  const rows: [string, string[]][] = [
    ["New task", ["c"]], ["Search", ["mod+k"]], ["Move between rows", ["up", "down"]], ["Open the focused task", ["enter"]],
    ["Complete the focused task", ["x"]], ["Reorder in Tasks", ["alt+up"]], ["Pick a milestone", ["left", "right"]], ["Close the task", ["escape"]],
  ];
  return <Scroller className={styles.panelScroll}>
    <div className={styles.panelBody}>
      <section className={styles.panelSection} data-first="" aria-label="Keyboard shortcuts">
        <div className={styles.panelHead}><h3>Keyboard shortcuts</h3></div>
        <dl className={styles.shortcuts}>
          {rows.map(([label, keys]) => <div key={label}><dt>{label}</dt><dd>{keys.map(key => <Kbd key={key} keys={key} size="sm" />)}</dd></div>)}
        </dl>
        <Button variant="secondary" size="sm" onClick={onClose} className={styles.shortcutsDone}>Done</Button>
      </section>
    </div>
  </Scroller>;
}


