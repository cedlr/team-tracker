import type { CSSProperties } from "react";
import { CircleCheck, CirclePause, Folder, OctagonAlert, PenTool, ShoppingCart, Smartphone, TriangleAlert, Webhook, type LucideIcon } from "lucide-react";
import type { Priority, Project, ProjectStatus, Stage, Tool } from "./project-board-data";
import styles from "./project-board.module.css";

/* Each project carries a plain icon tinted in its tone, never a coloured dot. New projects get a folder until someone picks one. */
const projectIcons: Record<string, LucideIcon> = { checkout: ShoppingCart, mobile: Smartphone, api: Webhook, brand: PenTool };

export function ProjectIcon({ project, size = 16, className }: { project: Pick<Project, "id" | "tone">; size?: number; className?: string }) {
  const Icon = projectIcons[project.id] ?? Folder;
  return <Icon size={size} strokeWidth={1.75} aria-hidden="true" className={[styles.projectIcon, className].filter(Boolean).join(" ")} style={{ "--pb-tone": `var(--tone-${project.tone})` } as CSSProperties} />;
}

/** Project health as an icon with meaning: a check on track, a triangle at risk, an octagon off track, a pause when paused. */
export const statusIcon: Record<ProjectStatus, LucideIcon> = { "On track": CircleCheck, "At risk": TriangleAlert, "Off track": OctagonAlert, Paused: CirclePause };
export const statusTone = (status: ProjectStatus) => status === "On track" ? "success" : status === "At risk" ? "warning" : status === "Off track" ? "danger" : "neutral";

/** Completion as a thin ring that fills clockwise, coloured by health so an at risk project reads at a glance in the sidebar. */
export function ProgressRing({ share, status, size = 16 }: { share: number; status: ProjectStatus; size?: number }) {
  const r = 6;
  const length = 2 * Math.PI * r;
  return <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" className={styles.ring} data-tone={statusTone(status)}>
    <circle cx="8" cy="8" r={r} fill="none" strokeWidth="2" className={styles.ringTrack} />
    <circle cx="8" cy="8" r={r} fill="none" strokeWidth="2" strokeLinecap="round" className={styles.ringFill}
      strokeDasharray={`${Math.max(0.001, share) * length} ${length}`} transform="rotate(-90 8 8)" />
  </svg>;
}

/* Brand marks are sample content, drawn inline. GitHub and Stripe are Simple Icons paths (CC0); the Figma mark is its five shapes. */

export function ToolMark({ tool, size = 14 }: { tool: Tool; size?: number }) {
  if (tool === "figma") return <svg width={size} height={size} viewBox="0 0 38 57" aria-hidden="true" className={styles.toolMark}>
    <path fill="#1ABCFE" d="M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0z" />
    <path fill="#0ACF83" d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0z" />
    <path fill="#FF7262" d="M19 0v19h9.5a9.5 9.5 0 1 0 0-19H19z" />
    <path fill="#F24E1E" d="M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5z" />
    <path fill="#A259FF" d="M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5z" />
  </svg>;
  if (tool === "github") return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={styles.toolMark} fill="currentColor">
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
  </svg>;
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={styles.toolMark} fill="#635BFF">
    <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z" />
  </svg>;
}

export const toolName: Record<Tool, string> = { figma: "Figma", github: "GitHub", stripe: "Stripe" };

/** Stage as a ring that fills: empty when planned, half in progress, three quarters in review, a check when done. */
export function StageIcon({ stage, size = 15 }: { stage: Stage; size?: number }) {
  if (stage === "Done") return <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" className={styles.stageIcon} data-stage="done">
    <circle cx="8" cy="8" r="7" fill="currentColor" />
    <path d="M5 8.2 7 10.2 11 6" fill="none" stroke="var(--pb-check, white)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
  const key = stage === "Planned" ? "planned" : stage === "In progress" ? "progress" : "review";
  return <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" className={styles.stageIcon} data-stage={key}>
    <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
    {stage === "In progress" && <path d="M8 8V4.5a3.5 3.5 0 0 1 0 7z" fill="currentColor" />}
    {stage === "Review" && <path d="M8 8V4.5a3.5 3.5 0 1 1-3.5 3.5z" fill="currentColor" />}
  </svg>;
}

/** Three bars; urgent fills them in the danger colour. */
export function PriorityIcon({ priority }: { priority: Priority }) {
  const level = priority === "Low" ? 1 : priority === "Medium" ? 2 : 3;
  return <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" className={styles.priorityIcon} data-urgent={priority === "Urgent" ? "" : undefined}>
    {[0, 1, 2].map(bar => <rect key={bar} x={1.5 + bar * 4} y={10 - bar * 3} width="3" height={3 + bar * 3} rx="1" fill="currentColor" opacity={bar < level ? 1 : .25} />)}
  </svg>;
}
