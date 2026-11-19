"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { requireViewer } from "@/lib/session";
import { getMember, getMemberForLogin, getMemberRecord, listMembers, listTeams, saveMember, saveTeam } from "@/lib/db";
import { inviteInput, passwordInput, profileInput, roleChangeInput, teamNameInput, teamSchema, type Membership } from "@/lib/schemas";
import { zonedISODate } from "@/lib/time";

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24);
const teamKey = (name: string) => (name.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 3) || "TM").padEnd(2, "X");
const titleCase = (value: string) => value.split(/[._+-]+/).filter(Boolean).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");

export async function updateProfile(input: unknown) {
  const parsed = profileInput.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid profile" };
  const { member } = await requireViewer();
  const record = await getMemberRecord(member.id);
  if (!record) return { ok: false as const, error: "Account not found." };
  await saveMember({ ...record, name: parsed.data.name, title: parsed.data.title, website: parsed.data.website || undefined, bio: parsed.data.bio || undefined });
  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function changePassword(input: unknown) {
  const parsed = passwordInput.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Use at least 8 characters" };
  const { member } = await requireViewer();
  const record = await getMemberRecord(member.id);
  if (!record?.passwordHash) return { ok: false as const, error: "This account has no password yet." };
  const matches = await bcrypt.compare(parsed.data.currentPassword, record.passwordHash);
  if (!matches) return { ok: false as const, error: "The current password is wrong." };
  await saveMember({ ...record, passwordHash: await bcrypt.hash(parsed.data.nextPassword, 10) });
  return { ok: true as const };
}

/** Adds someone to the current team. A new email gets an account and a one-time temporary password. */
export async function inviteMember(input: unknown) {
  const parsed = inviteInput.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid invite" };
  const { team, isLead } = await requireViewer();
  if (!isLead) return { ok: false as const, error: "Only team leads can add members." };
  const email = parsed.data.email.toLowerCase();
  const existing = await getMemberForLogin(email);
  if (existing) {
    if (existing.memberships.some(entry => entry.teamId === team.id)) return { ok: true as const, note: `${existing.name} is already on ${team.name}` };
    const membership: Membership = { teamId: team.id, allocation: 1, role: parsed.data.role };
    await saveMember({ ...existing, memberships: [...existing.memberships, membership] });
    revalidatePath("/", "layout");
    return { ok: true as const, note: `Added ${existing.name} to ${team.name}` };
  }
  let id = slug(email.split("@")[0]) || "member";
  if (await getMember(id)) id = `${id}-${randomBytes(2).toString("hex")}`;
  const password = randomBytes(9).toString("base64url");
  const name = parsed.data.name?.trim() || titleCase(email.split("@")[0]) || email;
  await saveMember({
    id, name, email, passwordHash: await bcrypt.hash(password, 10), title: "", department: "Engineering",
    weeklyCapacityHours: 40, started: zonedISODate(), isAdmin: false,
    memberships: [{ teamId: team.id, allocation: 1, role: parsed.data.role }],
  });
  revalidatePath("/", "layout");
  return { ok: true as const, note: `Temporary password: ${password}` };
}

export async function setMemberRole(input: unknown) {
  const parsed = roleChangeInput.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid role" };
  const { team, isLead } = await requireViewer();
  if (!isLead) return { ok: false as const, error: "Only team leads can change roles." };
  const record = await getMemberRecord(parsed.data.memberId);
  const current = record?.memberships.find(entry => entry.teamId === team.id);
  if (!record || !current) return { ok: false as const, error: "That person is not on this team." };
  if (current.role === "admin" && parsed.data.role !== "admin") {
    const people = await listMembers(team.id);
    const otherAdmin = people.some(person => person.id !== record.id && (person.isAdmin || person.memberships.some(entry => entry.teamId === team.id && entry.role === "admin")));
    if (!otherAdmin) return { ok: false as const, error: "The team needs at least one admin." };
  }
  await saveMember({ ...record, memberships: record.memberships.map(entry => entry.teamId === team.id ? { ...entry, role: parsed.data.role } : entry) });
  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function renameTeam(input: unknown) {
  const parsed = teamNameInput.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid name" };
  const { team, isLead } = await requireViewer();
  if (!isLead) return { ok: false as const, error: "Only team leads can rename a team." };
  await saveTeam({ ...team, name: parsed.data.name });
  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function createTeam(input: unknown) {
  const parsed = teamNameInput.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid name" };
  const { member, isLead } = await requireViewer();
  if (!isLead) return { ok: false as const, error: "Only team leads can add a team." };
  const teams = await listTeams();
  let id = slug(parsed.data.name) || "team";
  if (teams.some(team => team.id === id)) id = `${id}-${randomBytes(2).toString("hex")}`;
  const keyBase = teamKey(parsed.data.name);
  const key = teams.some(team => team.key === keyBase) ? `${keyBase.slice(0, 2)}${teams.length % 10}`.slice(0, 5) : keyBase;
  await saveTeam(teamSchema.parse({ id, name: parsed.data.name, tone: "teal", key }));
  const record = await getMemberRecord(member.id);
  if (!record) return { ok: false as const, error: "Account not found." };
  await saveMember({ ...record, memberships: [...record.memberships.filter(entry => entry.teamId !== id), { teamId: id, allocation: 1, role: "admin" }] });
  revalidatePath("/", "layout");
  return { ok: true as const, teamId: id };
}

export async function saveRoleGrants(grants: unknown) {
  const parsed = teamSchema.shape.grants.safeParse(grants);
  if (!parsed.success || !parsed.data) return { ok: false as const, error: "Invalid permissions" };
  const { team, isLead } = await requireViewer();
  if (!isLead) return { ok: false as const, error: "Only team leads can change permissions." };
  await saveTeam({ ...team, grants: parsed.data });
  revalidatePath("/", "layout");
  return { ok: true as const };
}
