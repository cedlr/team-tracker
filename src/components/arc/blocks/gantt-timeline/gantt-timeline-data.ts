import type { ComponentType } from "react";
import { Megaphone, PenTool, Server, Smartphone } from "lucide-react";

export type GanttTone = "teal" | "sky" | "orchid" | "violet" | "rose" | "amber" | "green";

export interface GanttGroup {
  id: string;
  name: string;
}

export interface GanttTeam {
  id: string;
  name: string;
  /** Arc's categorical tone. It colours the team's bars and tints its icon. */
  tone: GanttTone;
  /** A lucide icon (or your own with the same size and stroke props) that marks the team in lanes, lists and pickers. */
  icon?: ComponentType<{ size?: number | string; strokeWidth?: number | string; className?: string }>;
}

/** Brand marks are sample content: GitHub, Stripe, Apple and Google are Simple Icons paths (CC0), Figma is its five shapes. */
export type GanttLinkKind = "github" | "figma" | "stripe" | "apple" | "google";

export interface GanttLink {
  kind: GanttLinkKind;
  label: string;
  /** A short second line, such as "Open · 14 files changed". */
  detail?: string;
  url: string;
}

export interface GanttTask {
  id: string;
  name: string;
  /** Id of the phase the task belongs to. */
  group: string;
  /** First day, as an ISO date such as "2026-09-14". */
  start: string;
  /** Last day, inclusive. A milestone uses its start day and ignores this. */
  end: string;
  /** Share of the work done, from 0 to 1. */
  progress?: number;
  /** Owner id. Sample plans use an Arc portrait id; the app passes a member id. */
  assignee?: string;
  /** Ids of tasks that must end before this one starts. */
  dependsOn?: string[];
  milestone?: boolean;
  /** Id of the team that owns the task. Colours its bar and powers grouping by team. */
  team?: string;
  /** Pull requests, files and store listings tied to the task. Shown in the details panel. */
  links?: GanttLink[];
}

export interface GanttUpdate {
  id: string;
  /** Who made the change. Leave it out for the signed in person. */
  person?: string;
  text: string;
  /** The task it is about. Selecting the update opens that task. */
  task?: string;
  /** A short relative time, such as "2h ago" or "Nov 10". */
  at: string;
}

export const TODAY = "2026-11-12";
/** The signed in person. */
export const ME = "emma-collins";

export const GROUPS: GanttGroup[] = [
  { id: "discovery", name: "Discovery" },
  { id: "design", name: "Design" },
  { id: "build", name: "Build" },
  { id: "launch", name: "Launch" },
];

export const TEAMS: GanttTeam[] = [
  { id: "design", name: "Design", tone: "orchid", icon: PenTool },
  { id: "mobile", name: "Mobile", tone: "sky", icon: Smartphone },
  { id: "platform", name: "Platform", tone: "teal", icon: Server },
  { id: "growth", name: "Growth", tone: "amber", icon: Megaphone },
];

const gh = (n: number, title: string, detail: string): GanttLink => ({ kind: "github", label: `#${n} ${title}`, detail, url: `https://github.com/waypoint/atlas/pull/${n}` });
const figma = (label: string, detail: string): GanttLink => ({ kind: "figma", label, detail, url: `https://www.figma.com/design/atlas-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` });

export const TASKS: GanttTask[] = [
  { id: "interviews", name: "Customer interviews", group: "discovery", team: "design", start: "2026-09-28", end: "2026-10-09", progress: 1, assignee: "jasmine-brooks" },
  { id: "audit", name: "Analytics audit", group: "discovery", team: "growth", start: "2026-10-01", end: "2026-10-09", progress: 1, assignee: "chloe-nguyen" },
  { id: "readout", name: "Research readout", group: "discovery", team: "design", start: "2026-10-12", end: "2026-10-12", milestone: true, assignee: "jasmine-brooks", dependsOn: ["interviews", "audit"] },

  { id: "navigation", name: "Navigation model", group: "design", team: "design", start: "2026-10-13", end: "2026-10-28", progress: 1, assignee: "emma-collins", dependsOn: ["readout"], links: [figma("Atlas navigation", "Edited Oct 28 · 34 frames")] },
  { id: "visual", name: "Visual refresh", group: "design", team: "design", start: "2026-10-19", end: "2026-11-13", progress: .85, assignee: "jasmine-brooks", links: [figma("Atlas visual system", "Edited 2h ago · 112 frames")] },
  { id: "prototype", name: "Prototype testing", group: "design", team: "design", start: "2026-11-02", end: "2026-11-13", progress: .6, assignee: "emma-collins", dependsOn: ["navigation"], links: [figma("Checkout prototype", "8 of 12 sessions run")] },
  { id: "handoff", name: "Design handoff", group: "design", team: "design", start: "2026-11-16", end: "2026-11-16", milestone: true, assignee: "emma-collins", dependsOn: ["visual", "prototype"] },

  { id: "contracts", name: "API contracts", group: "build", team: "platform", start: "2026-10-19", end: "2026-11-06", progress: 1, assignee: "daniel-kim", links: [gh(2141, "Atlas v4 OpenAPI schema", "Merged Nov 6 · 38 files")] },
  { id: "sync", name: "Offline sync", group: "build", team: "platform", start: "2026-11-09", end: "2026-11-27", progress: .2, assignee: "olivia-bennett", dependsOn: ["contracts"], links: [gh(2184, "Sync queue with retries", "Open · 14 files changed")] },
  { id: "payments", name: "Payments with Stripe", group: "build", team: "platform", start: "2026-11-09", end: "2026-11-27", progress: .35, assignee: "daniel-kim", dependsOn: ["contracts"], links: [{ kind: "stripe", label: "Payment Element test mode", detail: "Webhook endpoint live", url: "https://dashboard.stripe.com/test/workbench" }, gh(2190, "Apple Pay and Link", "Draft · 6 files changed")] },
  { id: "onboarding", name: "Onboarding flow", group: "build", team: "mobile", start: "2026-11-12", end: "2026-11-24", progress: .05, assignee: "marcus-johnson", dependsOn: ["handoff"] },
  { id: "ios", name: "iOS app", group: "build", team: "mobile", start: "2026-11-09", end: "2026-12-04", progress: .25, assignee: "mateo-alvarez", dependsOn: ["contracts"], links: [{ kind: "apple", label: "TestFlight build 4.0 (212)", detail: "48 testers", url: "https://appstoreconnect.apple.com/apps/atlas/testflight" }] },
  { id: "android", name: "Android app", group: "build", team: "mobile", start: "2026-11-17", end: "2026-12-08", progress: 0, assignee: "marcus-johnson", dependsOn: ["contracts", "handoff"], links: [{ kind: "google", label: "Play Console internal track", detail: "Build 4.0.0-rc1", url: "https://play.google.com/console/atlas" }] },

  { id: "freeze", name: "Beta freeze", group: "launch", team: "mobile", start: "2026-12-09", end: "2026-12-09", milestone: true, assignee: "nathan-cole", dependsOn: ["ios", "android", "payments", "sync"] },
  { id: "press", name: "Press kit", group: "launch", team: "growth", start: "2026-11-16", end: "2026-11-27", progress: 0, assignee: "hannah-walsh" },
  { id: "review", name: "App store review", group: "launch", team: "mobile", start: "2026-12-10", end: "2026-12-16", progress: 0, assignee: "sofia-ramirez", dependsOn: ["freeze"], links: [{ kind: "apple", label: "App Store Connect listing", detail: "Screenshots due Dec 9", url: "https://appstoreconnect.apple.com/apps/atlas" }] },
  { id: "campaign", name: "Launch campaign", group: "launch", team: "growth", start: "2026-11-30", end: "2026-12-17", progress: 0, assignee: "ava-mitchell", dependsOn: ["press"] },
  { id: "public", name: "Public launch", group: "launch", team: "growth", start: "2026-12-18", end: "2026-12-18", milestone: true, assignee: "ava-mitchell", dependsOn: ["review", "campaign"] },
];

/** Groups folded on first render. Discovery is done, so it starts closed. */
export const COLLAPSED = ["discovery"];

export const UPDATES: GanttUpdate[] = [
  { id: "u1", person: "jasmine-brooks", text: "set Visual refresh to 85% done", task: "visual", at: "2h ago" },
  { id: "u2", person: "marcus-johnson", text: "started Onboarding flow before Design handoff", task: "onboarding", at: "3h ago" },
  { id: "u3", person: "olivia-bennett", text: "opened #2184 Sync queue with retries", task: "sync", at: "Yesterday" },
  { id: "u4", person: "mateo-alvarez", text: "shipped TestFlight build 4.0 (212) to 48 testers", task: "ios", at: "Yesterday" },
  { id: "u5", person: "daniel-kim", text: "merged #2141 and closed API contracts", task: "contracts", at: "Nov 6" },
  { id: "u6", person: "nathan-cole", text: "moved Beta freeze to Dec 9", task: "freeze", at: "Nov 5" },
  { id: "u7", person: "ava-mitchell", text: "added Press kit to Launch", task: "press", at: "Nov 4" },
  { id: "u8", person: "emma-collins", text: "finished Navigation model", task: "navigation", at: "Oct 28" },
];
