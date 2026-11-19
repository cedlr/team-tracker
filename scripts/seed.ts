/**
 * Seeds two teams, an admin, sample members, projects, tasks, leave, attendance and time logs.
 * Writes to Upstash Redis when UPSTASH_REDIS_REST_URL/TOKEN (or KV_REST_API_URL/TOKEN) are set, else to ./.data/kv.json.
 *   npm run seed            # add or refresh the sample data
 *   npm run seed -- --reset # local only: wipe ./.data first
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { addDays, format, isWeekend, subDays } from "date-fns";
import { saveLeave, saveMember, saveProject, saveTask, saveTeam, setAttendanceDay, logTime } from "@/lib/db";
import { usingRedis } from "@/lib/kv";
import type { Member, Task, TaskStatus } from "@/lib/schemas";

export const SEED_ADMIN = { email: "admin@teamtracker.dev", password: "TeamTracker!2026" };

const iso = (date: Date) => format(date, "yyyy-MM-dd");
const today = new Date();
let seed = 7;
const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

async function main() {
  if (process.argv.includes("--reset") && !usingRedis) await fs.rm(path.join(process.cwd(), ".data"), { recursive: true, force: true });
  console.log(`Seeding ${usingRedis ? "Upstash Redis" : "local ./.data/kv.json"}…`);

  await saveTeam({ id: "web", name: "Web platform", tone: "sky", key: "WEB" });
  await saveTeam({ id: "mobile", name: "Mobile apps", tone: "orchid", key: "MOB" });

  const started = iso(subDays(today, 400));
  const people: Omit<Member, "passwordHash">[] = [
    { id: "cedrick", name: "Cedrick De Lara", email: SEED_ADMIN.email, title: "Engineering lead", department: "Engineering", avatar: "nathan-cole", weeklyCapacityHours: 40, started, isAdmin: true,
      memberships: [{ teamId: "web", allocation: 0.5, role: "admin" }, { teamId: "mobile", allocation: 0.5, role: "admin" }] },
    { id: "marcus", name: "Marcus Johnson", email: "marcus@teamtracker.dev", title: "Frontend engineer", department: "Engineering", avatar: "marcus-johnson", weeklyCapacityHours: 40, started, managerId: "cedrick", isAdmin: false, memberships: [{ teamId: "web", allocation: 1, role: "lead" }] },
    { id: "olivia", name: "Olivia Bennett", email: "olivia@teamtracker.dev", title: "Platform engineer", department: "Engineering", avatar: "olivia-bennett", weeklyCapacityHours: 40, started, managerId: "marcus", isAdmin: false, memberships: [{ teamId: "web", allocation: 1, role: "member" }] },
    { id: "daniel", name: "Daniel Kim", email: "daniel@teamtracker.dev", title: "Backend engineer", department: "Engineering", avatar: "daniel-kim", weeklyCapacityHours: 40, started, managerId: "marcus", isAdmin: false, memberships: [{ teamId: "web", allocation: 1, role: "member" }] },
    { id: "emma", name: "Emma Collins", email: "emma@teamtracker.dev", title: "Product designer", department: "Design", avatar: "emma-collins", weeklyCapacityHours: 40, started, managerId: "cedrick", isAdmin: false,
      memberships: [{ teamId: "web", allocation: 0.5, role: "member" }, { teamId: "mobile", allocation: 0.5, role: "member" }] },
    { id: "mateo", name: "Mateo Alvarez", email: "mateo@teamtracker.dev", title: "Mobile engineer", department: "Engineering", avatar: "mateo-alvarez", weeklyCapacityHours: 40, started, managerId: "cedrick", isAdmin: false, memberships: [{ teamId: "mobile", allocation: 1, role: "lead" }] },
    { id: "chloe", name: "Chloe Nguyen", email: "chloe@teamtracker.dev", title: "QA analyst", department: "Operations", avatar: "chloe-nguyen", weeklyCapacityHours: 32, started, managerId: "mateo", isAdmin: false, memberships: [{ teamId: "mobile", allocation: 1, role: "member" }] },
    { id: "jasmine", name: "Jasmine Brooks", email: "jasmine@teamtracker.dev", title: "Design lead", department: "Design", avatar: "jasmine-brooks", weeklyCapacityHours: 40, started, managerId: "mateo", isAdmin: false, memberships: [{ teamId: "mobile", allocation: 1, role: "member" }] },
  ];
  const adminHash = await bcrypt.hash(SEED_ADMIN.password, 10);
  for (const person of people) await saveMember({ ...person, passwordHash: person.id === "cedrick" ? adminHash : undefined });

  const projects = [
    { id: "portal", teamId: "web", name: "Customer portal", key: "POR", tone: "sky" as const, members: ["marcus", "olivia", "emma"] },
    { id: "billing", teamId: "web", name: "Billing revamp", key: "BIL", tone: "teal" as const, members: ["daniel", "olivia", "cedrick"] },
    { id: "ios", teamId: "mobile", name: "iOS app 2.0", key: "IOS", tone: "orchid" as const, members: ["mateo", "jasmine", "emma"] },
    { id: "android", teamId: "mobile", name: "Android parity", key: "AND", tone: "amber" as const, members: ["mateo", "chloe", "cedrick"] },
  ];
  const titles = ["Set up project skeleton", "Design review", "Auth flow", "Settings screen", "API integration", "Empty and error states", "Accessibility pass", "Performance budget", "Release checklist", "Analytics events"];
  const statuses: TaskStatus[] = ["done", "done", "done", "review", "progress", "progress", "todo", "todo", "backlog", "backlog"];
  const priorities = ["high", "medium", "urgent", "medium", "high", "low", "medium", "low", "none", "none"] as const;
  const tasks: Task[] = [];
  for (const project of projects) {
    await saveProject({ id: project.id, teamId: project.teamId, name: project.name, key: project.key, tone: project.tone, status: "active",
      start: iso(subDays(today, 35)), end: iso(addDays(today, 45)), memberIds: project.members });
    for (let i = 0; i < titles.length; i++) {
      const start = addDays(today, -30 + i * 6);
      const task: Task = {
        id: `${project.key}-${i + 1}`, teamId: project.teamId, projectId: project.id, title: titles[i], status: statuses[i], priority: priorities[i],
        assigneeId: project.members[i % project.members.length], points: [1, 2, 3, 5, 8][i % 5], estimateHours: [4, 8, 12, 16, 24][i % 5],
        start: iso(start), due: iso(addDays(start, 5 + (i % 3) * 2)), order: i, updatedAt: new Date().toISOString(),
      };
      tasks.push(await saveTask(task));
    }
  }

  const leaves = [
    { id: "leave-1", teamId: "web", memberId: "olivia", type: "annual" as const, from: iso(subDays(today, 9)), to: iso(subDays(today, 7)), status: "approved" as const },
    { id: "leave-2", teamId: "mobile", memberId: "chloe", type: "sick" as const, from: iso(subDays(today, 3)), to: iso(subDays(today, 3)), status: "approved" as const },
    { id: "leave-3", teamId: "web", memberId: "daniel", type: "annual" as const, from: iso(addDays(today, 12)), to: iso(addDays(today, 16)), status: "pending" as const },
    { id: "leave-4", teamId: "mobile", memberId: "jasmine", type: "personal" as const, from: iso(addDays(today, 5)), to: iso(addDays(today, 5)), status: "pending" as const },
  ];
  const workdays = (from: string, to: string) => { const out: string[] = []; for (let d = new Date(from); iso(d) <= to; d = addDays(d, 1)) if (!isWeekend(d)) out.push(iso(d)); return out; };
  for (const leave of leaves) await saveLeave({ ...leave, days: workdays(leave.from, leave.to).length, createdAt: new Date().toISOString(), decidedBy: leave.status === "approved" ? "cedrick" : undefined });

  // Attendance and time logs for the last 30 days (weekdays, excluding today so the check-in button is live).
  for (const person of people) {
    const mine = tasks.filter(task => task.assigneeId === person.id);
    for (let back = 30; back >= 1; back--) {
      const day = subDays(today, back);
      if (isWeekend(day)) continue;
      const date = iso(day);
      const onLeave = leaves.find(l => l.memberId === person.id && l.status === "approved" && date >= l.from && date <= l.to);
      const teamId = person.memberships[0].teamId;
      if (onLeave) { await setAttendanceDay(person.id, date, { status: "leave", teamId, at: `${date}T09:00:00.000Z` }); continue; }
      const roll = rand();
      await setAttendanceDay(person.id, date, { status: roll < 0.05 ? "absent" : roll < 0.3 ? "remote" : "present", teamId, at: `${date}T0${1 + Math.floor(rand() * 2)}:${String(Math.floor(rand() * 60)).padStart(2, "0")}:00.000Z` });
      if (roll < 0.05 || !mine.length) continue;
      const task = mine[Math.floor(rand() * mine.length)];
      const hours = Math.round((4 + rand() * 3.5) * 2) / 2 * (person.weeklyCapacityHours / 40);
      await logTime(person.id, date, task.id, { hours, teamId: task.teamId });
    }
  }
  console.log(`Done: 2 teams, ${people.length} members, ${projects.length} projects, ${tasks.length} tasks, ${leaves.length} leave requests.`);
  console.log(`Admin login: ${SEED_ADMIN.email} (password in scripts/seed.ts)`);
}

main().catch(error => { console.error(error); process.exit(1); });
