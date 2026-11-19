export interface TaskOwner {
  id: string;
  name: string;
  /** Portrait URL. Without one the owner shows initials. */
  avatar?: string;
}

export interface TaskDraft {
  id: string;
  title: string;
  /** Working days, in steps of 0.5. */
  estimate: number;
  /** Owner id from `owners`. */
  ownerId?: string;
  /** Ids of tasks that must finish first. */
  dependsOn?: string[];
}

export type IssueTarget = "linear" | "jira";

export interface CreatedIssue {
  key: string;
  url: string;
}

export const demoOwners: TaskOwner[] = [
  { id: "andre", name: "Andre Williams", avatar: "/media/people/andre-williams.svg" },
  { id: "daniel", name: "Daniel Kim", avatar: "/media/people/daniel-kim.svg" },
  { id: "olivia", name: "Olivia Bennett", avatar: "/media/people/olivia-bennett.svg" },
  { id: "marcus", name: "Marcus Johnson", avatar: "/media/people/marcus-johnson.svg" },
  { id: "chloe", name: "Chloe Nguyen", avatar: "/media/people/chloe-nguyen.svg" },
  { id: "ava", name: "Ava Mitchell", avatar: "/media/people/ava-mitchell.svg" },
  { id: "sofia", name: "Sofia Ramirez", avatar: "/media/people/sofia-ramirez.svg" },
];

export const demoGoal = "Launch usage-based billing by Dec 1";

export const demoTasks: TaskDraft[] = [
  { id: "t1", title: "Define billable metrics and price tiers with finance", estimate: 2, ownerId: "andre" },
  { id: "t2", title: "Emit usage events from the API gateway", estimate: 5, ownerId: "daniel", dependsOn: ["t1"] },
  { id: "t3", title: "Create Stripe meters and metered prices", estimate: 3, ownerId: "olivia", dependsOn: ["t1"] },
  { id: "t4", title: "Build the usage page in billing settings", estimate: 6, ownerId: "marcus", dependsOn: ["t2"] },
  { id: "t5", title: "Backfill October usage and reconcile invoices", estimate: 3, ownerId: "chloe", dependsOn: ["t2", "t3"] },
  { id: "t6", title: "Update the pricing page and customer emails", estimate: 2, ownerId: "ava", dependsOn: ["t1"] },
  { id: "t7", title: "Dry-run a billing cycle on 20 accounts", estimate: 3, ownerId: "sofia", dependsOn: ["t4", "t5"] },
];

/** Alternatives the demo cycles through when a task is regenerated. */
export const demoAlternates: Record<string, Omit<TaskDraft, "id" | "dependsOn">[]> = {
  t1: [{ title: "Agree on metered units and overage pricing", estimate: 1.5, ownerId: "andre" }],
  t2: [{ title: "Stream metered API calls to the usage pipeline", estimate: 4, ownerId: "daniel" }],
  t3: [{ title: "Map plans to Stripe meters with a sandbox test", estimate: 2.5, ownerId: "olivia" }],
  t4: [{ title: "Ship a live usage chart with spend alerts", estimate: 5, ownerId: "marcus" }],
  t5: [{ title: "Replay October events and diff against invoices", estimate: 4, ownerId: "chloe" }],
  t6: [{ title: "Announce the new pricing to existing workspaces", estimate: 1.5, ownerId: "ava" }],
  t7: [{ title: "Shadow-bill 20 accounts and review every invoice", estimate: 2, ownerId: "sofia" }],
};

/** Key prefixes and first numbers for simulated issues. */
export const demoIssue: Record<IssueTarget, { prefix: string; first: number; url: (key: string) => string }> = {
  linear: { prefix: "BIL", first: 241, url: key => `https://linear.app/northwind/issue/${key}` },
  jira: { prefix: "PAY", first: 318, url: key => `https://northwind.atlassian.net/browse/${key}` },
};

/* Scheduling ----------------------------------------------------------------------------------------------------- */

export interface Schedule {
  /** Working days from the start until every task is done (the critical path). */
  span: number;
  /** Total effort in working days. */
  effort: number;
  start: Map<string, number>;
  finish: Map<string, number>;
  /** Task ids on the critical path, first to last. */
  critical: string[];
}

/** Earliest start and finish for every task, honoring dependencies; cycles and unknown ids are ignored. */
export function schedule(tasks: TaskDraft[]): Schedule {
  const byId = new Map(tasks.map(task => [task.id, task]));
  const start = new Map<string, number>(), finish = new Map<string, number>(), via = new Map<string, string | undefined>();
  const visiting = new Set<string>();
  const resolve = (id: string): number => {
    const known = finish.get(id);
    if (known !== undefined) return known;
    const task = byId.get(id);
    if (!task || visiting.has(id)) return 0;
    visiting.add(id);
    let begin = 0, from: string | undefined;
    for (const dep of task.dependsOn ?? []) {
      if (!byId.has(dep)) continue;
      const end = resolve(dep);
      if (end > begin) { begin = end; from = dep; }
    }
    visiting.delete(id);
    start.set(id, begin);
    finish.set(id, begin + task.estimate);
    via.set(id, from);
    return begin + task.estimate;
  };
  tasks.forEach(task => resolve(task.id));
  let last: string | undefined, span = 0;
  for (const task of tasks) { const end = finish.get(task.id) ?? 0; if (end > span) { span = end; last = task.id; } }
  const critical: string[] = [];
  for (let id = last; id; id = via.get(id)) critical.unshift(id);
  return { span, effort: tasks.reduce((sum, task) => sum + task.estimate, 0), start, finish, critical };
}

const DAY = 86_400_000;
const isWorkday = (date: Date) => date.getUTCDay() !== 0 && date.getUTCDay() !== 6;
const utc = (value: Date | string) => { const date = new Date(value); return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())); };

/** Working days from `from` to `to`, counting both ends. */
export function workdaysBetween(from: Date | string, to: Date | string) {
  let count = 0;
  for (let day = utc(from).getTime(); day <= utc(to).getTime(); day += DAY) if (isWorkday(new Date(day))) count++;
  return count;
}

/** The date of the nth working day, counting `from` as day one when it is a working day. */
export function addWorkdays(from: Date | string, days: number) {
  let date = utc(from), left = Math.max(1, Math.ceil(days));
  for (;;) {
    if (isWorkday(date)) left--;
    if (left <= 0) return date;
    date = new Date(date.getTime() + DAY);
  }
}

export const shortDate = (date: Date) => date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
export const days = (value: number) => `${Number.isInteger(value) ? value : value.toFixed(1)}d`;
