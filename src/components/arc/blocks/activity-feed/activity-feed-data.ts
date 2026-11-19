import type { PersonId, PhotoId } from "../../lib/media";

export type ActivityType = "comment" | "change" | "deploy" | "file" | "member";

export type DiffLine = { kind: "add" | "remove" | "context"; text: string };

export type ActivityDetail =
  | { kind: "comment"; text: string }
  | { kind: "diff"; file: string; additions: number; deletions: number; lines: DiffLine[] }
  | { kind: "files"; photos: PhotoId[] }
  | { kind: "deploy"; environment: string; commit: string; duration: string; status: "ready" | "failed"; log?: string[] };

export type Activity = {
  id: string;
  type: ActivityType;
  actor: PersonId;
  /** Verb phrase between the actor and the target, such as "commented on". */
  action: string;
  target: string;
  project: string;
  /** Days before today: 0 is today, 1 is yesterday. */
  day: number;
  time: string;
  unread: boolean;
  detail?: ActivityDetail;
};

/** The day the sample data treats as today. */
export const activityToday = "2026-09-24";

export const activities: Activity[] = [
  { id: "a1", type: "comment", actor: "emma-collins", action: "commented on", target: "Pricing page v3", project: "Website", day: 0, time: "10:42", unread: true,
    detail: { kind: "comment", text: "Can we move the annual toggle above the cards? On 13 inch screens it pushes the main button below the fold." } },
  { id: "a2", type: "deploy", actor: "olivia-bennett", action: "deployed", target: "atlas-web to Production", project: "Atlas", day: 0, time: "10:05", unread: true,
    detail: { kind: "deploy", environment: "Production", commit: "a41f9c2 Cache plan limits per workspace", duration: "1m 48s", status: "ready" } },
  { id: "a3", type: "change", actor: "marcus-johnson", action: "changed", target: "checkout/summary.tsx", project: "Atlas", day: 0, time: "09:31", unread: true,
    detail: { kind: "diff", file: "app/checkout/summary.tsx", additions: 3, deletions: 2, lines: [
      { kind: "context", text: "const subtotal = sum(items.map(item => item.price * item.qty));" },
      { kind: "remove", text: "const tax = subtotal * 0.23;" },
      { kind: "remove", text: "const total = subtotal + tax;" },
      { kind: "add", text: "const rate = taxRates[address.country] ?? 0;" },
      { kind: "add", text: "const tax = round(subtotal * rate, 2);" },
      { kind: "add", text: "const total = round(subtotal + tax - discount, 2);" },
    ] } },
  { id: "a4", type: "file", actor: "jasmine-brooks", action: "added 4 photos to", target: "Autumn catalog", project: "Brand", day: 0, time: "08:57", unread: true,
    detail: { kind: "files", photos: ["lounge-chair", "table-lamp", "stoneware-cups", "linen-throw"] } },
  { id: "a5", type: "member", actor: "sofia-ramirez", action: "invited Hannah Walsh to", target: "Support", project: "Workspace", day: 1, time: "17:20", unread: true },
  { id: "a6", type: "deploy", actor: "mateo-alvarez", action: "failed to deploy", target: "atlas-ios to Preview", project: "Atlas", day: 1, time: "16:02", unread: true,
    detail: { kind: "deploy", environment: "Preview", commit: "9be07d1 Swap image cache for the new loader", duration: "2m 11s", status: "failed", log: [
      "Compiling ImageLoader.swift",
      "error: cannot find 'DiskCache' in scope",
      "Build failed after 2m 11s",
    ] } },
  { id: "a7", type: "comment", actor: "chloe-nguyen", action: "commented on", target: "Q3 retention report", project: "Insights", day: 1, time: "14:48", unread: false,
    detail: { kind: "comment", text: "Week 6 retention is up 4 points for teams that finished onboarding. The dip in August lines up with the pricing test." } },
  { id: "a8", type: "change", actor: "daniel-kim", action: "fixed", target: "Webhook retries drop the idempotency key", project: "Platform", day: 1, time: "11:16", unread: false,
    detail: { kind: "diff", file: "services/webhooks/retry.ts", additions: 2, deletions: 1, lines: [
      { kind: "context", text: "for (const attempt of backoff(5)) {" },
      { kind: "remove", text: "  const response = await send(event.url, event.body);" },
      { kind: "add", text: "  const headers = { \"Idempotency-Key\": event.id };" },
      { kind: "add", text: "  const response = await send(event.url, event.body, { headers });" },
      { kind: "context", text: "  if (response.ok) return response;" },
    ] } },
  { id: "a9", type: "comment", actor: "ryan-sullivan", action: "commented on", target: "Lisbon Coffee Co. renewal", project: "Sales", day: 2, time: "15:37", unread: false,
    detail: { kind: "comment", text: "They signed for two years at 40 seats. Finance has the order form; kickoff is booked for October 6." } },
  { id: "a10", type: "file", actor: "ava-mitchell", action: "added 3 photos to", target: "Lisbon launch event", project: "Marketing", day: 2, time: "12:03", unread: false,
    detail: { kind: "files", photos: ["lisbon-tram", "lisbon-rooftops", "restaurant"] } },
  { id: "a11", type: "deploy", actor: "olivia-bennett", action: "deployed", target: "atlas-api to Production", project: "Atlas", day: 3, time: "18:44", unread: false,
    detail: { kind: "deploy", environment: "Production", commit: "e3c1a70 Rate limit exports per workspace", duration: "3m 02s", status: "ready" } },
  { id: "a12", type: "member", actor: "nathan-cole", action: "made Daniel Kim an admin of", target: "Platform", project: "Workspace", day: 3, time: "09:12", unread: false },
  { id: "a13", type: "change", actor: "emma-collins", action: "changed", target: "tokens/color.css", project: "Design system", day: 6, time: "16:25", unread: false,
    detail: { kind: "diff", file: "tokens/color.css", additions: 2, deletions: 2, lines: [
      { kind: "remove", text: "--border: oklch(92% 0 0);" },
      { kind: "remove", text: "--border-subtle: oklch(95% 0 0);" },
      { kind: "add", text: "--border: oklch(93.5% 0 0);" },
      { kind: "add", text: "--border-subtle: oklch(96.5% 0 0);" },
    ] } },
  { id: "a14", type: "comment", actor: "diane-foster", action: "commented on", target: "2027 hiring plan", project: "Operations", day: 9, time: "10:30", unread: false,
    detail: { kind: "comment", text: "Approved the two platform roles. Let's hold the second designer until Q1 numbers are in." } },
  { id: "a15", type: "member", actor: "tyler-hayes", action: "joined", target: "Sales", project: "Workspace", day: 13, time: "08:45", unread: false },
];

/** Arrive while the feed is open, to show the live pill. */
export const incomingActivities: Activity[] = [
  { id: "live-1", type: "comment", actor: "marcus-johnson", action: "replied on", target: "Pricing page v3", project: "Website", day: 0, time: "Just now", unread: true,
    detail: { kind: "comment", text: "Agreed. I'll move the toggle and keep the cards the same height so nothing jumps." } },
  { id: "live-2", type: "deploy", actor: "olivia-bennett", action: "deployed", target: "atlas-web to Preview", project: "Atlas", day: 0, time: "Just now", unread: true,
    detail: { kind: "deploy", environment: "Preview", commit: "c7d2e19 Move annual toggle above plan cards", duration: "1m 12s", status: "ready" } },
  { id: "live-3", type: "file", actor: "jasmine-brooks", action: "added 2 photos to", target: "Autumn catalog", project: "Brand", day: 0, time: "Just now", unread: true,
    detail: { kind: "files", photos: ["ceramic-lamp", "glass-carafe"] } },
];
