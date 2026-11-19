import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const toneSchema = z.enum(["teal", "sky", "orchid", "violet", "rose", "amber", "green"]);
/** Department shown with a person. */
export const departmentSchema = z.enum(["Design", "Engineering", "Go-to-market", "Operations"]);

export const teamSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(60),
  tone: toneSchema.default("teal"),
  /** Prefix for task keys, such as "WEB". */
  key: z.string().min(2).max(5),
  /** Saved roles-and-permissions matrix: role id -> permission id -> granted. */
  grants: z.record(z.string(), z.record(z.string(), z.boolean())).optional(),
});

export const membershipSchema = z.object({
  teamId: z.string(),
  /** Share of the person's capacity given to this team, 0 to 1. */
  allocation: z.number().min(0).max(1).default(1),
  role: z.enum(["admin", "lead", "member"]).default("member"),
});

export const memberSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email().transform(value => value.toLowerCase()),
  passwordHash: z.string().optional(),
  title: z.string().default(""),
  department: departmentSchema.default("Engineering"),
  /** Arc sample portrait id (lib/media people), or an image URL. */
  avatar: z.string().optional(),
  weeklyCapacityHours: z.number().min(0).max(80).default(40),
  started: isoDate,
  website: z.string().max(120).optional(),
  bio: z.string().max(200).optional(),
  isAdmin: z.boolean().default(false),
  memberships: z.array(membershipSchema).min(1),
});

export const projectSchema = z.object({
  id: z.string().min(1),
  teamId: z.string(),
  name: z.string().min(1).max(80),
  key: z.string().min(2).max(5),
  tone: toneSchema.default("sky"),
  status: z.enum(["active", "paused", "done"]).default("active"),
  start: isoDate,
  end: isoDate,
  memberIds: z.array(z.string()).default([]),
});

export const taskStatusSchema = z.enum(["backlog", "todo", "progress", "review", "done"]);
export const taskSchema = z.object({
  id: z.string().min(1),
  teamId: z.string(),
  projectId: z.string(),
  title: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
  status: taskStatusSchema.default("todo"),
  priority: z.enum(["urgent", "high", "medium", "low", "none"]).default("none"),
  assigneeId: z.string().optional(),
  estimateHours: z.number().min(0).max(1000).optional(),
  points: z.number().min(0).max(100).optional(),
  start: isoDate.optional(),
  due: isoDate.optional(),
  /** Board order inside a column. */
  order: z.number().default(0),
  updatedAt: z.string(),
});

export const leaveTypeSchema = z.enum(["annual", "sick", "personal", "parental", "unpaid"]);
export const leaveSchema = z.object({
  id: z.string().min(1),
  teamId: z.string(),
  memberId: z.string(),
  type: leaveTypeSchema,
  from: isoDate,
  to: isoDate,
  days: z.number().min(0.5).max(365),
  note: z.string().max(500).optional(),
  /** Who recorded it. Leave is approved by email; this app only keeps the record. */
  addedBy: z.string().optional(),
  createdAt: z.string(),
});

export const attendanceStatusSchema = z.enum(["present", "remote", "leave", "absent"]);
/** One field per day in att:{memberId}:{yyyy-mm}. */
export const attendanceDaySchema = z.object({
  status: attendanceStatusSchema,
  teamId: z.string(),
  at: z.string(),
  /** Set when the member checks out. Absent until then. */
  outAt: z.string().optional(),
});

/** One field per task in time:{memberId}:{yyyy-mm-dd}: hours logged. */
export const timeEntrySchema = z.object({ hours: z.number().min(0).max(24), teamId: z.string() });

export type Team = z.infer<typeof teamSchema>;
export type Membership = z.infer<typeof membershipSchema>;
export type Member = z.infer<typeof memberSchema>;
export type PublicMember = Omit<Member, "passwordHash">;
export type Project = z.infer<typeof projectSchema>;
export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type Task = z.infer<typeof taskSchema>;
export type Leave = z.infer<typeof leaveSchema>;
export type LeaveType = z.infer<typeof leaveTypeSchema>;
export type AttendanceStatus = z.infer<typeof attendanceStatusSchema>;
export type AttendanceDay = z.infer<typeof attendanceDaySchema>;
export type TimeEntry = z.infer<typeof timeEntrySchema>;

/* Inputs for Server Actions */
export const checkInInput = z.object({ status: z.enum(["present", "remote"]).default("present") });
export const taskInput = z.object({
  id: z.string().optional(),
  projectId: z.string(),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(4000).optional(),
  status: taskStatusSchema.optional(),
  priority: taskSchema.shape.priority.optional(),
  assigneeId: z.string().optional(),
  points: z.number().min(0).max(100).optional(),
  estimateHours: z.number().min(0).max(1000).optional(),
  start: isoDate.optional(),
  /** Null clears a due date. */
  due: isoDate.nullable().optional(),
  order: z.number().optional(),
});
export const leaveEntryInput = z.object({
  memberId: z.string().min(1),
  type: leaveTypeSchema,
  from: isoDate,
  to: isoDate,
  note: z.string().max(500).optional(),
}).refine(value => value.from <= value.to, { message: "The end date is before the start date", path: ["to"] });

export const calendarKindSchema = z.enum(["holiday", "deadline", "focus"]);
export const calendarEventSchema = z.object({
  id: z.string().min(1),
  teamId: z.string(),
  title: z.string().min(1).max(200),
  kind: calendarKindSchema,
  start: isoDate,
  end: isoDate.optional(),
  createdBy: z.string(),
});
export type CalendarKind = z.infer<typeof calendarKindSchema>;
export type CalendarEventRecord = z.infer<typeof calendarEventSchema>;

export const profileInput = z.object({
  name: z.string().trim().min(1).max(80),
  title: z.string().trim().max(80),
  website: z.string().trim().max(120).optional(),
  bio: z.string().trim().max(200).optional(),
});
export const passwordInput = z.object({
  currentPassword: z.string().min(1).max(200),
  nextPassword: z.string().min(8).max(200),
});
export const inviteInput = z.object({
  email: z.string().email(),
  name: z.string().trim().min(1).max(80).optional(),
  role: z.enum(["admin", "lead", "member"]).default("member"),
});
export const roleChangeInput = z.object({
  memberId: z.string().min(1),
  role: z.enum(["admin", "lead", "member"]),
});
export const teamNameInput = z.object({ name: z.string().trim().min(1).max(60) });
export const logHoursInput = z.object({
  taskId: z.string().min(1),
  date: isoDate.optional(),
  hours: z.number().min(0.5).max(24),
});
