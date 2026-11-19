"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ProfilePage } from "@/components/arc/blocks/profile-page/profile-page";
import type { ProfileDetails, ProfileProject, ProfileStat } from "@/components/arc/blocks/profile-page/profile-page-data";
import { RolesPermissions, type MemberRole } from "@/components/arc/blocks/roles-permissions/roles-permissions";
import { InvitePeople } from "@/components/arc/blocks/invite-people/invite-people";
import type { Entry, Role } from "@/components/arc/blocks/invite-people/invite-people-data";
import { Button } from "@/components/arc/button/button";
import { Input } from "@/components/arc/input/input";
import { PasswordField } from "@/components/arc/password-field/password-field";
import { changePassword, createTeam, inviteMember, renameTeam, saveRoleGrants, setMemberRole, updateProfile } from "@/app/actions/members";
import { selectTeam } from "@/app/actions/team";
import { AppScreen } from "./app-screen";

const inviteRoles: { value: Role; label: string; description: string }[] = [
  { value: "admin", label: "Admin", description: "Manages the team, members and leave records" },
  { value: "lead", label: "Lead", description: "Records leave and manages members" },
  { value: "member", label: "Member", description: "Works on tasks and checks in daily" },
];

export function SettingsView({
  profile, stats, projects, teamName, teamId, isLead, members, grants,
}: {
  profile: ProfileDetails;
  stats: ProfileStat[];
  projects: ProfileProject[];
  teamName: string;
  teamId: string;
  isLead: boolean;
  members: MemberRole[];
  grants?: Record<string, Record<string, boolean>>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [team, setTeam] = useState(teamName);
  const [nextTeam, setNextTeam] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const run = (work: () => Promise<{ ok: boolean; error?: string; note?: string; teamId?: string }>, after?: (result: { teamId?: string }) => void | Promise<void>) => {
    setError(""); setMessage("");
    start(async () => {
      const result = await work();
      if (!result.ok) { setError(result.error ?? "Could not save"); return; }
      setMessage(result.note ?? "Saved");
      await after?.(result);
      router.refresh();
    });
  };

  const roster: Entry[] = members.map(member => ({ email: member.email, name: member.name, title: member.role, src: member.avatar }));

  return (
    <AppScreen title="Settings" meta={teamName}>
      <div className="tt-stack">
        <ProfilePage
          profile={profile}
          stats={stats}
          projects={projects}
          activity={[]}
          defaultTab="projects"
          editable
          onSave={async next => {
            const result = await updateProfile({ name: next.name, title: next.headline, location: next.location, website: next.website, bio: next.bio });
            if (!result.ok) throw new Error(result.error);
            router.refresh();
          }}
        />
        <form className="tt-stack" onSubmit={event => { event.preventDefault(); run(() => changePassword({ currentPassword, nextPassword }), () => { setCurrentPassword(""); setNextPassword(""); }); }}>
          <PasswordField label="Current password" value={currentPassword} autoComplete="current-password" onChange={event => setCurrentPassword(event.target.value)} />
          <PasswordField label="New password" description="At least 8 characters" value={nextPassword} autoComplete="new-password" onChange={event => setNextPassword(event.target.value)} />
          <div className="tt-row">
            <Button type="submit" loading={pending}>Change password</Button>
          </div>
        </form>
        {isLead && (
          <form className="tt-stack" onSubmit={event => event.preventDefault()}>
            <div className="tt-row">
              <Input label="Team name" value={team} onChange={event => setTeam(event.target.value)} />
              <Button type="button" variant="secondary" loading={pending} onClick={() => run(() => renameTeam({ name: team }))}>Rename team</Button>
            </div>
            <div className="tt-row">
              <Input label="New team" value={nextTeam} placeholder="Platform" onChange={event => setNextTeam(event.target.value)} />
              <Button type="button" loading={pending} onClick={() => run(() => createTeam({ name: nextTeam }), async result => {
                if (result.teamId) await selectTeam(result.teamId);
                setNextTeam("");
              })}>Add team</Button>
            </div>
          </form>
        )}
        {message && <p role="status">{message}</p>}
        {error && <p role="alert">{error}</p>}
        {isLead && <RolesPermissions
          key={teamId}
          workspace={teamName}
          members={members}
          grants={grants}
          onMemberRole={(memberId, role) => setMemberRole({ memberId, role })}
          onSave={next => saveRoleGrants(next)}
        />}
        {isLead && <InvitePeople
          key={teamId}
          directory={[]}
          team={roster}
          roles={inviteRoles}
          seatLimit={200}
          onInvite={async people => {
            const notes: string[] = [];
            for (const person of people) {
              const result = await inviteMember({ email: person.email, name: person.name, role: person.role === "guest" ? "member" : person.role });
              if (!result.ok) return result;
              notes.push(`${person.email}: ${result.note ?? "Added"}`);
            }
            router.refresh();
            return { ok: true, note: notes.join(" · ") };
          }}
        />}
      </div>
    </AppScreen>
  );
}
