/** Every Redis key in one place. */
export const keys = {
  team: (id: string) => `team:${id}`,
  teams: "teams",
  member: (id: string) => `member:${id}`,
  members: "members",
  memberByEmail: (email: string) => `member-email:${email.toLowerCase()}`,
  teamMembers: (teamId: string) => `members:team:${teamId}`,
  project: (id: string) => `project:${id}`,
  teamProjects: (teamId: string) => `projects:team:${teamId}`,
  task: (id: string) => `task:${id}`,
  teamTasks: (teamId: string) => `tasks:team:${teamId}`,
  projectTasks: (projectId: string) => `tasks:project:${projectId}`,
  memberTasks: (memberId: string) => `tasks:member:${memberId}`,
  leave: (id: string) => `leave:${id}`,
  teamLeaves: (teamId: string) => `leaves:team:${teamId}`,
  /** Hash: day of month ("01".."31") -> AttendanceDay. One key per person per month keeps writes to one HSET a day. */
  attendance: (memberId: string, month: string) => `att:${memberId}:${month}`,
  /** Hash: taskId -> TimeEntry. */
  time: (memberId: string, date: string) => `time:${memberId}:${date}`,
  event: (id: string) => `event:${id}`,
  teamEvents: (teamId: string) => `events:team:${teamId}`,
};
