import type { ComponentType, CSSProperties } from "react";
import { AppWindow, Bug, Component, Gauge, PenTool, Server, ShoppingCart, Smartphone, TrendingUp, Webhook } from "lucide-react";
import { avatar } from "../../lib/media";

/** Sample workspace for the kanban board screen: Larkspur's product team in cycle 24 (Nov 9 to Nov 22, 2026). Replace with your tracker's data. */

/** Any lucide icon, or your own component that takes the same size and stroke props. */
export type KanbanIcon = ComponentType<{ size?: number | string; strokeWidth?: number | string; className?: string; style?: CSSProperties }>;

export type KanbanTone = "teal" | "sky" | "orchid" | "violet" | "rose" | "amber" | "green";
/** Drives the column's status mark. Leave it out and the board infers it from the column order. */
export type KanbanStatusKind = "backlog" | "unstarted" | "started" | "review" | "done";
export type KanbanPriority = "urgent" | "high" | "medium" | "low" | "none";

export interface KanbanColumn {
  id: string;
  name: string;
  /** Work in progress limit. The column warns once it holds more cards. */
  limit?: number;
  kind?: KanbanStatusKind;
}
export interface KanbanPerson { id: string; name: string; avatar?: string }
export interface KanbanChecklistItem { id: string; text: string; done: boolean }
export interface KanbanProject {
  id: string;
  name: string;
  /** Prefix for new card ids, such as "CHK". */
  key: string;
  tone: KanbanTone;
  /** The project's icon in the sidebar, on cards in cross-project views and in the details trail. Tinted with the tone. */
  icon?: KanbanIcon;
}
export interface KanbanLabel {
  id: string;
  name: string;
  tone: KanbanTone;
  /** Drawn in the tone beside the label name. Without one a tag glyph is used. */
  icon?: KanbanIcon;
}
/** A linked pull request or design file, shown on the card and in its details. */
export interface KanbanLink { kind: "github" | "figma"; title: string; detail?: string; state?: "open" | "draft" | "merged" }
export interface KanbanActivity { id: string; person: string; kind: "comment" | "event"; text: string; at: string }

export interface KanbanCard {
  id: string;
  title: string;
  column: string;
  assignee: string;
  /** A single label, kept for older data. Prefer `labels`. */
  label?: string;
  labels?: string[];
  priority?: KanbanPriority;
  project?: string;
  due?: string;
  points?: number;
  description?: string;
  /** Sub-issues, shown as a progress ring on the card and a checklist in the details. */
  checklist?: KanbanChecklistItem[];
  comments?: number;
  links?: KanbanLink[];
}

export const sampleColumns: KanbanColumn[] = [
  { id: "backlog", name: "Backlog", kind: "backlog" },
  { id: "todo", name: "Todo", kind: "unstarted" },
  { id: "progress", name: "In progress", limit: 4, kind: "started" },
  { id: "review", name: "In review", limit: 3, kind: "review" },
  { id: "done", name: "Done", kind: "done" },
];

export const samplePeople: KanbanPerson[] = [
  { id: "emma", name: "Emma Collins", avatar: avatar("emma-collins") },
  { id: "marcus", name: "Marcus Johnson", avatar: avatar("marcus-johnson") },
  { id: "chloe", name: "Chloe Nguyen", avatar: avatar("chloe-nguyen") },
  { id: "daniel", name: "Daniel Kim", avatar: avatar("daniel-kim") },
  { id: "olivia", name: "Olivia Bennett", avatar: avatar("olivia-bennett") },
  { id: "mateo", name: "Mateo Alvarez", avatar: avatar("mateo-alvarez") },
  { id: "jasmine", name: "Jasmine Brooks", avatar: avatar("jasmine-brooks") },
  { id: "ryan", name: "Ryan Sullivan", avatar: avatar("ryan-sullivan") },
];

export const sampleProjects: KanbanProject[] = [
  { id: "checkout", name: "Checkout v3", key: "CHK", tone: "teal", icon: ShoppingCart },
  { id: "ios", name: "iOS 4.2", key: "IOS", tone: "violet", icon: Smartphone },
  { id: "payments", name: "Payments API", key: "PAY", tone: "sky", icon: Webhook },
  { id: "design", name: "Design system", key: "DS", tone: "amber", icon: Component },
];

export const sampleLabels: KanbanLabel[] = [
  { id: "frontend", name: "Frontend", tone: "sky", icon: AppWindow },
  { id: "backend", name: "Backend", tone: "violet", icon: Server },
  { id: "design", name: "Design", tone: "orchid", icon: PenTool },
  { id: "bug", name: "Bug", tone: "rose", icon: Bug },
  { id: "performance", name: "Performance", tone: "amber", icon: Gauge },
  { id: "growth", name: "Growth", tone: "green", icon: TrendingUp },
];

const list = (...items: [string, boolean][]) => items.map(([text, done], index) => ({ id: `s${index}`, text, done }));
const pr = (title: string, state: KanbanLink["state"] = "open"): KanbanLink => ({ kind: "github", title, state });
const figma = (title: string, detail: string): KanbanLink => ({ kind: "figma", title, detail });
const projectOf: Record<string, string> = { CHK: "checkout", IOS: "ios", PAY: "payments", DS: "design" };
const card = (id: string, title: string, column: string, assignee: string, priority: KanbanPriority, labels: string[], points: number, extra: Partial<KanbanCard> = {}): KanbanCard =>
  ({ id, title, column, assignee, priority, labels, points, project: projectOf[id.split("-")[0]], ...extra });

export const sampleCards: KanbanCard[] = [
  // Checkout v3
  card("CHK-231", "Save cards for later with network tokens", "backlog", "daniel", "low", ["backend"], 5),
  card("CHK-236", "Address autocomplete for UK postcodes", "backlog", "chloe", "low", ["frontend"], 3, { comments: 2 }),
  card("CHK-240", "One page checkout for returning buyers", "backlog", "olivia", "medium", ["growth"], 8, { description: "Returning buyers with a saved address and card skip straight to review. Run as a 50/50 experiment in the US and UK." }),
  card("CHK-242", "Localise payment errors for nine markets", "backlog", "mateo", "none", ["frontend"], 2),
  card("CHK-219", "Apple Pay sheet on product pages", "todo", "marcus", "high", ["frontend"], 5, { due: "Nov 18", checklist: list(["Merchant validation endpoint", false], ["Shipping contact callbacks", false], ["Fallback for unsupported browsers", false]) }),
  card("CHK-221", "Retry 3DS challenge when the bank times out", "todo", "daniel", "urgent", ["backend", "bug"], 3, { due: "Nov 14", comments: 5, description: "About 1.8% of 3DS challenges time out at the issuer. Retry once with a fresh challenge before showing the decline screen." }),
  card("CHK-224", "Order summary skeleton while totals load", "todo", "chloe", "medium", ["design"], 2, { links: [figma("Checkout flows", "Summary states")] }),
  card("CHK-226", "Tax line for Canadian provinces", "todo", "ryan", "medium", ["backend"], 3, { due: "Nov 20" }),
  card("CHK-229", "Promo code field collapses on small screens", "todo", "jasmine", "high", ["frontend", "bug"], 1, { comments: 3 }),
  card("CHK-208", "Split shipping and billing into separate steps", "progress", "emma", "high", ["frontend"], 5, {
    due: "Nov 13", comments: 6, links: [pr("#1842 Separate address steps"), figma("Checkout flows", "Address step v4")],
    description: "Billing defaults to the shipping address. A separate step only appears when the buyer unticks it, which keeps the common path to three steps.",
    checklist: list(["Step routing and back navigation", true], ["Same as shipping toggle", true], ["Validation messages", true], ["Saved address picker", false], ["Analytics events", false]),
  }),
  card("CHK-211", "Idempotency keys for payment intents", "progress", "daniel", "urgent", ["backend"], 3, { due: "Nov 12", links: [pr("#1839 Idempotent intent creation", "draft")], checklist: list(["Key per cart revision", true], ["Replay test on staging", false]) }),
  card("CHK-214", "New payment method picker", "progress", "chloe", "medium", ["design"], 3, { comments: 4, links: [figma("Checkout flows", "Payment picker")] }),
  card("CHK-216", "Cart total animates when shipping changes", "progress", "mateo", "low", ["frontend", "performance"], 2),
  card("CHK-201", "Express checkout with Shop Pay and Link", "review", "marcus", "high", ["frontend"], 8, { comments: 11, links: [pr("#1831 Express checkout buttons")], checklist: list(["Button order by region", true], ["Wallet availability check", true], ["Loading states", true], ["Error copy", true]) }),
  card("CHK-204", "Fraud score webhook from Stripe Radar", "review", "olivia", "high", ["backend"], 5, { comments: 2, links: [pr("#1835 Radar score webhook")] }),
  card("CHK-206", "Empty cart with recently viewed items", "review", "emma", "low", ["design"], 2, { links: [figma("Checkout flows", "Empty cart")] }),
  card("CHK-188", "Guest checkout without an account", "done", "marcus", "high", ["frontend"], 5, { links: [pr("#1810 Guest checkout", "merged")] }),
  card("CHK-191", "Card form uses hosted fields", "done", "daniel", "urgent", ["backend"], 8, { links: [pr("#1804 Hosted card fields", "merged")] }),
  card("CHK-194", "Cache shipping rates for ten minutes", "done", "ryan", "medium", ["performance"], 3),
  card("CHK-197", "Checkout funnel analytics events", "done", "olivia", "low", ["growth"], 2),
  card("CHK-199", "Pay button loading state", "done", "chloe", "low", ["design"], 1),

  // iOS 4.2
  card("IOS-412", "Offline drafts for the composer", "progress", "mateo", "urgent", ["frontend"], 5, { due: "Nov 15", comments: 3, links: [pr("#977 Draft persistence")] }),
  card("IOS-415", "Haptics on pull to refresh", "todo", "jasmine", "low", ["design"], 1),
  card("IOS-418", "Widget shows today's orders", "todo", "marcus", "medium", ["frontend"], 5, { due: "Nov 21" }),
  card("IOS-406", "Crash on iPad split view rotation", "review", "mateo", "high", ["bug"], 2, { links: [pr("#971 Split view layout fix")] }),
  card("IOS-399", "Sign in with passkeys", "done", "emma", "high", ["frontend"], 8, { links: [pr("#958 Passkey sign in", "merged")] }),
  card("IOS-421", "Reduce cold start below 900 ms", "backlog", "ryan", "medium", ["performance"], 5),

  // Payments API
  card("PAY-87", "Webhook signing secrets rotation", "progress", "olivia", "high", ["backend"], 5, { due: "Nov 17", checklist: list(["Dual secret window", true], ["Dashboard copy", false], ["Docs update", false]) }),
  card("PAY-91", "Rate limit headers on every response", "todo", "daniel", "medium", ["backend"], 2),
  card("PAY-84", "Refunds endpoint returns partial state", "review", "emma", "medium", ["backend", "bug"], 3, { comments: 4, links: [pr("#412 Partial refund state")] }),
  card("PAY-79", "Payouts report export as CSV", "done", "ryan", "low", ["growth"], 3),
  card("PAY-95", "Sandbox clock for subscription tests", "backlog", "olivia", "low", ["backend"], 5),

  // Design system
  card("DS-58", "Focus ring tokens for dense tables", "todo", "emma", "medium", ["design"], 2, { due: "Nov 19", links: [figma("Arc tokens", "Focus")] }),
  card("DS-61", "Dark mode pass on charts", "progress", "jasmine", "medium", ["design"], 3, { comments: 2, links: [figma("Arc tokens", "Charts dark")] }),
  card("DS-54", "Button press scale audit", "done", "chloe", "low", ["design", "performance"], 1),
  card("DS-63", "Date picker range presets", "backlog", "marcus", "low", ["frontend"], 3),
];

/** Seeded history for a few cards. Cards without an entry get a short generated history. */
export const sampleActivity: Record<string, KanbanActivity[]> = {
  "CHK-208": [
    { id: "a1", person: "jasmine", kind: "event", text: "created the issue", at: "Nov 3" },
    { id: "a2", person: "emma", kind: "event", text: "moved it from Todo to In progress", at: "Nov 10" },
    { id: "a3", person: "marcus", kind: "comment", text: "The saved address picker can reuse the sheet from guest checkout. I left a note on the PR.", at: "Nov 11" },
    { id: "a4", person: "emma", kind: "comment", text: "Good call. Validation copy is in, picker next, then analytics.", at: "Yesterday" },
  ],
  "CHK-211": [
    { id: "a1", person: "olivia", kind: "event", text: "created the issue", at: "Nov 6" },
    { id: "a2", person: "daniel", kind: "event", text: "linked #1839", at: "Nov 11" },
    { id: "a3", person: "olivia", kind: "comment", text: "Needs to land before Friday's traffic test. Ping me for the staging replay.", at: "2 hours ago" },
  ],
  "CHK-201": [
    { id: "a1", person: "marcus", kind: "event", text: "moved it to In review", at: "Nov 11" },
    { id: "a2", person: "chloe", kind: "comment", text: "Button order matches the regional spec. Shop Pay is hidden in Canada until the merchant check passes.", at: "Yesterday" },
  ],
  "CHK-221": [
    { id: "a1", person: "daniel", kind: "event", text: "set priority to Urgent", at: "Nov 10" },
    { id: "a2", person: "ryan", kind: "comment", text: "Two enterprise accounts reported this last week, both on the same issuer.", at: "Nov 11" },
  ],
};
