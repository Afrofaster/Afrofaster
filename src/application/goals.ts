import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { isValidIsoDate } from "@/domain/dates";
import { findDuplicates } from "@/domain/entity-resolution";
import { GOAL_HORIZONS, GOAL_STATUSES, PRIORITY_LEVELS, type CreatedBy, type GoalStatus } from "@/domain/enums";
import { goals, lifeAreas, projects } from "@/server/db/schema";
import { UserFacingError, type Ctx } from "./context";
import { recordVersion } from "./versions";

const isoDate = z.string().refine(isValidIsoDate, "Fecha inválida");

export const GoalCreateSchema = z.object({
  title: z.string().trim().min(1, "Escribe tu objetivo").max(200),
  outcome: z.string().trim().max(1000).nullish(),
  metric: z.string().trim().max(200).nullish(),
  unit: z.string().trim().max(30).nullish(),
  baseline: z.number().nullish(),
  target: z.number().nullish(),
  currentValue: z.number().nullish(),
  deadline: isoDate.nullish(),
  horizon: z.enum(GOAL_HORIZONS).nullish(),
  lifeAreaId: z.string().uuid().nullish(),
  status: z.enum(GOAL_STATUSES).nullish(),
  priority: z.enum(PRIORITY_LEVELS).nullish(),
});
export type GoalCreateInput = z.infer<typeof GoalCreateSchema>;
export const GoalUpdateSchema = GoalCreateSchema.partial();

export type GoalRow = typeof goals.$inferSelect;
export type GoalSummary = GoalRow & { areaName: string | null; areaKey: string | null; projectCount: number; activeProjects: number; progress: number | null };

export async function findDuplicateGoal(ctx: Ctx, title: string) {
  const existing = await ctx.tx
    .select({ id: goals.id, title: goals.title })
    .from(goals)
    .where(and(eq(goals.userId, ctx.userId), isNull(goals.deletedAt), inArray(goals.status, ["DRAFT", "ACTIVE", "AT_RISK", "PAUSED"])));
  return findDuplicates(title, existing)[0] ?? null;
}

export async function createGoal(ctx: Ctx, input: GoalCreateInput, opts: { allowDuplicate?: boolean; createdBy?: CreatedBy } = {}): Promise<GoalRow> {
  const data = GoalCreateSchema.parse(input);
  if (!opts.allowDuplicate) {
    const dup = await findDuplicateGoal(ctx, data.title);
    if (dup) throw new UserFacingError(`Ya tienes un objetivo parecido: “${dup.title}”.`, "CONFLICT");
  }
  const [row] = await ctx.tx
    .insert(goals)
    .values({
      userId: ctx.userId,
      title: data.title,
      outcome: data.outcome ?? null,
      metric: data.metric ?? null,
      unit: data.unit ?? null,
      baseline: data.baseline ?? null,
      target: data.target ?? null,
      currentValue: data.currentValue ?? data.baseline ?? null,
      deadline: data.deadline ?? null,
      horizon: data.horizon ?? "QUARTER",
      lifeAreaId: data.lifeAreaId ?? null,
      status: data.status ?? "ACTIVE",
      priority: data.priority ?? "MEDIUM",
    })
    .returning();
  await recordVersion(ctx, "goal", row.id, null, snapshot(row), opts.createdBy);
  return row;
}

export async function getGoal(ctx: Ctx, id: string): Promise<GoalRow> {
  const row = await ctx.tx.query.goals.findFirst({ where: and(eq(goals.id, id), eq(goals.userId, ctx.userId), isNull(goals.deletedAt)) });
  if (!row) throw new UserFacingError("No encontré ese objetivo.", "NOT_FOUND");
  return row;
}

export async function updateGoal(ctx: Ctx, id: string, patch: z.infer<typeof GoalUpdateSchema>, changedBy: CreatedBy = "USER"): Promise<GoalRow> {
  const data = GoalUpdateSchema.parse(patch);
  const current = await getGoal(ctx, id);
  const next: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) if (v !== undefined) next[k] = v;
  const [row] = await ctx.tx.update(goals).set(next as Partial<typeof goals.$inferInsert>).where(and(eq(goals.id, id), eq(goals.userId, ctx.userId))).returning();
  await recordVersion(ctx, "goal", id, snapshot(current), snapshot(row), changedBy);
  return row;
}

export async function setGoalStatus(ctx: Ctx, id: string, status: GoalStatus) {
  return updateGoal(ctx, id, { status });
}

export async function deleteGoal(ctx: Ctx, id: string) {
  await getGoal(ctx, id);
  await ctx.tx.update(goals).set({ deletedAt: ctx.now }).where(eq(goals.id, id));
}

export function goalProgress(g: Pick<GoalRow, "baseline" | "target" | "currentValue">): number | null {
  if (g.target === null || g.currentValue === null) return null;
  const base = g.baseline ?? 0;
  if (g.target === base) return g.currentValue >= g.target ? 100 : 0;
  const pct = ((g.currentValue - base) / (g.target - base)) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

export async function listGoals(ctx: Ctx, opts: { statuses?: GoalStatus[]; areaId?: string } = {}): Promise<GoalSummary[]> {
  const conditions = [eq(goals.userId, ctx.userId), isNull(goals.deletedAt)];
  if (opts.statuses) conditions.push(inArray(goals.status, opts.statuses));
  if (opts.areaId) conditions.push(eq(goals.lifeAreaId, opts.areaId));
  const rows = await ctx.tx
    .select({
      goal: goals,
      areaName: lifeAreas.name,
      areaKey: lifeAreas.key,
      projectCount: sql<number>`count(${projects.id}) filter (where ${projects.deletedAt} is null)`.mapWith(Number),
      activeProjects: sql<number>`count(${projects.id}) filter (where ${projects.status} = 'ACTIVE' and ${projects.deletedAt} is null)`.mapWith(Number),
    })
    .from(goals)
    .leftJoin(lifeAreas, eq(lifeAreas.id, goals.lifeAreaId))
    .leftJoin(projects, eq(projects.goalId, goals.id))
    .where(and(...conditions))
    .groupBy(goals.id, lifeAreas.name, lifeAreas.key)
    .orderBy(asc(sql`case ${goals.status} when 'AT_RISK' then 0 when 'ACTIVE' then 1 when 'DRAFT' then 2 when 'PAUSED' then 3 else 4 end`), asc(goals.deadline));
  return rows.map((r) => ({ ...r.goal, areaName: r.areaName, areaKey: r.areaKey, projectCount: r.projectCount, activeProjects: r.activeProjects, progress: goalProgress(r.goal) }));
}

function snapshot(g: GoalRow): Record<string, unknown> {
  return { title: g.title, status: g.status, target: g.target, currentValue: g.currentValue, deadline: g.deadline, outcome: g.outcome };
}
