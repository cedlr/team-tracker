"use client";

import { useRef, useState } from "react";
import type { CSSProperties, DragEvent as ReactDragEvent, KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowDown, ArrowUp, Check, MessageSquare, Plane, Send, Star, Users, X } from "lucide-react";
import { motionTokens } from "../../lib/motion-tokens";
import { Badge } from "../../badge/badge";
import { Button } from "../../button/button";
import { CopyButton } from "../../copy-button/copy-button";
import { Kbd } from "../../kbd/kbd";
import { directoryNow, offices } from "./team-directory-data";
import type { DirectoryPerson, Office, Team, TimeOffRequest } from "./team-directory-data";
import {
  Face, GitHubMark, LinkedInMark, Picker, PickerChevron, SlackMark, StatusLabel, TeamIcon, clock, cx, dateRange, dayIndex, instant,
  localMinutes, longDate, overlapHours, shortDate, statusOf, tenure, toneOf, toneVar, useEdgeFade,
} from "./team-directory-parts";
import styles from "./team-directory.module.css";

/* ------------------------------------------------------------------ Shared roving keyboard */

/** Moves focus between [data-person] items. Up and down pick the nearest item in the next row by position, so it works for any column count. */
function moveFocus(container: HTMLElement | null, event: ReactKeyboardEvent, grid: boolean): HTMLElement | null {
  if (!container) return null;
  const items = [...container.querySelectorAll<HTMLElement>("[data-person]")];
  const current = (event.target as HTMLElement).closest<HTMLElement>("[data-person]");
  const index = current ? items.indexOf(current) : -1;
  if (index < 0) return null;
  let next: HTMLElement | undefined;
  if (event.key === "Home") next = items[0];
  else if (event.key === "End") next = items.at(-1);
  else if (grid && (event.key === "ArrowRight" || event.key === "ArrowLeft")) next = items[index + (event.key === "ArrowRight" ? 1 : -1)];
  else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    if (!grid) next = items[index + (event.key === "ArrowDown" ? 1 : -1)];
    else {
      const box = current!.getBoundingClientRect();
      const down = event.key === "ArrowDown";
      const candidates = items.map(item => ({ item, rect: item.getBoundingClientRect() }))
        .filter(({ rect }) => down ? rect.top > box.top + 4 : rect.top < box.top - 4);
      if (candidates.length) {
        const rowTop = down ? Math.min(...candidates.map(c => c.rect.top)) : Math.max(...candidates.map(c => c.rect.top));
        next = candidates.filter(c => Math.abs(c.rect.top - rowTop) < 4)
          .sort((a, b) => Math.abs(a.rect.left - box.left) - Math.abs(b.rect.left - box.left))[0]?.item;
      }
    }
  } else return null;
  event.preventDefault();
  if (!next) return null;
  next.focus({ preventScroll: true });
  next.scrollIntoView({ block: "nearest" });
  return next;
}

/* ------------------------------------------------------------------ People: grid */

export interface PeopleGroup { team: Team; people: DirectoryPerson[] }

interface PeopleViewProps {
  /** The person the keyboard returns to: the single tab stop. */
  selectedId: string;
  /** Draw the selection fill: only while their profile is open, so a closed panel leaves no stray highlight. */
  showSelection: boolean;
  favorites: Set<string>;
  statusFor: (person: DirectoryPerson) => ReturnType<typeof statusOf>;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
}

export function PeopleGrid({ groups, selectedId, showSelection, favorites, statusFor, onSelect, onOpen }: PeopleViewProps & { groups: PeopleGroup[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const flat = groups.flatMap(group => group.people);
  const focusId = flat.some(person => person.id === selectedId) ? selectedId : flat[0]?.id;
  return <div ref={ref} className={styles.groups} role="listbox" aria-label="People" aria-orientation="horizontal"
    onKeyDown={event => {
      if (event.key === "Enter" || event.key === " ") { const id = (event.target as HTMLElement).closest<HTMLElement>("[data-person]")?.dataset.person; if (id) { event.preventDefault(); onSelect(id); onOpen(id); } return; }
      const next = moveFocus(ref.current, event, true);
      if (next?.dataset.person) onSelect(next.dataset.person);
    }}>
    {groups.map(group => <section key={group.team} className={styles.group} role="group" aria-labelledby={`td-group-${group.team}`}>
      <h3 className={styles.groupHead} id={`td-group-${group.team}`}><TeamIcon team={group.team} />{group.team}<span className={styles.groupCount}>{group.people.length}</span></h3>
      <div className={styles.cards}>
        {group.people.map(person => {
          const status = statusFor(person);
          const selected = showSelection && person.id === selectedId;
          return <button key={person.id} type="button" role="option" aria-selected={selected} tabIndex={person.id === focusId ? 0 : -1} data-person={person.id}
            className={styles.card} onClick={() => { onSelect(person.id); onOpen(person.id); }}>
            <span className={styles.cardTop}>
              <Face person={person} size={36} />
              <span className={styles.cardWho}>
                <span className={styles.cardName}><span className={styles.ellipsis}>{person.name}</span>{favorites.has(person.id) && <Star size={14} strokeWidth={1.75} className={styles.cardStar} aria-label="Favorite" />}</span>
                <span className={styles.cardRole}>{person.role}</span>
              </span>
            </span>
            <span className={styles.cardFoot}>
              <span className={styles.cardPlace}>{person.city ?? person.office}<span className={styles.cardTime}>{clock(localMinutes(person))}</span></span>
              <StatusLabel status={status} className={styles.cardStatus} short />
            </span>
          </button>;
        })}
      </div>
    </section>)}
  </div>;
}

/* ------------------------------------------------------------------ People: list */

export type SortKey = "name" | "team" | "office" | "started";
export interface SortState { key: SortKey; dir: 1 | -1 }

export function PeopleList({ people, selectedId, showSelection, favorites, statusFor, onSelect, onOpen, sort, onSort, managerName }: PeopleViewProps & {
  people: DirectoryPerson[]; sort: SortState; onSort: (key: SortKey) => void; managerName: (id?: string) => string;
}) {
  const ref = useRef<HTMLTableSectionElement>(null);
  const scrollRef = useEdgeFade<HTMLDivElement>("x");
  const focusId = people.some(person => person.id === selectedId) ? selectedId : people[0]?.id;
  const head = (key: SortKey, label: string, className?: string) => <th className={className} aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
    <button type="button" className={styles.sortButton} data-active={sort.key === key ? "" : undefined} onClick={() => onSort(key)}>
      {label}
      <span className={styles.sortIcon} aria-hidden="true">{sort.dir === 1 ? <ArrowUp size={14} strokeWidth={1.75} /> : <ArrowDown size={14} strokeWidth={1.75} />}</span>
    </button>
  </th>;
  return <div ref={scrollRef} className={styles.tableScroll}>
    <table className={styles.table} role="grid" aria-label="People">
      <thead>
        <tr>
          {head("name", "Name")}
          {head("team", "Team", styles.colTeam)}
          {head("office", "Office", styles.colOffice)}
          <th className={styles.colStatus}><span className={styles.thText}>Status</span></th>
          <th className={styles.colManager}><span className={styles.thText}>Reports to</span></th>
          {head("started", "Started", styles.colStarted)}
        </tr>
      </thead>
      <tbody ref={ref} onKeyDown={event => {
        if (event.key === "Enter" || event.key === " ") { const id = (event.target as HTMLElement).closest<HTMLElement>("[data-person]")?.dataset.person; if (id) { event.preventDefault(); onOpen(id); } return; }
        const next = moveFocus(ref.current, event, false);
        if (next?.dataset.person) onSelect(next.dataset.person);
      }}>
        {people.map(person => {
          const status = statusFor(person);
          return <tr key={person.id} data-person={person.id} aria-selected={showSelection && person.id === selectedId} tabIndex={person.id === focusId ? 0 : -1} className={styles.row}
            onClick={() => { onSelect(person.id); onOpen(person.id); }}>
            <td>
              <span className={styles.rowWho}>
                <Face person={person} size={28} />
                <span className={styles.rowText}>
                  <span className={styles.rowName}><span className={styles.ellipsis}>{person.name}</span>{favorites.has(person.id) && <Star size={14} strokeWidth={1.75} className={styles.cardStar} aria-label="Favorite" />}</span>
                  <span className={styles.rowRole}>{person.role}</span>
                </span>
              </span>
            </td>
            <td className={styles.colTeam}><span className={styles.inline}><TeamIcon team={person.team} />{person.team}</span></td>
            <td className={styles.colOffice}><span className={styles.inline}>{person.city ?? person.office}<span className={styles.cardTime}>{clock(localMinutes(person))}</span></span></td>
            <td className={styles.colStatus}><StatusLabel status={status} short /></td>
            <td className={cx(styles.colManager, styles.muted)}>{managerName(person.managerId)}</td>
            <td className={cx(styles.colStarted, styles.muted, styles.num)}>{shortDate(person.started)} {person.started.slice(0, 4)}</td>
          </tr>;
        })}
      </tbody>
    </table>
  </div>;
}

/* ------------------------------------------------------------------ Org chart */

export function OrgChart({ people, selectedId, showSelection, onSelect, onOpen, onManagerChange }: {
  people: DirectoryPerson[]; selectedId: string; showSelection: boolean;
  onSelect: (id: string) => void; onOpen: (id: string) => void; onManagerChange: (personId: string, managerId: string) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const root = people.find(person => !person.managerId) ?? people[0];
  const reportsOf = (id: string) => people.filter(person => person.managerId === id);
  const descendants = (id: string): string[] => reportsOf(id).flatMap(child => [child.id, ...descendants(child.id)]);
  const blocked = dragId ? new Set([dragId, ...descendants(dragId), people.find(p => p.id === dragId)?.managerId ?? ""]) : null;

  const node = (person: DirectoryPerson, depth: number) => {
    const droppable = Boolean(dragId) && !blocked?.has(person.id);
    return <button type="button" key={person.id} className={styles.node} data-person={person.id} aria-pressed={showSelection && person.id === selectedId} data-depth={depth}
      data-drop={droppable ? "" : undefined} data-over={overId === person.id && droppable ? "" : undefined} data-dragging={dragId === person.id ? "" : undefined}
      draggable={person.id !== root.id}
      onClick={() => { onSelect(person.id); onOpen(person.id); }}
      onDragStart={(event: ReactDragEvent) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", person.id); setDragId(person.id); }}
      onDragEnd={() => { setDragId(null); setOverId(null); }}
      onDragOver={(event: ReactDragEvent) => { if (!droppable) return; event.preventDefault(); event.dataTransfer.dropEffect = "move"; if (overId !== person.id) setOverId(person.id); }}
      onDragLeave={() => { if (overId === person.id) setOverId(null); }}
      onDrop={(event: ReactDragEvent) => { event.preventDefault(); if (dragId && droppable) onManagerChange(dragId, person.id); setDragId(null); setOverId(null); }}>
      <Face person={person} size={depth === 0 ? 36 : 28} />
      <span className={styles.nodeText}><span className={styles.nodeName}>{person.name}</span><span className={styles.nodeRole}>{person.role}</span></span>
      {reportsOf(person.id).length > 0 && depth > 0 && <span className={styles.nodeCount} aria-label={`${reportsOf(person.id).length} direct reports`}><Users size={14} strokeWidth={1.75} aria-hidden="true" />{reportsOf(person.id).length}</span>}
    </button>;
  };

  const branch = (person: DirectoryPerson, depth: number): ReactNode => <li key={person.id} className={styles.branch}>
    {node(person, depth)}
    {reportsOf(person.id).length > 0 && <ul className={styles.reports}>{reportsOf(person.id).map(child => branch(child, depth + 1))}</ul>}
  </li>;

  const leads = reportsOf(root.id);
  return <div className={styles.org}>
    <div className={styles.orgRoot}>{node(root, 0)}</div>
    <ul className={styles.orgColumns} style={{ "--cols": leads.length } as CSSProperties}>
      {leads.map(lead => <li key={lead.id} className={styles.orgColumn} style={{ "--td-tone": toneVar(toneOf(lead.team)) } as CSSProperties}>
        <span className={styles.orgTeam}><TeamIcon team={lead.team} />{lead.team}</span>
        <ul className={styles.orgTree}>{branch(lead, 1)}</ul>
      </li>)}
    </ul>
    <p className={styles.hint}>Drag someone onto a new manager to change who they report to. On the keyboard, use Reports to in their profile.</p>
  </div>;
}

/* ------------------------------------------------------------------ Time off */

const WINDOW_START = dayIndex("2026-11-09");
const WINDOW_DAYS = 28;
const TODAY = Math.floor(directoryNow / 86400000);

export function TimeOffPage({ requests, people, onDecide, onSelect, onOpen }: {
  requests: TimeOffRequest[]; people: DirectoryPerson[]; onDecide: (id: string, decision: "approve" | "decline") => void;
  onSelect: (id: string) => void; onOpen: (id: string) => void;
}) {
  const reduce = useReducedMotion();
  const byId = (id: string) => people.find(person => person.id === id)!;
  const pending = requests.filter(request => request.status === "pending");
  const upcoming = requests.filter(request => request.status === "approved" && dayIndex(request.to) >= TODAY).sort((a, b) => dayIndex(a.from) - dayIndex(b.from));
  const inWindow = requests.filter(request => dayIndex(request.to) >= WINDOW_START && dayIndex(request.from) < WINDOW_START + WINDOW_DAYS)
    .sort((a, b) => dayIndex(a.from) - dayIndex(b.from));
  const scrollRef = useEdgeFade<HTMLDivElement>("x");
  const openPerson = (id: string) => { onSelect(id); onOpen(id); };

  return <div className={styles.timeoff}>
    <section className={styles.block} aria-labelledby="td-pending">
      <h3 className={styles.blockHead} id="td-pending">Waiting for you<span className={styles.groupCount}>{pending.length}</span></h3>
      {pending.length === 0 ? <p className={styles.emptyLine}>You are all caught up. New requests land here.</p> : <ul className={styles.requests}>
        <AnimatePresence initial={false}>
          {pending.map(request => {
            const person = byId(request.personId);
            return <motion.li key={request.id} className={styles.request} layout={reduce ? false : "position"}
              exit={{ opacity: 0, transition: reduce ? instant : { duration: motionTokens.duration.exit } }} transition={reduce ? instant : motionTokens.spring.smooth}>
              <button type="button" className={styles.requestWho} onClick={() => openPerson(person.id)}>
                <Face person={person} size={36} />
                <span className={styles.rowText}><span className={styles.rowName}>{person.name}</span><span className={styles.rowRole}>{request.kind}, {dateRange(request.from, request.to)}, {request.days} {request.days === 1 ? "day" : "days"}</span></span>
              </button>
              {request.note && <p className={styles.requestNote}>{request.note}</p>}
              <span className={styles.requestActions}>
                <Button variant="secondary" size="sm" className={styles.btn} onClick={() => onDecide(request.id, "decline")}><X size={16} strokeWidth={1.75} aria-hidden="true" />Decline</Button>
                <Button variant="primary" size="sm" className={styles.btn} onClick={() => onDecide(request.id, "approve")}><Check size={16} strokeWidth={1.75} aria-hidden="true" />Approve</Button>
              </span>
            </motion.li>;
          })}
        </AnimatePresence>
      </ul>}
    </section>

    <section className={styles.block} aria-labelledby="td-calendar">
      <h3 className={styles.blockHead} id="td-calendar">Next four weeks</h3>
      <div ref={scrollRef} className={styles.calScroll}>
        <div className={styles.cal} style={{ "--days": WINDOW_DAYS } as CSSProperties}>
          <div className={styles.calHead} aria-hidden="true">
            <span />
            {Array.from({ length: WINDOW_DAYS }, (_, day) => {
              const date = new Date((WINDOW_START + day) * 86400000);
              const weekend = date.getUTCDay() === 0 || date.getUTCDay() === 6;
              return <span key={day} className={styles.calDay} data-weekend={weekend ? "" : undefined} data-today={WINDOW_START + day === TODAY ? "" : undefined}>
                {date.getUTCDay() === 1 ? `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][date.getUTCMonth()]} ${date.getUTCDate()}` : ""}
              </span>;
            })}
          </div>
          {inWindow.map(request => {
            const person = byId(request.personId);
            const from = Math.max(0, dayIndex(request.from) - WINDOW_START);
            const to = Math.min(WINDOW_DAYS - 1, dayIndex(request.to) - WINDOW_START);
            return <div key={request.id} className={styles.calRow}>
              <button type="button" className={styles.calWho} onClick={() => openPerson(person.id)}><Face person={person} size={20} /><span>{person.name}</span></button>
              {Array.from({ length: WINDOW_DAYS }, (_, day) => {
                const date = new Date((WINDOW_START + day) * 86400000);
                return <span key={day} className={styles.calCell} style={{ gridColumn: day + 2 }} data-weekend={date.getUTCDay() === 0 || date.getUTCDay() === 6 ? "" : undefined} data-today={WINDOW_START + day === TODAY ? "" : undefined} aria-hidden="true" />;
              })}
              <span className={styles.calBar} title={`${person.name}, ${request.kind.toLowerCase()}, ${dateRange(request.from, request.to)}${request.status === "pending" ? ", pending" : ""}`} data-pending={request.status === "pending" ? "" : undefined} style={{ gridColumn: `${from + 2} / ${to + 3}`, "--td-tone": toneVar(toneOf(person.team)) } as CSSProperties}>
                <span>{request.kind}{request.status === "pending" ? ", pending" : ""}</span>
              </span>
            </div>;
          })}
        </div>
      </div>
    </section>

    <section className={styles.block} aria-labelledby="td-upcoming">
      <h3 className={styles.blockHead} id="td-upcoming">Approved<span className={styles.groupCount}>{upcoming.length}</span></h3>
      <ul className={styles.upcoming}>
        {upcoming.map(request => {
          const person = byId(request.personId);
          const now = dayIndex(request.from) <= TODAY;
          return <li key={request.id}>
            <button type="button" className={styles.upcomingRow} onClick={() => openPerson(person.id)}>
              <Face person={person} size={28} />
              <span className={styles.rowText}><span className={styles.rowName}>{person.name}</span><span className={styles.rowRole}>{request.kind}</span></span>
              <span className={styles.upcomingWhen}>{now && <Badge tone="info" size="sm" icon={<Plane size={12} strokeWidth={1.75} />}>Out now</Badge>}{dateRange(request.from, request.to)}<span className={styles.muted}>{request.days} {request.days === 1 ? "day" : "days"}</span></span>
            </button>
          </li>;
        })}
      </ul>
    </section>
  </div>;
}

/* ------------------------------------------------------------------ Profile panel */

export function ProfilePanel(props: {
  person: DirectoryPerson; people: DirectoryPerson[]; viewer: DirectoryPerson; viewerAway: boolean; favorite: boolean; timeOff: TimeOffRequest[];
  onToggleFavorite: () => void; onSelect: (id: string) => void; onManagerChange: (personId: string, managerId: string) => void;
}) {
  const reduce = useReducedMotion();
  const ref = useEdgeFade<HTMLDivElement>();
  return <div ref={ref} className={styles.panelScroll}>
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div key={props.person.id} className={styles.profile}
        initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1, transition: reduce ? instant : { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.standard] } }}
        exit={{ opacity: 0, transition: reduce ? instant : { duration: motionTokens.duration.exit, ease: [...motionTokens.ease.standard] } }}>
        <Profile {...props} />
      </motion.div>
    </AnimatePresence>
  </div>;
}

function Profile({ person, people, viewer, viewerAway, favorite, timeOff, onToggleFavorite, onSelect, onManagerChange }: Parameters<typeof ProfilePanel>[0]) {
  const reduce = useReducedMotion();
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const status = statusOf(person, viewerAway, viewer.id);
  const manager = people.find(entry => entry.id === person.managerId);
  const reports = people.filter(entry => entry.managerId === person.id);
  const isViewer = person.id === viewer.id;
  const descendants = (id: string): string[] => people.filter(p => p.managerId === id).flatMap(child => [child.id, ...descendants(child.id)]);
  const blocked = new Set([person.id, ...descendants(person.id)]);
  const managerOptions = people.filter(entry => !blocked.has(entry.id)).map(entry => ({ value: entry.id, label: entry.name, detail: entry.role, photo: entry.photo }));
  const away = timeOff.filter(request => request.personId === person.id && request.status === "approved" && dayIndex(request.to) >= TODAY);
  const first = person.name.split(" ")[0];

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setSent(`Sent to ${first} in Slack. This demo does not deliver messages.`);
    setDraft("");
    setComposing(false);
  };

  return <>
    <header className={styles.profileHead}>
      <Face person={person} size={48} />
      <div className={styles.profileWho}>
        <h2 className={styles.profileName}>{person.name}</h2>
        <p className={styles.profileRole}>{person.role}{person.pronouns && <span className={styles.muted}>, {person.pronouns}</span>}</p>
      </div>
    </header>
    <StatusLabel status={status} className={styles.profileStatus} />

    <div className={styles.profileActions}>
      <Button variant="primary" size="sm" className={cx(styles.btn, styles.grow)} aria-expanded={composing} disabled={isViewer}
        onClick={() => { setComposing(value => !value); setSent(null); }}>
        <MessageSquare size={16} strokeWidth={1.75} aria-hidden="true" />Message
      </Button>
      <CopyButton value={person.email} label="Copy email" className={styles.copy} />
      <Button variant="secondary" size="sm" className={cx(styles.btn, styles.iconBtn, styles.star)} aria-pressed={favorite}
        aria-label={favorite ? `Remove ${first} from favorites` : `Add ${first} to favorites`} title={favorite ? "Remove from favorites" : "Add to favorites"} onClick={onToggleFavorite}>
        <Star size={16} strokeWidth={1.75} aria-hidden="true" />
      </Button>
    </div>

    <AnimatePresence initial={false}>
      {composing && <motion.form key="compose" className={styles.composeFold} onSubmit={event => { event.preventDefault(); send(); }}
        initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
        transition={reduce ? instant : { height: motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.fast } }}>
        <div className={styles.compose}>
          <span className={styles.composeTo}><SlackMark size={16} />Direct message to {first}</span>
          <textarea className={styles.composeField} value={draft} rows={3} placeholder={`Write to ${first}`} aria-label={`Message to ${first}`} autoFocus
            onChange={event => setDraft(event.target.value)}
            onKeyDown={event => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); send(); }
              if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setComposing(false); }
            }} />
          <span className={styles.composeBar}>
            <span className={styles.composeHint}><Kbd size="sm" keys={["mod", "enter"]} />to send</span>
            <Button type="submit" variant="primary" size="sm" className={styles.btn} disabled={!draft.trim()}><Send size={16} strokeWidth={1.75} aria-hidden="true" />Send</Button>
          </span>
        </div>
      </motion.form>}
    </AnimatePresence>
    <p className={styles.sentLine} role="status">{sent && <><Check size={16} strokeWidth={1.75} aria-hidden="true" />{sent}</>}</p>

    {person.about ? <p className={styles.about}>{person.about}</p> : <p className={cx(styles.about, styles.muted)}>{first} has not written a bio yet.</p>}

    <Hours person={person} viewer={viewer} />

    <dl className={styles.facts}>
      <div><dt>Team</dt><dd><span className={styles.inline}><TeamIcon team={person.team} />{person.team}</span></dd></div>
      <div>
        <dt>Reports to</dt>
        <dd>{manager
          ? <Picker label={`Who ${first} reports to`} value={manager.id} options={managerOptions} onChange={id => onManagerChange(person.id, id)} className={styles.factPicker} align="end">
            <Face person={manager} size={20} /><span className={styles.ellipsis}>{manager.name}</span><PickerChevron />
          </Picker>
          : <span className={styles.muted}>No one, top of the chart</span>}</dd>
      </div>
      <div><dt>Office</dt><dd>{person.city ? `${person.city}, remote` : person.office}</dd></div>
      <div><dt>Email</dt><dd className={styles.ellipsis}>{person.email}</dd></div>
      <div><dt>Phone</dt><dd className={cx(styles.num, !person.phone && styles.muted)}>{person.phone ?? "Not added"}</dd></div>
      <div><dt>Started</dt><dd>{longDate(person.started)}<span className={styles.muted}>{tenure(person.started)}</span></dd></div>
    </dl>

    {away.length > 0 && <section className={styles.profileBlock}>
      <h3 className={styles.profileHeading}>Time off</h3>
      <ul className={styles.awayList}>{away.map(request => <li key={request.id}><span>{request.kind}</span><span className={styles.muted}>{dateRange(request.from, request.to)}</span></li>)}</ul>
    </section>}

    {reports.length > 0 && <section className={styles.profileBlock}>
      <h3 className={styles.profileHeading}>Direct reports<span className={styles.groupCount}>{reports.length}</span></h3>
      <ul className={styles.reportList}>
        {reports.map(report => <li key={report.id}><button type="button" className={styles.reportRow} onClick={() => onSelect(report.id)}>
          <Face person={report} size={24} />
          <span className={styles.ellipsis}>{report.name}</span><span className={cx(styles.muted, styles.ellipsis)}>{report.role}</span>
        </button></li>)}
      </ul>
    </section>}

    {person.skills.length > 0 && <section className={styles.profileBlock}>
      <h3 className={styles.profileHeading}>Ask about</h3>
      <ul className={styles.skills}>{person.skills.map(skill => <li key={skill}><Badge size="sm">{skill}</Badge></li>)}</ul>
    </section>}

    {(person.github || person.linkedin) && <section className={styles.profileBlock}>
      <h3 className={styles.profileHeading}>Profiles</h3>
      <ul className={styles.links}>
        {person.github && <li><GitHubMark /><span>github.com/{person.github}</span></li>}
        {person.linkedin && <li><LinkedInMark /><span>linkedin.com/in/{person.linkedin}</span></li>}
      </ul>
    </section>}
  </>;
}

/** Working hours on a 24 hour strip in the viewer's time zone, with the shared hours and the current time marked. */
function Hours({ person, viewer }: { person: DirectoryPerson; viewer: DirectoryPerson }) {
  const shift = viewer.utcOffset - person.utcOffset;
  const segs = (start: number, end: number) => {
    const a = ((start % 24) + 24) % 24, b = a + (end - start);
    return b <= 24 ? [[a, b]] : [[a, 24], [0, b - 24]];
  };
  const theirs = segs(person.hours[0] + shift, person.hours[1] + shift);
  const mine = segs(viewer.hours[0], viewer.hours[1]);
  const now = localMinutes(viewer) / 60;
  const shared = overlapHours(person, viewer);
  const isViewer = person.id === viewer.id;
  const officeLabel = offices.find(entry => entry.id === viewer.office)?.label ?? viewer.office;
  const bar = (list: number[][], kind: "them" | "you") => list.map(([a, b], index) => <span key={index} className={styles.hoursSeg} data-kind={kind} style={{ left: `${(a / 24) * 100}%`, width: `${((b - a) / 24) * 100}%` }} />);
  return <section className={styles.hours} aria-label="Working hours">
    <div className={styles.hoursTop}>
      <h3 className={styles.profileHeading}>Working hours</h3>
      <span className={styles.hoursNote}>{isViewer ? "Your day" : shared > 0 ? `${shared}h overlap with you` : "No overlap with you"}</span>
    </div>
    <p className={styles.hoursLine}>{clock(person.hours[0] * 60)} to {clock(person.hours[1] * 60)} in {person.city ?? person.office}<span className={styles.muted}>, {clock(localMinutes(person))} now</span></p>
    <div className={styles.hoursChart} aria-hidden="true">
      <span className={styles.hoursLabel}>{isViewer ? "You" : person.name.split(" ")[0]}</span>
      <span className={styles.hoursTrack}>{bar(theirs, "them")}<span className={styles.hoursNow} style={{ left: `${(now / 24) * 100}%` }} /></span>
      {!isViewer && <><span className={styles.hoursLabel}>You</span><span className={styles.hoursTrack}>{bar(mine, "you")}<span className={styles.hoursNow} style={{ left: `${(now / 24) * 100}%` }} /></span></>}
      <span />
      <span className={styles.hoursTicks}><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></span>
    </div>
    <p className={styles.srOnly}>Times shown in {officeLabel} time.</p>
  </section>;
}

export type { Office };
