import { avatar } from "../../lib/media";

/** Sample profile content for the profile page block. Replace with data from your user and project APIs. */

export interface ProfileDetails {
  name: string;
  handle: string;
  headline: string;
  location: string;
  website: string;
  bio: string;
  avatar?: string;
  cover?: string;
  joined: string;
}

export interface ProfileStat { id: string; label: string; value: number }

export type ActivityKind = "shipped" | "commented" | "created" | "reviewed" | "starred";

export interface ProfileActivity {
  id: string;
  kind: ActivityKind;
  /** What happened, written to follow the person's name. */
  action: string;
  target: string;
  detail?: string;
  time: string;
  /** Group heading such as "This week". */
  group: string;
}

export interface ProfileProject {
  id: string;
  name: string;
  description: string;
  cover: string;
  updated: string;
  stars: number;
  starred?: boolean;
  visibility: "Public" | "Private";
  collaborators: { name: string; avatar?: string }[];
}

export const sampleProfile: ProfileDetails = {
  name: "Jasmine Brooks",
  handle: "jasmine",
  headline: "Design lead at Northwind",
  location: "Lisbon, Portugal",
  website: "jasminebrooks.design",
  bio: "I lead the design system team and care about calm interfaces, clear writing, and tools that stay out of the way. Previously at Linear and Figma.",
  avatar: avatar("jasmine-brooks"),
  cover: "/media/photos/lisbon-rooftops.jpg",
  joined: "March 2021",
};

export const sampleStats: ProfileStat[] = [
  { id: "followers", label: "Followers", value: 2418 },
  { id: "following", label: "Following", value: 186 },
  { id: "shipped", label: "Shipped", value: 37 },
];

const team = {
  emma: { name: "Emma Collins", avatar: avatar("emma-collins") },
  marcus: { name: "Marcus Johnson", avatar: avatar("marcus-johnson") },
  chloe: { name: "Chloe Nguyen", avatar: avatar("chloe-nguyen") },
  daniel: { name: "Daniel Kim", avatar: avatar("daniel-kim") },
  olivia: { name: "Olivia Bennett", avatar: avatar("olivia-bennett") },
};

export const sampleActivity: ProfileActivity[] = [
  { id: "a1", kind: "shipped", action: "shipped", target: "Tokens v4", detail: "Semantic color roles, dark mode surfaces, and new spacing steps.", time: "2h", group: "This week" },
  { id: "a2", kind: "commented", action: "commented on", target: "Checkout empty states", detail: "Let us keep the illustration out and lead with the action.", time: "Yesterday", group: "This week" },
  { id: "a3", kind: "reviewed", action: "approved", target: "Table density toggle", time: "Tue", group: "This week" },
  { id: "a4", kind: "created", action: "created", target: "Onboarding audit", detail: "A shared board for the first run review with research notes.", time: "Mon", group: "This week" },
  { id: "a5", kind: "starred", action: "starred", target: "Motion guidelines", time: "Sep 12", group: "Earlier" },
  { id: "a6", kind: "shipped", action: "shipped", target: "Icon set 2.0", detail: "412 icons redrawn on a 1.75px stroke.", time: "Sep 8", group: "Earlier" },
  { id: "a7", kind: "commented", action: "commented on", target: "Billing settings", time: "Sep 3", group: "Earlier" },
];

export const sampleProjects: ProfileProject[] = [
  { id: "p1", name: "Northwind design system", description: "Tokens, components, and guidance used by every product team.", cover: "/media/photos/curved-facade.jpg", updated: "Updated 2h ago", stars: 342, starred: true, visibility: "Public", collaborators: [team.emma, team.marcus, team.chloe] },
  { id: "p2", name: "Onboarding audit", description: "Research notes and flows for the new first run experience.", cover: "/media/photos/sunroom.jpg", updated: "Updated Monday", stars: 28, visibility: "Private", collaborators: [team.daniel, team.olivia] },
  { id: "p3", name: "Motion guidelines", description: "When things move, how fast, and why. Springs, easing, and reduced motion.", cover: "/media/photos/terracotta-waves.jpg", updated: "Updated Sep 12", stars: 191, visibility: "Public", collaborators: [team.chloe] },
  { id: "p4", name: "Icon set 2.0", description: "A redrawn icon family on a consistent stroke and grid.", cover: "/media/photos/concert-hall.jpg", updated: "Updated Sep 8", stars: 87, visibility: "Public", collaborators: [team.marcus, team.emma] },
];
