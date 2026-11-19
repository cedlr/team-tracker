"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CalendarDays, CircleDashed, Clock3, Mail, Moon, Network, Undo2, UserPlus, UserRound, Users, X } from "lucide-react";
import { ScreenShell, ScreenShellButton, ScreenShellMark, useScreenShell } from "../../screen-shell/screen-shell";
import type { ScreenShellSection } from "../../screen-shell/screen-shell";
import { Button } from "../../button/button";
import { Input } from "../../input/input";
import { Kbd } from "../../kbd/kbd";
import { Popover, PopoverContent, PopoverTrigger } from "../../popover/popover";
import { SearchField } from "../../search-field/search-field";
import SegmentedControl from "../../segmented-control/segmented-control";
import { motionTokens } from "../../lib/motion-tokens";
import { directoryNow, directoryPeople, directoryTimeOff, offices as sampleOffices, teams, viewerId as defaultViewerId } from "./team-directory-data";
import type { DirectoryPerson, Office, Team, TimeOffRequest } from "./team-directory-data";
import { DayPhase, DirectoryClockProvider, Picker, PickerChevron, StatusLabel, TeamIcon, clock, cx, instant, localMinutes, statusOf } from "./team-directory-parts";
import type { DirectoryOffice } from "./team-directory-parts";
import type { PersonStatus, StatusKind } from "./team-directory-parts";
import { OrgChart, PeopleGrid, PeopleList, ProfilePanel, TimeOffPage } from "./team-directory-pages";
import type { PeopleGroup, SortKey, SortState } from "./team-directory-pages";
import styles from "./team-directory.module.css";

export type { DirectoryPerson, Office, StatusOverride, Team, TimeOffRequest } from "./team-directory-data";
export { directoryPeople, directoryTimeOff } from "./team-directory-data";

export type TeamDirectoryPage = "people" | "org" | "timeoff";
export type TeamDirectoryView = "grid" | "list";

export interface TeamDirectoryProps {
  /** Called when a person is chosen in the grid, the list, the org chart or the profile. */
  onPersonSelect?: (person: { id: string; name: string; team: Team }) => void;
  /** The people in the directory. Defaults to the 16 person sample studio. */
  people?: DirectoryPerson[];
  /** Time off requests: pending ones wait on the Time off page, approved ones mark people out. */
  timeOff?: TimeOffRequest[];
  /** The person viewing the directory: working hour overlap is measured against them and they appear in the account menu. */
  viewerId?: string;
  /** The workspace name in the switcher and the trail. Default "Saltmarsh". */
  workspaceName?: string;
  /** Grid of cards grouped by team, or a sortable table. Default "grid". */
  defaultView?: TeamDirectoryView;
  /** The page that opens first. Default "people". */
  defaultPage?: TeamDirectoryPage;
  /** The person the keyboard starts on, and whose profile opens first when defaultProfileOpen is set. */
  defaultSelectedId?: string;
  /** Opens the profile panel on load. Default false: the people page has the room, and the profile opens on demand. */
  defaultProfileOpen?: boolean;
  /** Called when an invite is sent from the Invite form. */
  onInvite?: (invite: { email: string; team: Team }) => void;
  /** Called when someone's manager changes, by dragging in the org chart or from the profile. */
  onManagerChange?: (personId: string, managerId: string) => void;
  /** Called when a time off request is approved or declined. */
  onTimeOffDecision?: (requestId: string, decision: "approve" | "decline") => void;
  /** team-tracker: epoch ms for clocks and the time-off strip. Defaults to the sample studio's fixed moment. */
  now?: number;
  /** team-tracker: time zone used to place "today" on the time-off strip. */
  timeZone?: string;
  /** team-tracker: offices to show clocks for. Defaults to the sample offices. */
  offices?: DirectoryOffice[];
  className?: string;
}

type ShellApi = ReturnType<typeof useScreenShell>;
type StatusFilter = "any" | StatusKind;
interface Invite { id: string; email: string; team: Team }
interface Notice { id: number; text: string; undo?: () => void }

const statusOptions: { value: StatusFilter; label: string }[] = [
  { value: "any", label: "Anyone" },
  { value: "available", label: "Available" },
  { value: "meeting", label: "In a meeting" },
  { value: "offline", label: "Offline" },
  { value: "out", label: "Out of office" },
  { value: "joining", label: "Starting soon" },
];

const statusGlyph: Record<StatusFilter, StatusKind | null> = { any: null, available: "available", meeting: "meeting", offline: "offline", out: "out", joining: "joining" };
const sampleStatus = (kind: StatusKind): PersonStatus => ({ kind, label: "" });
/** Someone counts as working now when they are inside their hours and not out. */
const isWorking = (status: PersonStatus) => status.kind === "available" || status.kind === "meeting";

/** Mirrors the shell's controls into a ref, so handlers outside the shell can close the sidebar sheet. */
function ShellBridge({ apiRef }: { apiRef: MutableRefObject<ShellApi | null> }) {
  const shell = useScreenShell();
  useEffect(() => { apiRef.current = shell; });
  return null;
}

/**
 * A people directory for a whole company, inside the Arc screen shell: offices with their local time, team groups of people cards
 * or a sortable table, an org chart you can rearrange by dragging, a time off page with approvals, and a profile panel with
 * working hour overlap, reporting line, contact and a quick message.
 */
export function TeamDirectory({
  onPersonSelect, people: peopleProp = directoryPeople, timeOff: timeOffProp = directoryTimeOff, viewerId = defaultViewerId, workspaceName = "Saltmarsh",
  defaultView = "grid", defaultPage = "people", defaultSelectedId = "marcus-johnson", defaultProfileOpen = false, onInvite, onManagerChange, onTimeOffDecision,
  now = directoryNow, timeZone = "UTC", offices = sampleOffices, className,
}: TeamDirectoryProps) {
  const uid = useId();
  const reduce = useReducedMotion() ?? false;
  const shellApi = useRef<ShellApi | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const [people, setPeople] = useState(peopleProp);
  const [requests, setRequests] = useState(timeOffProp);
  const [navActive, setNavActive] = useState<string>(defaultPage);
  const [selectedId, setSelectedId] = useState(() => peopleProp.some(person => person.id === defaultSelectedId) ? defaultSelectedId : peopleProp[0]?.id ?? "");
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set(["nathan-cole", "jasmine-brooks"].filter(id => peopleProp.some(person => person.id === id))));
  const [view, setView] = useState<TeamDirectoryView>(defaultView);
  const [query, setQuery] = useState("");
  const [office, setOffice] = useState<Office | "all">("all");
  const [teamFilter, setTeamFilter] = useState<Team | "all">("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("any");
  const [panelOpen, setPanelOpen] = useState(defaultProfileOpen);
  const [sort, setSort] = useState<SortState>({ key: "name", dir: 1 });
  const [viewerAway, setViewerAway] = useState(false);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const page: TeamDirectoryPage = navActive === "org" ? "org" : navActive === "timeoff" ? "timeoff" : "people";
  /* Each page starts at its top: the shell keeps one scroll container for all of them. */
  const pageRef = useRef<HTMLDivElement>(null);
  useEffect(() => { pageRef.current?.parentElement?.closest<HTMLElement>("[data-padding]")?.scrollTo({ top: 0 }); }, [page]);
  const viewer = people.find(person => person.id === viewerId) ?? people[0];
  const selected = people.find(person => person.id === selectedId) ?? people[0];
  const statusFor = useCallback((person: DirectoryPerson) => statusOf(person, viewerAway, viewer.id, now), [viewerAway, viewer.id, now]);

  /* Notices sit in the header and leave on their own. */
  const noticeId = useRef(0);
  const notify = useCallback((text: string, undo?: () => void) => setNotice({ id: ++noticeId.current, text, undo }), []);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 5200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  /* "/" focuses the search, the way most directories do. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=true]")) return;
      if (!searchRef.current) return;
      event.preventDefault();
      searchRef.current.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const select = useCallback((id: string) => {
    setSelectedId(id);
    setNavActive(active => active.startsWith("fav:") ? "people" : active);
    const person = people.find(entry => entry.id === id);
    if (person) onPersonSelect?.({ id: person.id, name: person.name, team: person.team });
  }, [people, onPersonSelect]);
  const openPanel = useCallback(() => setPanelOpen(true), []);

  const changeManager = useCallback((personId: string, managerId: string) => {
    const before = people;
    const person = people.find(entry => entry.id === personId);
    const manager = people.find(entry => entry.id === managerId);
    if (!person || !manager || person.managerId === managerId) return;
    const team = manager.managerId ? manager.team : person.team;
    setPeople(list => list.map(entry => entry.id === personId ? { ...entry, managerId, team } : entry));
    onManagerChange?.(personId, managerId);
    notify(`${person.name.split(" ")[0]} now reports to ${manager.name.split(" ")[0]}`, () => setPeople(before));
  }, [people, onManagerChange, notify]);

  const decide = useCallback((id: string, decision: "approve" | "decline") => {
    const before = requests;
    const request = requests.find(entry => entry.id === id);
    const person = people.find(entry => entry.id === request?.personId);
    if (!request || !person) return;
    setRequests(list => decision === "approve" ? list.map(entry => entry.id === id ? { ...entry, status: "approved" } : entry) : list.filter(entry => entry.id !== id));
    onTimeOffDecision?.(id, decision);
    notify(`${decision === "approve" ? "Approved" : "Declined"} ${person.name.split(" ")[0]}'s ${request.kind.toLowerCase()}`, () => setRequests(before));
  }, [requests, people, onTimeOffDecision, notify]);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  /* Filtering */
  const needle = query.trim().toLowerCase();
  const filtered = useMemo(() => people.filter(person => {
    if (teamFilter !== "all" && person.team !== teamFilter) return false;
    if (office !== "all" && person.office !== office) return false;
    if (statusFilter !== "any" && statusFor(person).kind !== statusFilter) return false;
    if (!needle) return true;
    return [person.name, person.role, person.team, person.office, person.city ?? "", person.email, ...person.skills].join(" ").toLowerCase().includes(needle);
  }), [people, teamFilter, office, statusFilter, needle, statusFor]);

  const groups: PeopleGroup[] = useMemo(() => teams.map(team => {
    const members = filtered.filter(person => person.team === team.id);
    const isLead = (person: DirectoryPerson) => { const manager = people.find(entry => entry.id === person.managerId); return !manager || manager.team !== person.team; };
    members.sort((a, b) => Number(isLead(b)) - Number(isLead(a)) || a.name.localeCompare(b.name));
    return { team: team.id, people: members };
  }).filter(group => group.people.length > 0), [filtered, people]);

  const sorted = useMemo(() => {
    const value = (person: DirectoryPerson) => sort.key === "name" ? person.name : sort.key === "team" ? person.team : sort.key === "office" ? person.office : person.started;
    return [...filtered].sort((a, b) => value(a).localeCompare(value(b)) * sort.dir || a.name.localeCompare(b.name));
  }, [filtered, sort]);

  const filtersOn = Boolean(needle) || office !== "all" || teamFilter !== "all" || statusFilter !== "any";
  const clearFilters = () => { setQuery(""); setOffice("all"); setTeamFilter("all"); setStatusFilter("any"); };
  const managerName = useCallback((id?: string) => people.find(person => person.id === id)?.name ?? "No one", [people]);
  const pendingCount = requests.filter(request => request.status === "pending").length;

  /* ⌘K in the sidebar and / anywhere both land in the people search, on the People page. */
  const focusSearch = useCallback(() => {
    shellApi.current?.closeSidebar();
    setNavActive(active => active === "org" || active === "timeoff" ? "people" : active);
    requestAnimationFrame(() => searchRef.current?.focus());
  }, []);
  const pickOffice = useCallback((id: Office) => {
    if (shellApi.current?.compact) shellApi.current.closeSidebar();
    setOffice(current => current === id ? "all" : id);
    setNavActive(active => active === "org" || active === "timeoff" ? "people" : active);
  }, []);

  /* Shell: main nav, the office clocks and starred people. Teams are a filter on the page, not a second list here. */
  const nav = [
    { id: "people", label: "People", icon: Users, count: people.length },
    { id: "org", label: "Org chart", icon: Network },
    { id: "timeoff", label: "Time off", icon: CalendarDays, count: pendingCount || undefined },
  ];
  const sections: ScreenShellSection[] = [
    { id: "offices", label: "Offices", icon: Clock3, items: [], content: <OfficeClocks people={people} offices={offices} now={now} statusFor={statusFor} active={page === "people" ? office : "all"} onPick={pickOffice} /> },
  ];
  const favoritePeople = people.filter(person => favorites.has(person.id));
  if (favoritePeople.length) sections.push({ id: "favorites", label: "Favorites", items: favoritePeople.map(person => ({ id: `fav:${person.id}`, label: person.name, avatar: person.photo })) });

  const onNavigate = (id: string) => {
    if (id.startsWith("fav:")) {
      const personId = id.slice(4);
      setNavActive(id);
      setSelectedId(personId);
      const person = people.find(entry => entry.id === personId);
      if (person) onPersonSelect?.({ id: person.id, name: person.name, team: person.team });
      requestAnimationFrame(openPanel);
      return;
    }
    setNavActive(id);
  };

  const title = page === "org" ? "Org chart" : page === "timeoff" ? "Time off" : "People";
  const meta = page === "org" ? `${teams.length} teams, ${people.length} people` : page === "timeoff" ? (pendingCount ? `${pendingCount} waiting for you` : "All caught up")
    : filtersOn ? `${filtered.length} of ${people.length}` : `${people.length} people in ${offices.length} offices`;
  const teamOptions = [{ value: "all" as const, label: "All teams", icon: <Users size={16} strokeWidth={1.75} />, hint: String(people.length) },
    ...teams.map(team => ({ value: team.id, label: team.id, icon: <TeamIcon team={team.id} />, hint: String(people.filter(person => person.team === team.id).length) }))];
  const statusPickerOptions = statusOptions.map(option => {
    const kind = statusGlyph[option.value];
    return { value: option.value, label: option.label, icon: kind ? <StatusLabel status={sampleStatus(kind)} className={styles.glyphOnly} /> : <CircleDashed size={16} strokeWidth={1.75} />,
      hint: option.value === "any" ? undefined : String(people.filter(person => statusFor(person).kind === option.value).length) };
  });

  const header = {
    breadcrumbs: [{ id: "ws", label: workspaceName }],
    title,
    meta,
    actions: <>
      <NoticeChip notice={notice} onDone={() => setNotice(null)} reduce={reduce} />
      <InviteButton open={inviteOpen} onOpenChange={setInviteOpen} defaultTeam={teamFilter === "all" ? selected.team : teamFilter} workspaceName={workspaceName}
        onSend={(email, team) => {
          const invite = { id: `inv-${Date.now()}`, email, team };
          setInvites(list => [...list, invite]);
          onInvite?.({ email, team });
          notify(`Invite sent to ${email}`, () => setInvites(list => list.filter(entry => entry.id !== invite.id)));
        }} />
    </>,
    below: page === "people" ? <div className={styles.filters}>
      <div className={styles.search} data-filled={query ? "" : undefined}>
        <SearchField ref={searchRef} label="Search people" value={query} placeholder="Search people, roles, skills" aria-keyshortcuts="/" autoComplete="off" spellCheck={false}
          onValueChange={setQuery}
          onKeyDown={event => {
            if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); if (query) setQuery(""); else event.currentTarget.blur(); }
            if (event.key === "ArrowDown" || event.key === "Enter") {
              const first = document.querySelector<HTMLElement>(`[data-td-root="${uid}"] [data-person][tabindex="0"]`);
              if (first) { event.preventDefault(); first.focus(); if (first.dataset.person) setSelectedId(first.dataset.person); }
            }
          }} />
        <Kbd size="sm" className={styles.searchKey} aria-hidden="true">/</Kbd>
      </div>
      <Picker label="Team" value={teamFilter} options={teamOptions} onChange={setTeamFilter} className={styles.filterButton} active={teamFilter !== "all"}>
        {teamFilter === "all" ? <Users size={16} strokeWidth={1.75} aria-hidden="true" /> : <TeamIcon team={teamFilter} />}
        <span>{teamFilter === "all" ? "Team" : teamFilter}</span><PickerChevron />
      </Picker>
      <Picker label="Status" value={statusFilter} options={statusPickerOptions} onChange={setStatusFilter} className={styles.filterButton} active={statusFilter !== "any"}>
        {statusGlyph[statusFilter] ? <StatusLabel status={sampleStatus(statusGlyph[statusFilter]!)} className={styles.glyphOnly} /> : <CircleDashed size={16} strokeWidth={1.75} aria-hidden="true" />}
        <span>{statusFilter === "any" ? "Status" : statusOptions.find(option => option.value === statusFilter)?.label}</span><PickerChevron />
      </Picker>
      {office !== "all" && <Button variant="secondary" size="sm" className={cx(styles.btn, styles.officeChip)} aria-label={`Office: ${office}. Remove filter`} onClick={() => setOffice("all")}>
        <DayPhase minutes={localMinutes(offices.find(entry => entry.id === office) ?? offices[0], now)} />{office}<X size={16} strokeWidth={1.75} aria-hidden="true" />
      </Button>}
      {filtersOn && <Button variant="ghost" size="sm" className={styles.btn} onClick={clearFilters}>Clear</Button>}
      <SegmentedControl className={styles.segmented} label="Layout" value={view} onValueChange={value => setView(value as TeamDirectoryView)}
        options={[{ value: "grid", label: "Grid" }, { value: "list", label: "List" }]} />
    </div> : undefined,
  };

  return <DirectoryClockProvider value={{ now, timeZone, offices }}><div className={cx(styles.root, className)} data-td-root={uid}>
    <ScreenShell
      className={styles.shell}
      aria-label={workspaceName}
      workspace={{
        name: workspaceName,
        options: [
          { id: "main", name: workspaceName, detail: `${people.length} people, Business plan`, mark: <ScreenShellMark name={workspaceName} variant="seed" tone="teal" size={24} /> },
          { id: "labs", name: `${workspaceName} Labs`, detail: "4 people, Starter plan", mark: <ScreenShellMark name={`${workspaceName} Labs`} variant="wedge" tone="amber" size={24} /> },
        ],
        actions: [{ id: "invite", label: "Invite people", icon: UserPlus, onSelect: () => setInviteOpen(true) }],
      }}
      nav={nav}
      sections={sections}
      activeId={navActive}
      onNavigate={onNavigate}
      search={{ placeholder: "Find a person", onOpen: focusSearch }}
      account={{
        name: viewer.name, detail: viewer.email, avatar: viewer.photo,
        menu: [
          { id: "profile", label: "Your profile", icon: UserRound, onSelect: () => { select(viewer.id); requestAnimationFrame(openPanel); } },
          { id: "away", label: "Appear away", icon: Moon, checked: viewerAway, onSelect: () => setViewerAway(value => !value) },
        ],
      }}
      header={header}
      rightPanel={{
        label: "Profile",
        open: panelOpen,
        onOpenChange: setPanelOpen,
        defaultWidth: 344,
        minWidth: 300,
        maxWidth: 480,
        content: selected && <ProfilePanel person={selected} people={people} viewer={viewer} viewerAway={viewerAway} favorite={favorites.has(selected.id)} timeOff={requests}
          onToggleFavorite={() => toggleFavorite(selected.id)} onSelect={select} onManagerChange={changeManager} />,
      }}
    >
      <ShellBridge apiRef={shellApi} />
      <div ref={pageRef} className={styles.page}>
      {page === "people" && <div className={styles.peoplePage}>
        {filtered.length === 0
          ? <div className={styles.empty}>
            <p className={styles.emptyTitle}>No one matches{needle ? ` "${query.trim()}"` : " these filters"}</p>
            <p className={styles.muted}>Try another team, office or status, or search by skill.</p>
            <Button variant="secondary" size="sm" className={styles.btn} onClick={clearFilters}>Clear filters</Button>
          </div>
          : view === "grid"
            ? <PeopleGrid groups={groups} selectedId={selected.id} showSelection={panelOpen} favorites={favorites} statusFor={statusFor} onSelect={select} onOpen={openPanel} />
            : <PeopleList people={sorted} selectedId={selected.id} showSelection={panelOpen} favorites={favorites} statusFor={statusFor} onSelect={select} onOpen={openPanel} managerName={managerName}
              sort={sort} onSort={(key: SortKey) => setSort(current => current.key === key ? { key, dir: current.dir === 1 ? -1 : 1 } : { key, dir: 1 })} />}

        {invites.length > 0 && <section className={styles.group} aria-labelledby={`${uid}-invites`}>
          <h3 className={styles.groupHead} id={`${uid}-invites`}>Pending invites<span className={styles.groupCount}>{invites.length}</span></h3>
          <ul className={styles.invites}>
            <AnimatePresence initial={false}>
              {invites.map(invite => <motion.li key={invite.id} className={styles.invite} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: reduce ? instant : { duration: motionTokens.duration.exit } }} transition={reduce ? instant : { duration: motionTokens.duration.standard }}>
                <span className={styles.inviteFace} aria-hidden="true"><Mail size={16} strokeWidth={1.75} /></span>
                <span className={styles.rowText}><span className={styles.rowName}>{invite.email}</span><span className={styles.rowRole}>{invite.team}, sent just now</span></span>
                <Button variant="ghost" size="sm" className={styles.btn} onClick={() => { setInvites(list => list.filter(entry => entry.id !== invite.id)); notify(`Revoked the invite to ${invite.email}`); }}>Revoke</Button>
              </motion.li>)}
            </AnimatePresence>
          </ul>
        </section>}
      </div>}

      {page === "org" && <OrgChart people={people} selectedId={selected.id} showSelection={panelOpen} onSelect={select} onOpen={openPanel} onManagerChange={changeManager} />}
      {page === "timeoff" && <TimeOffPage requests={requests} people={people} onDecide={decide} onSelect={select} onOpen={openPanel} />}
      </div>
    </ScreenShell>
  </div></DirectoryClockProvider>;
}

/* ------------------------------------------------------------------ Sidebar: office clocks */

/**
 * Every office with its local time, the sun or moon over it and how many people there are working right now. A row filters the
 * People page to that office; pressing it again clears the filter. The chosen row takes a calm full fill in place.
 */
function OfficeClocks({ people, offices, now, statusFor, active, onPick }: {
  people: DirectoryPerson[]; offices: DirectoryOffice[]; now: number; statusFor: (person: DirectoryPerson) => PersonStatus; active: Office | "all"; onPick: (office: Office) => void;
}) {
  return <ul className={styles.clocks}>
    {offices.map(office => {
      const here = people.filter(person => person.office === office.id);
      const working = here.filter(person => isWorking(statusFor(person))).length;
      const minutes = localMinutes(office, now);
      return <li key={office.id}>
        <button type="button" className={styles.clock} aria-pressed={active === office.id} onClick={() => onPick(office.id)}
          aria-label={`${office.label}, ${clock(minutes)} local time, ${working} of ${here.length} working now`}>
          <DayPhase minutes={minutes} />
          <span className={styles.clockText}>
            <span className={styles.clockName}>{office.label}</span>
            <span className={styles.clockMeta}>{working} of {here.length} working now</span>
          </span>
          <span className={styles.clockTime}>{clock(minutes)}</span>
        </button>
      </li>;
    })}
  </ul>;
}

/* ------------------------------------------------------------------ Header parts */

function NoticeChip({ notice, onDone, reduce }: { notice: Notice | null; onDone: () => void; reduce: boolean }) {
  return <span className={styles.noticeSlot} aria-live="polite">
    <AnimatePresence mode="popLayout" initial={false}>
      {notice && <motion.span key={notice.id} className={styles.notice}
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: reduce ? instant : { duration: motionTokens.duration.exit } }}
        transition={reduce ? instant : { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] }}>
        <span className={styles.noticeText} title={notice.text}>{notice.text}</span>
        {notice.undo && <Button variant="ghost" size="sm" className={styles.noticeUndo} onClick={() => { notice.undo?.(); onDone(); }}><Undo2 size={16} strokeWidth={1.75} aria-hidden="true" />Undo</Button>}
      </motion.span>}
    </AnimatePresence>
  </span>;
}

/** The Invite button opens a small form in Arc's Popover: a work email and a team, checked before it sends. */
function InviteButton({ open, onOpenChange, onSend, defaultTeam, workspaceName }: { open: boolean; onOpenChange: (open: boolean) => void; onSend: (email: string, team: Team) => void; defaultTeam: Team; workspaceName: string }) {
  const emailRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [team, setTeam] = useState<Team>(defaultTeam);
  const [error, setError] = useState<string | undefined>();

  /* Reset the form each time it opens. Adjusting state during render, not in an effect. */
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) { setWasOpen(open); if (open) { setEmail(""); setError(undefined); setTeam(defaultTeam); } }

  const submit = () => {
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) { setError("Enter a work email, like name@company.com"); emailRef.current?.focus(); return; }
    onSend(value, team);
    onOpenChange(false);
  };
  const domain = workspaceName.toLowerCase().replace(/[^a-z0-9]/g, "") || "company";

  return <Popover open={open} onOpenChange={onOpenChange}>
    <PopoverTrigger asChild>
      <ScreenShellButton variant="primary" icon={UserPlus}>Invite</ScreenShellButton>
    </PopoverTrigger>
    <PopoverContent align="end" className={styles.invitePop} aria-label="Invite someone"
      onOpenAutoFocus={event => { event.preventDefault(); emailRef.current?.focus({ preventScroll: true }); }}>
      <form className={styles.inviteForm} noValidate onSubmit={event => { event.preventDefault(); submit(); }}>
        <p className={styles.popTitle}>Invite someone to {workspaceName}</p>
        <Input ref={emailRef} label="Work email" type="email" value={email} placeholder={`name@${domain}.co`} autoComplete="off" error={error}
          onChange={event => { setEmail(event.target.value); setError(undefined); }} />
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Team</span>
          <Picker label="Team" value={team} options={teams.map(entry => ({ value: entry.id, label: entry.id, icon: <TeamIcon team={entry.id} /> }))} onChange={setTeam} className={styles.selectButton}>
            <TeamIcon team={team} /><span className={styles.ellipsis}>{team}</span><PickerChevron />
          </Picker>
        </div>
        <div className={styles.popActions}>
          <Button type="button" variant="ghost" size="sm" className={styles.btn} onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" variant="primary" size="sm" className={styles.btn}>Send invite</Button>
        </div>
      </form>
    </PopoverContent>
  </Popover>;
}

export default TeamDirectory;
