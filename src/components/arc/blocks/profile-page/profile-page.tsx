"use client";

import Image from "next/image";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion, animate, useMotionValue } from "motion/react";
import { Calendar, Link2, Loader2, MapPin, MessageSquare, Plus, Rocket, Share2, Star, ThumbsUp, X } from "lucide-react";
import { motionTokens } from "../../lib/motion-tokens";
import { sampleActivity, sampleProfile, sampleProjects, sampleStats } from "./profile-page-data";
import type { ActivityKind, ProfileActivity, ProfileDetails, ProfileProject, ProfileStat } from "./profile-page-data";
import styles from "./profile-page.module.css";
import { writeClipboard } from "../../lib/use-copy-feedback";

/** Eases the copy label's width to `target` on a spring with no overshoot. The first measurement lands at once, so the control
 *  starts at its current word's width instead of the widest one. */
function useFitWidth(target: number | undefined, reduced: boolean | null | undefined) {
  const width = useMotionValue<number | "auto">("auto");
  const placed = useRef(false);
  useLayoutEffect(() => {
    if (!target) return;
    if (!placed.current || reduced) { placed.current = true; width.jump(target); return; }
    const controls = animate(width, target, { ...motionTokens.spring.snappy });
    return () => controls.stop();
  }, [target, reduced, width]);
  return width;
}

export type { ActivityKind, ProfileActivity, ProfileDetails, ProfileProject, ProfileStat } from "./profile-page-data";
export type ProfileTab = "activity" | "projects";

export interface ProfilePageProps {
  profile?: ProfileDetails;
  stats?: ProfileStat[];
  activity?: ProfileActivity[];
  projects?: ProfileProject[];
  /** Controlled tab. Pair with onTabChange. */
  tab?: ProfileTab;
  defaultTab?: ProfileTab;
  onTabChange?: (tab: ProfileTab) => void;
  /** Persists edited details. Throw an Error to keep the sheet open and show its message. */
  onSave?: (profile: ProfileDetails) => void | Promise<void>;
  /** Called when a project star is toggled. */
  onStarChange?: (projectId: string, starred: boolean) => void;
  /** Public link copied by Share. */
  profileUrl?: string;
  /** Shows Edit profile. Set false when someone views another person's profile. */
  editable?: boolean;
  className?: string;
}

type EditableField = "name" | "headline" | "location" | "website" | "bio";
const fields: EditableField[] = ["name", "headline", "website", "bio"]; // team-tracker: no location
const bioLimit = 200;
const number = new Intl.NumberFormat("en-US");
const easeEnter = [...motionTokens.ease.enter] as [number, number, number, number];
const easeStandard = [...motionTokens.ease.standard] as [number, number, number, number];
const instant = { duration: 0 };

const activityIcon: Record<ActivityKind, ReactNode> = {
  shipped: <Rocket size={15} strokeWidth={1.75} />,
  commented: <MessageSquare size={15} strokeWidth={1.75} />,
  created: <Plus size={15} strokeWidth={1.75} />,
  reviewed: <ThumbsUp size={15} strokeWidth={1.75} />,
  starred: <Star size={15} strokeWidth={1.75} />,
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));


/** Share faces crossfade centered in one cell, and the cell eases to the shown face's measured width with no overshoot, so
 *  "Copied" never sits in leftover space and nothing jumps. */
function FitStack({ shown, reduced, children }: { shown: number; reduced: boolean; children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [widths, setWidths] = useState<number[]>([]);
  useLayoutEffect(() => {
    const faces = Array.from(ref.current?.children ?? []) as HTMLElement[];
    const read = () => setWidths(faces.map(face => face.offsetWidth));
    read();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(read);
    faces.forEach(face => observer.observe(face));
    return () => observer.disconnect();
  }, []);
  const fitWidth = useFitWidth(widths[shown], reduced);
  return <motion.span ref={ref} className={styles.copyStack} style={{ width: fitWidth }}>{children}</motion.span>;
}

/** The success tick draws in one short stroke when it turns on. */
function DrawnCheck({ on, reduced }: { on: boolean; reduced: boolean }) {
  return <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <motion.path d="M4 12l5 5L20 6" initial={false} animate={{ pathLength: on || reduced ? 1 : 0 }} transition={on ? { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.standard], delay: .04 } : { duration: 0, delay: .12 }} />
  </svg>;
}

/** A profile page: cover, identity, about, stats, and activity and project tabs, with an edit sheet that writes back into the page. */
export function ProfilePage({
  profile = sampleProfile,
  stats = sampleStats,
  activity = sampleActivity,
  projects = sampleProjects,
  tab: tabProp,
  defaultTab = "activity",
  onTabChange,
  onSave,
  onStarChange,
  profileUrl,
  editable = true,
  className,
}: ProfilePageProps) {
  const reduced = !!useReducedMotion();
  const layoutId = useId();
  const [details, setDetails] = useState(profile);
  const [tabState, setTabState] = useState<ProfileTab>(defaultTab);
  const tab = tabProp ?? tabState;
  const [editing, setEditing] = useState(false);
  const [flash, setFlash] = useState<EditableField[]>([]);
  const [stars, setStars] = useState(() => Object.fromEntries(projects.map(project => [project.id, { on: !!project.starred, count: project.stars }])));
  const [copied, setCopied] = useState<"idle" | "copied" | "failed">("idle");
  const editButton = useRef<HTMLButtonElement>(null);
  const timers = useRef<number[]>([]);
  const tabRefs = useRef<Record<ProfileTab, HTMLButtonElement | null>>({ activity: null, projects: null });
  const panelContent = useRef<HTMLDivElement>(null);
  const [panelHeight, setPanelHeight] = useState<number | "auto">("auto");
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  // The panel follows its content's height on a spring, so switching tabs never snaps the page taller or shorter in one frame.
  useEffect(() => {
    const node = panelContent.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setPanelHeight(entry.borderBoxSize?.[0]?.blockSize ?? node.offsetHeight));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };
  const selectTab = (next: ProfileTab) => { if (tabProp === undefined) setTabState(next); onTabChange?.(next); };
  const url = profileUrl ?? `https://northwind.app/@${details.handle}`;

  const share = async () => {
    try { await writeClipboard(url); setCopied("copied"); }
    catch { setCopied("failed"); }
    later(() => setCopied("idle"), 1800);
  };

  const closeEditor = () => { setEditing(false); requestAnimationFrame(() => editButton.current?.focus()); };
  const save = async (next: ProfileDetails) => {
    if (onSave) await onSave(next); else await wait(700);
    const changed = fields.filter(field => next[field] !== details[field]);
    setDetails(next);
    setFlash(changed);
    later(() => setFlash([]), 1600);
    closeEditor();
  };

  const toggleStar = (id: string) => {
    const current = stars[id];
    const on = !current.on;
    setStars({ ...stars, [id]: { on, count: current.count + (on ? 1 : -1) } });
    onStarChange?.(id, on);
  };

  const onTabKey = (event: ReactKeyboardEvent) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = tab === "activity" ? "projects" : "activity";
    selectTab(next);
    tabRefs.current[next]?.focus();
  };

  const lit = (field: EditableField) => flash.includes(field) ? styles.flash : undefined;
  const groups = [...new Set(activity.map(item => item.group))];
  const tabs: { id: ProfileTab; label: string; count: number }[] = [{ id: "activity", label: "Activity", count: activity.length }, { id: "projects", label: "Projects", count: projects.length }];

  return <div className={[styles.root, className].filter(Boolean).join(" ")}>
    <div className={styles.page} data-editing={editing || undefined}>
      <div className={styles.cover}>{details.cover && <Image src={details.cover} alt="" fill sizes="(max-width: 980px) 100vw, 980px" priority />}</div>

      <header className={styles.identity}>
        <div className={styles.avatar}>{details.avatar ? <Image src={details.avatar} alt={details.name} fill sizes="96px" /> : <span aria-hidden="true">{details.name.slice(0, 1)}</span>}</div>
        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={share} aria-live="polite">
            <FitStack shown={copied === "copied" ? 1 : copied === "failed" ? 2 : 0} reduced={reduced}>
              <span data-shown={copied === "idle"}><Share2 size={15} strokeWidth={1.75} aria-hidden="true" />Share</span>
              <span data-shown={copied === "copied"}><DrawnCheck on={copied === "copied"} reduced={reduced} />Copied</span>
              <span data-shown={copied === "failed"}><X size={15} strokeWidth={1.75} aria-hidden="true" />Failed</span>
            </FitStack>
          </button>
          {editable && <button ref={editButton} type="button" className={styles.primary} onClick={() => setEditing(true)} aria-haspopup="dialog" aria-expanded={editing}>Edit profile</button>}
        </div>
        <div className={styles.names}>
          <h2 className={lit("name")}>{details.name}</h2>
          <p><span>@{details.handle}</span><span aria-hidden="true">·</span><span className={lit("headline")}>{details.headline}</span></p>
        </div>
      </header>

      <div className={styles.body}>
        <aside className={styles.about} aria-label="About">
          {details.bio && <p className={[styles.bio, lit("bio")].filter(Boolean).join(" ")}>{details.bio}</p>}
          <ul className={styles.meta}>
            {details.location && <li className={lit("location")}><MapPin size={15} strokeWidth={1.75} aria-hidden="true" />{details.location}</li>}
            {details.website && <li className={lit("website")}><Link2 size={15} strokeWidth={1.75} aria-hidden="true" /><a href={`https://${details.website.replace(/^https?:\/\//, "")}`} target="_blank" rel="noreferrer">{details.website.replace(/^https?:\/\//, "")}</a></li>}
            <li><Calendar size={15} strokeWidth={1.75} aria-hidden="true" />Joined {details.joined}</li>
          </ul>
          <dl className={styles.stats}>
            {stats.map(stat => <div key={stat.id}><dt>{stat.label}</dt><dd>{number.format(stat.value)}</dd></div>)}
          </dl>
        </aside>

        <section className={styles.main} aria-label="Profile content">
          <LayoutGroup id={layoutId}>
            <div className={styles.tabs} role="tablist" aria-label="Profile sections" onKeyDown={onTabKey}>
              {tabs.map(item => <button key={item.id} ref={node => { tabRefs.current[item.id] = node; }} type="button" role="tab" id={`${layoutId}-${item.id}-tab`} aria-selected={tab === item.id} aria-controls={`${layoutId}-panel`} tabIndex={tab === item.id ? 0 : -1} className={styles.tab} onClick={() => selectTab(item.id)}>
                {item.label}<span className={styles.tabCount}>{item.count}</span>
                {tab === item.id && <motion.span layoutId="underline" className={styles.underline} transition={reduced ? instant : motionTokens.spring.morph} />}
              </button>)}
            </div>
          </LayoutGroup>
          <motion.div id={`${layoutId}-panel`} role="tabpanel" aria-labelledby={`${layoutId}-${tab}-tab`} className={styles.panel} initial={false} animate={{ height: panelHeight }} transition={reduced ? instant : motionTokens.spring.smooth}>
            <div ref={panelContent} className={styles.panelContent}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={tab} initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: reduced ? 0 : motionTokens.duration.instant } }} transition={reduced ? instant : { duration: motionTokens.duration.standard, ease: easeEnter }}>
                  {tab === "activity" ? <div className={styles.activity}>
                    {groups.map(group => <div key={group} className={styles.group}>
                      <h3>{group}</h3>
                      <ol>{activity.filter(item => item.group === group).map(item => <li key={item.id} className={styles.event}>
                        <span className={styles.eventIcon} data-kind={item.kind} aria-hidden="true">{activityIcon[item.kind]}</span>
                        <div className={styles.eventText}>
                          <p><span className={styles.muted}>{details.name.split(" ")[0]} {item.action}</span> {item.target}</p>
                          {item.detail && <p className={styles.eventDetail}>{item.detail}</p>}
                        </div>
                        <time className={styles.time}>{item.time}</time>
                      </li>)}</ol>
                    </div>)}
                  </div> : <ul className={styles.projects}>
                    {projects.map(project => { const star = stars[project.id]; return <li key={project.id} className={styles.project}>
                      <div className={styles.projectCover}><Image src={project.cover} alt="" fill sizes="(max-width: 640px) 100vw, 320px" /></div>
                      <div className={styles.projectBody}>
                        <div className={styles.projectHead}><h4>{project.name}</h4><span className={styles.visibility}>{project.visibility}</span></div>
                        <p>{project.description}</p>
                        <div className={styles.projectFoot}>
                          <span className={styles.faces}>{project.collaborators.map(person => <span key={person.name} className={styles.face} title={person.name}>{person.avatar ? <Image src={person.avatar} alt={person.name} fill sizes="22px" /> : person.name[0]}</span>)}</span>
                          <span className={styles.updated}>{project.updated}</span>
                          <button type="button" className={styles.star} data-on={star.on} aria-pressed={star.on} aria-label={`${star.on ? "Unstar" : "Star"} ${project.name}, ${star.count} stars`} onClick={() => toggleStar(project.id)}>
                            <motion.span key={String(star.on)} className={styles.starIcon} initial={reduced || !star.on ? false : { scale: .6 }} animate={{ scale: 1 }} transition={reduced ? instant : motionTokens.spring.snappy}><Star size={14} strokeWidth={1.75} aria-hidden="true" /></motion.span>
                            <span className={styles.starCount}>{number.format(star.count)}</span>
                          </button>
                        </div>
                      </div>
                    </li>; })}
                  </ul>}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </section>
      </div>
    </div>

    <AnimatePresence>
      {editing && <EditSheet key="sheet" initial={details} reduced={reduced} onClose={closeEditor} onSave={save} />}
    </AnimatePresence>
  </div>;
}

/** The edit sheet slides in from the right edge over a dimmed page, keeps focus inside, and closes on Escape. */
function EditSheet({ initial, reduced, onClose, onSave }: { initial: ProfileDetails; reduced: boolean; onClose: () => void; onSave: (profile: ProfileDetails) => Promise<void> }) {
  const [draft, setDraft] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saving">("idle");
  const [error, setError] = useState<string>();
  const [touched, setTouched] = useState(false);
  const panel = useRef<HTMLFormElement>(null);
  const first = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const fieldId = useId();
  useEffect(() => { const frame = requestAnimationFrame(() => first.current?.focus({ preventScroll: true })); return () => cancelAnimationFrame(frame); }, []);

  const dirty = fields.some(field => draft[field] !== initial[field]);
  const nameError = !draft.name.trim() ? "Add your name" : undefined;
  const websiteError = draft.website && !/^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(draft.website.trim()) ? "Use a domain like example.com" : undefined;
  const invalid = !!(nameError || websiteError);
  const set = (field: EditableField) => (event: { target: { value: string } }) => { setDraft({ ...draft, [field]: field === "bio" ? event.target.value.slice(0, bioLimit) : event.target.value }); setError(undefined); };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (invalid || !dirty || status === "saving") return;
    setStatus("saving");
    try { await onSave({ ...draft, name: draft.name.trim(), website: draft.website.trim() }); }
    catch (reason) { setStatus("idle"); setError(reason instanceof Error ? reason.message : "Could not save. Try again."); }
  };

  const onKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key === "Escape") { event.stopPropagation(); onClose(); return; }
    if (event.key !== "Tab" || !panel.current) return;
    const nodes = [...panel.current.querySelectorAll<HTMLElement>("input, textarea, button:not(:disabled)")];
    const head = nodes[0], tail = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === head) { event.preventDefault(); tail.focus(); }
    else if (!event.shiftKey && document.activeElement === tail) { event.preventDefault(); head.focus(); }
  };

  const slide = reduced ? { opacity: 0 } : { x: "100%" };
  return <>
    <motion.div className={styles.scrim} onClick={onClose} aria-hidden="true" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: motionTokens.duration.standard, ease: easeStandard }} />
    <motion.form ref={panel} className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby={titleId} onSubmit={submit} onKeyDown={onKeyDown} noValidate
      initial={slide} animate={{ x: 0, opacity: 1 }} exit={reduced ? { opacity: 0, transition: { duration: motionTokens.duration.fast } } : { x: "100%", transition: { duration: motionTokens.duration.exit + .06, ease: easeStandard } }}
      transition={reduced ? { duration: motionTokens.duration.fast } : motionTokens.spring.smooth}>
      <div className={styles.sheetHead}>
        <h3 id={titleId}>Edit profile</h3>
        <button type="button" className={styles.iconButton} onClick={onClose} aria-label="Close"><X size={16} strokeWidth={1.75} /></button>
      </div>
      <div className={styles.sheetBody}>
        <Field id={`${fieldId}-name`} label="Name" error={touched ? nameError : undefined}><input ref={first} id={`${fieldId}-name`} value={draft.name} onChange={set("name")} autoComplete="name" aria-invalid={touched && !!nameError} aria-describedby={touched && nameError ? `${fieldId}-name-error` : undefined} /></Field>
        <Field id={`${fieldId}-headline`} label="Headline"><input id={`${fieldId}-headline`} value={draft.headline} onChange={set("headline")} /></Field>
        <div className={styles.pair}>
          <Field id={`${fieldId}-website`} label="Website" error={touched ? websiteError : undefined}><input id={`${fieldId}-website`} value={draft.website} onChange={set("website")} inputMode="url" aria-invalid={touched && !!websiteError} aria-describedby={touched && websiteError ? `${fieldId}-website-error` : undefined} /></Field>
        </div>
        <Field id={`${fieldId}-bio`} label="Bio" hint={`${bioLimit - draft.bio.length} left`}><textarea id={`${fieldId}-bio`} value={draft.bio} onChange={set("bio")} rows={5} /></Field>
      </div>
      <div className={styles.sheetFoot}>
        <AnimatePresence initial={false}>{error && <motion.p role="alert" className={styles.formError} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>{error}</motion.p>}</AnimatePresence>
        <button type="button" className={styles.secondary} onClick={onClose}>Cancel</button>
        <button type="submit" className={styles.primary} disabled={!dirty || status === "saving"} aria-disabled={invalid || undefined}>
          <span className={styles.stack}>
            <span data-shown={status === "idle"}>Save changes</span>
            <span data-shown={status === "saving"}><Loader2 size={15} strokeWidth={1.75} className={styles.spin} aria-hidden="true" />Saving</span>
          </span>
        </button>
      </div>
    </motion.form>
  </>;
}

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: ReactNode }) {
  return <div className={styles.field} data-invalid={!!error || undefined}>
    <div className={styles.fieldHead}><label htmlFor={id}>{label}</label>{hint && <span>{hint}</span>}</div>
    {children}
    {error && <p id={`${id}-error`} className={styles.fieldError}>{error}</p>}
  </div>;
}

export default ProfilePage;
