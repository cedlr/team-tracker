"use client";

import { useState, useTransition, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, UserRound, Plus } from "lucide-react";
import { ScreenShellAppProvider, type ScreenShellTone } from "@/components/arc/screen-shell/screen-shell";
import { Button } from "@/components/arc/button/button";
import { appNav, navIcons, navIdFor } from "./nav";
import { selectTeam } from "@/app/actions/team";
import { checkIn } from "@/app/actions/attendance";
import { logout } from "@/app/actions/auth";

export interface AppShellData {
  teams: { id: string; name: string; tone: ScreenShellTone; detail: string }[];
  teamId: string;
  account: { name: string; email: string; avatar?: string; title: string };
  checkedInAt: string | null;
  canManage: boolean;
}

/** Feeds the shared nav, team switcher, account and check-in into every Arc screen-shell on the page. */
export function AppShell({ data, children }: { data: AppShellData; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [checkedInAt, setCheckedInAt] = useState(data.checkedInAt);

  const time = checkedInAt ? new Date(checkedInAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : null;
  const checkInButton = (
    <Button
      variant={checkedInAt ? "secondary" : "primary"}
      size="sm"
      loading={pending}
      aria-disabled={Boolean(checkedInAt) || undefined}
      style={{ width: "100%" }}
      onClick={() => {
        if (checkedInAt || pending) return;
        startTransition(async () => {
          const result = await checkIn({ status: "present" });
          if (result.ok) { setCheckedInAt(result.at); router.refresh(); }
        });
      }}
    >
      <navIcons.checkIn size={16} strokeWidth={1.75} aria-hidden="true" />
      {time ? `Checked in at ${time}` : "Check in for today"}
    </Button>
  );

  return (
    <ScreenShellAppProvider value={{
      nav: appNav,
      currentId: navIdFor(pathname),
      onNavigate: id => router.push(id),
      sidebarTop: checkInButton,
      workspace: {
        name: data.teams.find(team => team.id === data.teamId)?.name ?? "Team",
        options: data.teams.map(team => ({ id: team.id, name: team.name, detail: team.detail, tone: team.tone })),
        activeId: data.teamId,
        onSelect: id => startTransition(async () => { await selectTeam(id); router.refresh(); }),
        actions: data.canManage ? [{ id: "new-team", label: "Manage teams", icon: Plus, onSelect: () => router.push("/settings") }] : undefined,
      },
      account: {
        name: data.account.name,
        detail: data.account.email,
        avatar: data.account.avatar,
        menu: [
          { id: "profile", label: "Profile", icon: UserRound, onSelect: () => router.push("/settings") },
          { id: "sign-out", label: "Sign out", icon: LogOut, danger: true, separatorBefore: true, onSelect: () => startTransition(() => logout()) },
        ],
      },
    }}>
      {children}
    </ScreenShellAppProvider>
  );
}
