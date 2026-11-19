import type { Metadata } from "next";
import { DirectoryView } from "@/components/app/directory-view";
import { requireViewer } from "@/lib/session";
import { listLeaves, listMembers } from "@/lib/db";
import { officesFor, toDirectoryPeople, toTimeOff } from "@/lib/directory";
import { APP_TIME_ZONE, nowMs, zonedISODate } from "@/lib/time";

export const metadata: Metadata = { title: "People" };

export default async function PeoplePage() {
  const { team, member } = await requireViewer();
  const [members, leaves] = await Promise.all([listMembers(team.id), listLeaves(team.id)]);
  const today = zonedISODate();
  const people = toDirectoryPeople(members, leaves, today);
  return <DirectoryView key={team.id} page="people" people={people} timeOff={toTimeOff(leaves)} viewerId={member.id} teamName={team.name} now={nowMs()} timeZone={APP_TIME_ZONE} offices={officesFor(people)} />;
}
