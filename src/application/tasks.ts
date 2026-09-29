import { and, asc, desc, eq, inArray, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { isValidIsoDate } from "@/domain/dates";
import { bestTextMatch, findDuplicates } from "@/domain/entity-resolution";
import { ENERGY_LEVELS, OPEN_TASK_STATUSES, PRIORITY_LEVELS, TASK_STATUSES, type CreatedBy, type TaskStatus } from "@/domain/enums";
import { lifeAreas, projects, tasks } from "@/server/db/schema";
import { track } from "./analytics";
import { UserFacingError, type Ctx } from "./context";

const isoDate = z.string().refine(isValidIsoDate, "Fecha inválida (YYYY-MM-DD)");
const uuid = z.string().uuid();

export const TaskCreateSchema = z.object({
  title: z.string().trim().min(1, "Escribe un título").max(300),
  description: z.string().trim().max(5000).nullish(),
  dueDate: isoDate.nullish(),
  scheduledDate: isoDate.nullish(),
  estimatedMinutes: z.number().int().positive().max(24 * 60).nullish(),
  energy: z.enum(ENERGY_LEVELS).nullish(),
  priority: z.enum(PRIORITY_LEVELS).nullish(),
  lifeAreaId: uuid.nullish(),
  projectId: uuid.nullish(),
  personId: uuid.nullish(),
  status: z.enum(TASK_STATUSES).nullish(),
});
export type TaskCreateInput = z.infer<typeof TaskCreateSchema>;

export const TaskUpdateSchema = TaskCreateSchema.partial();
export type TaskUpdateInput = z.infer<typeof TaskUpdateSchema>;

export type TaskRow = typeof tasks.$inferSelect;
export type TaskWithRefs = TaskRow & { projectTitle: string | null; areaName: string | null; areaKey: string | null };

type CreateOptions = { createdBy?: CreatedBy; source?: string; inboxItemId?: string | null };

export async function createTask(ctx: Ctx, input: TaskCreateInput, opts: CreateOptions = {}): Promise<TaskRow> {
  const data = TaskCreateSchema.parse(input);
  await assertRefsOwned(ctx, data.projectId, data.lifeAreaId);
  let lifeAreaId = data.lifeAreaId ?? null;
  if (!lifeAreaId && data.projectId) {
    const project = await ctx.tx.query.projects.findFirst({ where: eq(projects.id, data.projectId), columns: { lifeAreaId: true } });
    lifeAreaId = project?.lifeAreaId ?? null;
  }
  const status: TaskStatus = data.status ?? (data.scheduledDate && data.scheduledDate > ctx.today ? "SCHEDULED" : "NEXT");
  const [row] = await ctx.tx
    .insert(tasks)
    .values({
      userId: ctx.userId,
      title: data.title,
      description: data.description ?? null,
      dueDate: data.dueDate ?? null,
      scheduledDate: data.scheduledDate ?? null,
      estimatedMinutes: data.estimatedMinutes ?? null,
      energy: data.energy ?? null,
      priority: data.priority ?? "MEDIUM",
      lifeAreaId,
      projectId: data.projectId ?? null,
      personId: data.personId ?? null,
      status,
      source: opts.source ?? "MANUAL",
      createdBy: opts.createdBy ?? "USER",
      inboxItemId: opts.inboxItemId ?? null,
    })
    .returning();
  if (row.projectId) await touchProject(ctx, row.projectId);
  return row;
}

export async function getTask(ctx: Ctx, id: string): Promise<TaskRow> {
  const row = await ctx.tx.query.tasks.findFirst({ where: and(eq(tasks.id, id), eq(tasks.userId, ctx.userId), isNull(tasks.deletedAt)) });
  if (!row) throw new UserFacingError("No encontré esa tarea. Puede que ya no exista.", "NOT_FOUND");
  return row;
}

export async function updateTask(ctx: Ctx, id: string, patch: TaskUpdateInput): Promise<TaskRow> {
  const data = TaskUpdateSchema.parse(patch);
  const current = await getTask(ctx, id);
  await assertRefsOwned(ctx, data.projectId, data.lifeAreaId);
  const next: Partial<typeof tasks.$inferInsert> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) (next as Record<string, unknown>)[key] = value;
  }
  if (data.status === "DONE" && !current.completedAt) next.completedAt = ctx.now;
  if (data.status && data.status !== "DONE") next.completedAt = null;
  if (data.scheduledDate && current.scheduledDate && data.scheduledDate > current.scheduledDate) next.deferCount = current.deferCount + 1;
  if (data.scheduledDate !== undefined && !data.status && (current.status === "NEXT" || current.status === "SCHEDULED" || current.status === "INBOX")) {
    next.status = data.scheduledDate && data.scheduledDate > ctx.today ? "SCHEDULED" : "NEXT";
  }
  const [row] = await ctx.tx.update(tasks).set(next).where(and(eq(tasks.id, id), eq(tasks.userId, ctx.userId))).returning();
  if (row.projectId) await touchProject(ctx, row.projectId);
  return row;
}

export async function completeTask(ctx: Ctx, id: string): Promise<TaskRow> {
  const current = await getTask(ctx, id);
  if (current.status === "DONE") return current;
  const [row] = await ctx.tx
    .update(tasks)
    .set({ status: "DONE", completedAt: ctx.now })
    .where(and(eq(tasks.id, id), eq(tasks.userId, ctx.userId)))
    .returning();
  if (row.projectId) await touchProject(ctx, row.projectId);
  await track(ctx, "task_completed", { source: row.source, hadProject: Boolean(row.projectId) });
  return row;
}

export async function reopenTask(ctx: Ctx, id: string): Promise<TaskRow> {
  const current = await getTask(ctx, id);
  const status: TaskStatus = current.scheduledDate && current.scheduledDate > ctx.today ? "SCHEDULED" : "NEXT";
  const [row] = await ctx.tx.update(tasks).set({ status, completedAt: null }).where(eq(tasks.id, id)).returning();
  return row;
}

export async function deferTask(ctx: Ctx, id: string, toDate: string): Promise<TaskRow> {
  if (!isValidIsoDate(toDate)) throw new UserFacingError("Fecha inválida.");
  const current = await getTask(ctx, id);
  const [row] = await ctx.tx
    .update(tasks)
    .set({ scheduledDate: toDate, status: toDate > ctx.today ? "SCHEDULED" : "NEXT", deferCount: current.deferCount + 1 })
    .where(eq(tasks.id, id))
    .returning();
  return row;
}

/** Soft delete: the task disappears from views but stays recoverable. */
export async function deleteTask(ctx: Ctx, id: string): Promise<void> {
  await getTask(ctx, id);
  await ctx.tx.update(tasks).set({ deletedAt: ctx.now }).where(and(eq(tasks.id, id), eq(tasks.userId, ctx.userId)));
}

export async function restoreTask(ctx: Ctx, id: string): Promise<void> {
  await ctx.tx.update(tasks).set({ deletedAt: null }).where(and(eq(tasks.id, id), eq(tasks.userId, ctx.userId)));
}

export type TaskFilter =
  | { kind: "open" }
  | { kind: "today" }
  | { kind: "overdue" }
  | { kind: "upcoming"; days?: number }
  | { kind: "done"; limit?: number }
  | { kind: "project"; projectId: string }
  | { kind: "area"; areaId: string }
  | { kind: "date"; date: string };

const openStatus = () => inArray(tasks.status, [...OPEN_TASK_STATUSES]);

export async function listTasks(ctx: Ctx, filter: TaskFilter): Promise<TaskWithRefs[]> {
  const conditions: SQL[] = [eq(tasks.userId, ctx.userId), isNull(tasks.deletedAt)];
  let order: SQL[] = [asc(sql`coalesce(${tasks.dueDate}, ${tasks.scheduledDate}, '9999-12-31')`), asc(tasks.createdAt)];
  let limit = 500;
  switch (filter.kind) {
    case "open":
      conditions.push(openStatus());
      break;
    case "today":
      conditions.push(openStatus(), or(lte(tasks.scheduledDate, ctx.today), lte(tasks.dueDate, ctx.today))!);
      break;
    case "date":
      conditions.push(openStatus(), or(eq(tasks.scheduledDate, filter.date), eq(tasks.dueDate, filter.date))!);
      break;
    case "overdue":
      conditions.push(openStatus(), sql`${tasks.dueDate} < ${ctx.today}`);
      break;
    case "upcoming":
      conditions.push(openStatus(), sql`coalesce(${tasks.dueDate}, ${tasks.scheduledDate}) > ${ctx.today}`);
      break;
    case "done":
      conditions.push(eq(tasks.status, "DONE"));
      order = [desc(tasks.completedAt)];
      limit = filter.limit ?? 50;
      break;
    case "project":
      conditions.push(eq(tasks.projectId, filter.projectId));
      order = [asc(sql`case when ${tasks.status} in ('DONE','CANCELLED') then 1 else 0 end`), ...order];
      break;
    case "area":
      conditions.push(eq(tasks.lifeAreaId, filter.areaId), openStatus());
      break;
  }
  const rows = await ctx.tx
    .select({ task: tasks, projectTitle: projects.title, areaName: lifeAreas.name, areaKey: lifeAreas.key })
    .from(tasks)
    .leftJoin(projects, eq(projects.id, tasks.projectId))
    .leftJoin(lifeAreas, eq(lifeAreas.id, tasks.lifeAreaId))
    .where(and(...conditions))
    .orderBy(...order)
    .limit(limit);
  return rows.map((r) => ({ ...r.task, projectTitle: r.projectTitle, areaName: r.areaName, areaKey: r.areaKey }));
}

export async function countTasks(ctx: Ctx, filter: TaskFilter): Promise<number> {
  return (await listTasks(ctx, filter)).length;
}

/** For "terminé la llamada a Olga": best open task matching the free text. */
export async function matchOpenTask(ctx: Ctx, text: string) {
  const open = await ctx.tx
    .select({ id: tasks.id, title: tasks.title })
    .from(tasks)
    .where(and(eq(tasks.userId, ctx.userId), isNull(tasks.deletedAt), openStatus()));
  return bestTextMatch(text, open);
}

export async function findDuplicateOpenTask(ctx: Ctx, title: string) {
  const open = await ctx.tx
    .select({ id: tasks.id, title: tasks.title })
    .from(tasks)
    .where(and(eq(tasks.userId, ctx.userId), isNull(tasks.deletedAt), openStatus()));
  return findDuplicates(title, open, 0.92)[0] ?? null;
}

async function touchProject(ctx: Ctx, projectId: string) {
  await ctx.tx.update(projects).set({ lastActivityAt: ctx.now }).where(and(eq(projects.id, projectId), eq(projects.userId, ctx.userId)));
}

async function assertRefsOwned(ctx: Ctx, projectId?: string | null, areaId?: string | null) {
  // RLS already hides foreign rows; this turns a silent FK into a clear error.
  if (projectId) {
    const p = await ctx.tx.query.projects.findFirst({ where: and(eq(projects.id, projectId), isNull(projects.deletedAt)), columns: { id: true } });
    if (!p) throw new UserFacingError("El proyecto indicado no existe.", "NOT_FOUND");
  }
  if (areaId) {
    const a = await ctx.tx.query.lifeAreas.findFirst({ where: eq(lifeAreas.id, areaId), columns: { id: true } });
    if (!a) throw new UserFacingError("El área indicada no existe.", "NOT_FOUND");
  }
}
