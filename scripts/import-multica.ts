/**
 * Replaces ALL team-tracker data with a Multica export (one team, its members, projects and issues).
 * Writes to Upstash Redis when UPSTASH_REDIS_REST_URL/TOKEN (or KV_REST_API_*) are set, else to ./.data/kv.json.
 *
 *   npm run import:multica -- [dir] [--passwords out.csv] [--yes]
 *
 * [dir] (or MULTICA_EXPORT_DIR) holds members.json, projects.json and tasks.json. Default ./.data/multica/.
 * The export is company data: keep it out of git (./.data is ignored).
 * Every member gets a random temporary password, written only to the --passwords CSV
 * (default <dir>/member-passwords.csv, mode 600). The seeded admin login from scripts/seed.ts is kept.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { saveMember, saveProject, saveTask, saveTeam } from "@/lib/db";
import { usingRedis } from "@/lib/kv";
import { redis } from "@/lib/redis";
import type { Member, Project, Task, TaskStatus } from "@/lib/schemas";

const SEED_ADMIN = { email: "admin@teamtracker.dev", password: "TeamTracker!2026" }; // same as scripts/seed.ts

type MulticaMember = { name: string; email: string; role: string; team?: string; joined?: string | null };
type MulticaProject = { id: string; name: string; status?: string | null; start_date?: string | null; due_date?: string | null; description?: string | null };
type MulticaTask = {
  title: string; description?: string | null; status: string; priority?: string | null; project?: string | null;
  assignee_name?: string | null; assignee_email?: string | null; due_date?: string | null; created_date?: string | null;
  estimated_hours?: number | string | null; effort_days?: number | string | null; labels?: string | null;
};

/** Multica status -> team-tracker board column. Cancelled has no column, so it lands in backlog, tagged. */
const STATUS: Record<string, TaskStatus> = {
  backlog: "backlog", todo: "todo", "in progress": "progress", "in review": "review", done: "done", cancelled: "backlog", canceled: "backlog",
};
const PRIORITY: Record<string, Task["priority"]> = { urgent: "urgent", high: "high", medium: "medium", low: "low", "no priority": "none" };
const TONES = ["sky", "teal", "orchid", "amber", "violet", "rose", "green"] as const;
const HOURS_PER_DAY = 8;

const args = process.argv.slice(2);
const flag = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const dir = path.resolve(args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--passwords") ?? process.env.MULTICA_EXPORT_DIR ?? ".data/multica");
const passwordsFile = path.resolve(flag("--passwords") ?? path.join(dir, "member-passwords.csv"));

const readJson = async <T,>(file: string): Promise<T> => JSON.parse(await fs.readFile(path.join(dir, file), "utf8"));
const day = (value?: string | null) => (value ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(new Date(value)) : undefined);
const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const num = (value: unknown) => { const n = Number(value); return value != null && value !== "" && Number.isFinite(n) ? n : undefined; };
const tempPassword = () => randomBytes(9).toString("base64url");
const addDays = (iso: string, days: number) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };

/** "PFS - Old App" -> "PFSOA", "Kiosk" -> "KIOSK". Unique, 2 to 5 chars. */
function projectKey(name: string, used: Set<string>) {
  const words = name.split(/[^A-Za-z0-9]+/).filter(Boolean);
  let key = (words.length === 1 ? words[0].slice(0, 5) : words.map((w, i) => (i === 0 ? w.slice(0, 3) : w[0])).join("").slice(0, 5)).toUpperCase();
  if (key.length < 2) key = (key + "XX").slice(0, 2);
  let candidate = key, n = 2;
  while (used.has(candidate)) candidate = `${key.slice(0, 4)}${n++}`;
  used.add(candidate);
  return candidate;
}

async function wipe() {
  if (usingRedis && redis) { await redis.flushdb(); return; }
  await fs.rm(path.join(process.cwd(), ".data", "kv.json"), { force: true });
}

async function main() {
  const members = await readJson<MulticaMember[]>("members.json");
  const projects = await readJson<MulticaProject[]>("projects.json");
  const tasks = await readJson<MulticaTask[]>("tasks.json");
  const teamName = members.find(m => m.team)?.team ?? "HLBInBranch";
  const teamId = slug(teamName);

  if (!args.includes("--yes")) {
    console.log(`This wipes ALL data in ${usingRedis ? "Upstash Redis" : "./.data/kv.json"} and imports ${teamName}: ${members.length} members, ${projects.length} projects, ${tasks.length} tasks.`);
    console.log("Re-run with --yes to continue.");
    return;
  }
  await wipe();
  await saveTeam({ id: teamId, name: teamName, tone: "teal", key: "INB" });

  /* Members */
  const byEmail = new Map<string, string>(), byName = new Map<string, string>();
  const passwords: string[] = ["name,email,role,temporary_password"];
  const today = day(new Date().toISOString())!;
  const ids = new Set<string>();
  for (const m of members) {
    const email = m.email.trim().toLowerCase();
    let id = slug(email.split("@")[0]) || slug(m.name);
    while (ids.has(id)) id += "-2";
    ids.add(id);
    const isCedrick = /cedrick/i.test(m.name) || /cedrick/i.test(email);
    const name = isCedrick && !/\s/.test(m.name.trim()) ? "Cedrick De Lara" : m.name.trim();
    const multicaRole = (m.role ?? "Member").toLowerCase();
    const role: "admin" | "lead" | "member" = isCedrick || multicaRole === "owner" || multicaRole === "admin" ? "admin" : "member";
    const password = tempPassword();
    const member: Member = {
      id, name, email, passwordHash: await bcrypt.hash(password, 10), title: m.role ?? "", department: "Engineering",
      weeklyCapacityHours: 40, started: m.joined ?? today, isAdmin: isCedrick || multicaRole === "owner",
      memberships: [{ teamId, allocation: 1, role }],
    };
    await saveMember(member);
    byEmail.set(email, id);
    byName.set(name.toLowerCase(), id);
    byName.set(m.name.trim().toLowerCase(), id);
    passwords.push([name, email, role, password].map(v => `"${v.replace(/"/g, '""')}"`).join(","));
  }
  if (!byEmail.has(SEED_ADMIN.email)) {
    await saveMember({
      id: "admin", name: "Team Tracker Admin", email: SEED_ADMIN.email, passwordHash: await bcrypt.hash(SEED_ADMIN.password, 10),
      title: "Admin", department: "Operations", weeklyCapacityHours: 0, started: today, isAdmin: true,
      memberships: [{ teamId, allocation: 0, role: "admin" }],
    });
  }
  await fs.mkdir(path.dirname(passwordsFile), { recursive: true });
  await fs.writeFile(passwordsFile, passwords.join("\n") + "\n", { mode: 0o600 });
  await fs.chmod(passwordsFile, 0o600);

  /* Projects (plus "General" for issues without one) */
  const usedKeys = new Set<string>();
  const projectIdByName = new Map<string, string>();
  const allProjects = [...projects];
  if (tasks.some(t => !t.project) && !projects.some(p => p.name === "General")) allProjects.push({ id: "general", name: "General", status: "In Progress" });
  const sorted = [...tasks].sort((a, b) => (a.created_date ?? "").localeCompare(b.created_date ?? ""));
  let projectCount = 0;
  for (const [i, p] of allProjects.entries()) {
    const id = p.id === "general" ? "general" : slug(p.name) || p.id;
    projectIdByName.set(p.name, id);
    const mine = tasks.filter(t => (t.project ?? "General") === p.name);
    const created = mine.map(t => day(t.created_date)).filter(Boolean).sort() as string[];
    const dues = mine.map(t => t.due_date ?? undefined).filter(Boolean).sort() as string[];
    const start = p.start_date ?? created[0] ?? today;
    let end = p.due_date ?? dues.at(-1) ?? addDays(start, 90);
    if (end < start) end = dues.at(-1) && dues.at(-1)! >= start ? dues.at(-1)! : addDays(start, 90);
    const status = (p.status ?? "").toLowerCase();
    const memberIds = Array.from(new Set(mine.map(t => (t.assignee_email && byEmail.get(t.assignee_email.toLowerCase())) || (t.assignee_name && byName.get(t.assignee_name.toLowerCase()))).filter(Boolean) as string[]));
    const project: Project = {
      id, teamId, name: p.name.slice(0, 80), key: p.id === "general" ? projectKey("GEN", usedKeys) : projectKey(p.name, usedKeys), tone: TONES[i % TONES.length],
      status: status === "completed" || status === "done" ? "done" : status === "paused" || status === "cancelled" ? "paused" : "active",
      start, end, memberIds,
    };
    await saveProject(project);
    projectCount++;
  }

  /* Tasks */
  const skipped: string[] = [];
  const unmatched = new Set<string>();
  const orderByStatus = new Map<TaskStatus, number>();
  let taskCount = 0;
  for (const [i, t] of sorted.entries()) {
    const multicaStatus = (t.status ?? "").toLowerCase();
    const status = STATUS[multicaStatus];
    if (!status) { skipped.push(`${t.title} (status ${t.status})`); continue; }
    const assigneeId = (t.assignee_email && byEmail.get(t.assignee_email.toLowerCase())) || (t.assignee_name && byName.get(t.assignee_name.toLowerCase())) || undefined;
    if (!assigneeId && (t.assignee_email || t.assignee_name)) unmatched.add(t.assignee_email || t.assignee_name!);
    const effort = num(t.effort_days);
    const estimate = num(t.estimated_hours) ?? (effort != null ? effort * HOURS_PER_DAY : undefined);
    const cancelled = multicaStatus.startsWith("cancel");
    const notes = [
      t.description?.trim(),
      cancelled ? "Cancelled in Multica." : undefined,
      !assigneeId && t.assignee_name ? `Assigned in Multica to ${t.assignee_name} (not a team member, likely a Multica agent).` : undefined,
      t.labels ? `Labels: ${t.labels}` : undefined,
      effort != null ? `Effort: ${effort} day(s) in Multica.` : undefined,
      t.created_date ? `Created in Multica: ${t.created_date}` : undefined,
    ].filter(Boolean).join("\n");
    const order = orderByStatus.get(status) ?? 0;
    orderByStatus.set(status, order + 1);
    const start = day(t.created_date);
    const task: Task = {
      id: `INB-${i + 1}`, teamId, projectId: projectIdByName.get(t.project ?? "General") ?? "general",
      title: `${cancelled ? "[Cancelled] " : ""}${t.title}`.slice(0, 200), description: notes ? notes.slice(0, 4000) : undefined,
      status, priority: PRIORITY[(t.priority ?? "").toLowerCase()] ?? "none", assigneeId,
      estimateHours: estimate != null ? Math.min(estimate, 1000) : undefined,
      start: start && t.due_date && start > t.due_date ? t.due_date : start, due: t.due_date ?? undefined,
      order, updatedAt: t.created_date ?? new Date().toISOString(),
    };
    await saveTask(task);
    taskCount++;
  }

  console.log(`Imported into ${usingRedis ? "Upstash Redis" : "./.data/kv.json"}: 1 team (${teamName}), ${members.length} members + admin login, ${projectCount} projects, ${taskCount} tasks.`);
  if (skipped.length) console.log(`Skipped ${skipped.length} tasks with unknown status:\n  ${skipped.join("\n  ")}`);
  if (unmatched.size) console.log(`Assignees not among members, left unassigned and noted in the description: ${[...unmatched].join(", ")}`);
  console.log(`Temporary passwords written to ${passwordsFile} (mode 600). Admin login: ${SEED_ADMIN.email} (password in scripts/seed.ts).`);
}

main().catch(error => { console.error(error); process.exit(1); });
