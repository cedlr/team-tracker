import type { Metadata } from "next";
import { CalendarView } from "@/components/app/calendar-view";
import { requireViewer } from "@/lib/session";
import { listEvents, listLeaves, listMembers, listTasks } from "@/lib/db";
import { avatarSrc } from "@/lib/avatar";
import { zonedISODate } from "@/lib/time";

export const metadata: Metadata = { title: "Calendar" };

const leaveLabel = { annual: "Annual leave", sick: "Sick leave", personal: "Personal day", parental: "Parental leave", unpaid: "Unpaid leave" } as const;

export default async function CalendarPage() {
  const { team, member } = await requireViewer();
  const [members, leaves, tasks, stored] = await Promise.all([listMembers(team.id), listLeaves(team.id), listTasks({ teamId: team.id }), listEvents(team.id)]);
  const name = new Map(members.map(m => [m.id, m.name]));
  const events = [
    ...leaves.map(l => ({
      id: l.id, title: `${name.get(l.memberId) ?? "Someone"}: ${leaveLabel[l.type]}`, calendarId: "leave",
      start: l.from, end: l.to === l.from ? undefined : l.to, attendees: [{ id: l.memberId }], notes: l.note,
    })),
    ...tasks.filter(t => t.due && t.status !== "done").map(t => ({
      id: `due-${t.id}`, title: `Due: ${t.title}`, calendarId: "deadlines", start: t.due!, attendees: t.assigneeId ? [{ id: t.assigneeId }] : [],
    })),
    ...stored.map(event => ({
      id: event.id, title: event.title, calendarId: event.kind === "holiday" ? "holidays" : event.kind === "deadline" ? "deadlines" : "holidays",
      start: event.start, end: event.end, notes: event.kind === "focus" ? "Focus time" : undefined,
    })),
  ];
  return <CalendarView
    key={team.id}
    events={events}
    people={members.map(m => ({ id: m.id, name: m.name, email: m.email, avatar: avatarSrc(m.avatar) }))}
    userId={member.id}
    today={zonedISODate()}
  />;
}
