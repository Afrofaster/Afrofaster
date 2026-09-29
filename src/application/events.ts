import { and, asc, eq, gte, lt } from "drizzle-orm";
import { z } from "zod";
import { addDays, diffDays, hhmmToMinutes, isValidIsoDate, weekdayOf, type IsoDate } from "@/domain/dates";
import type { FixedBlock } from "@/domain/planning";
import { calendarEvents, commitments } from "@/server/db/schema";
import { UserFacingError, type Ctx } from "./context";

/**
 * Converts a wall-clock time in the user's timezone to a UTC Date.
 * Uses Intl to find the zone offset at that instant (handles DST zones).
 */
export function zonedTimeToUtc(date: IsoDate, minutes: number, timezone: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, Math.floor(minutes / 60), minutes % 60));
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(guess);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asLocal = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return new Date(guess.getTime() - (asLocal - guess.getTime()));
}

export function utcToZonedMinutes(date: Date, timezone: string): { date: IsoDate; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

export const EventCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  date: z.string().refine(isValidIsoDate),
  time: z.string().regex(/^\d{2}:\d{2}$/).nullish(),
  durationMinutes: z.number().int().positive().max(24 * 60).nullish(),
  location: z.string().max(200).nullish(),
});

export async function createEvent(ctx: Ctx, input: z.infer<typeof EventCreateSchema>) {
  const data = EventCreateSchema.parse(input);
  const allDay = !data.time;
  const startMin = data.time ? hhmmToMinutes(data.time) : 0;
  const startsAt = zonedTimeToUtc(data.date, startMin, ctx.timezone);
  const duration = allDay ? 24 * 60 : data.durationMinutes ?? defaultDuration(data.title);
  const endsAt = new Date(startsAt.getTime() + duration * 60_000);
  const [row] = await ctx.tx
    .insert(calendarEvents)
    .values({ userId: ctx.userId, title: data.title, startsAt, endsAt, allDay, location: data.location ?? null, source: "MANUAL" })
    .returning();
  return row;
}

function defaultDuration(title: string): number {
  if (/audiencia/i.test(title)) return 120;
  if (/almuerzo|cena/i.test(title)) return 90;
  return 60;
}

export async function deleteEvent(ctx: Ctx, id: string) {
  const res = await ctx.tx.delete(calendarEvents).where(and(eq(calendarEvents.id, id), eq(calendarEvents.userId, ctx.userId))).returning({ id: calendarEvents.id });
  if (res.length === 0) throw new UserFacingError("No encontré ese evento.", "NOT_FOUND");
}

export async function listEventsBetween(ctx: Ctx, from: IsoDate, toExclusive: IsoDate) {
  return ctx.tx
    .select()
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.userId, ctx.userId),
        gte(calendarEvents.startsAt, zonedTimeToUtc(from, 0, ctx.timezone)),
        lt(calendarEvents.startsAt, zonedTimeToUtc(toExclusive, 0, ctx.timezone)),
      ),
    )
    .orderBy(asc(calendarEvents.startsAt));
}

export async function eventsOn(ctx: Ctx, date: IsoDate) {
  const rows = await listEventsBetween(ctx, date, addDays(date, 1));
  return rows.map((e) => {
    const start = utcToZonedMinutes(e.startsAt, ctx.timezone);
    const end = utcToZonedMinutes(e.endsAt, ctx.timezone);
    return { ...e, startMinutes: e.allDay ? 0 : start.minutes, endMinutes: e.allDay ? 24 * 60 : end.date === date ? end.minutes : 24 * 60 };
  });
}

// ─── Recurring commitments ──────────────────────────────────────────────────
export const CommitmentSchema = z.object({
  title: z.string().trim().min(1).max(120),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).nullish(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).nullish(),
  minutesPerOccurrence: z.number().int().positive().max(24 * 60).nullish(),
});

export async function createCommitment(ctx: Ctx, input: z.infer<typeof CommitmentSchema>) {
  const data = CommitmentSchema.parse(input);
  const minutes = data.minutesPerOccurrence ?? (data.startTime && data.endTime ? hhmmToMinutes(data.endTime) - hhmmToMinutes(data.startTime) : null);
  if (!minutes || minutes <= 0) throw new UserFacingError("Indica la duración o la hora de inicio y fin.");
  const [row] = await ctx.tx
    .insert(commitments)
    .values({ userId: ctx.userId, title: data.title, weekdays: data.weekdays, startTime: data.startTime ?? null, endTime: data.endTime ?? null, minutesPerOccurrence: minutes })
    .returning();
  return row;
}

export async function listCommitments(ctx: Ctx) {
  return ctx.tx.select().from(commitments).where(and(eq(commitments.userId, ctx.userId), eq(commitments.active, true))).orderBy(asc(commitments.startTime));
}

export async function deleteCommitment(ctx: Ctx, id: string) {
  await ctx.tx.update(commitments).set({ active: false }).where(and(eq(commitments.id, id), eq(commitments.userId, ctx.userId)));
}

/** Fixed blocks for a date: calendar events + recurring commitments. */
export async function fixedBlocksOn(ctx: Ctx, date: IsoDate): Promise<FixedBlock[]> {
  const [events, recurring] = await Promise.all([eventsOn(ctx, date), listCommitments(ctx)]);
  const wd = weekdayOf(date);
  const blocks: FixedBlock[] = events.filter((e) => !e.allDay).map((e) => ({ title: e.title, start: e.startMinutes, end: e.endMinutes, kind: "EVENT" as const }));
  for (const c of recurring) {
    if (!c.weekdays.includes(wd) || !c.startTime) continue;
    const start = hhmmToMinutes(c.startTime);
    blocks.push({ title: c.title, start, end: start + c.minutesPerOccurrence, kind: "COMMITMENT" });
  }
  return blocks.sort((a, b) => a.start - b.start);
}

/** Minutes of commitments + events in [from, from+days). */
export async function fixedMinutesInRange(ctx: Ctx, from: IsoDate, days: number) {
  const [events, recurring] = await Promise.all([listEventsBetween(ctx, from, addDays(from, days)), listCommitments(ctx)]);
  const calendar = events.filter((e) => !e.allDay).reduce((s, e) => s + (e.endsAt.getTime() - e.startsAt.getTime()) / 60_000, 0);
  let fixed = 0;
  for (let i = 0; i < days; i++) {
    const wd = weekdayOf(addDays(from, i));
    for (const c of recurring) if (c.weekdays.includes(wd)) fixed += c.minutesPerOccurrence;
  }
  return { calendarMinutes: Math.round(calendar), fixedCommitmentMinutes: fixed, eventCount: events.length, span: diffDays(from, addDays(from, days)) };
}
