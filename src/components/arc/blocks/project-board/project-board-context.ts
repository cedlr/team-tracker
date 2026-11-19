import { createContext, useContext } from "react";
import type { PersonId } from "../../lib/media";
import type { Activity, Milestone, Project, ProjectStatus, Stage, Task } from "./project-board-data";

export type Tab = "overview" | "tasks" | "activity";
export type Scope = "all" | "mine" | "week";
export interface TaskQuery { scope: Scope; milestone: string; person: PersonId | "all" }

export interface BoardStore {
  projects: Project[];
  milestones: Milestone[];
  tasks: Task[];
  activity: Activity[];
  comments: (taskId: string) => Activity[];
  selectedTask: string | null;
  openTask: (id: string) => void;
  closeTask: () => void;
  toggleDone: (id: string) => void;
  setStage: (id: string, stage: Stage) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  reorder: (ids: string[]) => void;
  addComment: (taskId: string, body: string) => void;
  newTask: (milestone?: string) => void;
  setStatus: (projectId: string, status: ProjectStatus) => void;
  /** Navigate to a project, or to "home", "my-tasks" or "inbox". */
  go: (id: string) => void;
  tab: Tab;
  setTab: (tab: Tab) => void;
  query: TaskQuery;
  setQuery: (query: Partial<TaskQuery>) => void;
  markRead: (id: string) => void;
  /** The id of a task created in this session that should focus its title. */
  fresh: string | null;
}

export const BoardContext = createContext<BoardStore | null>(null);

export function useBoard() {
  const value = useContext(BoardContext);
  if (!value) throw new Error("useBoard must be used inside ProjectBoard.");
  return value;
}
