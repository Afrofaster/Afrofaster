import { and, eq, gte, lt, notInArray } from "drizzle-orm";
import { addDays } from "@/domain/dates";
import { exchangeGoogleCode, listGoogleEvents, refreshGoogleToken, type ExternalEvent } from "@/integrations/calendar";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { calendarConnections, calendarEvents } from "@/server/db/schema";
import { UserFacingError, type Ctx } from "./context";
import { zonedTimeToUtc } from "./events";

type StoredTokens = { accessToken: string; refreshToken: string | null; expiresAt: number };
type Fetch = typeof fetch;

export const SYNC_PAST_DAYS = 1;
export const SYNC_FUTURE_DAYS = 21;

export async function getCalendarConnection(ctx: Ctx) {
  return ctx.tx.query.calendarConnections.findFirst({ where: and(eq(calendarConnections.userId, ctx.userId), eq(calendarConnections.provider, "GOOGLE")) });
}

/** Exchanges the OAuth code and stores encrypted tokens. Read-only scope. */
export async function connectGoogleCalendar(ctx: Ctx, code: string, f: Fetch = fetch) {
  const tokens = await exchangeGoogleCode(code, f);
  const existing = await getCalendarConnection(ctx);
  const refreshToken = tokens.refreshToken ?? (existing?.encryptedTokens ? (JSON.parse(decryptSecret(existing.encryptedTokens)) as StoredTokens).refreshToken : null);
  const encryptedTokens = encryptSecret(JSON.stringify({ accessToken: tokens.accessToken, refreshToken, expiresAt: tokens.expiresAt } satisfies StoredTokens));
  if (existing) {
    const [row] = await ctx.tx.update(calendarConnections).set({ encryptedTokens, accountEmail: tokens.email ?? existing.accountEmail, status: "CONNECTED", accessMode: "READ_ONLY" }).where(eq(calendarConnections.id, existing.id)).returning();
    return row;
  }
  const [row] = await ctx.tx.insert(calendarConnections).values({ userId: ctx.userId, provider: "GOOGLE", accountEmail: tokens.email, encryptedTokens, status: "CONNECTED", accessMode: "READ_ONLY" }).returning();
  return row;
}

export async function disconnectCalendar(ctx: Ctx) {
  const conn = await getCalendarConnection(ctx);
  if (!conn) return;
  // Cascade removes synced events; manual events (no connection) stay.
  await ctx.tx.delete(calendarConnections).where(eq(calendarConnections.id, conn.id));
}

async function freshAccessToken(ctx: Ctx, connId: string, stored: StoredTokens, f: Fetch): Promise<string> {
  if (stored.expiresAt - 60_000 > Date.now()) return stored.accessToken;
  if (!stored.refreshToken) throw new UserFacingError("La conexión con Google expiró. Vuelve a conectar tu calendario.");
  const next = await refreshGoogleToken(stored.refreshToken, f);
  const updated: StoredTokens = { ...stored, accessToken: next.accessToken, expiresAt: next.expiresAt };
  await ctx.tx.update(calendarConnections).set({ encryptedTokens: encryptSecret(JSON.stringify(updated)) }).where(eq(calendarConnections.id, connId));
  return next.accessToken;
}

/** Reconciles the window [today-1, today+21) with Google: upsert, then remove what disappeared. */
export async function syncCalendar(ctx: Ctx, f: Fetch = fetch): Promise<{ synced: number; removed: number }> {
  const conn = await getCalendarConnection(ctx);
  if (!conn?.encryptedTokens) throw new UserFacingError("No hay un calendario conectado.");
  const stored = JSON.parse(decryptSecret(conn.encryptedTokens)) as StoredTokens;
  let events: ExternalEvent[];
  const from = zonedTimeToUtc(addDays(ctx.today, -SYNC_PAST_DAYS), 0, ctx.timezone);
  const to = zonedTimeToUtc(addDays(ctx.today, SYNC_FUTURE_DAYS), 0, ctx.timezone);
  try {
    const token = await freshAccessToken(ctx, conn.id, stored, f);
    events = await listGoogleEvents(token, from, to, f);
  } catch (err) {
    await ctx.tx.update(calendarConnections).set({ status: "ERROR" }).where(eq(calendarConnections.id, conn.id));
    if (err instanceof UserFacingError) throw err;
    throw new UserFacingError("No pude leer tu Google Calendar. Intenta de nuevo o reconecta la cuenta.");
  }
  for (const e of events) {
    // All-day events keep their calendar date in the user's timezone.
    const startsAt = e.allDay ? zonedTimeToUtc(e.startsAt.toISOString().slice(0, 10), 0, ctx.timezone) : e.startsAt;
    const endsAt = e.allDay ? zonedTimeToUtc(e.endsAt.toISOString().slice(0, 10), 0, ctx.timezone) : e.endsAt;
    await ctx.tx
      .insert(calendarEvents)
      .values({ userId: ctx.userId, connectionId: conn.id, externalId: e.externalId, title: e.title.slice(0, 200), startsAt, endsAt, allDay: e.allDay, location: e.location, source: "GOOGLE" })
      .onConflictDoUpdate({
        target: [calendarEvents.userId, calendarEvents.connectionId, calendarEvents.externalId],
        set: { title: e.title.slice(0, 200), startsAt, endsAt, allDay: e.allDay, location: e.location },
      });
  }
  const keep = events.map((e) => e.externalId);
  const windowCond = and(eq(calendarEvents.connectionId, conn.id), gte(calendarEvents.startsAt, from), lt(calendarEvents.startsAt, to));
  const removed = await ctx.tx
    .delete(calendarEvents)
    .where(keep.length ? and(windowCond, notInArray(calendarEvents.externalId, keep)) : windowCond)
    .returning({ id: calendarEvents.id });
  await ctx.tx.update(calendarConnections).set({ status: "CONNECTED", lastSyncedAt: ctx.now }).where(eq(calendarConnections.id, conn.id));
  return { synced: events.length, removed: removed.length };
}
