import type { ScreenShellTone } from "../../screen-shell/screen-shell";
import { people, type PersonId } from "../../lib/media";

/* Sample workspace for the project overview. Everything below is local demo data: replace it with your own records. */

export type Stage = "Planned" | "In progress" | "Review" | "Done";
export type Priority = "Urgent" | "High" | "Medium" | "Low";
export type ProjectStatus = "On track" | "At risk" | "Off track" | "Paused";
export type Tool = "figma" | "github" | "stripe";
export type ActivityKind = "status" | "comment" | "code" | "design" | "task";

export interface ProjectLink { tool: Tool; label: string; detail: string; url: string }
export interface Project {
  id: string;
  name: string;
  tone: ScreenShellTone;
  lead: PersonId;
  status: ProjectStatus;
  start: string;
  end: string;
  summary: string;
  team: PersonId[];
  links: ProjectLink[];
}
export interface Milestone { id: string; project: string; name: string; date: string }
export interface Subtask { id: string; label: string; done: boolean }
export interface Task {
  id: string;
  project: string;
  milestone?: string;
  title: string;
  stage: Stage;
  assignee: PersonId;
  due: string;
  priority: Priority;
  description?: string;
  subtasks?: Subtask[];
}
export interface Activity {
  id: string;
  project: string;
  who: PersonId;
  kind: ActivityKind;
  /** The sentence after the name, such as "moved" or "opened pull request". */
  verb: string;
  task?: string;
  /** A pull request, file or other target when there is no task. */
  target?: string;
  tool?: Tool;
  /** "to Review" and similar endings. */
  detail?: string;
  body?: string;
  day: string;
  at: string;
  forMe?: boolean;
  read?: boolean;
}

export const ME: PersonId = "emma-collins";
export const TODAY = "2026-11-12";
export const WEEK = ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"];
export const stages: Stage[] = ["Planned", "In progress", "Review", "Done"];
export const groupOrder: Stage[] = ["In progress", "Review", "Planned", "Done"];
export const priorities: Priority[] = ["Urgent", "High", "Medium", "Low"];
export const statuses: ProjectStatus[] = ["On track", "At risk", "Off track", "Paused"];

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const parse = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };
export const formatDate = (iso: string) => { const date = parse(iso); return `${months[date.getUTCMonth()]} ${date.getUTCDate()}`; };
export const weekday = (iso: string) => weekdays[parse(iso).getUTCDay()];
export const daysBetween = (from: string, to: string) => Math.round((parse(to).getTime() - parse(from).getTime()) / 86_400_000);
export const addDays = (iso: string, days: number) => new Date(parse(iso).getTime() + days * 86_400_000).toISOString().slice(0, 10);
export const dayLabel = (iso: string) => iso === TODAY ? "Today" : daysBetween(iso, TODAY) === 1 ? "Yesterday" : `${weekday(iso)}, ${formatDate(iso)}`;
export const isOverdue = (task: Task) => task.stage !== "Done" && task.due < TODAY;
export const isThisWeek = (task: Task) => task.stage !== "Done" && task.due <= WEEK[6];

export const personName = (id: PersonId) => people.find(person => person.id === id)?.name ?? id;
export const personRole = (id: PersonId) => people.find(person => person.id === id)?.role ?? "";
export const firstName = (id: PersonId) => personName(id).split(" ")[0];

export const seedProjects: Project[] = [
  {
    id: "checkout", name: "Checkout redesign", tone: "teal", lead: "jasmine-brooks", status: "On track", start: "2026-09-29", end: "2026-12-12",
    summary: "One page checkout with saved cards, wallets and address autocomplete. The goal is 4% more completed orders by launch.",
    team: ["jasmine-brooks", "emma-collins", "marcus-johnson", "daniel-kim", "chloe-nguyen", "hannah-walsh"],
    links: [
      { tool: "figma", label: "Checkout v4 flows", detail: "Edited 2 hours ago", url: "https://figma.com/file/tidewater-checkout-v4" },
      { tool: "github", label: "tidewater/web-checkout", detail: "3 open pull requests", url: "https://github.com/tidewater/web-checkout" },
      { tool: "stripe", label: "Payment Element", detail: "Test mode, 1,248 payments", url: "https://dashboard.stripe.com/test/payments" },
    ],
  },
  {
    id: "mobile", name: "Mobile app 3.0", tone: "violet", lead: "mateo-alvarez", status: "At risk", start: "2026-10-05", end: "2027-01-22",
    summary: "Offline drafts, a faster composer and push settings per channel for iOS and Android.",
    team: ["mateo-alvarez", "emma-collins", "olivia-bennett", "nathan-cole", "ava-mitchell"],
    links: [
      { tool: "figma", label: "Mobile 3.0 composer", detail: "Edited yesterday", url: "https://figma.com/file/tidewater-mobile-3" },
      { tool: "github", label: "tidewater/mobile", detail: "5 open pull requests", url: "https://github.com/tidewater/mobile" },
    ],
  },
  {
    id: "api", name: "Partner API", tone: "sky", lead: "olivia-bennett", status: "On track", start: "2026-08-17", end: "2026-11-27",
    summary: "A public REST API with OAuth apps, signed webhooks and usage based rate limits for partners.",
    team: ["olivia-bennett", "daniel-kim", "marcus-johnson", "nathan-cole"],
    links: [
      { tool: "github", label: "tidewater/partner-api", detail: "2 open pull requests", url: "https://github.com/tidewater/partner-api" },
      { tool: "stripe", label: "Usage records", detail: "Metered billing", url: "https://dashboard.stripe.com/test/billing/meters" },
    ],
  },
  {
    id: "brand", name: "Brand refresh", tone: "amber", lead: "ava-mitchell", status: "Paused", start: "2026-09-14", end: "2027-01-29",
    summary: "A new logo, type and colour system, then a rollout across the site and the product.",
    team: ["ava-mitchell", "jasmine-brooks", "emma-collins"],
    links: [{ tool: "figma", label: "Brand directions", detail: "Edited Nov 10", url: "https://figma.com/file/tidewater-brand" }],
  },
];

export const seedMilestones: Milestone[] = [
  { id: "chk-research", project: "checkout", name: "Research and audit", date: "2026-10-09" },
  { id: "chk-payment", project: "checkout", name: "Payment step", date: "2026-10-30" },
  { id: "chk-address", project: "checkout", name: "Address autocomplete", date: "2026-11-20" },
  { id: "chk-beta", project: "checkout", name: "Beta at 10% traffic", date: "2026-12-03" },
  { id: "chk-ga", project: "checkout", name: "General availability", date: "2026-12-12" },
  { id: "mob-composer", project: "mobile", name: "Composer prototype", date: "2026-10-23" },
  { id: "mob-offline", project: "mobile", name: "Offline drafts", date: "2026-11-20" },
  { id: "mob-push", project: "mobile", name: "Push settings", date: "2026-12-11" },
  { id: "mob-release", project: "mobile", name: "Store release", date: "2027-01-22" },
  { id: "api-oauth", project: "api", name: "OAuth apps", date: "2026-09-25" },
  { id: "api-webhooks", project: "api", name: "Webhooks", date: "2026-10-23" },
  { id: "api-limits", project: "api", name: "Rate limits", date: "2026-11-20" },
  { id: "api-docs", project: "api", name: "Public docs", date: "2026-11-27" },
  { id: "brd-mood", project: "brand", name: "Moodboards", date: "2026-10-16" },
  { id: "brd-logo", project: "brand", name: "Logo and type", date: "2026-11-27" },
  { id: "brd-site", project: "brand", name: "Site rollout", date: "2027-01-29" },
];

const sub = (id: string, items: [string, boolean][]): Subtask[] => items.map(([label, done], index) => ({ id: `${id}-${index}`, label, done }));

export const seedTasks: Task[] = [
  // Checkout redesign
  { id: "CHK-137", project: "checkout", milestone: "chk-address", title: "Design states for unmatched addresses", stage: "In progress", assignee: "emma-collins", due: "2026-11-12", priority: "High",
    description: "Cover no match, partial match and a manual entry fallback. Keep the field focused while suggestions change.", subtasks: sub("CHK-137", [["No match state", true], ["Partial match with a correction", true], ["Manual entry after two misses", false], ["Mobile keyboard layout", false]]) },
  { id: "CHK-135", project: "checkout", milestone: "chk-address", title: "Autocomplete field with keyboard support", stage: "In progress", assignee: "marcus-johnson", due: "2026-11-14", priority: "Urgent",
    description: "Combobox pattern with arrow keys, Enter to accept and Escape to keep typed text.", subtasks: sub("CHK-135", [["Combobox semantics", true], ["Debounced lookup", true], ["Highlight matched text", false]]) },
  { id: "CHK-132", project: "checkout", milestone: "chk-address", title: "Address lookup service behind a feature flag", stage: "Review", assignee: "daniel-kim", due: "2026-11-13", priority: "High",
    description: "Proxy the provider through our API so keys stay on the server. Flag: checkout_address_lookup." },
  { id: "CHK-141", project: "checkout", milestone: "chk-address", title: "Copy for address errors and hints", stage: "Review", assignee: "emma-collins", due: "2026-11-10", priority: "Medium" },
  { id: "CHK-139", project: "checkout", milestone: "chk-address", title: "Validate postcodes for the UK, Germany and Switzerland", stage: "Planned", assignee: "daniel-kim", due: "2026-11-18", priority: "Medium" },
  { id: "CHK-144", project: "checkout", milestone: "chk-address", title: "Track the autocomplete accept rate", stage: "Planned", assignee: "chloe-nguyen", due: "2026-11-19", priority: "Low" },
  { id: "CHK-130", project: "checkout", milestone: "chk-address", title: "Pick an address data provider", stage: "Done", assignee: "jasmine-brooks", due: "2026-11-03", priority: "High" },
  { id: "CHK-138", project: "checkout", milestone: "chk-address", title: "Remove the legacy address form", stage: "Done", assignee: "marcus-johnson", due: "2026-11-06", priority: "Low" },
  { id: "CHK-150", project: "checkout", milestone: "chk-beta", title: "Rollout plan and kill switch", stage: "Planned", assignee: "jasmine-brooks", due: "2026-11-26", priority: "High" },
  { id: "CHK-152", project: "checkout", milestone: "chk-beta", title: "Dashboard for beta conversion", stage: "Planned", assignee: "chloe-nguyen", due: "2026-11-27", priority: "Medium" },
  { id: "CHK-157", project: "checkout", milestone: "chk-beta", title: "Load test payment intents at three times peak", stage: "Planned", assignee: "daniel-kim", due: "2026-12-01", priority: "High" },
  { id: "CHK-155", project: "checkout", milestone: "chk-beta", title: "Support macros for checkout questions", stage: "Planned", assignee: "hannah-walsh", due: "2026-12-02", priority: "Low" },
  { id: "CHK-161", project: "checkout", milestone: "chk-ga", title: "Launch notes and help center article", stage: "Planned", assignee: "hannah-walsh", due: "2026-12-09", priority: "Medium" },
  { id: "CHK-163", project: "checkout", milestone: "chk-ga", title: "Remove the old checkout route", stage: "Planned", assignee: "marcus-johnson", due: "2026-12-11", priority: "Low" },
  { id: "CHK-118", project: "checkout", milestone: "chk-payment", title: "Card form with the Stripe Payment Element", stage: "Done", assignee: "marcus-johnson", due: "2026-10-23", priority: "High" },
  { id: "CHK-121", project: "checkout", milestone: "chk-payment", title: "Save cards for signed in customers", stage: "Done", assignee: "daniel-kim", due: "2026-10-28", priority: "High" },
  { id: "CHK-126", project: "checkout", milestone: "chk-payment", title: "Apple Pay and Google Pay buttons", stage: "Done", assignee: "marcus-johnson", due: "2026-10-30", priority: "Medium" },
  { id: "CHK-101", project: "checkout", milestone: "chk-research", title: "Audit drop-off in the current funnel", stage: "Done", assignee: "chloe-nguyen", due: "2026-10-02", priority: "High" },
  { id: "CHK-104", project: "checkout", milestone: "chk-research", title: "Interview eight customers who left a cart", stage: "Done", assignee: "emma-collins", due: "2026-10-07", priority: "Medium" },
  { id: "CHK-109", project: "checkout", milestone: "chk-research", title: "Benchmark five competitor checkouts", stage: "Done", assignee: "jasmine-brooks", due: "2026-10-09", priority: "Low" },
  // Mobile app 3.0
  { id: "MOB-221", project: "mobile", milestone: "mob-offline", title: "Draft storage with conflict resolution", stage: "In progress", assignee: "mateo-alvarez", due: "2026-11-14", priority: "Urgent",
    subtasks: sub("MOB-221", [["SQLite schema", true], ["Merge rules for edits on two devices", false], ["Conflict dialog", false]]) },
  { id: "MOB-224", project: "mobile", milestone: "mob-offline", title: "Sync queue for flaky networks", stage: "In progress", assignee: "olivia-bennett", due: "2026-11-17", priority: "High" },
  { id: "MOB-226", project: "mobile", milestone: "mob-offline", title: "Offline banner and retry states", stage: "Review", assignee: "emma-collins", due: "2026-11-11", priority: "Medium" },
  { id: "MOB-230", project: "mobile", milestone: "mob-push", title: "Push settings per channel API", stage: "Planned", assignee: "olivia-bennett", due: "2026-11-30", priority: "Medium" },
  { id: "MOB-233", project: "mobile", milestone: "mob-push", title: "Settings screen design", stage: "Planned", assignee: "emma-collins", due: "2026-12-04", priority: "Medium" },
  { id: "MOB-240", project: "mobile", milestone: "mob-release", title: "App Store screenshots and copy", stage: "Planned", assignee: "ava-mitchell", due: "2027-01-12", priority: "Low" },
  { id: "MOB-242", project: "mobile", milestone: "mob-release", title: "Release checklist and phased rollout", stage: "Planned", assignee: "nathan-cole", due: "2027-01-18", priority: "High" },
  { id: "MOB-210", project: "mobile", milestone: "mob-composer", title: "Composer prototype in SwiftUI", stage: "Done", assignee: "mateo-alvarez", due: "2026-10-20", priority: "High" },
  { id: "MOB-214", project: "mobile", milestone: "mob-composer", title: "Usability test the new composer", stage: "Done", assignee: "emma-collins", due: "2026-10-23", priority: "Medium" },
  // Partner API
  { id: "API-320", project: "api", milestone: "api-limits", title: "Usage based rate limits", stage: "In progress", assignee: "daniel-kim", due: "2026-11-16", priority: "Urgent" },
  { id: "API-330", project: "api", milestone: "api-docs", title: "Reference docs from the OpenAPI spec", stage: "In progress", assignee: "marcus-johnson", due: "2026-11-24", priority: "Medium" },
  { id: "API-323", project: "api", milestone: "api-limits", title: "Rate limit headers and 429 guidance", stage: "Review", assignee: "olivia-bennett", due: "2026-11-13", priority: "High" },
  { id: "API-327", project: "api", milestone: "api-limits", title: "Report usage to Stripe metering", stage: "Planned", assignee: "daniel-kim", due: "2026-11-20", priority: "Medium" },
  { id: "API-334", project: "api", milestone: "api-docs", title: "Partner onboarding guide", stage: "Planned", assignee: "nathan-cole", due: "2026-11-26", priority: "Low" },
  { id: "API-301", project: "api", milestone: "api-oauth", title: "OAuth app registration", stage: "Done", assignee: "olivia-bennett", due: "2026-09-18", priority: "High" },
  { id: "API-305", project: "api", milestone: "api-oauth", title: "Scopes and consent screen", stage: "Done", assignee: "marcus-johnson", due: "2026-09-25", priority: "Medium" },
  { id: "API-312", project: "api", milestone: "api-webhooks", title: "Webhook delivery with retries", stage: "Done", assignee: "daniel-kim", due: "2026-10-16", priority: "High" },
  { id: "API-315", project: "api", milestone: "api-webhooks", title: "Signing secrets for webhooks", stage: "Done", assignee: "olivia-bennett", due: "2026-10-22", priority: "Medium" },
  // Brand refresh
  { id: "BRD-408", project: "brand", milestone: "brd-logo", title: "Logo refinements", stage: "In progress", assignee: "jasmine-brooks", due: "2026-11-20", priority: "Medium" },
  { id: "BRD-411", project: "brand", milestone: "brd-logo", title: "Type scale and licensing", stage: "Planned", assignee: "emma-collins", due: "2026-11-25", priority: "Low" },
  { id: "BRD-415", project: "brand", milestone: "brd-site", title: "Update the marketing site", stage: "Planned", assignee: "ava-mitchell", due: "2027-01-20", priority: "Medium" },
  { id: "BRD-401", project: "brand", milestone: "brd-mood", title: "Moodboards for three directions", stage: "Done", assignee: "ava-mitchell", due: "2026-10-09", priority: "Medium" },
  { id: "BRD-404", project: "brand", milestone: "brd-mood", title: "Pick a direction with leadership", stage: "Done", assignee: "ava-mitchell", due: "2026-10-16", priority: "High" },
];

export const seedActivity: Activity[] = [
  { id: "a-01", project: "mobile", who: "mateo-alvarez", kind: "comment", verb: "commented on", task: "MOB-226", body: "Emma, can the retry state keep the draft visible behind the banner?", day: TODAY, at: "11:05", forMe: true, read: false },
  { id: "a-02", project: "checkout", who: "daniel-kim", kind: "status", verb: "moved", task: "CHK-132", detail: "to Review", day: TODAY, at: "10:42" },
  { id: "a-03", project: "checkout", who: "marcus-johnson", kind: "code", verb: "opened pull request", target: "#482 Address autocomplete field", tool: "github", day: TODAY, at: "10:15" },
  { id: "a-04", project: "checkout", who: "jasmine-brooks", kind: "comment", verb: "commented on", task: "CHK-137", body: "Let's show the manual form after two misses, not three. Pilot data backs it up.", day: TODAY, at: "9:30", forMe: true, read: false },
  { id: "a-05", project: "checkout", who: "emma-collins", kind: "design", verb: "updated", target: "Checkout v4 flows", tool: "figma", day: TODAY, at: "9:02" },
  { id: "a-06", project: "api", who: "olivia-bennett", kind: "status", verb: "moved", task: "API-323", detail: "to Review", day: TODAY, at: "8:50" },
  { id: "a-07", project: "checkout", who: "marcus-johnson", kind: "code", verb: "requested your review on", target: "#482 Address autocomplete field", tool: "github", day: TODAY, at: "8:12", forMe: true, read: false },
  { id: "a-08", project: "checkout", who: "chloe-nguyen", kind: "comment", verb: "commented on", task: "CHK-144", body: "Baseline accept rate from the pilot is 61%. I'll add it to the beta dashboard.", day: "2026-11-11", at: "17:20" },
  { id: "a-09", project: "checkout", who: "daniel-kim", kind: "code", verb: "merged", target: "#477 Postcode service client", tool: "github", day: "2026-11-11", at: "15:05" },
  { id: "a-10", project: "api", who: "daniel-kim", kind: "comment", verb: "commented on", task: "API-320", body: "Limits per app are live in staging. Burst is 50 requests, then 10 per second.", day: "2026-11-11", at: "14:30" },
  { id: "a-11", project: "checkout", who: "marcus-johnson", kind: "comment", verb: "commented on", task: "CHK-135", body: "Lookup is debounced at 150ms. Screen reader announces the result count now.", day: "2026-11-11", at: "12:10" },
  { id: "a-12", project: "mobile", who: "olivia-bennett", kind: "status", verb: "moved", task: "MOB-224", detail: "to In progress", day: "2026-11-11", at: "11:40" },
  { id: "a-13", project: "checkout", who: "hannah-walsh", kind: "task", verb: "created", task: "CHK-155", day: "2026-11-11", at: "10:02" },
  { id: "a-14", project: "checkout", who: "jasmine-brooks", kind: "task", verb: "assigned you", task: "CHK-141", day: "2026-11-10", at: "16:45", forMe: true, read: true },
  { id: "a-15", project: "checkout", who: "marcus-johnson", kind: "status", verb: "completed", task: "CHK-138", day: "2026-11-10", at: "15:12" },
  { id: "a-16", project: "checkout", who: "daniel-kim", kind: "comment", verb: "commented on", task: "CHK-132", body: "Provider keys are in the vault. Flag is off for everyone but the team.", day: "2026-11-10", at: "11:31" },
  { id: "a-17", project: "brand", who: "ava-mitchell", kind: "design", verb: "updated", target: "Brand directions", tool: "figma", day: "2026-11-10", at: "10:20" },
  { id: "a-18", project: "checkout", who: "jasmine-brooks", kind: "comment", verb: "commented on", task: "CHK-137", body: "Partial matches look great. Can we try the correction inline instead of a sheet?", day: "2026-11-10", at: "9:48" },
];
