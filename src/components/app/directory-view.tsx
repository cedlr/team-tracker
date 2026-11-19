"use client";

import { TeamDirectory } from "@/components/arc/blocks/team-directory/team-directory";
import type { DirectoryPerson, TimeOffRequest } from "@/components/arc/blocks/team-directory/team-directory-data";

export interface DirectoryViewProps {
  people: DirectoryPerson[];
  timeOff: TimeOffRequest[];
  viewerId: string;
  teamName: string;
  page: "people" | "timeoff";
  now: number;
  timeZone: string;
  offices: { id: string; utcOffset: number; label: string }[];
}

/** Arc's team directory on real members and their leave records. */
export function DirectoryView({ people, timeOff, viewerId, teamName, page, now, timeZone, offices }: DirectoryViewProps) {
  return (
    <div className="tt-screen">
      <TeamDirectory
        people={people}
        timeOff={timeOff}
        viewerId={viewerId}
        workspaceName={teamName}
        defaultPage={page}
        defaultSelectedId={viewerId}
        defaultView="grid"
        now={now}
        timeZone={timeZone}
        offices={offices}
      />
    </div>
  );
}
