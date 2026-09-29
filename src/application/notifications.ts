import { and, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { addDays, endOfMonth, hourIn, startOfMonth, startOfWeek, weekdayOf } from "@/domain/dates";
import { OPEN_TASK_STATUSES } from "@/domain/enums";
import { buildCandidates, selectNotifications, type Candidate } from "@/integrations/notifications";
import { notifications, pushSubscriptions, reviews, tasks, userProfiles, waitingFor } from "@/server/db/schema";
import type { Ctx } from "./context";
import { zonedTimeToUtc } from "./events";
import { getBig3, runCapacityReview } from "./intelligence";

const BRIEF_HOUR = 7;

/** Decides and stores today's notifications for one user (respecting budget + dedupe). */
export async function planNotifications(ctx: Ctx): Promise<Candidate[]> {
  const profile = await ctx.tx.query.userProfiles.findFirst({ where: eq(userProfiles.userId, ctx.userId), columns: { notificationBudget: true } });
  const budget = profile?.notificationBudget ?? 3;
  if (budget <= 0) return [];
  const weekStart = startOfWeek(ctx.today);
  const dayStartUtc = zonedTimeToUtc(ctx.today, 0, ctx.timezone);

  const [big3, dueSoon, followUps, weekly, monthly, capacity, sentToday, keys] = await Promise.all([
    getBig3(ctx),
    ctx.tx
      .select({ id: tasks.id, title: tasks.title, dueDate: tasks.dueDate })
      .from(tasks)
      .where(and(eq(tasks.userId, ctx.userId), isNull(tasks.deletedAt), inArray(tasks.status, [...OPEN_TASK_STATUSES]), sql`${tasks.dueDate} between ${ctx.today} and ${addDays(ctx.today, 1)}`)),
    ctx.tx.select().from(waitingFor).where(and(eq(waitingFor.userId, ctx.userId), eq(waitingFor.status, "OPEN"), sql`${waitingFor.followUpDate} <= ${ctx.today}`)),
    ctx.tx.select({ id: reviews.id }).from(reviews).where(and(eq(reviews.userId, ctx.userId), eq(reviews.type, "WEEKLY"), eq(reviews.periodStart, weekStart))),
    ctx.tx.select({ id: reviews.id }).from(reviews).where(and(eq(reviews.userId, ctx.userId), eq(reviews.type, "MONTHLY"), eq(reviews.periodStart, startOfMonth(ctx.today)))),
    runCapacityReview(ctx),
    ctx.tx.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(notifications).where(and(eq(notifications.userId, ctx.userId), gte(notifications.scheduledFor, dayStartUtc))),
    ctx.tx.select({ key: notifications.dedupeKey }).from(notifications).where(and(eq(notifications.userId, ctx.userId), gte(notifications.createdAt, new Date(ctx.now.getTime() - 40 * 86_400_000)))),
  ]);

  const candidates = buildCandidates({
    today: ctx.today,
    hour: hourIn(ctx.timezone, ctx.now),
    weekday: weekdayOf(ctx.today),
    isLastDayOfMonth: endOfMonth(ctx.today) === ctx.today,
    weekStart,
    briefHour: BRIEF_HOUR,
    big1: big3.find((b) => !b.done)?.title ?? null,
    dueSoon: dueSoon.map((t) => ({ id: t.id, title: t.title, dueDate: t.dueDate! })),
    followUps: followUps.map((w) => ({ id: w.id, who: w.personName ?? "alguien", item: w.expectedItem })),
    weeklyReviewDone: weekly.length > 0,
    monthlyReviewDone: monthly.length > 0,
    capacityLevel: capacity.level,
  });
  const selected = selectNotifications(candidates, { budget, sentToday: sentToday[0]?.n ?? 0, alreadySentKeys: new Set(keys.map((k) => k.key).filter((k): k is string => Boolean(k))) });
  for (const c of selected) {
    await ctx.tx
      .insert(notifications)
      .values({ userId: ctx.userId, kind: c.kind, title: c.title, body: c.body ?? null, href: c.href ?? null, dedupeKey: c.dedupeKey, channel: "PUSH", scheduledFor: ctx.now })
      .onConflictDoNothing();
  }
  return selected;
}

export async function listNotifications(ctx: Ctx, limit = 50) {
  return ctx.tx.select().from(notifications).where(eq(notifications.userId, ctx.userId)).orderBy(desc(notifications.scheduledFor)).limit(limit);
}

export async function unreadNotifications(ctx: Ctx): Promise<number> {
  const [row] = await ctx.tx.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(notifications).where(and(eq(notifications.userId, ctx.userId), isNull(notifications.readAt)));
  return row?.n ?? 0;
}

export async function markAllRead(ctx: Ctx) {
  await ctx.tx.update(notifications).set({ readAt: ctx.now }).where(and(eq(notifications.userId, ctx.userId), isNull(notifications.readAt)));
}

export async function markSent(ctx: Ctx, dedupeKeys: string[]) {
  if (dedupeKeys.length === 0) return;
  await ctx.tx.update(notifications).set({ sentAt: ctx.now }).where(and(eq(notifications.userId, ctx.userId), inArray(notifications.dedupeKey, dedupeKeys)));
}

// ─── Push subscriptions ─────────────────────────────────────────────────────
export async function savePushSubscription(ctx: Ctx, sub: { endpoint: string; p256dh: string; auth: string }, userAgent: string | null) {
  await ctx.tx.delete(pushSubscriptions).where(and(eq(pushSubscriptions.userId, ctx.userId), eq(pushSubscriptions.endpoint, sub.endpoint)));
  await ctx.tx.insert(pushSubscriptions).values({ userId: ctx.userId, endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth, userAgent: userAgent?.slice(0, 300) ?? null }).onConflictDoNothing();
}

export async function removePushSubscription(ctx: Ctx, endpoint: string) {
  await ctx.tx.delete(pushSubscriptions).where(and(eq(pushSubscriptions.userId, ctx.userId), eq(pushSubscriptions.endpoint, endpoint)));
}

export async function listPushSubscriptions(ctx: Ctx) {
  return ctx.tx.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, ctx.userId));
}
