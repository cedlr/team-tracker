import { CalendarDays, Clock4, FolderKanban, GanttChart, Gauge, LayoutDashboard, ListTodo, Plane, Settings, Users } from "lucide-react";
import type { ScreenShellNavItem } from "@/components/arc/screen-shell/screen-shell";

/** The one nav config every screen shares. Ids are routes. */
export const appNav: ScreenShellNavItem[] = [
  { id: "/", label: "Dashboard", icon: LayoutDashboard },
  { id: "/tasks", label: "Tasks", icon: ListTodo },
  { id: "/projects", label: "Projects", icon: FolderKanban },
  { id: "/timeline", label: "Timeline", icon: GanttChart },
  { id: "/calendar", label: "Calendar", icon: CalendarDays },
  { id: "/people", label: "People", icon: Users },
  { id: "/leave", label: "Leave", icon: Plane },
  { id: "/utilization", label: "Utilization", icon: Gauge },
  { id: "/settings", label: "Settings", icon: Settings },
];

export const navIcons = { checkIn: Clock4 };

/** The nav id for a pathname: "/projects/abc" -> "/projects". */
export function navIdFor(pathname: string) {
  if (pathname === "/") return "/";
  const match = appNav.find(item => item.id !== "/" && (pathname === item.id || pathname.startsWith(`${item.id}/`)));
  return match?.id ?? "/";
}
