"use client";

import { useRouter } from "next/navigation";
import { TeamDirectory } from "@/components/arc/blocks/team-directory/team-directory";
import type { DirectoryPerson, TimeOffRequest } from "@/components/arc/blocks/team-directory/team-directory-data";
import { decideLeave } from "@/app/actions/leave";

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

/** Arc's team directory on real members and leave. Approve or decline goes through the decideLeave Server Action. */
export function DirectoryView({ people, timeOff, viewerId, teamName, page, now, timeZone, offices }: DirectoryViewProps) {
  const router = useRouter();
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
        onTimeOffDecision={async (id, decision) => {
          const result = await decideLeave({ id, decision });
          if (!result.ok) window.alert(result.error);
          router.refresh();
        }}
      />
    </div>
  );
}
