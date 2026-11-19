"use client";

import { ProfilePage } from "@/components/arc/blocks/profile-page/profile-page";
import type { ProfileDetails, ProfileProject, ProfileStat } from "@/components/arc/blocks/profile-page/profile-page-data";
import { RolesPermissions } from "@/components/arc/blocks/roles-permissions/roles-permissions";
import { InvitePeople } from "@/components/arc/blocks/invite-people/invite-people";
import { AppScreen } from "./app-screen";

/**
 * Profile on real data. Roles and permissions and Invite people are Arc's blocks with their own sample state:
 * they render for leads but do not save yet (no props for data or persistence).
 */
export function SettingsView({ profile, stats, projects, teamName, isLead }: { profile: ProfileDetails; stats: ProfileStat[]; projects: ProfileProject[]; teamName: string; isLead: boolean }) {
  return (
    <AppScreen title="Settings" meta={teamName}>
      <div className="tt-stack">
        <ProfilePage profile={profile} stats={stats} projects={projects} activity={[]} defaultTab="projects" editable={false} />
        {isLead && <RolesPermissions workspace={teamName} />}
        {isLead && <InvitePeople />}
      </div>
    </AppScreen>
  );
}
