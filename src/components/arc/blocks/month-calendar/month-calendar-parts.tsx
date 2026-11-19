"use client";

import { createElement } from "react";
import type { CSSProperties } from "react";
import type { CalendarVideo } from "./month-calendar-data";
import type { CalendarKit } from "./month-calendar-utils";
import styles from "./month-calendar.module.css";

/*
 * Video call marks in the brands' own colours. Google Meet is the Simple Icons (CC0) path split into its six brand
 * pieces; the Zoom mark is drawn to the published app icon. They identify which service hosts a call and do not imply
 * an endorsement. Swap in your own assets if you ship this.
 */
export function VideoMark({ provider, size = 16 }: { provider: CalendarVideo["provider"]; size?: number }) {
  if (provider === "zoom") return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={styles.mark}>
    <rect width="24" height="24" rx="6.5" fill="#0B5CFF" />
    <rect x="4.6" y="7.6" width="10.4" height="8.8" rx="2.2" fill="#fff" />
    <path fill="#fff" d="m16.1 10.7 2.55-1.86c.42-.3.85-.08.85.44v5.44c0 .52-.43.74-.85.44l-2.55-1.86z" />
  </svg>;
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={styles.mark}>
    <path fill="#EA4335" d="M5.53 2.13 0 7.75h5.53z" />
    <path fill="#FFBA00" d="M5.928 2.13v5.62h7.608v3.65l5.47-4.45c-.014-1.22.031-2.25-.025-3.46-.148-1.09-1.287-1.47-2.236-1.36z" />
    <path fill="#00832D" d="M23.1 4.32c-.802.295-1.358.995-2.047 1.49-2.506 2.05-4.982 4.12-7.468 6.19 3.025 2.59 6.04 5.18 9.065 7.76 1.218.671 1.428-.814 1.328-1.64v-13a.828.828 0 0 0-.877-.825z" />
    <path fill="#2684FC" d="M.038 8.15v7.7h5.53v-7.7z" />
    <path fill="#00AC47" d="M13.615 16.25H6.008v5.62c3.864-.006 7.737.011 11.58-.009 1.02-.07 1.618-1.12 1.468-2.07v-2.51l-5.47-4.68v3.65z" />
    <path fill="#0066DA" d="M.038 16.25c.02 1.44-.041 2.88.033 4.31.162.948 1.158 1.43 2.047 1.31h3.464v-5.62z" />
  </svg>;
}

export const videoName: Record<CalendarVideo["provider"], string> = { zoom: "Zoom", meet: "Google Meet" };

/** A calendar's own icon in its colour: how the screen marks which calendar an event is on, instead of a coloured dot. */
export function CalendarGlyph({ kit, calendarId, size = 16, className }: { kit: CalendarKit; calendarId: string; size?: number; className?: string }) {
  const color = kit.calendar(calendarId)?.color ?? "var(--text-muted)";
  // The icon comes from the calendar's data, a stable component per calendar, so it is rendered by reference.
  return createElement(kit.iconOf(calendarId), { size, strokeWidth: 1.75, className: [styles.glyph, className].filter(Boolean).join(" "), style: { "--event": color } as CSSProperties, "aria-hidden": "true" });
}
