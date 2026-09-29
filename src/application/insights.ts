import { and, eq, gte, sql } from "drizzle-orm";
import { addDays } from "@/domain/dates";
import { daysNeeded, deepWorkVsBig3, sleepVsBig3, type DayRecord } from "@/domain/insights";
import { metricEntries, metrics, priorities, tasks } from "@/server/db/schema";
import type { Ctx } from "./context";

/** Builds one record per day (last N days) from real data, then asks the domain for patterns. */
export async function buildDayRecords(ctx: Ctx, days = 90): Promise<DayRecord[]> {
  const from = addDays(ctx.today, -days);
  const [big3, metricRows] = await Promise.all([
    ctx.tx
      .select({
        date: priorities.periodStart,
        planned: sql<number>`count(*)`.mapWith(Number),
        done: sql<number>`count(*) filter (where ${tasks.status} = 'DONE' and (${tasks.completedAt} at time zone ${ctx.timezone})::date <= ${priorities.periodStart})`.mapWith(Number),
      })
      .from(priorities)
      .leftJoin(tasks, eq(tasks.id, priorities.taskId))
      .where(and(eq(priorities.userId, ctx.userId), eq(priorities.scope, "DAY"), gte(priorities.periodStart, from), sql`${priorities.periodStart} < ${ctx.today}`))
      .groupBy(priorities.periodStart),
    ctx.tx
      .select({ key: metrics.key, date: metricEntries.recordedFor, value: sql<number>`sum(${metricEntries.value})`.mapWith(Number), last: sql<number>`(array_agg(${metricEntries.value} order by ${metricEntries.createdAt} desc))[1]`.mapWith(Number) })
      .from(metricEntries)
      .innerJoin(metrics, eq(metrics.id, metricEntries.metricId))
      .where(and(eq(metricEntries.userId, ctx.userId), gte(metricEntries.recordedFor, from), sql`${metrics.key} in ('sleep_hours','deep_work_minutes')`))
      .groupBy(metrics.key, metricEntries.recordedFor),
  ]);
  const byDate = new Map<string, DayRecord>();
  const get = (date: string) => {
    let r = byDate.get(date);
    if (!r) {
      r = { date, sleepHours: null, big3Planned: 0, big3Done: 0, deepWorkMinutes: null };
      byDate.set(date, r);
    }
    return r;
  };
  for (const b of big3) Object.assign(get(b.date), { big3Planned: b.planned, big3Done: b.done });
  for (const m of metricRows) {
    if (m.key === "sleep_hours") get(m.date).sleepHours = m.last;
    if (m.key === "deep_work_minutes") get(m.date).deepWorkMinutes = m.value;
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export async function getInsights(ctx: Ctx) {
  const records = await buildDayRecords(ctx);
  const insights = [sleepVsBig3(records), deepWorkVsBig3(records)].filter((i): i is NonNullable<typeof i> => i !== null);
  return { insights, trackedDays: records.length, daysNeeded: daysNeeded(records) };
}
