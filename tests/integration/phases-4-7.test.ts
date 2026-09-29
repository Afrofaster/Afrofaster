import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { listAttachments, readAttachment, saveAttachment } from "@/application/attachments";
import { connectGoogleCalendar, disconnectCalendar, syncCalendar } from "@/application/calendar";
import { runAsUser } from "@/application/context";
import { eventsOn } from "@/application/events";
import { createFailure, listFailures } from "@/application/failures";
import { getInsights } from "@/application/insights";
import { runHourlyJobs } from "@/application/jobs";
import { listNotifications, savePushSubscription } from "@/application/notifications";
import { withUser } from "@/server/db/factory";
import { calendarConnections, inboxItems } from "@/server/db/schema";
import { makeUser, resetDb, testDb } from "../support/db";

/** Fake Google endpoints: token exchange + one page of events. */
function fakeGoogle(events: unknown[]) {
  const calls: string[] = [];
  const f = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    if (url.startsWith("https://oauth2.googleapis.com/token")) {
      const idToken = `x.${Buffer.from(JSON.stringify({ email: "jhony@gmail.com" })).toString("base64url")}.y`;
      return new Response(JSON.stringify({ access_token: "at", refresh_token: "rt", expires_in: 3600, id_token: idToken }), { status: 200 });
    }
    return new Response(JSON.stringify({ items: events }), { status: 200 });
  }) as typeof fetch;
  return { f, calls };
}

describe("phase 4 — google calendar (read-only, mocked)", () => {
  let userId: string;
  beforeAll(async () => {
    process.env.TOKEN_ENCRYPTION_KEY = "integration-test-key-long-enough";
    process.env.GOOGLE_CLIENT_ID = "id";
    process.env.GOOGLE_CLIENT_SECRET = "secret";
    await resetDb();
    userId = (await makeUser()).id;
  });

  it("connects with encrypted tokens and syncs events into the planner's table", async () => {
    const now = new Date("2026-09-29T14:00:00Z");
    const { f } = fakeGoogle([
      { id: "e1", summary: "Audiencia caso Carmen", start: { dateTime: "2026-09-30T09:00:00-05:00" }, end: { dateTime: "2026-09-30T11:00:00-05:00" } },
      { id: "e2", summary: "Festivo", start: { date: "2026-09-30" }, end: { date: "2026-10-01" } },
    ]);
    await runAsUser(testDb(), userId, (ctx) => connectGoogleCalendar(ctx, "code", f), now);
    const [conn] = await withUser(testDb(), userId, (tx) => tx.select().from(calendarConnections));
    expect(conn.accountEmail).toBe("jhony@gmail.com");
    expect(conn.encryptedTokens).not.toContain("rt");

    const r = await runAsUser(testDb(), userId, (ctx) => syncCalendar(ctx, f), now);
    expect(r.synced).toBe(2);
    const events = await runAsUser(testDb(), userId, (ctx) => eventsOn(ctx, "2026-09-30"), now);
    const audiencia = events.find((e) => e.title === "Audiencia caso Carmen")!;
    expect(audiencia.startMinutes).toBe(9 * 60);
    expect(events.find((e) => e.title === "Festivo")?.allDay).toBe(true);
  });

  it("re-sync is idempotent and removes deleted events", async () => {
    const now = new Date("2026-09-29T14:00:00Z");
    const { f } = fakeGoogle([{ id: "e1", summary: "Audiencia movida", start: { dateTime: "2026-09-30T10:00:00-05:00" }, end: { dateTime: "2026-09-30T11:00:00-05:00" } }]);
    const r = await runAsUser(testDb(), userId, (ctx) => syncCalendar(ctx, f), now);
    expect(r.removed).toBe(1);
    const events = await runAsUser(testDb(), userId, (ctx) => eventsOn(ctx, "2026-09-30"), now);
    expect(events.map((e) => e.title)).toEqual(["Audiencia movida"]);
  });

  it("disconnect removes synced events", async () => {
    await runAsUser(testDb(), userId, (ctx) => disconnectCalendar(ctx));
    const events = await runAsUser(testDb(), userId, (ctx) => eventsOn(ctx, "2026-09-30"), new Date("2026-09-29T14:00:00Z"));
    expect(events).toHaveLength(0);
  });
});

describe("phase 6 — notifications", () => {
  it("plans the morning brief once, respects budget, and pushes", async () => {
    await resetDb();
    const { id } = await makeUser();
    await runAsUser(testDb(), id, (ctx) => savePushSubscription(ctx, { endpoint: "https://push.example/1", p256dh: "p256dh-key-xxxx", auth: "auth-key" }, "vitest"));
    const sevenAm = new Date("2026-09-29T12:05:00Z"); // 07:05 in Bogotá
    const pushed: string[] = [];
    const sendPush = async (_t: unknown, p: { title: string }) => {
      pushed.push(p.title);
      return "ok" as const;
    };
    const first = await runHourlyJobs(testDb(), { sendPush, now: sevenAm });
    expect(first.notifications).toBeGreaterThanOrEqual(1);
    expect(pushed).toContain("Tu Daily Brief está listo");
    const second = await runHourlyJobs(testDb(), { sendPush, now: new Date(sevenAm.getTime() + 3600_000) });
    expect(second.notifications).toBe(0); // deduped
    const list = await runAsUser(testDb(), id, (ctx) => listNotifications(ctx));
    expect(list.every((n) => n.sentAt !== null)).toBe(true);
  });

  it("removes expired push subscriptions", async () => {
    await resetDb();
    const { id } = await makeUser();
    await runAsUser(testDb(), id, (ctx) => savePushSubscription(ctx, { endpoint: "https://push.example/gone", p256dh: "p256dh-key-xxxx", auth: "auth-key" }, null));
    await runHourlyJobs(testDb(), { sendPush: async () => "gone", now: new Date("2026-09-29T12:05:00Z") });
    const { listPushSubscriptions } = await import("@/application/notifications");
    expect(await runAsUser(testDb(), id, listPushSubscriptions)).toHaveLength(0);
  });
});

describe("phase 5 — attachments, failure log, insights", () => {
  it("stores files privately with validation", async () => {
    await resetDb();
    const a = await makeUser();
    const b = await makeUser();
    const loose = await runAsUser(testDb(), a.id, (ctx) => saveAttachment(ctx, { name: "contrato.pdf", type: "application/pdf", bytes: Buffer.from("%PDF-1.4 test") }));
    const file = await runAsUser(testDb(), a.id, (ctx) => readAttachment(ctx, loose.id));
    expect(file.data.toString()).toBe("%PDF-1.4 test");
    await expect(runAsUser(testDb(), b.id, (ctx) => readAttachment(ctx, loose.id))).rejects.toThrow(/No encontré/);
    await expect(runAsUser(testDb(), a.id, (ctx) => saveAttachment(ctx, { name: "x.exe", type: "application/x-msdownload", bytes: Buffer.from("MZ") }))).rejects.toThrow(/no permitido/);
    const inbox = await withUser(testDb(), a.id, (tx) => tx.select().from(inboxItems).where(eq(inboxItems.type, "DOCUMENT_REFERENCE")));
    expect(inbox[0].rawText).toBe("Documento: contrato.pdf");
  });

  it("links attachments to owned entities only", async () => {
    const a = await makeUser();
    const { createProject } = await import("@/application/projects");
    const p = await runAsUser(testDb(), a.id, (ctx) => createProject(ctx, { title: "Carmen" }));
    await runAsUser(testDb(), a.id, (ctx) => saveAttachment(ctx, { name: "demanda.pdf", type: "application/pdf", bytes: Buffer.from("x") }, { entityType: "project", entityId: p.id }));
    expect(await runAsUser(testDb(), a.id, (ctx) => listAttachments(ctx, "project", p.id))).toHaveLength(1);
    const other = await makeUser();
    await expect(runAsUser(testDb(), other.id, (ctx) => saveAttachment(ctx, { name: "x.pdf", type: "application/pdf", bytes: Buffer.from("x") }, { entityType: "project", entityId: p.id }))).rejects.toThrow();
  });

  it("logs failures and reports insufficient data honestly", async () => {
    const u = await makeUser();
    await runAsUser(testDb(), u.id, (ctx) => createFailure(ctx, { event: "No envié la propuesta", rootCause: "Sin bloque en el calendario", systemFailure: true }));
    expect(await runAsUser(testDb(), u.id, listFailures)).toHaveLength(1);
    const insights = await runAsUser(testDb(), u.id, getInsights);
    expect(insights.insights).toHaveLength(0);
    expect(insights.daysNeeded).toBeGreaterThan(0);
  });
});
