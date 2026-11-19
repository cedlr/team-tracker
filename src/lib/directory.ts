import "server-only";
import type { DirectoryPerson, TimeOffRequest } from "@/components/arc/blocks/team-directory/team-directory-data";
import { avatarSrc } from "./avatar";
import type { Leave, PublicMember } from "./schemas";

const kind: Record<Leave["type"], TimeOffRequest["kind"]> = { annual: "Vacation", personal: "Personal day", unpaid: "Personal day", sick: "Sick leave", parental: "Parental leave" };

/** Maps members to Arc's team-directory people. Everyone is in Kuala Lumpur unless a member record says otherwise. */

export function officesFor(people: DirectoryPerson[]) {
  const seen = new Map<string, { id: string; utcOffset: number; label: string }>();
  for (const person of people) {
    if (!seen.has(person.office)) seen.set(person.office, { id: person.office, utcOffset: person.utcOffset, label: person.city ?? person.office });
  }
  return [...seen.values()];
}
export function toDirectoryPeople(members: PublicMember[], leaves: Leave[], today: string): DirectoryPerson[] {
  return members.map(m => {
    const out = leaves.find(l => l.memberId === m.id && today >= l.from && today <= l.to);
    return {
      id: m.id, name: m.name, role: m.title || "Team member", team: m.department, office: "Kuala Lumpur", city: "Kuala Lumpur",
      utcOffset: 8, hours: [9, 18], managerId: m.managerId, email: m.email, started: m.started,
      photo: avatarSrc(m.avatar) ?? "/media/people/diane-foster.svg", skills: [],
      status: out ? { kind: "out", until: out.to } : undefined,
    };
  });
}

export function toTimeOff(leaves: Leave[]): TimeOffRequest[] {
  return leaves.map(l => ({ id: l.id, personId: l.memberId, kind: kind[l.type], from: l.from, to: l.to, days: l.days, note: l.note }));
}
