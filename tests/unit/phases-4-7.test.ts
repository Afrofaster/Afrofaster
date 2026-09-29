import { beforeAll, describe, expect, it } from "vitest";
import { speakableText } from "@/ai/voice";
import { daysNeeded, deepWorkVsBig3, sleepVsBig3, type DayRecord } from "@/domain/insights";
import { googleAuthUrl, mapGoogleEvent } from "@/integrations/calendar";
import { buildCandidates, selectNotifications, type CandidateInput } from "@/integrations/notifications";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

beforeAll(() => {
  process.env.TOKEN_ENCRYPTION_KEY = "test-key-that-is-long-enough-123";
  process.env.GOOGLE_CLIENT_ID = "client-id";
});

describe("token encryption", () => {
  it("round-trips and never stores plaintext", () => {
    const enc = encryptSecret('{"accessToken":"secret"}');
    expect(enc).not.toContain("secret");
    expect(decryptSecret(enc)).toBe('{"accessToken":"secret"}');
    expect(encryptSecret("x")).not.toBe(encryptSecret("x")); // random IV
  });
  it("detects tampering", () => {
    const enc = encryptSecret("hola");
    const parts = enc.split(".");
    parts[3] = Buffer.from("otro").toString("base64url");
    expect(() => decryptSecret(parts.join("."))).toThrow();
  });
});

describe("google calendar mapping", () => {
  it("requests read-only scope", () => {
    const url = googleAuthUrl("state123");
    expect(url).toContain("calendar.readonly");
    expect(url).not.toContain("auth%2Fcalendar+");
    expect(url).toContain("state=state123");
  });
  it("maps timed, all-day and skips cancelled/free events", () => {
    expect(mapGoogleEvent({ id: "a", summary: "Audiencia", start: { dateTime: "2026-09-30T09:00:00-05:00" }, end: { dateTime: "2026-09-30T11:00:00-05:00" } })).toMatchObject({ title: "Audiencia", allDay: false });
    expect(mapGoogleEvent({ id: "b", summary: "Festivo", start: { date: "2026-10-12" }, end: { date: "2026-10-13" } })).toMatchObject({ allDay: true });
    expect(mapGoogleEvent({ id: "c", status: "cancelled", start: { dateTime: "2026-09-30T09:00:00Z" }, end: { dateTime: "2026-09-30T10:00:00Z" } })).toBeNull();
    expect(mapGoogleEvent({ id: "d", transparency: "transparent", start: { dateTime: "2026-09-30T09:00:00Z" }, end: { dateTime: "2026-09-30T10:00:00Z" } })).toBeNull();
  });
});

describe("notification timing", () => {
  const base: CandidateInput = {
    today: "2026-09-27",
    hour: 7,
    weekday: 0,
    isLastDayOfMonth: false,
    weekStart: "2026-09-21",
    briefHour: 7,
    big1: "Escrito Carmen",
    dueSoon: [],
    followUps: [],
    weeklyReviewDone: false,
    monthlyReviewDone: false,
    capacityLevel: "NORMAL",
  };
  it("morning brief only in its window", () => {
    expect(buildCandidates(base).map((c) => c.kind)).toContain("MORNING_BRIEF");
    expect(buildCandidates({ ...base, hour: 15 }).map((c) => c.kind)).not.toContain("MORNING_BRIEF");
  });
  it("weekly review on Sunday evening only if not done", () => {
    expect(buildCandidates({ ...base, hour: 18 }).map((c) => c.kind)).toContain("WEEKLY_REVIEW");
    expect(buildCandidates({ ...base, hour: 18, weeklyReviewDone: true }).map((c) => c.kind)).not.toContain("WEEKLY_REVIEW");
  });
  it("critical risk is prioritized within budget", () => {
    const c = buildCandidates({ ...base, capacityLevel: "CRITICAL", hour: 8, dueSoon: [{ id: "t", title: "X", dueDate: "2026-09-28" }] });
    const picked = selectNotifications(c, { budget: 1, sentToday: 0, alreadySentKeys: new Set() });
    expect(picked.map((p) => p.kind)).toEqual(["CRITICAL_RISK"]);
  });
});

describe("insights need enough data", () => {
  const day = (i: number, sleep: number, done: number, deep: number | null = null): DayRecord => ({ date: `2026-08-${String(i + 1).padStart(2, "0")}`, sleepHours: sleep, big3Planned: 3, big3Done: done, deepWorkMinutes: deep });
  it("refuses with too few days", () => {
    expect(sleepVsBig3([day(0, 5, 1), day(1, 7, 3)])).toBeNull();
    expect(daysNeeded([day(0, 5, 1)])).toBe(9);
  });
  it("finds the sleep pattern with sample size", () => {
    const days = [...Array.from({ length: 6 }, (_, i) => day(i, 5, 1)), ...Array.from({ length: 6 }, (_, i) => day(i + 6, 7.5, 3))];
    const r = sleepVsBig3(days)!;
    expect(r.message).toBe("Tus días con menos de 6 h de sueño tienen 67 % menos cumplimiento del Big 3.");
    expect(r.sample).toContain("6 días");
  });
  it("finds the deep work pattern", () => {
    const days = [...Array.from({ length: 5 }, (_, i) => day(i, 7, 3, 90)), ...Array.from({ length: 5 }, (_, i) => day(i + 5, 7, 1, 0))];
    expect(deepWorkVsBig3(days)?.message).toContain("100 %");
  });
});

describe("voice", () => {
  it("makes replies speakable", () => {
    expect(speakableText("**Big 1**\n• 06:00–08:00 Escrito")).toBe("Big 1. de 06:00 a 08:00 Escrito");
  });
});
