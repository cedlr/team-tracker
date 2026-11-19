import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getMember, listTeams } from "./db";
import { TEAM_COOKIE } from "./team-cookie";
import type { PublicMember, Team } from "./schemas";

export interface Viewer { member: PublicMember; teams: Team[]; team: Team; isLead: boolean }

/** The signed in member, the teams they belong to and the selected team (cookie, else their first team). */
export async function requireViewer(): Promise<Viewer> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const member = await getMember(session.user.id);
  if (!member) redirect("/login");
  const all = await listTeams();
  const mine = member.isAdmin ? all : all.filter(team => member.memberships.some(m => m.teamId === team.id));
  if (!mine.length) throw new Error("This account is not in any team yet.");
  const wanted = (await cookies()).get(TEAM_COOKIE)?.value;
  const team = mine.find(t => t.id === wanted) ?? mine[0];
  const role = member.memberships.find(m => m.teamId === team.id)?.role;
  return { member, teams: mine, team, isLead: member.isAdmin || role === "lead" || role === "admin" };
}
