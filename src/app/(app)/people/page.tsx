import type { Metadata } from "next";
import { PeopleView } from "@/components/app/people-view";
import { requireViewer } from "@/lib/session";
import { teamWork } from "@/lib/people";

export const metadata: Metadata = { title: "People" };

export default async function PeoplePage() {
  const { team } = await requireViewer();
  const { rows } = await teamWork(team);
  return <PeopleView key={team.id} rows={rows} teamName={team.name} />;
}
