import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { isValidIsoDate } from "@/domain/dates";
import { findDuplicates } from "@/domain/entity-resolution";
import { PRIORITY_LEVELS, PROJECT_STATUSES, type CreatedBy, type ProjectStatus } from "@/domain/enums";
import { goals, lifeAreas, milestones, projects, tasks } from "@/server/db/schema";
import { UserFacingError, type Ctx } from "./context";
import { recordVersion } from "./versions";

const isoDate = z.string().refine(isValidIsoDate, "Fecha inválida");

export const ProjectCreateSchema = z.object({
  title: z.string().trim().min(1, "Escribe un nombre").max(200),
  description: z.string().trim().max(5000).nullish(),
  desiredOutcome: z.string().trim().max(1000).nullish(),
  lifeAreaId: z.string().uuid().nullish(),
  goalId: z.string().uuid().nullish(),
  status: z.enum(PROJECT_STATUSES).nullish(),
  priority: z.enum(PRIORITY_LEVELS).nullish(),
  startDate: isoDate.nullish(),
  targetDate: isoDate.nullish(),
  nextAction: z.string().trim().max(300).nullish(),
  metadata: z
    .object({
      client: z.string().max(200).optional(),
      caseReference: z.string().max(200).optional(),
      courtOrEntity: z.string().max(200).optional(),
      legalDeadline: isoDate.optional(),
    })
    .partial()
    .nullish(),
});
export type ProjectCreateInput = z.infer<typeof ProjectCreateSchema>;
export const ProjectUpdateSchema = ProjectCreateSchema.partial().extend({ progress: z.number().int().min(0).max(100).nullish() });

export type ProjectRow = typeof projects.$inferSelect;
export type ProjectSummary = ProjectRow & {
  areaName: string | null;
  areaKey: string | null;
  goalTitle: string | null;
  openTasks: number;
  doneTasks: number;
  computedProgress: number;
  nextTaskTitle: string | null;
};

export async function findDuplicateProject(ctx: Ctx, title: string) {
  const existing = await ctx.tx
    .select({ id: projects.id, title: projects.title })
    .from(projects)
    .where(and(eq(projects.userId, ctx.userId), isNull(projects.deletedAt), inArray(projects.status, ["IDEA", "PLANNED", "ACTIVE", "PAUSED"])));
  return findDuplicates(title, existing)[0] ?? null;
}

export async function createProject(ctx: Ctx, input: ProjectCreateInput, opts: { allowDuplicate?: boolean; createdBy?: CreatedBy } = {}): Promise<ProjectRow> {
  const data = ProjectCreateSchema.parse(input);
  if (!opts.allowDuplicate) {
    const dup = await findDuplicateProject(ctx, data.title);
    if (dup) throw new UserFacingError(`Ya existe un proyecto parecido: “${dup.title}”.`, "CONFLICT");
  }
  let lifeAreaId = data.lifeAreaId ?? null;
  if (!lifeAreaId && data.goalId) {
    const goal = await ctx.tx.query.goals.findFirst({ where: eq(goals.id, data.goalId), columns: { lifeAreaId: true } });
    lifeAreaId = goal?.lifeAreaId ?? null;
  }
  const [row] = await ctx.tx
    .insert(projects)
    .values({
      userId: ctx.userId,
      title: data.title,
      description: data.description ?? null,
      desiredOutcome: data.desiredOutcome ?? null,
      lifeAreaId,
      goalId: data.goalId ?? null,
      status: data.status ?? "ACTIVE",
      priority: data.priority ?? "MEDIUM",
      startDate: data.startDate ?? ctx.today,
      targetDate: data.targetDate ?? null,
      nextAction: data.nextAction ?? null,
      metadata: data.metadata ?? {},
    })
    .returning();
  await recordVersion(ctx, "project", row.id, null, { status: row.status, title: row.title }, opts.createdBy);
  return row;
}

export async function getProject(ctx: Ctx, id: string): Promise<ProjectRow> {
  const row = await ctx.tx.query.projects.findFirst({ where: and(eq(projects.id, id), eq(projects.userId, ctx.userId), isNull(projects.deletedAt)) });
  if (!row) throw new UserFacingError("No encontré ese proyecto.", "NOT_FOUND");
  return row;
}

export async function updateProject(ctx: Ctx, id: string, patch: z.infer<typeof ProjectUpdateSchema>, changedBy: CreatedBy = "USER"): Promise<ProjectRow> {
  const data = ProjectUpdateSchema.parse(patch);
  const current = await getProject(ctx, id);
  const next: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) if (v !== undefined) next[k] = v;
  const [row] = await ctx.tx
    .update(projects)
    .set({ ...(next as Partial<typeof projects.$inferInsert>), lastActivityAt: ctx.now })
    .where(and(eq(projects.id, id), eq(projects.userId, ctx.userId)))
    .returning();
  if (data.status && data.status !== current.status) {
    await recordVersion(ctx, "project", id, { status: current.status }, { status: data.status }, changedBy);
  }
  return row;
}

export async function setProjectStatus(ctx: Ctx, id: string, status: ProjectStatus): Promise<ProjectRow> {
  return updateProject(ctx, id, { status });
}

export async function deleteProject(ctx: Ctx, id: string): Promise<void> {
  await getProject(ctx, id);
  await ctx.tx.update(projects).set({ deletedAt: ctx.now }).where(eq(projects.id, id));
}

export async function listProjects(ctx: Ctx, opts: { statuses?: ProjectStatus[]; goalId?: string; areaId?: string } = {}): Promise<ProjectSummary[]> {
  const conditions = [eq(projects.userId, ctx.userId), isNull(projects.deletedAt)];
  if (opts.statuses) conditions.push(inArray(projects.status, opts.statuses));
  if (opts.goalId) conditions.push(eq(projects.goalId, opts.goalId));
  if (opts.areaId) conditions.push(eq(projects.lifeAreaId, opts.areaId));

  const rows = await ctx.tx
    .select({
      project: projects,
      areaName: lifeAreas.name,
      areaKey: lifeAreas.key,
      goalTitle: goals.title,
      openTasks: sql<number>`count(${tasks.id}) filter (where ${tasks.status} not in ('DONE','CANCELLED') and ${tasks.deletedAt} is null)`.mapWith(Number),
      doneTasks: sql<number>`count(${tasks.id}) filter (where ${tasks.status} = 'DONE' and ${tasks.deletedAt} is null)`.mapWith(Number),
      nextTaskTitle: sql<string | null>`(array_agg(${tasks.title} order by coalesce(${tasks.dueDate}, ${tasks.scheduledDate}, '9999-12-31'), ${tasks.createdAt}) filter (where ${tasks.status} not in ('DONE','CANCELLED') and ${tasks.deletedAt} is null))[1]`,
    })
    .from(projects)
    .leftJoin(lifeAreas, eq(lifeAreas.id, projects.lifeAreaId))
    .leftJoin(goals, eq(goals.id, projects.goalId))
    .leftJoin(tasks, eq(tasks.projectId, projects.id))
    .where(and(...conditions))
    .groupBy(projects.id, lifeAreas.name, lifeAreas.key, goals.title)
    .orderBy(
      asc(sql`case ${projects.status} when 'ACTIVE' then 0 when 'PLANNED' then 1 when 'IDEA' then 2 when 'PAUSED' then 3 else 4 end`),
      asc(sql`case ${projects.priority} when 'CRITICAL' then 0 when 'HIGH' then 1 when 'MEDIUM' then 2 else 3 end`),
      desc(projects.lastActivityAt),
    );

  return rows.map((r) => {
    const total = r.openTasks + r.doneTasks;
    return {
      ...r.project,
      areaName: r.areaName,
      areaKey: r.areaKey,
      goalTitle: r.goalTitle,
      openTasks: r.openTasks,
      doneTasks: r.doneTasks,
      computedProgress: r.project.progress ?? (total === 0 ? 0 : Math.round((r.doneTasks / total) * 100)),
      nextTaskTitle: r.nextTaskTitle ?? r.project.nextAction,
    };
  });
}

/** Matches a free-text mention ("Carmen", "PACE") against active project titles. */
export async function matchProjectMention(ctx: Ctx, text: string): Promise<{ id: string; title: string } | null> {
  const active = await ctx.tx
    .select({ id: projects.id, title: projects.title })
    .from(projects)
    .where(and(eq(projects.userId, ctx.userId), isNull(projects.deletedAt), inArray(projects.status, ["IDEA", "PLANNED", "ACTIVE", "PAUSED"])));
  const haystack = ` ${normalizeLoose(text)} `;
  let best: { id: string; title: string; len: number } | null = null;
  for (const p of active) {
    const core = normalizeLoose(p.title.replace(/^proyecto\s+/i, ""));
    const bare = core.replace(/[^a-z0-9 ]/g, "").trim();
    if (bare.length < 3) continue;
    if (haystack.includes(` ${core} `) || haystack.includes(` ${bare} `)) {
      if (!best || core.length > best.len) best = { id: p.id, title: p.title, len: core.length };
    }
  }
  return best ? { id: best.id, title: best.title } : null;
}

function normalizeLoose(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9+ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Milestones ─────────────────────────────────────────────────────────────
export async function listMilestones(ctx: Ctx, projectId: string) {
  return ctx.tx.select().from(milestones).where(and(eq(milestones.projectId, projectId), eq(milestones.userId, ctx.userId))).orderBy(asc(milestones.sortOrder), asc(milestones.dueDate));
}

export async function createMilestone(ctx: Ctx, projectId: string, title: string, dueDate: string | null) {
  await getProject(ctx, projectId);
  const trimmed = title.trim();
  if (!trimmed) throw new UserFacingError("Escribe un hito.");
  if (dueDate && !isValidIsoDate(dueDate)) throw new UserFacingError("Fecha inválida.");
  const [row] = await ctx.tx.insert(milestones).values({ userId: ctx.userId, projectId, title: trimmed, dueDate }).returning();
  return row;
}

export async function toggleMilestone(ctx: Ctx, id: string) {
  const current = await ctx.tx.query.milestones.findFirst({ where: and(eq(milestones.id, id), eq(milestones.userId, ctx.userId)) });
  if (!current) throw new UserFacingError("No encontré ese hito.", "NOT_FOUND");
  const [row] = await ctx.tx.update(milestones).set({ completedAt: current.completedAt ? null : ctx.now }).where(eq(milestones.id, id)).returning();
  await ctx.tx.update(projects).set({ lastActivityAt: ctx.now }).where(eq(projects.id, current.projectId));
  return row;
}
