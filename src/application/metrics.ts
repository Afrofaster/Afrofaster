import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { addDays, startOfMonth } from "@/domain/dates";
import { habitLogs, habits, metricEntries, metrics, transactions } from "@/server/db/schema";
import { UserFacingError, type Ctx } from "./context";
import { DEFAULT_METRICS } from "./workspace";
import { areaIdByKey } from "./areas";

export async function ensureMetric(ctx: Ctx, key: string) {
  const existing = await ctx.tx.query.metrics.findFirst({ where: and(eq(metrics.userId, ctx.userId), eq(metrics.key, key)) });
  if (existing) return existing;
  const def = DEFAULT_METRICS.find((m) => m.key === key);
  const [row] = await ctx.tx
    .insert(metrics)
    .values({
      userId: ctx.userId,
      key,
      name: def?.name ?? key.replace(/_/g, " "),
      unit: def?.unit ?? null,
      lifeAreaId: def ? await areaIdByKey(ctx, def.area) : null,
      aggregation: def?.aggregation ?? "AVG",
      direction: def?.direction ?? "HIGHER_BETTER",
      target: def?.target ?? null,
      sensitiveCategory: def?.sensitive ?? null,
    })
    .onConflictDoNothing()
    .returning();
  return row ?? (await ctx.tx.query.metrics.findFirst({ where: and(eq(metrics.userId, ctx.userId), eq(metrics.key, key)) }))!;
}

export async function logMetric(ctx: Ctx, key: string, value: number, date: string = ctx.today, inboxItemId: string | null = null, note: string | null = null) {
  if (!Number.isFinite(value)) throw new UserFacingError("El valor de la métrica no es válido.");
  if (key === "sleep_hours" && (value < 0 || value > 24)) throw new UserFacingError("Las horas de sueño deben estar entre 0 y 24.");
  const metric = await ensureMetric(ctx, key);
  const [entry] = await ctx.tx.insert(metricEntries).values({ userId: ctx.userId, metricId: metric.id, value, recordedFor: date, inboxItemId, note }).returning();
  return { metric, entry };
}

export async function listMetricsWithLatest(ctx: Ctx) {
  const since = addDays(ctx.today, -6);
  return ctx.tx
    .select({
      metric: metrics,
      latest: sql<number | null>`(select e.value from ${metricEntries} e where e.metric_id = ${metrics.id} order by e.recorded_for desc, e.created_at desc limit 1)`.mapWith((v) => (v === null ? null : Number(v))),
      latestDate: sql<string | null>`(select e.recorded_for::text from ${metricEntries} e where e.metric_id = ${metrics.id} order by e.recorded_for desc, e.created_at desc limit 1)`,
      weekAvg: sql<number | null>`(select avg(e.value) from ${metricEntries} e where e.metric_id = ${metrics.id} and e.recorded_for >= ${since})`.mapWith((v) => (v === null ? null : Number(v))),
      weekSum: sql<number | null>`(select sum(e.value) from ${metricEntries} e where e.metric_id = ${metrics.id} and e.recorded_for >= ${since})`.mapWith((v) => (v === null ? null : Number(v))),
      weekCount: sql<number>`(select count(*) from ${metricEntries} e where e.metric_id = ${metrics.id} and e.recorded_for >= ${since})`.mapWith(Number),
    })
    .from(metrics)
    .where(eq(metrics.userId, ctx.userId))
    .orderBy(asc(metrics.name));
}

export async function metricSeries(ctx: Ctx, key: string, days = 30) {
  const metric = await ctx.tx.query.metrics.findFirst({ where: and(eq(metrics.userId, ctx.userId), eq(metrics.key, key)) });
  if (!metric) return [];
  return ctx.tx
    .select({ date: metricEntries.recordedFor, value: metricEntries.value })
    .from(metricEntries)
    .where(and(eq(metricEntries.metricId, metric.id), gte(metricEntries.recordedFor, addDays(ctx.today, -days))))
    .orderBy(asc(metricEntries.recordedFor));
}

/** Average of a metric in the last N days, or null when there is no data. */
export async function recentAverage(ctx: Ctx, key: string, days = 7): Promise<{ avg: number | null; count: number }> {
  const series = await metricSeries(ctx, key, days - 1);
  if (series.length === 0) return { avg: null, count: 0 };
  // One value per day (last write wins) so double logging doesn't skew averages.
  const perDay = new Map<string, number>();
  for (const e of series) perDay.set(e.date, e.value);
  const values = [...perDay.values()];
  return { avg: values.reduce((s, v) => s + v, 0) / values.length, count: values.length };
}

// ─── Finances ───────────────────────────────────────────────────────────────
export async function logTransaction(
  ctx: Ctx,
  input: { kind: "EXPENSE" | "INCOME"; amount: number; category: string | null; description: string | null; occurredOn?: string },
  inboxItemId: string | null = null,
) {
  if (!(input.amount > 0)) throw new UserFacingError("El monto debe ser mayor que cero.");
  const [row] = await ctx.tx
    .insert(transactions)
    .values({
      userId: ctx.userId,
      kind: input.kind,
      amount: input.amount,
      currency: ctx.currency,
      category: input.category,
      description: input.description,
      occurredOn: input.occurredOn ?? ctx.today,
      inboxItemId,
    })
    .returning();
  return row;
}

/** Cashflow for the current month. Net worth is a separate concept (financial_accounts). */
export async function monthCashflow(ctx: Ctx) {
  const from = startOfMonth(ctx.today);
  const rows = await ctx.tx
    .select({ kind: transactions.kind, category: transactions.category, total: sql<number>`sum(${transactions.amount})`.mapWith(Number) })
    .from(transactions)
    .where(and(eq(transactions.userId, ctx.userId), gte(transactions.occurredOn, from)))
    .groupBy(transactions.kind, transactions.category);
  const expenses = rows.filter((r) => r.kind === "EXPENSE");
  const income = rows.filter((r) => r.kind === "INCOME").reduce((s, r) => s + r.total, 0);
  return {
    from,
    income,
    expenses: expenses.reduce((s, r) => s + r.total, 0),
    byCategory: expenses.map((r) => ({ category: r.category ?? "Otros", total: r.total })).sort((a, b) => b.total - a.total),
  };
}

export async function recentTransactions(ctx: Ctx, limit = 20) {
  return ctx.tx.select().from(transactions).where(eq(transactions.userId, ctx.userId)).orderBy(desc(transactions.occurredOn), desc(transactions.createdAt)).limit(limit);
}

// ─── Habits ─────────────────────────────────────────────────────────────────
export async function logHabit(ctx: Ctx, name: string, areaKey: string | null, date = ctx.today) {
  let habit = await ctx.tx.query.habits.findFirst({ where: and(eq(habits.userId, ctx.userId), sql`lower(${habits.name}) = lower(${name})`) });
  if (!habit) {
    [habit] = await ctx.tx.insert(habits).values({ userId: ctx.userId, name, lifeAreaId: await areaIdByKey(ctx, areaKey) }).returning();
  }
  const [log] = await ctx.tx.insert(habitLogs).values({ userId: ctx.userId, habitId: habit.id, loggedFor: date }).returning();
  return { habit, log };
}
