import { and, asc, desc, eq, lt } from "drizzle-orm";
import { z } from "zod";
import { AREA_MODES, AREA_STATUSES } from "@/domain/enums";
import { computeLifeScore, trendFromDelta, type LifeScoreResult } from "@/domain/life-score";
import { lifeAreas, lifeScoreSnapshots } from "@/server/db/schema";
import { UserFacingError, type Ctx } from "./context";
import { recordVersion } from "./versions";

export type AreaRow = typeof lifeAreas.$inferSelect;

export async function listAreas(ctx: Ctx, opts: { activeOnly?: boolean } = {}): Promise<AreaRow[]> {
  const conditions = [eq(lifeAreas.userId, ctx.userId)];
  if (opts.activeOnly) conditions.push(eq(lifeAreas.status, "ACTIVE"));
  return ctx.tx.select().from(lifeAreas).where(and(...conditions)).orderBy(asc(lifeAreas.sortOrder));
}

export async function getAreaByKey(ctx: Ctx, key: string): Promise<AreaRow> {
  const row = await ctx.tx.query.lifeAreas.findFirst({ where: and(eq(lifeAreas.userId, ctx.userId), eq(lifeAreas.key, key)) });
  if (!row) throw new UserFacingError("No encontré esa área.", "NOT_FOUND");
  return row;
}

export async function areaIdByKey(ctx: Ctx, key: string | null | undefined): Promise<string | null> {
  if (!key) return null;
  const row = await ctx.tx.query.lifeAreas.findFirst({ where: and(eq(lifeAreas.userId, ctx.userId), eq(lifeAreas.key, key)), columns: { id: true } });
  return row?.id ?? null;
}

export const AreaUpdateSchema = z.object({
  score: z.number().int().min(0).max(100).nullish(),
  mode: z.enum(AREA_MODES).optional(),
  status: z.enum(AREA_STATUSES).optional(),
  notes: z.string().max(2000).nullish(),
  weight: z.number().min(0).max(3).optional(),
});

export async function updateArea(ctx: Ctx, id: string, patch: z.infer<typeof AreaUpdateSchema>): Promise<AreaRow> {
  const data = AreaUpdateSchema.parse(patch);
  const current = await ctx.tx.query.lifeAreas.findFirst({ where: and(eq(lifeAreas.id, id), eq(lifeAreas.userId, ctx.userId)) });
  if (!current) throw new UserFacingError("No encontré esa área.", "NOT_FOUND");
  const next: Partial<typeof lifeAreas.$inferInsert> = {};
  if (data.score !== undefined) {
    next.score = data.score;
    next.trend = trendFromDelta(current.score === null || data.score === null ? null : data.score - current.score);
    next.lastReviewedAt = ctx.now;
  }
  if (data.mode) next.mode = data.mode;
  if (data.status) next.status = data.status;
  if (data.notes !== undefined) next.notes = data.notes;
  if (data.weight !== undefined) next.weight = data.weight;
  const [row] = await ctx.tx.update(lifeAreas).set(next).where(eq(lifeAreas.id, id)).returning();
  if (data.score !== undefined || data.mode) {
    await recordVersion(ctx, "life_area", id, { score: current.score, mode: current.mode }, { score: row.score, mode: row.mode });
  }
  return row;
}

export async function setActiveAreas(ctx: Ctx, keys: string[]): Promise<void> {
  const all = await listAreas(ctx);
  for (const area of all) {
    const status = keys.includes(area.key) ? "ACTIVE" : "DORMANT";
    if (area.status !== status) await ctx.tx.update(lifeAreas).set({ status }).where(eq(lifeAreas.id, area.id));
  }
}

export type LifeScoreView = LifeScoreResult & { delta: number | null; previousDate: string | null };

export async function computeCurrentLifeScore(ctx: Ctx): Promise<LifeScoreView> {
  const areas = await listAreas(ctx);
  const result = computeLifeScore(
    areas.map((a) => ({ key: a.key, name: a.name, score: a.score, weight: a.weight, mode: a.mode, active: a.status === "ACTIVE", isFoundational: a.isFoundational })),
  );
  const previous = await ctx.tx
    .select()
    .from(lifeScoreSnapshots)
    .where(and(eq(lifeScoreSnapshots.userId, ctx.userId), lt(lifeScoreSnapshots.calculationDate, ctx.today)))
    .orderBy(desc(lifeScoreSnapshots.calculationDate))
    .limit(1);
  const prev = previous[0];
  return { ...result, delta: result.score !== null && prev ? result.score - prev.score : null, previousDate: prev?.calculationDate ?? null };
}

/** Stores today's score (one per day, last write wins) for history and trends. */
export async function snapshotLifeScore(ctx: Ctx): Promise<LifeScoreView> {
  const view = await computeCurrentLifeScore(ctx);
  if (view.score === null) return view;
  const factors = { base: view.baseScore, penalty: view.penalty, contributions: view.contributions, penalties: view.penalties };
  await ctx.tx
    .insert(lifeScoreSnapshots)
    .values({ userId: ctx.userId, score: view.score, calculationDate: ctx.today, factors, explanation: view.explanation })
    .onConflictDoUpdate({
      target: [lifeScoreSnapshots.userId, lifeScoreSnapshots.calculationDate],
      set: { score: view.score, factors, explanation: view.explanation },
    });
  return view;
}

export async function lifeScoreHistory(ctx: Ctx, limit = 30) {
  const rows = await ctx.tx
    .select({ score: lifeScoreSnapshots.score, date: lifeScoreSnapshots.calculationDate })
    .from(lifeScoreSnapshots)
    .where(eq(lifeScoreSnapshots.userId, ctx.userId))
    .orderBy(desc(lifeScoreSnapshots.calculationDate))
    .limit(limit);
  return rows.reverse();
}
