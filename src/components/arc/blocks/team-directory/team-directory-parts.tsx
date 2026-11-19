"use client";

import { createContext, useContext, useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import type { Transition } from "motion/react";
import { Briefcase, CalendarClock, Check, ChevronDown, CircleCheck, Code, Hourglass, Megaphone, Moon, PenTool, Plane, Sun, Sunrise, Sunset } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Avatar } from "../../avatar/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "../../popover/popover";
import { directoryNow, offices as sampleOffices, teams } from "./team-directory-data";
import type { DirectoryPerson, Team, Tone } from "./team-directory-data";
import styles from "./team-directory.module.css";

export const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");
export const instant: Transition = { duration: 0 };

/* ------------------------------------------------------------------ Time and status */

const DAY = 1440;

export interface DirectoryOffice { id: string; utcOffset: number; label: string }
interface DirectoryClock { now: number; timeZone: string; offices: DirectoryOffice[] }
const ClockContext = createContext<DirectoryClock>({ now: directoryNow, timeZone: "UTC", offices: sampleOffices });
/** team-tracker: the real clock and the offices that actually have people. Defaults keep the sample studio fixed. */
export function DirectoryClockProvider({ value, children }: { value: DirectoryClock; children: ReactNode }) {
  return <ClockContext.Provider value={value}>{children}</ClockContext.Provider>;
}
export function useDirectoryClock() { return useContext(ClockContext); }

/** UTC day index of a timestamp's calendar date in a time zone. */
export function calendarDay(now: number, timeZone: string) {
  const iso = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(now));
  const [year, month, date] = iso.split("-").map(Number);
  return Math.round(Date.UTC(year, month - 1, date) / 86400000);
}

/** Minutes past midnight in the person's local time. */
export function localMinutes(person: Pick<DirectoryPerson, "utcOffset">, now: number) {
  const nowMinutesUtc = Math.floor(now / 60000) % DAY;
  return (((nowMinutesUtc + person.utcOffset * 60) % DAY) + DAY) % DAY;
}

export const clock = (minutes: number) => `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(Math.round(minutes) % 60).padStart(2, "0")}`;

export type StatusKind = "available" | "meeting" | "out" | "offline" | "joining";
export interface PersonStatus { kind: StatusKind; label: string; /** A shorter label for cards and rows. */ short?: string }

export function statusOf(person: DirectoryPerson, viewerAway = false, viewerId?: string, now = directoryNow): PersonStatus {
  if (viewerAway && person.id === viewerId) return { kind: "offline", label: "Away" };
  const override = person.status;
  if (override?.kind === "joining") return { kind: "joining", label: `Starts ${override.on}` };
  if (override?.kind === "out") return { kind: "out", label: `Out until ${override.until}` };
  const local = localMinutes(person, now);
  const [start, end] = person.hours;
  if (local < start * 60 || local >= end * 60) return { kind: "offline", label: local < start * 60 ? `Online at ${clock(start * 60)}` : "Offline" };
  if (override?.kind === "meeting") return { kind: "meeting", label: `In a meeting until ${override.until}`, short: `Busy until ${override.until}` };
  return { kind: "available", label: "Available" };
}

/** Hours of working time two people share today. */
export function overlapHours(a: DirectoryPerson, b: DirectoryPerson) {
  const start = Math.max(a.hours[0] - a.utcOffset, b.hours[0] - b.utcOffset);
  const end = Math.min(a.hours[1] - a.utcOffset, b.hours[1] - b.utcOffset);
  return Math.max(0, end - start);
}

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function parseDate(iso: string) { const [y, m, d] = iso.split("-").map(Number); return { y, m: m - 1, d }; }
export function shortDate(iso: string) { const { m, d } = parseDate(iso); return `${months[m]} ${d}`; }
export function longDate(iso: string) { const { y, m, d } = parseDate(iso); return `${months[m]} ${d}, ${y}`; }
export function dayIndex(iso: string) { const { y, m, d } = parseDate(iso); return Math.round(Date.UTC(y, m, d) / 86400000); }
export function dateRange(from: string, to: string) {
  if (from === to) return shortDate(from);
  const a = parseDate(from), b = parseDate(to);
  return a.m === b.m && a.y === b.y ? `${months[a.m]} ${a.d} to ${b.d}` : `${shortDate(from)} to ${shortDate(to)}`;
}
export function tenure(iso: string, nowMs = directoryNow) {
  const { y, m, d } = parseDate(iso);
  const now = new Date(nowMs);
  let total = (now.getUTCFullYear() - y) * 12 + now.getUTCMonth() - m - (now.getUTCDate() < d ? 1 : 0);
  if (total < 0) return "Not started yet";
  if (total < 1) return "New this month";
  const years = Math.floor(total / 12); total -= years * 12;
  const parts = [years ? `${years} ${years === 1 ? "year" : "years"}` : "", total ? `${total} ${total === 1 ? "month" : "months"}` : ""].filter(Boolean);
  return parts.join(", ");
}

export const toneOf = (team: Team): Tone => teams.find(entry => entry.id === team)?.tone ?? "sky";
export const toneVar = (tone: Tone) => `var(--tone-${tone})`;

/* ------------------------------------------------------------------ Glyphs: every team and status reads as an icon, never a coloured dot */

const teamIcons: Record<Team, LucideIcon> = { Engineering: Code, Design: PenTool, "Go-to-market": Megaphone, Operations: Briefcase };

/** The team's own icon in its categorical tone. */
export function TeamIcon({ team, size = 16 }: { team: Team; size?: number }) {
  const Icon = teamIcons[team] ?? Briefcase;
  return <Icon size={size} strokeWidth={1.75} className={styles.teamIcon} style={{ "--td-tone": toneVar(toneOf(team)) } as CSSProperties} aria-hidden="true" />;
}

const statusIcons: Record<StatusKind, LucideIcon> = { available: CircleCheck, meeting: CalendarClock, out: Plane, offline: Moon, joining: Hourglass };

/** A status as a word with its own glyph: a check when free, a calendar clock in a meeting, a plane when out, a moon after hours. */
export function StatusLabel({ status, className, short }: { status: PersonStatus; className?: string; short?: boolean }) {
  const text = short && status.short ? status.short : status.label;
  const Icon = statusIcons[status.kind];
  return <span className={cx(styles.status, className)} data-status={status.kind} title={text !== status.label ? status.label : undefined}>
    <Icon size={14} strokeWidth={1.75} className={styles.statusIcon} aria-hidden="true" /><span className={styles.statusText}>{text}</span>
  </span>;
}

/** Where the sun is for an office right now: the glyph beside each office clock. */
export function DayPhase({ minutes, size = 16 }: { minutes: number; size?: number }) {
  const hour = minutes / 60;
  const Icon = hour >= 6 && hour < 9 ? Sunrise : hour >= 9 && hour < 17 ? Sun : hour >= 17 && hour < 21 ? Sunset : Moon;
  return <Icon size={size} strokeWidth={1.75} className={styles.dayPhase} data-phase={Icon === Sun ? "day" : Icon === Moon ? "night" : "edge"} aria-hidden="true" />;
}

/* ------------------------------------------------------------------ Faces: Arc's Avatar, at the size each surface needs */

const avatarSize = (size: number) => size >= 48 ? "lg" : size >= 36 ? "md" : "sm";

/** Arc's Avatar with the seeded gradient photo. Sizes between Arc's steps (20 and 24px) keep the small avatar and set its box. */
export function Face({ person, size = 32 }: { person: Pick<DirectoryPerson, "photo" | "name">; size?: number }) {
  const step = avatarSize(size);
  const exact = size === 28 || size === 36 || size === 48;
  return <Avatar name={person.name} src={person.photo} size={step} className={styles.face} style={exact ? undefined : { width: size, height: size }} aria-hidden="true" />;
}

/** Marks a scroller's cut edges with data-fade-top and data-fade-bottom so CSS can fade them. */
export function useEdgeFade<T extends HTMLElement>(axis: "y" | "x" = "y", key?: unknown) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => {
      if (axis === "y") {
        element.toggleAttribute("data-fade-top", element.scrollTop > 1);
        element.toggleAttribute("data-fade-bottom", element.scrollTop + element.clientHeight < element.scrollHeight - 1);
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
  }, [axis, key]);
  return ref;
}

/* ------------------------------------------------------------------ Picker: a listbox in Arc's Popover */

export interface PickerOption<T extends string> { value: T; label: string; detail?: string; photo?: string; icon?: ReactNode; hint?: string }

/**
 * A trigger and a listbox inside Arc's Popover. The highlight follows the keyboard instantly and the pointer on hover; Enter or a
 * click chooses. Escape, an outside press and focus return belong to the popover. The trigger answers a press with colour only,
 * because it anchors the list.
 */
export function Picker<T extends string>({ label, value, options, onChange, children, className, align = "start", disabled, active }: {
  label: string; value: T; options: PickerOption<T>[]; onChange: (value: T) => void; children: ReactNode; className?: string;
  align?: "start" | "end"; disabled?: boolean; active?: boolean;
}) {
  const id = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);

  const onOpenChange = (next: boolean) => {
    if (next) setCursor(Math.max(0, options.findIndex(option => option.value === value)));
    setOpen(next);
  };
  const choose = (next: T) => { onChange(next); setOpen(false); };

  /* The list keeps the highlighted option in view and fades whichever edge cuts content off. */
  useEffect(() => {
    const list = listRef.current;
    if (!open || !list) return;
    list.querySelector<HTMLElement>(`#${CSS.escape(`${id}-${cursor}`)}`)?.scrollIntoView({ block: "nearest" });
    list.toggleAttribute("data-fade-top", list.scrollTop > 1);
    list.toggleAttribute("data-fade-bottom", list.scrollTop + list.clientHeight < list.scrollHeight - 1);
  }, [open, cursor, id]);

  const onKeyDown = (event: ReactKeyboardEvent) => {
    const last = options.length - 1;
    if (event.key === "ArrowDown") { event.preventDefault(); setCursor(index => Math.min(last, index + 1)); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setCursor(index => Math.max(0, index - 1)); }
    else if (event.key === "Home") { event.preventDefault(); setCursor(0); }
    else if (event.key === "End") { event.preventDefault(); setCursor(last); }
    else if (event.key === "Enter" || event.key === " ") { event.preventDefault(); const option = options[cursor]; if (option) choose(option.value); }
    else if (event.key === "Tab") setOpen(false);
  };

  return <Popover open={open} onOpenChange={onOpenChange}>
    <PopoverTrigger className={className} aria-haspopup="listbox" disabled={disabled} data-active={active || undefined}
      onKeyDown={event => { if (event.key === "ArrowDown" && !open) { event.preventDefault(); onOpenChange(true); } }}>
      {children}
    </PopoverTrigger>
    <PopoverContent ref={listRef} id={id} align={align} className={styles.menu} role="listbox" tabIndex={-1} aria-label={label}
      aria-activedescendant={`${id}-${cursor}`} onKeyDown={onKeyDown}
      onScroll={event => { const list = event.currentTarget; list.toggleAttribute("data-fade-top", list.scrollTop > 1); list.toggleAttribute("data-fade-bottom", list.scrollTop + list.clientHeight < list.scrollHeight - 1); }}
      onOpenAutoFocus={event => { event.preventDefault(); listRef.current?.focus({ preventScroll: true }); }}>
      {options.map((option, index) => {
        const selected = option.value === value;
        return <div key={option.value} id={`${id}-${index}`} role="option" aria-selected={selected} className={styles.option} data-cursor={index === cursor || undefined}
          onPointerMove={() => { if (cursor !== index) setCursor(index); }} onClick={() => choose(option.value)}>
          {option.photo ? <Face person={{ photo: option.photo, name: option.label }} size={20} /> : option.icon ? <span className={styles.optionIcon}>{option.icon}</span> : null}
          <span className={styles.optionText}><span>{option.label}</span>{option.detail && <span className={styles.optionDetail}>{option.detail}</span>}</span>
          {option.hint && <span className={styles.optionHint}>{option.hint}</span>}
          <Check size={16} strokeWidth={1.75} className={styles.optionCheck} data-on={selected || undefined} aria-hidden="true" />
        </div>;
      })}
    </PopoverContent>
  </Popover>;
}

export function PickerChevron() { return <ChevronDown size={16} strokeWidth={1.75} className={styles.chev} aria-hidden="true" />; }

/* ------------------------------------------------------------------ Brand marks (Simple Icons, CC0) */

export function GitHubMark({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" /></svg>;
}

export function LinkedInMark({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="#0A66C2" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>;
}

/** Slack's four colour mark, drawn simply. */
export function SlackMark({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#E01E5A" d="M5.04 15.17a2.53 2.53 0 1 1-2.52-2.53h2.52v2.53zm1.27 0a2.53 2.53 0 0 1 5.05 0v6.31a2.53 2.53 0 1 1-5.05 0v-6.31z" />
    <path fill="#36C5F0" d="M8.83 5.04a2.53 2.53 0 1 1 2.53-2.52v2.52H8.83zm0 1.27a2.53 2.53 0 0 1 0 5.05H2.52a2.53 2.53 0 0 1 0-5.05h6.31z" />
    <path fill="#2EB67D" d="M18.96 8.83a2.53 2.53 0 1 1 2.52 2.53h-2.52V8.83zm-1.27 0a2.53 2.53 0 0 1-5.05 0V2.52a2.53 2.53 0 1 1 5.05 0v6.31z" />
    <path fill="#ECB22E" d="M15.17 18.96a2.53 2.53 0 1 1-2.53 2.52v-2.52h2.53zm0-1.27a2.53 2.53 0 0 1 0-5.05h6.31a2.53 2.53 0 1 1 0 5.05h-6.31z" />
  </svg>;
}
