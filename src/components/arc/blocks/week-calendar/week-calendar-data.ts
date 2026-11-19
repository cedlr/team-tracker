import type { ComponentType } from "react";
import { Briefcase, Flag, Headphones, House, Plane, Users } from "lucide-react";
import { people, type PersonId } from "../../lib/media";
import { DAY, dateDay, fromWall } from "./calendar-time";

export type CalendarResponse = "pending" | "yes" | "maybe" | "no";

export interface CalendarAttendee {
  name: string;
  /** Portrait URL. Initials show when it is missing. */
  avatar?: string;
  email?: string;
  /** Their answer to the invite. */
  status?: CalendarResponse;
}

export interface CalendarConference {
  provider: "meet" | "zoom" | "phone";
  /** The link or number people join with. */
  url: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  /** Exclusive. For an all day event this is midnight after the last day. */
  end: Date;
  calendarId: string;
  allDay?: boolean;
  location?: string;
  attendees?: CalendarAttendee[];
  /** Your answer when someone else invited you. "pending" draws the event as an outline until you reply. */
  rsvp?: CalendarResponse;
  organizer?: CalendarAttendee;
  conference?: CalendarConference;
  description?: string;
}

/** Built in hues follow Arc's categorical tones in light and dark; any CSS color works too. */
export type CalendarColor = "blue" | "sky" | "green" | "violet" | "orchid" | "amber" | "rose" | "teal" | (string & {});

export interface CalendarSource {
  id: string;
  name: string;
  color: CalendarColor;
  /** Start hidden. People can still turn it on from the calendar list. */
  hidden?: boolean;
  /** Groups calendars in the list, such as an email address, "iCloud" or "People". */
  account?: string;
  /** A portrait for a person's calendar. */
  avatar?: string;
  /** A 16px icon that marks the calendar in pickers and lists, tinted with its color. Defaults to a calendar glyph. */
  icon?: ComponentType<{ size?: number | string; strokeWidth?: number | string; className?: string }>;
  /** Someone else's calendar: shown and toggled, but new events never go to it and its events are view only. */
  readOnly?: boolean;
}

const face = (id: PersonId) => people.find(entry => entry.id === id)!;

export const ACCOUNT_WORK = "emma@northwind.studio";
export const ACCOUNT_HOME = "iCloud";
export const ACCOUNT_PEOPLE = "People";

export const SAMPLE_CALENDARS: CalendarSource[] = [
  { id: "work", name: "Northwind", color: "sky", account: ACCOUNT_WORK, icon: Briefcase },
  { id: "meetings", name: "Team meetings", color: "violet", account: ACCOUNT_WORK, icon: Users },
  { id: "focus", name: "Focus time", color: "teal", account: ACCOUNT_WORK, icon: Headphones },
  { id: "holidays", name: "US holidays", color: "rose", account: ACCOUNT_WORK, icon: Flag },
  { id: "personal", name: "Personal", color: "green", account: ACCOUNT_HOME, icon: House },
  { id: "travel", name: "Travel", color: "amber", account: ACCOUNT_HOME, icon: Plane },
  { id: "marcus", name: face("marcus-johnson").name, color: "orchid", account: ACCOUNT_PEOPLE, avatar: face("marcus-johnson").src, hidden: true, readOnly: true },
  { id: "sofia", name: face("sofia-ramirez").name, color: "orchid", account: ACCOUNT_PEOPLE, avatar: face("sofia-ramirez").src, hidden: true, readOnly: true },
];

/** The sample week starts on Monday 9 November 2026. */
export const SAMPLE_WEEK = dateDay(2026, 11, 9);
export const SAMPLE_DATE = new Date(Date.UTC(2026, 10, 12, 12));

const STATUSES: CalendarResponse[] = ["yes", "yes", "yes", "maybe", "yes", "pending", "yes", "no"];
/** Seeded gradient avatars from lib/media.ts. Names are sample content. */
const who = (...ids: PersonId[]): CalendarAttendee[] => ids.map((id, i) => {
  const person = face(id);
  return { name: person.name, avatar: person.src, email: `${id.split("-")[0]}@northwind.studio`, status: i === 0 ? "yes" : STATUSES[(id.length * 3 + i) % STATUSES.length] };
});
const TEAM = who("marcus-johnson", "sofia-ramirez", "chloe-nguyen", "daniel-kim", "jasmine-brooks");

const meet = (code: string): CalendarConference => ({ provider: "meet", url: `meet.google.com/${code}` });
const zoom = (id: string): CalendarConference => ({ provider: "zoom", url: `zoom.us/j/${id}` });

type Extra = Pick<CalendarEvent, "rsvp" | "conference" | "description" | "organizer">;
type Seed = [day: number, start: string, end: string, title: string, calendarId: string, location?: string, attendees?: CalendarAttendee[], extra?: Extra];
type AllDaySeed = [from: number, to: number, title: string, calendarId: string, location?: string];

const minutes = (time: string) => { const [h, m] = time.split(":").map(Number); return h * 60 + m; };

const STANDUP: Extra = { conference: meet("kfp-zwqa-hrm"), description: "Yesterday, today, blockers. Keep it to fifteen minutes; longer threads move to Slack." };

/** Monday is day 0. Times are wall clock times in the calendar's zone. */
const WEEK: Seed[] = [
  [0, "9:00", "9:15", "Team standup", "meetings", "Google Meet", TEAM, STANDUP],
  [0, "9:30", "11:30", "Focus: Q1 planning doc", "focus"],
  [0, "12:00", "13:00", "Lunch with Sofia", "personal", "Tartine Manufactory", who("sofia-ramirez")],
  [0, "13:30", "14:00", "1:1 with Marcus", "meetings", "Marcus's desk", who("marcus-johnson")],
  [0, "14:00", "15:00", "Pricing sync", "work", "Juniper room", who("ava-mitchell", "tyler-hayes", "andre-williams"), { description: "Decide on the annual discount for the Team plan before the December launch." }],
  [0, "14:00", "14:30", "Quick sync with Daniel", "meetings", "Zoom", who("daniel-kim"), { conference: zoom("84213369021") }],
  [0, "15:30", "16:15", "Hiring debrief", "meetings", "Atlas room", who("nathan-cole", "olivia-bennett")],
  [0, "18:00", "19:00", "Climbing gym", "personal", "Mission Cliffs"],
  [1, "9:00", "9:15", "Team standup", "meetings", "Google Meet", TEAM, STANDUP],
  [1, "10:00", "11:30", "Design review: onboarding", "work", "Atlas room, 4th floor", who("jasmine-brooks", "chloe-nguyen", "marcus-johnson", "olivia-bennett"), { description: "Walk through the new first run flow, then agree on what ships in 4.2." }],
  [1, "11:00", "11:30", "Portfolio chat with Mateo", "meetings", "Zoom", who("mateo-alvarez"), { rsvp: "pending", conference: zoom("71930055412"), description: "Mateo wants feedback on his case studies before applying for the senior role." }],
  [1, "13:00", "15:00", "Focus: prototype the new editor", "focus"],
  [1, "15:00", "15:45", "Customer call: Stripe", "work", "Zoom", who("hannah-walsh", "ryan-sullivan"), { conference: zoom("90155238814"), description: "Quarterly check in with the Stripe design systems team. Agenda in the shared doc." }],
  [1, "17:00", "17:45", "Dentist", "personal", "Valencia Dental"],
  [2, "8:00", "8:30", "Pack for New York", "personal"],
  [2, "9:00", "9:15", "Team standup", "meetings", "Google Meet", TEAM, STANDUP],
  [2, "9:30", "10:30", "Sprint planning", "meetings", "Juniper room", who("daniel-kim", "olivia-bennett", "marcus-johnson")],
  [2, "10:30", "11:30", "Roadmap review", "work", "Atlas room", who("diane-foster", "nathan-cole"), { conference: meet("rvd-hhjt-pqe") }],
  [2, "11:00", "12:00", "Interview: staff engineer", "meetings", "Juniper room", who("olivia-bennett")],
  [2, "12:30", "18:05", "Flight UA 1542 to New York", "travel", "SFO Terminal 3, gate F12", undefined, { description: "Confirmation K7Q2LM. Seat 14C." }],
  [3, "9:00", "9:15", "Team standup", "meetings", "Google Meet", TEAM, STANDUP],
  [3, "9:30", "12:00", "Offsite: strategy session", "work", "Brooklyn Navy Yard", who("diane-foster", "nathan-cole", "jasmine-brooks", "tyler-hayes"), { description: "2027 bets, pricing and the platform roadmap. Laptops closed for the first hour." }],
  [3, "12:00", "13:00", "Lunch with the leadership team", "personal", "Olmsted"],
  [3, "13:00", "16:30", "Offsite: team workshops", "work", "Brooklyn Navy Yard", who("diane-foster", "sofia-ramirez", "andre-williams")],
  [3, "16:30", "17:00", "1:1 with Nathan", "meetings", "Walk along the pier", who("nathan-cole")],
  [3, "19:00", "21:00", "Dinner at Lilia", "personal", "567 Union Ave", who("jasmine-brooks", "tyler-hayes")],
  [4, "9:00", "9:15", "Team standup", "meetings", "Google Meet", TEAM, STANDUP],
  [4, "10:00", "12:00", "Offsite: wrap up and next steps", "work", "Brooklyn Navy Yard", who("diane-foster", "nathan-cole")],
  [4, "13:00", "13:30", "Metrics review", "work", "Google Meet", who("chloe-nguyen"), { conference: meet("zte-vqmf-ddo") }],
  [4, "13:30", "14:15", "Partner sync: GitHub", "work", "Zoom", who("jordan-reyes", "ryan-sullivan"), { rsvp: "pending", conference: zoom("66318402277"), description: "Co-marketing for the Universe recap and the Actions integration launch." }],
  [4, "15:00", "21:30", "Flight UA 2210 to San Francisco", "travel", "JFK Terminal 7", undefined, { description: "Confirmation K7Q2LM. Seat 9A." }],
  [5, "8:00", "9:00", "Long run, Golden Gate Park", "personal"],
  [5, "9:30", "11:00", "Farmers market", "personal", "Ferry Building"],
  [6, "11:00", "12:30", "Brunch with Jasmine", "personal", "Zazie, Cole Valley", who("jasmine-brooks")],
  [6, "17:00", "17:30", "Plan the week", "focus"],
];

/** Teammates' calendars, overlaid when someone turns them on. */
const PEOPLE_WEEK: Seed[] = [
  [0, "10:00", "12:00", "API migration pairing", "marcus"],
  [1, "14:00", "15:00", "Deploy window", "marcus"],
  [2, "13:00", "14:30", "Platform sync", "marcus"],
  [3, "10:00", "11:00", "Code review block", "marcus"],
  [4, "9:30", "11:00", "Incident review", "marcus"],
  [0, "8:30", "9:00", "Vendor check in", "sofia"],
  [1, "12:00", "13:30", "Office move planning", "sofia"],
  [3, "14:00", "15:30", "Budget review", "sofia"],
  [4, "11:30", "12:30", "Payroll sign off", "sofia"],
];

const WEEK_ALL_DAY: AllDaySeed[] = [
  [2, 4, "Hotel: The Wythe", "travel", "80 Wythe Ave, Brooklyn"],
  [3, 4, "Leadership offsite", "work", "Brooklyn Navy Yard"],
  [2, 2, "Veterans Day", "holidays"],
  [3, 3, "Mom's birthday", "personal"],
];

/** Next week holds one more open invite, so the invites list reaches past the visible week. */
const NEXT_INVITE: Seed = [0, "10:00", "11:00", "Quarterly business review", "work", "Google Meet", who("diane-foster", "andre-williams", "tyler-hayes"), { rsvp: "pending", conference: meet("qbr-nwd-qfr"), description: "Q4 numbers, churn and the 2027 hiring plan. Slides due Friday." }];

/** A repeating shape for the weeks around the sample week, picked by a seeded random so each week looks lived in and stays the same on every visit. */
const ROTATION: [start: string, end: string, title: string, calendarId: string, location?: string, attendees?: CalendarAttendee[]][] = [
  ["10:00", "11:00", "Product review", "work", "Atlas room", who("sofia-ramirez", "daniel-kim")],
  ["11:30", "12:00", "1:1 with Chloe", "meetings", "Google Meet", who("chloe-nguyen")],
  ["13:00", "15:00", "Focus: deep work", "focus"],
  ["14:00", "14:45", "Partner sync", "meetings", "Zoom", who("jordan-reyes")],
  ["15:30", "16:30", "Research readout", "work", "Juniper room", who("olivia-bennett", "jasmine-brooks")],
  ["12:00", "13:00", "Lunch with Daniel", "personal", "Souvla, Hayes Valley", who("daniel-kim")],
  ["9:30", "10:30", "Roadmap grooming", "meetings", "Juniper room", who("marcus-johnson", "sofia-ramirez")],
  ["18:00", "19:00", "Pilates", "personal", "Mission studio"],
  ["10:30", "12:00", "Spec writing", "focus"],
  ["14:30", "15:30", "Interview: product designer", "meetings", "Juniper room", who("olivia-bennett")],
];

function random(seed: number) {
  let t = seed + 0x6d2b79f5;
  return () => { t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function seedsForWeek(week: number): { timed: Seed[]; allDay: AllDaySeed[] } {
  if (week === SAMPLE_WEEK) return { timed: [...WEEK, ...PEOPLE_WEEK], allDay: WEEK_ALL_DAY };
  const next = random(week);
  const timed: Seed[] = [0, 1, 2, 3, 4].map(day => [day, "9:00", "9:15", "Team standup", "meetings", "Google Meet", TEAM, STANDUP]);
  if (week === SAMPLE_WEEK + 7) timed.push(NEXT_INVITE);
  for (let day = 0; day < 5; day++) {
    const used = new Set<number>();
    for (let n = 1 + Math.floor(next() * 3); n > 0; n--) {
      const pick = Math.floor(next() * ROTATION.length);
      if (used.has(pick)) continue;
      used.add(pick);
      timed.push([day, ...ROTATION[pick]]);
    }
    timed.push([day, "11:00", "12:00", "Standup prep and reviews", "marcus"]);
  }
  if (next() > .4) timed.push([5, "9:30", "11:00", "Farmers market", "personal", "Ferry Building"]);
  if (next() > .5) timed.push([6, "9:00", "10:30", "Long run", "personal", "Golden Gate Park"]);
  const allDay: AllDaySeed[] = week === SAMPLE_WEEK + 14 ? [[3, 4, "Thanksgiving break", "holidays"]] : [];
  return { timed, allDay };
}

/**
 * Sample events for the weeks around 9 November 2026, as wall clock times in `timeZone` (the browser's zone when
 * omitted). Replace this with your own events.
 */
export function sampleEvents(timeZone?: string, weeksAround = 4): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (let offset = -weeksAround; offset <= weeksAround; offset++) {
    const week = SAMPLE_WEEK + offset * 7;
    const { timed, allDay } = seedsForWeek(week);
    timed.forEach(([day, start, end, title, calendarId, location, attendees, extra], i) => events.push({
      id: `w${week}-${i}`, title, calendarId, location, attendees,
      organizer: extra?.organizer ?? attendees?.[0],
      ...extra,
      start: fromWall((week + day) * DAY + minutes(start), timeZone),
      end: fromWall((week + day) * DAY + minutes(end), timeZone),
    }));
    allDay.forEach(([from, to, title, calendarId, location], i) => events.push({
      id: `w${week}-a${i}`, title, calendarId, location, allDay: true,
      start: fromWall((week + from) * DAY, timeZone),
      end: fromWall((week + Math.max(from, to) + 1) * DAY, timeZone),
    }));
  }
  return events;
}
