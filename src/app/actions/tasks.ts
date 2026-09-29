"use server";

import { completeTask, createTask, deferTask, deleteTask, reopenTask, restoreTask, updateTask, type TaskUpdateInput } from "@/application/tasks";
import { setBig3 } from "@/application/intelligence";
import { addDays } from "@/domain/dates";
import type { EnergyLevel, PriorityLevel } from "@/domain/enums";
import { formNumber, formString, runAction } from "@/server/action";

const PATHS = ["/"];

export async function createTaskAction(form: FormData) {
  return runAction(
    "createTask",
    (ctx) =>
      createTask(ctx, {
        title: formString(form, "title") ?? "",
        description: formString(form, "description"),
        dueDate: formString(form, "dueDate"),
        scheduledDate: formString(form, "scheduledDate"),
        estimatedMinutes: formNumber(form, "estimatedMinutes"),
        priority: (formString(form, "priority") as PriorityLevel | null) ?? undefined,
        energy: formString(form, "energy") as EnergyLevel | null,
        projectId: formString(form, "projectId"),
        lifeAreaId: formString(form, "lifeAreaId"),
      }),
    { revalidate: PATHS, message: "Tarea creada." },
  );
}

export async function completeTaskAction(id: string) {
  return runAction("completeTask", (ctx) => completeTask(ctx, id), { revalidate: PATHS });
}

export async function reopenTaskAction(id: string) {
  return runAction("reopenTask", (ctx) => reopenTask(ctx, id), { revalidate: PATHS });
}

export async function deferTaskAction(id: string, days: number) {
  return runAction("deferTask", (ctx) => deferTask(ctx, id, addDays(ctx.today, days)), { revalidate: PATHS });
}

export async function updateTaskAction(id: string, patch: TaskUpdateInput) {
  return runAction("updateTask", (ctx) => updateTask(ctx, id, patch), { revalidate: PATHS });
}

export async function deleteTaskAction(id: string) {
  return runAction("deleteTask", (ctx) => deleteTask(ctx, id), { revalidate: PATHS });
}

export async function restoreTaskAction(id: string) {
  return runAction("restoreTask", (ctx) => restoreTask(ctx, id), { revalidate: PATHS });
}

export async function confirmBig3Action(taskIds: string[], date?: string) {
  return runAction("confirmBig3", (ctx) => setBig3(ctx, date ?? ctx.today, taskIds, "USER_CONFIRMED"), { revalidate: PATHS, message: "Big 3 confirmado." });
}
