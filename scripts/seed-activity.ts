/**
 * Adds realistic demo activity on top of the real team data: time logs, daily check-ins / check-outs and a few
 * leave records for the last ~6 weeks of working days. Members, projects and tasks are never changed.
 *
 *   npm run seed:activity -- [--team <id>] [--weeks 6] [--yes]   # add activity (dry run without --yes)
 *   npm run seed:activity -- --reset                              # remove only what this script added
 *
 * Every write is tracked in the set `seed:activity` ("time|<key>|<field>", "att|<key>|<field>", "leave|<id>")
 * and every value carries source: "seed", so --reset removes exactly those and nothing a person entered.
 * Existing attendance / time entries are never overwritten. Writes go out in Upstash pipelines.
 */
import { addDays, format, isWeekend, parseISO, startOfMonth, startOfWeek } from "date-fns";
import { getTimeLogs, listLeaves, listMembers, listTasks } from "@/lib/db";
import { kv, usingRedis } from "@/lib/kv";
import { keys } from "@/lib/keys";
import { redis } from "@/lib/redis";
import { utilizationFor } from "@/lib/utilization";
import { zonedISODate } from "@/lib/time";
import type { AttendanceDay, Leave, PublicMember, Task, TimeEntry } from "@/lib/schemas";

const TRACK = "seed:activity";
const SOURCE = "seed";
const args = process.argv.slice(2);
const arg = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const WEEKS = Number(arg("--weeks") ?? 6);

/* Deterministic randomness so a re-run after --reset gives the same picture. */
let state = 20261119;
const rand = () => { state = (state * 48271) % 2147483647; return state / 2147483647; };
const between = (lo: number, hi: number) => lo + rand() * (hi - lo);
const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)];
const half = (n: number) => Math.round(n * 2) / 2;
const iso = (d: Date) => format(d, "yyyy-MM-dd");
/** A Kuala Lumpur wall-clock time (UTC+8, no DST) on a date, as a UTC ISO string. */
const klInstant = (date: string, minutes: number) => new Date(Date.parse(`${date}T00:00:00Z`) + (minutes - 8 * 60) * 60_000).toISOString();

type Op = { kind: "hset"; key: string; field: string; value: unknown } | { kind: "set"; key: string; value: unknown } | { kind: "sadd"; key: string; member: string };

async function flush(ops: Op[]) {
  if (usingRedis && redis) {
    for (let i = 0; i < ops.length; i += 400) {
      const pipe = redis.pipeline();
      for (const op of ops.slice(i, i + 400)) {
        if (op.kind === "hset") pipe.hset(op.key, { [op.field]: op.value });
        else if (op.kind === "set") pipe.set(op.key, op.value);
        else pipe.sadd(op.key, op.member);
      }
      await pipe.exec();
    }
    return;
  }
  for (const op of ops) {
    if (op.kind === "hset") await kv.hset(op.key, { [op.field]: op.value });
    else if (op.kind === "set") await kv.set(op.key, op.value);
    else await kv.sadd(op.key, op.member);
  }
}

async function reset() {
  const tracked = await kv.smembers(TRACK);
  const hashFields = new Map<string, string[]>();
  const leaves: string[] = [];
  for (const entry of tracked) {
    const [kind, a, b] = entry.split("|");
    if (kind === "leave") leaves.push(a);
    else hashFields.set(a, [...(hashFields.get(a) ?? []), b]);
  }
  const leaveRecords = await kv.mget<Leave>(leaves.map(keys.leave));
  if (usingRedis && redis) {
    const all = [...hashFields.entries()];
    for (let i = 0; i < all.length; i += 300) {
      const pipe = redis.pipeline();
      for (const [key, fields] of all.slice(i, i + 300)) pipe.hdel(key, ...fields);
      await pipe.exec();
    }
    const pipe = redis.pipeline();
    leaves.forEach((id, i) => { pipe.del(keys.leave(id)); const team = leaveRecords[i]?.teamId; if (team) pipe.srem(keys.teamLeaves(team), id); });
    pipe.del(TRACK);
    await pipe.exec();
  } else {
    for (const [key, fields] of hashFields) await kv.hdel(key, ...fields);
    for (const [i, id] of leaves.entries()) { await kv.del(keys.leave(id)); const team = leaveRecords[i]?.teamId; if (team) await kv.srem(keys.teamLeaves(team), id); }
    await kv.del(TRACK);
  }
  console.log(`Removed seeded activity: ${tracked.length - leaves.length} attendance/time fields, ${leaves.length} leave records.`);
}

async function main() {
  if (args.includes("--reset")) return reset();
  if ((await kv.smembers(TRACK)).length) { console.log("Seeded activity already exists. Run with --reset first."); return; }

  const teamId = arg("--team") ?? "hlbinbranch";
  const [members, tasks, existingLeaves] = await Promise.all([listMembers(teamId), listTasks({ teamId }), listLeaves(teamId)]);
  const people = members.filter(m => (m.memberships.find(s => s.teamId === teamId)?.allocation ?? 0) > 0);
  if (!people.length) throw new Error(`No members with capacity in team ${teamId}.`);
  const lead = people.find(m => m.isAdmin) ?? people[0];

  const today = zonedISODate();
  const nowKl = (() => { const t = new Date(Date.now() + 8 * 3_600_000); return t.getUTCHours() * 60 + t.getUTCMinutes(); })();
  const start = addDays(parseISO(today), -(WEEKS * 7 - 1));
  const days: string[] = [];
  for (let d = start; iso(d) <= today; d = addDays(d, 1)) if (!isWeekend(d)) days.push(iso(d));
  const ahead: string[] = [];
  for (let d = addDays(parseISO(today), 1); ahead.length < 10; d = addDays(d, 1)) if (!isWeekend(d)) ahead.push(iso(d));

  /* Per-person profile: share of a full day they log. Sorted so a couple sit low and one or two run over. */
  const targets = [0.6, 0.66, 0.8, 0.86, 0.9, 0.93, 0.96, 0.99, 1.02, 1.05, 1.1, 1.14];
  const order = [...people].sort((a, b) => a.id.localeCompare(b.id));
  const profile = new Map(order.map((m, i) => [m.id, { share: targets[(i * 5) % targets.length], gapRate: between(0.01, 0.05) }]));

  /* Leave: about five records, some in the last two weeks and some in the next two. */
  const leaveOps: Op[] = [];
  const leaveDays = new Map<string, Set<string>>();
  const recent = days.slice(-10, -1);
  const plans: { when: string[]; type: Leave["type"] }[] = [
    { when: recent, type: "annual" }, { when: recent, type: "sick" }, { when: recent, type: "annual" },
    { when: ahead, type: "annual" }, { when: ahead, type: "sick" },
  ];
  const onLeave = new Set<string>();
  const leaves: Leave[] = [];
  for (const [i, plan] of plans.entries()) {
    const person = order[(i * 7 + 3) % order.length];
    if (onLeave.has(person.id)) continue;
    onLeave.add(person.id);
    const length = plan.type === "sick" ? 1 + Math.floor(rand() * 2) : 1 + Math.floor(rand() * 3);
    const at = Math.floor(rand() * (plan.when.length - length));
    const span = plan.when.slice(at, at + length);
    const leave: Leave & { source: string } = {
      id: `seed-leave-${i + 1}`, teamId, memberId: person.id, type: plan.type, from: span[0], to: span.at(-1)!, days: span.length,
      note: plan.type === "sick" ? "Medical leave (MC), approved by email" : "Annual leave, approved by email",
      addedBy: lead.id, createdAt: klInstant(plan.when === ahead ? days.at(-3)! : span[0], 9 * 60 + 15), source: SOURCE,
    };
    leaves.push(leave);
    leaveOps.push({ kind: "set", key: keys.leave(leave.id), value: leave }, { kind: "sadd", key: keys.teamLeaves(teamId), member: leave.id }, { kind: "sadd", key: TRACK, member: `leave|${leave.id}` });
    leaveDays.set(person.id, new Set(span));
  }
  for (const l of existingLeaves) for (const d of days) if (d >= l.from && d <= l.to) leaveDays.set(l.memberId, new Set([...(leaveDays.get(l.memberId) ?? []), d]));

  /* Existing real entries are kept: read them first and skip those fields. */
  const months = Array.from(new Set([...days, ...ahead].map(d => d.slice(0, 7))));
  const existingAtt = await kv.hgetallMany<AttendanceDay>(people.flatMap(m => months.map(mo => keys.attendance(m.id, mo))));
  const attTaken = new Set<string>();
  people.forEach((m, i) => months.forEach((mo, j) => Object.keys(existingAtt[i * months.length + j]).forEach(day => attTaken.add(`${m.id}:${mo}-${day}`))));
  const existingLogs = await getTimeLogs(people.map(m => m.id), days[0], today);

  const ops: Op[] = [...leaveOps];
  let attCount = 0, logCount = 0, hoursTotal = 0;
  const workedTasks = (m: PublicMember) => {
    const mine = tasks.filter(t => t.assigneeId === m.id);
    const active = mine.filter(t => t.status === "progress" || t.status === "review" || t.status === "done");
    if (active.length) return active;
    if (mine.length) return mine;
    // Admins with nothing assigned review the team's in-flight work.
    return tasks.filter(t => t.status === "review" || t.status === "progress");
  };

  for (const m of people) {
    const p = profile.get(m.id)!;
    const pool = workedTasks(m);
    if (!pool.length) continue;
    const spent = new Map<string, number>();
    const daily = (m.weeklyCapacityHours / 5) * (m.memberships.find(s => s.teamId === teamId)?.allocation ?? 1);
    for (const date of days) {
      if (date < m.started) continue; // nothing before they joined
      // Leave days get a "leave" attendance mark and no logs.
      if (leaveDays.get(m.id)?.has(date)) {
        if (!attTaken.has(`${m.id}:${date}`)) {
          const key = keys.attendance(m.id, date.slice(0, 7)), field = date.slice(8, 10);
          ops.push({ kind: "hset", key, field, value: { status: "leave", teamId, at: klInstant(date, 9 * 60), source: SOURCE } }, { kind: "sadd", key: TRACK, member: `att|${key}|${field}` });
          attCount++;
        }
        continue;
      }
      if (date !== today && rand() < p.gapRate) continue; // an unrecorded day
      const isToday = date === today;
      const inAt = Math.round(between(8 * 60 + 30, 10 * 60));
      if (isToday && nowKl < inAt) continue;
      const outAt = Math.round(between(17 * 60, 19 * 60));
      if (!attTaken.has(`${m.id}:${date}`)) {
        const key = keys.attendance(m.id, date.slice(0, 7)), field = date.slice(8, 10);
        const day: AttendanceDay & { source: string } = { status: rand() < 0.22 ? "remote" : "present", teamId, at: klInstant(date, inAt), source: SOURCE };
        if (!isToday || nowKl > outAt) day.outAt = klInstant(date, outAt);
        ops.push({ kind: "hset", key, field, value: day }, { kind: "sadd", key: TRACK, member: `att|${key}|${field}` });
        attCount++;
      }
      // Hours: the person's usual share of a full day, varied, a little lower on Fridays; today only up to now.
      let hours = half(Math.min(10, Math.max(3, daily * p.share + between(-1.25, 1.25) - (parseISO(date).getDay() === 5 ? 0.5 : 0))));
      if (isToday) hours = half(Math.max(0, Math.min(hours, (Math.min(nowKl, outAt) - inAt) / 60 - 1)));
      if (hours <= 0) continue;
      // One to three tasks a day, favouring tasks still under their estimate.
      const fresh = pool.filter(t => (spent.get(t.id) ?? 0) < (t.estimateHours ?? 24) * 1.3);
      const choices = fresh.length ? fresh : pool;
      const count = Math.min(choices.length, hours >= 6 ? 1 + Math.floor(rand() * 3) : 1 + Math.floor(rand() * 2));
      const picked: Task[] = [];
      while (picked.length < count) { const t = pick(choices); if (!picked.includes(t)) picked.push(t); }
      let left = hours;
      picked.forEach((t, i) => {
        const h = i === picked.length - 1 ? left : half(Math.max(0.5, left * between(0.3, 0.65)));
        left = half(left - h);
        if (h <= 0 || existingLogs[m.id]?.[date]?.[t.id]) return;
        const key = keys.time(m.id, date);
        const entry: TimeEntry & { source: string } = { hours: h, teamId, source: SOURCE };
        ops.push({ kind: "hset", key, field: t.id, value: entry }, { kind: "sadd", key: TRACK, member: `time|${key}|${t.id}` });
        spent.set(t.id, (spent.get(t.id) ?? 0) + h);
        logCount++; hoursTotal += h;
      });
    }
  }

  console.log(`${args.includes("--yes") ? "Writing" : "Would write"} ${logCount} time entries (${Math.round(hoursTotal)}h), ${attCount} attendance days, ${leaves.length} leave records over ${days.length} working days (${days[0]} to ${today}) to ${usingRedis ? "Upstash Redis" : "./.data/kv.json"}.`);
  if (!args.includes("--yes")) { console.log("Dry run. Re-run with --yes to write."); return; }
  const started = Date.now();
  await flush(ops);
  console.log(`Done in ${Math.round((Date.now() - started) / 1000)}s.`);

  /* Read back and report utilization the way the app computes it. */
  const allLeaves = await listLeaves(teamId);
  const ranges = { week: iso(startOfWeek(parseISO(today), { weekStartsOn: 1 })), month: iso(startOfMonth(parseISO(today))), sixWeeks: days[0] };
  const report: Record<string, Record<string, string>> = {};
  for (const [label, from] of Object.entries(ranges)) {
    const logs = await getTimeLogs(people.map(m => m.id), from, today);
    for (const u of utilizationFor(people, teamId, from, today, allLeaves, logs)) {
      report[u.name] ??= {};
      report[u.name][label] = `${Math.round(u.rate * 100)}%`;
    }
  }
  console.table(report);
  console.log(`Leave: ${leaves.map(l => `${people.find(m => m.id === l.memberId)?.name} ${l.type} ${l.from}${l.to !== l.from ? `..${l.to}` : ""}`).join("; ")}`);
}

main().catch(error => { console.error(error); process.exit(1); });
