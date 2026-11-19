import { avatar } from "../../lib/media";

/** Sample directory for Saltmarsh, a 16 person product studio. Replace it with your own people, offices and time off. */

export type Team = "Design" | "Engineering" | "Go-to-market" | "Operations";
export type Office = string;
export type Tone = "teal" | "sky" | "orchid" | "violet" | "rose" | "amber" | "green";

/** Overrides the status worked out from someone's working hours. */
export type StatusOverride = { kind: "out"; until: string } | { kind: "meeting"; until: string } | { kind: "joining"; on: string };

export interface DirectoryPerson {
  id: string;
  name: string;
  role: string;
  team: Team;
  office: Office;
  /** The city shown with the local time, for remote people. Defaults to the office. */
  city?: string;
  /** Offset from UTC in hours, today. */
  utcOffset: number;
  /** Working hours in local time, 24 hour clock. */
  hours: [number, number];
  managerId?: string;
  email: string;
  phone?: string;
  pronouns?: string;
  /** ISO date. */
  started: string;
  photo: string;
  about?: string;
  skills: string[];
  github?: string;
  linkedin?: string;
  status?: StatusOverride;
}

export interface TimeOffRequest {
  id: string;
  personId: string;
  kind: "Vacation" | "Personal day" | "Sick leave" | "Parental leave";
  /** ISO dates, inclusive. */
  from: string;
  to: string;
  days: number;
  note?: string;
}

export const teams: { id: Team; tone: Tone }[] = [
  { id: "Engineering", tone: "sky" },
  { id: "Design", tone: "orchid" },
  { id: "Go-to-market", tone: "teal" },
  { id: "Operations", tone: "amber" },
];

export const offices: { id: Office; utcOffset: number; label: string }[] = [
  { id: "Zürich", utcOffset: 1, label: "Zürich" },
  { id: "London", utcOffset: 0, label: "London" },
  { id: "New York", utcOffset: -5, label: "New York" },
  { id: "Remote", utcOffset: 0, label: "Remote" },
];

/** Thursday, 12 November 2026 at 13:32 UTC: 14:32 in Zürich. Fixed so server and client render the same clock. */
export const directoryNow = Date.UTC(2026, 10, 12, 13, 32);

/** The person viewing the directory. */
export const viewerId = "diane-foster";

export const directoryPeople: DirectoryPerson[] = [
  {
    id: "diane-foster", name: "Diane Foster", role: "Chief operating officer", team: "Operations", office: "Zürich", utcOffset: 1, hours: [8, 17],
    email: "diane@saltmarsh.co", phone: "+41 44 508 21 90", pronouns: "she/her", started: "2021-02-01", photo: avatar("diane-foster"),
    about: "Runs the studio day to day: hiring, finance and how the teams work together. Book time with Diane for budget questions or anything that crosses teams.",
    skills: ["Operations", "Hiring", "Finance"], linkedin: "dianefoster",
  },
  {
    id: "nathan-cole", name: "Nathan Cole", role: "Engineering manager", team: "Engineering", office: "Zürich", utcOffset: 1, hours: [9, 18], managerId: "diane-foster",
    email: "nathan@saltmarsh.co", phone: "+41 44 508 21 14", pronouns: "he/him", started: "2021-06-14", photo: avatar("nathan-cole"),
    about: "Leads the engineering team and owns the delivery plan. Talk to Nathan about scope, release dates and who can pick up new work.",
    skills: ["Planning", "Go", "Postgres", "Hiring"], github: "ncole", linkedin: "nathancole", status: { kind: "meeting", until: "15:00" },
  },
  {
    id: "olivia-bennett", name: "Olivia Bennett", role: "Platform engineer", team: "Engineering", office: "London", utcOffset: 0, hours: [9, 18], managerId: "nathan-cole",
    email: "olivia@saltmarsh.co", phone: "+44 20 3808 4471", pronouns: "she/her", started: "2022-03-07", photo: avatar("olivia-bennett"),
    about: "Keeps the platform fast and dependable: infrastructure, deploys and on call. Olivia is the person to ask about Kubernetes and the build pipeline.",
    skills: ["Kubernetes", "Terraform", "Observability"], github: "obennett", status: { kind: "out", until: "Nov 16" },
  },
  {
    id: "daniel-kim", name: "Daniel Kim", role: "Backend engineer", team: "Engineering", office: "Zürich", utcOffset: 1, hours: [9, 18], managerId: "nathan-cole",
    email: "daniel@saltmarsh.co", phone: "+41 44 508 21 37", pronouns: "he/him", started: "2022-09-19", photo: avatar("daniel-kim"),
    about: "Builds the APIs and data models behind the product. Reach out to Daniel for integrations, billing logic and performance work.",
    skills: ["Go", "Postgres", "Stripe API"], github: "dkim", linkedin: "danielkim",
  },
  {
    id: "marcus-johnson", name: "Marcus Johnson", role: "Frontend engineer", team: "Engineering", office: "London", utcOffset: 0, hours: [9, 18], managerId: "nathan-cole",
    email: "marcus@saltmarsh.co", phone: "+44 20 3808 4402", pronouns: "he/him", started: "2023-01-09", photo: avatar("marcus-johnson"),
    about: "Turns designs into components that feel as good in code as they do on screen. Marcus maintains the design system package.",
    skills: ["React", "TypeScript", "Accessibility"], github: "mjohnson", linkedin: "marcusjohnson",
  },
  {
    id: "mateo-alvarez", name: "Mateo Alvarez", role: "Mobile engineer", team: "Engineering", office: "Remote", city: "Lisbon", utcOffset: 0, hours: [10, 19], managerId: "nathan-cole",
    email: "mateo@saltmarsh.co", phone: "+351 21 340 5512", pronouns: "he/him", started: "2024-04-02", photo: avatar("mateo-alvarez"),
    about: "Ships the iOS and Android apps. Mateo works late mornings to evenings, so London and Zürich overlap is best after lunch.",
    skills: ["Swift", "Kotlin", "React Native"], github: "malvarez",
  },
  {
    id: "jasmine-brooks", name: "Jasmine Brooks", role: "Design lead", team: "Design", office: "London", utcOffset: 0, hours: [9, 17], managerId: "diane-foster",
    email: "jasmine@saltmarsh.co", phone: "+44 20 3808 4419", pronouns: "she/her", started: "2021-09-06", photo: avatar("jasmine-brooks"),
    about: "Sets the direction for product and brand design. Jasmine runs the Tuesday critique and reviews every flow before it ships.",
    skills: ["Product design", "Research", "Critique"], linkedin: "jasminebrooks",
  },
  {
    id: "emma-collins", name: "Emma Collins", role: "Product designer", team: "Design", office: "Zürich", utcOffset: 1, hours: [9, 18], managerId: "jasmine-brooks",
    email: "emma@saltmarsh.co", phone: "+41 44 508 21 52", pronouns: "she/her", started: "2023-05-15", photo: avatar("emma-collins"),
    about: "Designs onboarding and the editor. Ask Emma about prototypes, interaction details or a second pair of eyes on a flow.",
    skills: ["Figma", "Prototyping", "Motion"], linkedin: "emmacollins",
  },
  {
    id: "tyler-hayes", name: "Tyler Hayes", role: "Head of sales", team: "Go-to-market", office: "New York", utcOffset: -5, hours: [8, 17], managerId: "diane-foster",
    email: "tyler@saltmarsh.co", phone: "+1 212 555 0147", pronouns: "he/him", started: "2022-01-10", photo: avatar("tyler-hayes"),
    about: "Leads sales, marketing and customer success. Tyler owns the revenue plan and the enterprise pipeline.",
    skills: ["Enterprise sales", "Forecasting"], linkedin: "tylerhayes",
  },
  {
    id: "ryan-sullivan", name: "Ryan Sullivan", role: "Account executive", team: "Go-to-market", office: "New York", utcOffset: -5, hours: [9, 18], managerId: "tyler-hayes",
    email: "ryan@saltmarsh.co", phone: "+1 212 555 0163", pronouns: "he/him", started: "2023-08-21", photo: avatar("ryan-sullivan"),
    about: "Works with mid market teams from first call to signed contract. Loop in Ryan before any pricing conversation.",
    skills: ["Sales", "Negotiation", "HubSpot"], linkedin: "ryansullivan",
  },
  {
    id: "ava-mitchell", name: "Ava Mitchell", role: "Marketing manager", team: "Go-to-market", office: "London", utcOffset: 0, hours: [9, 18], managerId: "tyler-hayes",
    email: "ava@saltmarsh.co", phone: "+44 20 3808 4436", pronouns: "she/her", started: "2023-03-13", photo: avatar("ava-mitchell"),
    about: "Runs launches, the newsletter and the website. Send Ava anything that needs to go out to customers.",
    skills: ["Launches", "Content", "Webflow"], linkedin: "avamitchell", status: { kind: "meeting", until: "14:00" },
  },
  {
    id: "hannah-walsh", name: "Hannah Walsh", role: "Customer success", team: "Go-to-market", office: "Remote", city: "Dublin", utcOffset: 0, hours: [8, 17], managerId: "tyler-hayes",
    email: "hannah@saltmarsh.co", pronouns: "she/her", started: "2024-02-05", photo: avatar("hannah-walsh"),
    about: "Onboards new enterprise accounts and knows which ones are blocked and why.",
    skills: ["Onboarding", "Zendesk"],
  },
  {
    id: "sofia-ramirez", name: "Sofia Ramirez", role: "Operations lead", team: "Operations", office: "New York", utcOffset: -5, hours: [9, 18], managerId: "diane-foster",
    email: "sofia@saltmarsh.co", phone: "+1 212 555 0118", pronouns: "she/her", started: "2022-05-02", photo: avatar("sofia-ramirez"),
    about: "Keeps the business running across offices: vendors, payroll, travel and the tools everyone uses.",
    skills: ["People ops", "Payroll", "Vendors"], linkedin: "sofiaramirez",
  },
  {
    id: "andre-williams", name: "Andre Williams", role: "Finance partner", team: "Operations", office: "Zürich", utcOffset: 1, hours: [8, 17], managerId: "sofia-ramirez",
    email: "andre@saltmarsh.co", phone: "+41 44 508 21 71", pronouns: "he/him", started: "2023-10-02", photo: avatar("andre-williams"),
    about: "Owns budgets, forecasts and the monthly close. Andre approves purchases over CHF 2,000.",
    skills: ["FP&A", "Budgeting"],
  },
  {
    id: "chloe-nguyen", name: "Chloe Nguyen", role: "Data analyst", team: "Operations", office: "Zürich", utcOffset: 1, hours: [9, 18], managerId: "sofia-ramirez",
    email: "chloe@saltmarsh.co", phone: "+41 44 508 21 88", pronouns: "she/her", started: "2024-06-17", photo: avatar("chloe-nguyen"),
    about: "Builds the dashboards the studio runs on. Ask Chloe for numbers before you ask anyone else.",
    skills: ["SQL", "dbt", "Metabase"], github: "cnguyen",
  },
  {
    id: "jordan-reyes", name: "Jordan Reyes", role: "Support specialist", team: "Operations", office: "Remote", city: "Lisbon", utcOffset: 0, hours: [9, 18], managerId: "sofia-ramirez",
    email: "jordan@saltmarsh.co", pronouns: "they/them", started: "2026-11-17", photo: avatar("jordan-reyes"),
    skills: [], status: { kind: "joining", on: "Nov 17" },
  },
];

export const directoryTimeOff: TimeOffRequest[] = [
  { id: "t1", personId: "daniel-kim", kind: "Vacation", from: "2026-11-30", to: "2026-12-04", days: 5, note: "Skiing in Laax. The billing migration ships the week before." },
  { id: "t2", personId: "ryan-sullivan", kind: "Personal day", from: "2026-11-13", to: "2026-11-13", days: 1 },
  { id: "t3", personId: "olivia-bennett", kind: "Vacation", from: "2026-11-10", to: "2026-11-16", days: 5 },
  { id: "t4", personId: "emma-collins", kind: "Vacation", from: "2026-11-23", to: "2026-11-27", days: 5 },
  { id: "t5", personId: "chloe-nguyen", kind: "Sick leave", from: "2026-11-05", to: "2026-11-06", days: 2 },
  { id: "t6", personId: "marcus-johnson", kind: "Vacation", from: "2026-12-21", to: "2027-01-01", days: 8 },
  { id: "t7", personId: "ava-mitchell", kind: "Parental leave", from: "2027-02-01", to: "2027-04-30", days: 64 },
];
