"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { requireViewer } from "@/lib/session";
import { getProject, getTask, listTasks, saveTask } from "@/lib/db";
import { taskInput, taskStatusSchema, type Task } from "@/lib/schemas";

/** Create a task, or update one in the current team. */
export async function upsertTask(input: unknown) {
  const parsed = taskInput.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid task" };
  const { team } = await requireViewer();
  const project = await getProject(parsed.data.projectId);
  if (!project || project.teamId !== team.id) return { ok: false as const, error: "Project not found in this team." };
  const previous = parsed.data.id ? await getTask(parsed.data.id) : null;
  if (previous && previous.teamId !== team.id) return { ok: false as const, error: "Task not found in this team." };
  const { id: _id, ...fields } = parsed.data;
  const task: Task = {
    ...(previous ?? { id: parsed.data.id ?? randomUUID(), teamId: team.id, status: "todo", priority: "none", order: Date.now() }),
    ...Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)),
    updatedAt: new Date().toISOString(),
  } as Task;
  const saved = await saveTask(task);
  revalidatePath("/tasks"); revalidatePath(`/projects/${saved.projectId}`); revalidatePath("/");
  return { ok: true as const, task: saved };
}

/** Kanban: persist status and order for the cards that moved. Only changed tasks are written. */
export async function moveTasks(moves: { id: string; status: string; order: number }[]) {
  const { team } = await requireViewer();
  const current = new Map((await listTasks({ teamId: team.id })).map(task => [task.id, task]));
  let written = 0;
  for (const move of moves.slice(0, 500)) {
    const task = current.get(move.id);
    const status = taskStatusSchema.safeParse(move.status);
    if (!task || !status.success) continue;
    if (task.status === status.data && task.order === move.order) continue;
    await saveTask({ ...task, status: status.data, order: move.order, updatedAt: new Date().toISOString() });
    written++;
  }
  if (written) { revalidatePath("/tasks"); revalidatePath("/"); }
  return { ok: true as const, written };
}
