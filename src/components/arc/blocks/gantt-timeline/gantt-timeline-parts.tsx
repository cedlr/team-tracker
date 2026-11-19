"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { Check, Users } from "lucide-react";
import { avatar, person } from "../../lib/media";
import type { PersonId } from "../../lib/media";
import { Avatar } from "../../avatar/avatar";
import { Badge } from "../../badge/badge";
import type { BadgeTone } from "../../badge/badge";
import { Popover, PopoverContent, PopoverTrigger } from "../../popover/popover";
import type { GanttLinkKind, GanttTeam, GanttTone } from "./gantt-timeline-data";
import type { GanttStatus } from "./gantt-timeline-model";
import { STATUS_LABEL, cx } from "./gantt-timeline-model";
import styles from "./gantt-timeline.module.css";

export const toneVar = (tone?: GanttTone) => ({ "--tone": tone ? `var(--tone-${tone})` : "var(--text-muted)" }) as CSSProperties;

/** Arc's Avatar at row size. The name is always written beside it or in the control's label, so it stays out of the accessibility tree. */
export function Face({ id, size = 20, className }: { id: PersonId; size?: number; className?: string }) {
  return <Avatar name={person(id).name} src={avatar(id)} size="sm" aria-hidden="true" className={cx(styles.face, className)} style={{ width: size, height: size }} />;
}

/** A team is marked by its own icon in its tone, never a coloured dot. */
export function TeamIcon({ team, size = 16 }: { team?: GanttTeam; size?: number }) {
  const Icon = team?.icon ?? Users;
  return <span className={styles.teamIcon} style={toneVar(team?.tone)} aria-hidden="true"><Icon size={size} strokeWidth={1.75} /></span>;
}

/** A milestone is a diamond, the same shape it has on the timeline. Reached ones go quiet, a conflict turns red. */
export function MilestoneGlyph({ status, tone }: { status: GanttStatus; tone?: GanttTone }) {
  return <svg width={16} height={16} viewBox="0 0 16 16" aria-hidden="true" className={styles.milestoneGlyph} data-status={status} style={toneVar(tone)}>
    <rect x="4" y="4" width="8" height="8" rx="1.5" transform="rotate(45 8 8)" />
  </svg>;
}

const STATUS_TONE: Record<GanttStatus, BadgeTone> = { done: "neutral", "on-track": "success", behind: "warning", conflict: "danger", upcoming: "neutral" };

/** Status as Arc's Badge with the ring icon, so colour is never the only signal. */
export function StatusBadge({ status, label }: { status: GanttStatus; label?: string }) {
  return <Badge size="sm" tone={STATUS_TONE[status]} icon={<StatusIcon status={status} size={13} />} className={styles.statusBadge}>{label ?? STATUS_LABEL[status]}</Badge>;
}

/* Brand marks are sample content, drawn inline. GitHub, Stripe, Apple and Google are Simple Icons paths (CC0); the Figma mark is its five shapes. */
export function LinkMark({ kind, size = 14 }: { kind: GanttLinkKind; size?: number }) {
  if (kind === "figma") return <svg width={size} height={size} viewBox="0 0 38 57" aria-hidden="true" className={styles.mark}>
    <path fill="#1ABCFE" d="M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0z" />
    <path fill="#0ACF83" d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0z" />
    <path fill="#FF7262" d="M19 0v19h9.5a9.5 9.5 0 1 0 0-19H19z" />
    <path fill="#F24E1E" d="M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5z" />
    <path fill="#A259FF" d="M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5z" />
  </svg>;
  if (kind === "github") return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={styles.mark} fill="currentColor">
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
  </svg>;
  if (kind === "stripe") return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={styles.mark} fill="#635BFF">
    <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z" />
  </svg>;
  if (kind === "apple") return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={styles.mark} fill="currentColor">
    <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
  </svg>;
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={styles.mark} fill="#4285F4">
    <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
  </svg>;
}

/** Status as a ring that fills: dashed before it starts, part filled while running, a check when done, a bang on a conflict. */
export function StatusIcon({ status, size = 14 }: { status: GanttStatus; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" className={styles.statusIcon} data-status={status}>
    {status === "done" ? <>
      <circle cx="8" cy="8" r="7" fill="currentColor" />
      <path d="M5 8.2 7 10.2 11 6" fill="none" stroke="var(--status-glyph)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </> : status === "conflict" ? <>
      <circle cx="8" cy="8" r="7" fill="currentColor" />
      <path d="M8 4.6v4.2" stroke="var(--status-glyph)" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="8" cy="11.2" r=".95" fill="var(--status-glyph)" />
    </> : <>
      <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray={status === "upcoming" ? "2.2 2.2" : undefined} />
      {status === "on-track" && <path d="M8 8V4.5a3.5 3.5 0 0 1 0 7z" fill="currentColor" />}
      {status === "behind" && <path d="M8 8V4.5a3.5 3.5 0 0 1 3.5 3.5z" fill="currentColor" />}
    </>}
  </svg>;
}

/* ------------------------------------------------------------------ Picker: a listbox inside Arc's Popover */

export interface PickerOption { id: string; label: string; icon?: ReactNode; hint?: string }

interface PickerProps {
  label: string;
  value: string;
  options: PickerOption[];
  onChange: (id: string) => void;
  className?: string;
  children: ReactNode;
  /** Lines the list up with the trigger's start edge (default) or its end edge. */
  align?: "start" | "end";
  disabled?: boolean;
}

/** Popover handles placement, outside presses, Escape and returning focus; the list inside moves its highlight instantly with the keys. */
export function Picker({ label, value, options, onChange, className, children, align = "start", disabled }: PickerProps) {
  const uid = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const hinted = options.some(option => option.hint);
  const current = Math.max(0, options.findIndex(option => option.id === value));
  const toggle = (next: boolean) => { if (next) setActive(current); setOpen(next); };
  const choose = (index: number) => { const option = options[index]; if (option) onChange(option.id); setOpen(false); };
  const onKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowDown") { event.preventDefault(); setActive(index => Math.min(options.length - 1, index + 1)); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setActive(index => Math.max(0, index - 1)); }
    else if (event.key === "Home") { event.preventDefault(); setActive(0); }
    else if (event.key === "End") { event.preventDefault(); setActive(options.length - 1); }
    else if (event.key === "Enter" || event.key === " ") { event.preventDefault(); choose(active); }
    // The popover closes itself; marking the event keeps the screen from also closing the details panel.
    else if (event.key === "Escape") event.preventDefault();
  };
  return <Popover open={open} onOpenChange={toggle}>
    <PopoverTrigger className={className} aria-haspopup="listbox" aria-label={label} disabled={disabled}
      onKeyDown={event => { if (event.key === "ArrowDown" && !open) { event.preventDefault(); toggle(true); } }}>
      {children}
    </PopoverTrigger>
    <PopoverContent align={align} className={styles.picker} style={{ width: hinted ? 268 : 208 }}
      onOpenAutoFocus={event => { event.preventDefault(); listRef.current?.focus({ preventScroll: true }); }}>
      <div ref={listRef} role="listbox" tabIndex={-1} aria-label={label} aria-activedescendant={`${uid}-${active}`} className={styles.pickerList} onKeyDown={onKey}>
        {options.map((option, index) => <div key={option.id} id={`${uid}-${index}`} role="option" aria-selected={option.id === value} className={styles.pickerOption} data-active={index === active || undefined}
          onPointerMove={() => { if (active !== index) setActive(index); }} onClick={() => choose(index)}>
          {option.icon}
          <span className={styles.pickerLabel}>{option.label}</span>
          {option.hint && <span className={styles.pickerHint}>{option.hint}</span>}
          <span className={styles.pickerCheck}>{option.id === value && <Check size={14} strokeWidth={2} aria-hidden="true" />}</span>
        </div>)}
      </div>
    </PopoverContent>
  </Popover>;
}

/** Copies a URL and answers in place: the icon swaps, the width never changes. */
export function useCopy() {
  const [copied, setCopied] = useState<{ key: string; ok: boolean } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const copy = async (key: string, text: string) => {
    let ok = true;
    try { await navigator.clipboard.writeText(text); } catch { ok = false; }
    setCopied({ key, ok });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(null), 1600);
  };
  return { copied, copy };
}
