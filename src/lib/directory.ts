import "server-only";
import type { DirectoryPerson, TimeOffRequest } from "@/components/arc/blocks/team-directory/team-directory-data";
import { avatarSrc } from "./avatar";
import type { Leave, PublicMember } from "./schemas";

const kind: Record<Leave["type"], TimeOffRequest["kind"]> = { annual: "Vacation", personal: "Personal day", unpaid: "Personal day", sick: "Sick leave", parental: "Parental leave" };

/** Maps members to Arc's team-directory people. Office and hours default to Kuala Lumpur office hours. */
export function toDirectoryPeople(members: PublicMember[], leaves: Leave[], today: string): DirectoryPerson[] {
  return members.map(m => {
    const out = leaves.find(l => l.memberId === m.id && l.status === "approved" && today >= l.from && today <= l.to);
    return {
      id: m.id, name: m.name, role: m.title || "Team member", team: m.department, office: "Remote", city: "Kuala Lumpur",
      utcOffset: 8, hours: [9, 18], managerId: m.managerId, email: m.email, started: m.started,
      photo: avatarSrc(m.avatar) ?? "/media/people/diane-foster.svg", skills: [],
      status: out ? { kind: "out", until: out.to } : undefined,
    };
  });
}

export function toTimeOff(leaves: Leave[]): TimeOffRequest[] {
  return leaves.filter(l => l.status !== "declined").map(l => ({
    id: l.id, personId: l.memberId, kind: kind[l.type], from: l.from, to: l.to, days: l.days,
    status: l.status === "approved" ? "approved" : "pending", note: l.note,
  }));
}
