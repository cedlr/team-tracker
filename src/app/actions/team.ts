"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireViewer } from "@/lib/session";
import { TEAM_COOKIE } from "@/lib/team-cookie";

export async function selectTeam(teamId: string) {
  const viewer = await requireViewer();
  if (!viewer.teams.some(team => team.id === teamId)) return { ok: false as const, error: "You are not in that team." };
  (await cookies()).set(TEAM_COOKIE, teamId, { path: "/", sameSite: "lax", httpOnly: true, maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/", "layout");
  return { ok: true as const };
}
