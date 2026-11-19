"use client";

import type { ReactNode } from "react";
import { ScreenShell } from "@/components/arc/screen-shell/screen-shell";

/** Arc's screen shell for pages that compose Arc items (no screen of their own). Nav, team and account come from AppShell. */
export function AppScreen({ title, meta, actions, children }: { title: string; meta?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="tt-screen">
      <ScreenShell workspace={{ name: "" }} nav={[]} header={{ title, meta, actions }}>
        {children}
      </ScreenShell>
    </div>
  );
}
