import { and, asc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { hourIn } from "@/domain/dates";
import { OPEN_TASK_STATUSES } from "@/domain/enums";
import { inboxItems, tasks } from "@/server/db/schema";
import { computeCurrentLifeScore, listAreas } from "./areas";
import type { Ctx } from "./context";
import { eventsOn } from "./events";
import { getAttention, getBig3, runCapacityReview } from "./intelligence";
import { areaHealth } from "@/domain/life-areas";
import { utcToZonedMinutes } from "./events";

export function greetingFor(ctx: Ctx): string {
  const h = hourIn(ctx.timezone, ctx.now);
  const salute = h < 5 ? "Buenas noches" : h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
  return `${salute}, ${ctx.displayName}.`;
}

/** Everything Home needs in one round trip: "¿Cómo está mi vida y qué importa ahora?" */
export async function getHomeSnapshot(ctx: Ctx) {
  const [lifeScore, big3, capacity, areas, eventsToday, nextTask, pendingInbox] = await Promise.all([
    computeCurrentLifeScore(ctx),
    getBig3(ctx),
    runCapacityReview(ctx),
    listAreas(ctx, { activeOnly: true }),
    eventsOn(ctx, ctx.today),
    ctx.tx
      .select({ id: tasks.id, title: tasks.title, dueDate: tasks.dueDate, scheduledDate: tasks.scheduledDate })
      .from(tasks)
      .where(and(eq(tasks.userId, ctx.userId), isNull(tasks.deletedAt), inArray(tasks.status, [...OPEN_TASK_STATUSES]), gte(sql`coalesce(${tasks.scheduledDate}, ${tasks.dueDate})`, ctx.today)))
      .orderBy(asc(sql`coalesce(${tasks.scheduledDate}, ${tasks.dueDate})`))
      .limit(1),
    ctx.tx.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(inboxItems).where(and(eq(inboxItems.userId, ctx.userId), inArray(inboxItems.status, ["PENDING", "NEEDS_REVIEW"]))),
  ]);
  const attention = await getAttention(ctx, capacity.level);
  const nowMin = utcToZonedMinutes(ctx.now, ctx.timezone).minutes;
  const upcomingEvent = eventsToday.find((e) => !e.allDay && e.endMinutes > nowMin);
  const nextUp = upcomingEvent
    ? { kind: "event" as const, title: upcomingEvent.title, startMinutes: upcomingEvent.startMinutes, date: ctx.today }
    : nextTask[0]
      ? { kind: "task" as const, title: nextTask[0].title, startMinutes: null, date: nextTask[0].scheduledDate ?? nextTask[0].dueDate }
      : null;
  return {
    greeting: greetingFor(ctx),
    today: ctx.today,
    lifeScore,
    big3,
    nextUp,
    attention,
    capacity: { level: capacity.level, summary: capacity.summary, utilization: capacity.utilization },
    areas: areas.map((a) => ({ key: a.key, name: a.name, icon: a.icon, score: a.score, trend: a.trend, mode: a.mode, health: areaHealth(a.score, a.mode) })),
    pendingInbox: pendingInbox[0]?.n ?? 0,
  };
}
export type HomeSnapshot = Awaited<ReturnType<typeof getHomeSnapshot>>;
