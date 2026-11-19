import type { ComponentType, CSSProperties } from "react";
import { Briefcase, Flag, Plane, Rocket, Sprout } from "lucide-react";
import { avatar } from "../../lib/media";

/** Any lucide icon, or your own component that takes the same props. */
export type CalendarIcon = ComponentType<{ size?: number | string; strokeWidth?: number | string; className?: string; style?: CSSProperties; "aria-hidden"?: boolean | "true" | "false" }>;

export interface CalendarSource {
  id: string;
  name: string;
  /** Any CSS color. The sample uses Arc's categorical tones so each calendar stays distinct in both themes. */
  color: string;
  /** Drawn in the calendar's color wherever its events appear, in place of a colored dot. Defaults to a calendar glyph. */
  icon?: CalendarIcon;
}

/** An answer to an invitation. "pending" means the invite has not been answered yet. */
export type CalendarRsvp = "yes" | "maybe" | "no" | "pending";

export interface CalendarPerson {
  id: string;
  name: string;
  /** An image URL. Leave it out for initials. */
  avatar?: string;
  email?: string;
}

export interface CalendarAttendee {
  /** A CalendarPerson id. */
  id: string;
  status?: CalendarRsvp;
}

export interface CalendarVideo {
  provider: "zoom" | "meet";
  url: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  calendarId: string;
  /** ISO date of the first day. */
  start: string;
  /** ISO date of the last day, inclusive. Omit for a single day. */
  end?: string;
  /** 24 hour start time such as "09:30". Omit for all day events. */
  time?: string;
  /** 24 hour end time such as "10:15". Defaults to an hour after time. */
  endTime?: string;
  location?: string;
  /** People invited, including the organizer. */
  attendees?: CalendarAttendee[];
  /** The attendee id of whoever sent the invite. When it is not the current user, the event shows an RSVP control. */
  organizer?: string;
  /** The current user's answer. "pending" events show as outlined chips and appear under Invitations. */
  rsvp?: CalendarRsvp;
  video?: CalendarVideo;
  notes?: string;
}

export const sampleCalendars: CalendarSource[] = [
  { id: "work", name: "Work", color: "var(--tone-teal)", icon: Briefcase },
  { id: "launch", name: "Launch", color: "var(--tone-violet)", icon: Rocket },
  { id: "personal", name: "Personal", color: "var(--tone-amber)", icon: Sprout },
  { id: "travel", name: "Travel", color: "var(--tone-sky)", icon: Plane },
  { id: "holidays", name: "Holidays", color: "var(--tone-rose)", icon: Flag },
];

export const samplePeople: CalendarPerson[] = [
  { id: "emma-collins", name: "Emma Collins", avatar: avatar("emma-collins"), email: "emma@copperline.studio" },
  { id: "marcus-johnson", name: "Marcus Johnson", avatar: avatar("marcus-johnson"), email: "marcus@copperline.studio" },
  { id: "jasmine-brooks", name: "Jasmine Brooks", avatar: avatar("jasmine-brooks"), email: "jasmine@copperline.studio" },
  { id: "olivia-bennett", name: "Olivia Bennett", avatar: avatar("olivia-bennett"), email: "olivia@copperline.studio" },
  { id: "chloe-nguyen", name: "Chloe Nguyen", avatar: avatar("chloe-nguyen"), email: "chloe@copperline.studio" },
  { id: "daniel-kim", name: "Daniel Kim", avatar: avatar("daniel-kim"), email: "daniel@copperline.studio" },
  { id: "mateo-alvarez", name: "Mateo Alvarez", avatar: avatar("mateo-alvarez"), email: "mateo@copperline.studio" },
  { id: "sofia-ramirez", name: "Sofia Ramirez", avatar: avatar("sofia-ramirez"), email: "sofia@copperline.studio" },
  { id: "ava-mitchell", name: "Ava Mitchell", avatar: avatar("ava-mitchell"), email: "ava@copperline.studio" },
  { id: "nathan-cole", name: "Nathan Cole", avatar: avatar("nathan-cole"), email: "nathan@copperline.studio" },
  { id: "diane-foster", name: "Diane Foster", avatar: avatar("diane-foster"), email: "diane@copperline.studio" },
  { id: "andre-williams", name: "Andre Williams", avatar: avatar("andre-williams"), email: "andre@copperline.studio" },
];

const team = (ids: string[], statuses: Record<string, CalendarRsvp> = {}): CalendarAttendee[] => ids.map(id => ({ id, status: statuses[id] ?? "yes" }));
const zoom = (id: string): CalendarVideo => ({ provider: "zoom", url: `https://zoom.us/j/${id}` });
const meet = (code: string): CalendarVideo => ({ provider: "meet", url: `https://meet.google.com/${code}` });
const sprint = ["emma-collins", "marcus-johnson", "olivia-bennett", "daniel-kim", "chloe-nguyen"];

export const sampleEvents: CalendarEvent[] = [
  // Late October
  { id: "e01", title: "Q4 roadmap review", calendarId: "work", start: "2026-10-27", time: "10:00", endTime: "11:30", organizer: "nathan-cole", rsvp: "yes", attendees: team(["nathan-cole", "emma-collins", "jasmine-brooks", "marcus-johnson"]), video: zoom("84213397561") },
  { id: "e02", title: "Retro", calendarId: "work", start: "2026-10-30", time: "16:00", endTime: "16:45", organizer: "emma-collins", attendees: team(sprint), video: meet("kfz-qwrt-mbx") },
  { id: "e03", title: "Halloween", calendarId: "holidays", start: "2026-10-31" },
  { id: "e04", title: "Clocks go back", calendarId: "holidays", start: "2026-11-01", notes: "Daylight saving time ends in the US. Zurich changed on October 25." },

  // Nov 2 to 8
  { id: "e05", title: "Sprint planning", calendarId: "work", start: "2026-11-02", time: "09:30", endTime: "10:15", organizer: "emma-collins", attendees: team(sprint), video: meet("kfz-qwrt-mbx") },
  { id: "e06", title: "Design review: billing", calendarId: "work", start: "2026-11-03", time: "11:00", endTime: "12:00", organizer: "jasmine-brooks", rsvp: "yes", attendees: team(["jasmine-brooks", "emma-collins", "marcus-johnson"]), video: zoom("85509124470") },
  { id: "e07", title: "Run club", calendarId: "personal", start: "2026-11-04", time: "07:00", endTime: "08:00", location: "Lake promenade, Tiefenbrunnen" },
  { id: "e08", title: "Customer call: Lumen Health", calendarId: "work", start: "2026-11-04", time: "14:00", endTime: "14:45", organizer: "olivia-bennett", rsvp: "yes", attendees: team(["olivia-bennett", "emma-collins", "sofia-ramirez"]), video: zoom("86120934412") },
  { id: "e09", title: "Pricing page freeze", calendarId: "launch", start: "2026-11-05", notes: "No copy or price changes after today without Ava's sign off." },
  { id: "e10", title: "Dinner with Ana", calendarId: "personal", start: "2026-11-05", time: "19:30", endTime: "21:30", location: "Taberna Sal, Langstrasse 84" },
  { id: "e11", title: "Retro", calendarId: "work", start: "2026-11-06", time: "16:00", endTime: "16:45", organizer: "emma-collins", attendees: team(sprint), video: meet("kfz-qwrt-mbx") },
  { id: "e12", title: "Weekend in Lucerne", calendarId: "travel", start: "2026-11-07", end: "2026-11-08", location: "Hotel Des Balances" },

  // Nov 9 to 15
  { id: "e13", title: "Sprint planning", calendarId: "work", start: "2026-11-09", time: "09:30", endTime: "10:15", organizer: "emma-collins", attendees: team(sprint), video: meet("kfz-qwrt-mbx") },
  { id: "e14", title: "1:1 with Marcus", calendarId: "work", start: "2026-11-09", time: "15:00", endTime: "15:30", organizer: "emma-collins", attendees: team(["emma-collins", "marcus-johnson"]), video: meet("pqa-trnv-zye") },
  { id: "e15", title: "Press kit review", calendarId: "launch", start: "2026-11-10", time: "11:00", endTime: "12:00", organizer: "ava-mitchell", rsvp: "yes", attendees: team(["ava-mitchell", "emma-collins", "jasmine-brooks"]), video: zoom("87734410276") },
  { id: "e16", title: "Dentist", calendarId: "personal", start: "2026-11-10", time: "17:15", endTime: "18:00", location: "Seefeld Dental, Seefeldstrasse 41" },
  { id: "e17", title: "Launch content freeze", calendarId: "launch", start: "2026-11-11" },
  { id: "e18", title: "Board prep", calendarId: "work", start: "2026-11-11", time: "10:00", endTime: "11:30", organizer: "diane-foster", rsvp: "yes", attendees: team(["diane-foster", "emma-collins", "nathan-cole"]) },
  { id: "e19", title: "Quarterly planning", calendarId: "work", start: "2026-11-12", end: "2026-11-13", location: "Studio, 4th floor", notes: "Two days to agree on Q1 bets. Bring one page per team." },
  { id: "e20", title: "Standup", calendarId: "work", start: "2026-11-12", time: "09:15", endTime: "09:30", organizer: "emma-collins", attendees: team(sprint), video: meet("kfz-qwrt-mbx") },
  { id: "e21", title: "Design crit", calendarId: "work", start: "2026-11-12", time: "10:00", endTime: "10:45", organizer: "jasmine-brooks", rsvp: "yes", attendees: team(["jasmine-brooks", "emma-collins", "chloe-nguyen", "mateo-alvarez"], { "mateo-alvarez": "maybe" }), video: zoom("88123094451"), notes: "Onboarding checklist and the new empty states. Jasmine shares the Figma file before." },
  { id: "e22", title: "Lunch with Sofia", calendarId: "personal", start: "2026-11-12", time: "12:30", endTime: "13:30", location: "Café Henrici" },
  { id: "e23", title: "Customer interviews", calendarId: "work", start: "2026-11-12", time: "14:00", endTime: "15:30", organizer: "chloe-nguyen", rsvp: "yes", attendees: team(["chloe-nguyen", "emma-collins", "olivia-bennett"]), video: zoom("89011237745"), notes: "Three admins from mid size teams. Focus on how they set up approvals." },
  { id: "e24", title: "Launch go or no-go", calendarId: "launch", start: "2026-11-12", time: "16:30", endTime: "17:00", organizer: "ava-mitchell", rsvp: "yes", attendees: team(["ava-mitchell", "emma-collins", "nathan-cole", "marcus-johnson", "jasmine-brooks"]), video: meet("hwd-mjsa-qpe") },
  { id: "e25", title: "Investor update", calendarId: "work", start: "2026-11-13", time: "11:00", endTime: "11:45", organizer: "diane-foster", rsvp: "maybe", attendees: team(["diane-foster", "emma-collins", "andre-williams"]), video: zoom("81240098813") },
  { id: "e26", title: "Farmers market", calendarId: "personal", start: "2026-11-14", time: "10:00", endTime: "11:30", location: "Helvetiaplatz" },

  // Nov 16 to 22: launch week
  { id: "e27", title: "Launch week", calendarId: "launch", start: "2026-11-16", end: "2026-11-20" },
  { id: "e28", title: "Launch standup", calendarId: "launch", start: "2026-11-16", time: "09:00", endTime: "09:20", organizer: "ava-mitchell", rsvp: "yes", attendees: team(["ava-mitchell", "emma-collins", "marcus-johnson", "daniel-kim"]), video: meet("hwd-mjsa-qpe") },
  { id: "e29", title: "Partner sync: Lumen Health", calendarId: "work", start: "2026-11-16", time: "13:00", endTime: "13:45", organizer: "olivia-bennett", rsvp: "pending", attendees: team(["olivia-bennett", "emma-collins", "sofia-ramirez"], { "emma-collins": "pending", "sofia-ramirez": "maybe" }), video: zoom("86120934412"), notes: "Walk through the approvals beta before it opens to all of their teams." },
  { id: "e30", title: "Copperline 3.0 goes live", calendarId: "launch", start: "2026-11-17", time: "08:00", endTime: "08:30", organizer: "ava-mitchell", rsvp: "yes", attendees: team(["ava-mitchell", "emma-collins", "marcus-johnson", "daniel-kim", "olivia-bennett"]), video: meet("hwd-mjsa-qpe") },
  { id: "e31", title: "Press briefing", calendarId: "launch", start: "2026-11-17", time: "11:00", endTime: "12:00", organizer: "ava-mitchell", rsvp: "yes", attendees: team(["ava-mitchell", "emma-collins", "diane-foster"]), video: zoom("83300217784") },
  { id: "e32", title: "Hiring panel: senior designer", calendarId: "work", start: "2026-11-18", time: "10:00", endTime: "11:00", organizer: "nathan-cole", rsvp: "pending", attendees: team(["nathan-cole", "emma-collins", "jasmine-brooks"], { "emma-collins": "pending" }), video: meet("vbn-kpra-wsd"), notes: "Portfolio review with the second round candidate. Scorecards are in the hiring folder." },
  { id: "e33", title: "Webinar: what's new in 3.0", calendarId: "launch", start: "2026-11-18", time: "15:00", endTime: "16:00", organizer: "ava-mitchell", rsvp: "yes", attendees: team(["ava-mitchell", "emma-collins", "jasmine-brooks"]), video: zoom("84477120956") },
  { id: "e34", title: "Launch party", calendarId: "launch", start: "2026-11-19", time: "19:00", endTime: "23:00", location: "Frau Gerolds Garten", organizer: "ava-mitchell", rsvp: "yes", attendees: team(["ava-mitchell", "emma-collins", "marcus-johnson", "jasmine-brooks", "olivia-bennett", "chloe-nguyen", "daniel-kim"]) },
  { id: "e35", title: "Launch retro", calendarId: "work", start: "2026-11-20", time: "16:00", endTime: "17:00", organizer: "emma-collins", attendees: team([...sprint, "ava-mitchell"]), video: meet("kfz-qwrt-mbx") },
  { id: "e36", title: "Ava's birthday", calendarId: "personal", start: "2026-11-21" },

  // Nov 23 to 29: Config Europe in Berlin
  { id: "e37", title: "Sprint planning", calendarId: "work", start: "2026-11-23", time: "09:30", endTime: "10:15", organizer: "emma-collins", attendees: team(sprint), video: meet("kfz-qwrt-mbx") },
  { id: "e38", title: "Flight LX 962 to Berlin", calendarId: "travel", start: "2026-11-24", time: "07:05", endTime: "08:35", location: "Zurich Airport, Terminal 2" },
  { id: "e39", title: "Config Europe", calendarId: "travel", start: "2026-11-24", end: "2026-11-26", location: "Station Berlin" },
  { id: "e40", title: "Talk: design systems at scale", calendarId: "travel", start: "2026-11-25", time: "14:00", endTime: "14:40", location: "Main stage, Station Berlin" },
  { id: "e41", title: "Thanksgiving, US office closed", calendarId: "holidays", start: "2026-11-26" },
  { id: "e42", title: "Flight LX 975 home", calendarId: "travel", start: "2026-11-27", time: "17:40", endTime: "19:05", location: "Berlin Brandenburg, Terminal 1" },
  { id: "e43", title: "Brunch with Jasmine", calendarId: "personal", start: "2026-11-28", time: "10:30", endTime: "12:00", location: "Kafi Schoffel" },

  // Nov 30 to Dec 6
  { id: "e44", title: "Sprint planning", calendarId: "work", start: "2026-11-30", time: "09:30", endTime: "10:15", organizer: "emma-collins", attendees: team(sprint), video: meet("kfz-qwrt-mbx") },
  { id: "e45", title: "Invoice run", calendarId: "work", start: "2026-12-01", time: "12:00", endTime: "12:30", organizer: "andre-williams", rsvp: "yes", attendees: team(["andre-williams", "emma-collins"]) },
  { id: "e46", title: "Offsite planning", calendarId: "work", start: "2026-12-03", time: "15:00", endTime: "16:00", organizer: "diane-foster", rsvp: "pending", attendees: team(["diane-foster", "emma-collins", "nathan-cole", "ava-mitchell"], { "emma-collins": "pending" }), video: zoom("82219904417"), notes: "Pick the venue and dates for the January offsite." },
  { id: "e47", title: "Team holiday dinner", calendarId: "work", start: "2026-12-04", time: "18:30", endTime: "22:00", location: "Kronenhalle", organizer: "nathan-cole", rsvp: "yes", attendees: team(["nathan-cole", "emma-collins", "marcus-johnson", "jasmine-brooks", "olivia-bennett", "chloe-nguyen"]) },
  { id: "e48", title: "Saint Nicholas Day", calendarId: "holidays", start: "2026-12-06" },
];
