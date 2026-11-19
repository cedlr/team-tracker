"use client";

import { useRouter } from "next/navigation";
import { CalendarClock, Flag, Palmtree, Plane } from "lucide-react";
import { MonthCalendar } from "@/components/arc/blocks/month-calendar/month-calendar";
import type { CalendarEvent, CalendarPerson, CalendarSource } from "@/components/arc/blocks/month-calendar/month-calendar-data";
import { createCalendarItem, deleteCalendarItem } from "@/app/actions/events";

const calendars: CalendarSource[] = [
  { id: "leave", name: "Approved leave", color: "var(--tone-green)", icon: Plane },
  { id: "leave-pending", name: "Pending leave", color: "var(--tone-amber)", icon: CalendarClock },
  { id: "deadlines", name: "Task deadlines", color: "var(--tone-sky)", icon: Flag },
  { id: "holidays", name: "Holidays", color: "var(--tone-rose)", icon: Palmtree },
];

/** Arc's month calendar showing the team's leave and task due dates. New events on "Approved leave" become leave requests. */
export function CalendarView({ events, people, userId, today }: { events: CalendarEvent[]; people: CalendarPerson[]; userId: string; today: string }) {
  const router = useRouter();
  return (
    <div className="tt-screen">
      <MonthCalendar
        events={events}
        calendars={calendars}
        people={people}
        userId={userId}
        today={today}
        defaultMonth={today.slice(0, 7)}
        weekStartsOn={1}
        onEventCreate={async event => {
          const result = await createCalendarItem({ id: event.id, title: event.title, calendarId: event.calendarId, start: event.start, end: event.end, notes: event.notes });
          if (!result.ok) throw new Error(result.error);
          router.refresh();
        }}
        onEventDelete={async event => {
          const result = await deleteCalendarItem({ id: event.id, title: event.title, calendarId: event.calendarId, start: event.start, end: event.end, notes: event.notes });
          if (!result.ok) throw new Error(result.error);
          router.refresh();
        }}
      />
    </div>
  );
}
