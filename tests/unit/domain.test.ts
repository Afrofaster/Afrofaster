import { describe, expect, it } from "vitest";
import { computeAttention } from "@/domain/attention";
import { computeCapacity, suggestRelief } from "@/domain/capacity";
import { addDays, diffDays, parseSpanishDate, parseSpanishTime, startOfWeek, todayIn } from "@/domain/dates";
import { bestTextMatch, findDuplicates, matchPerson, similarity } from "@/domain/entity-resolution";
import { computeLifeScore } from "@/domain/life-score";
import { areaHealth } from "@/domain/life-areas";
import { categorizeExpense, parseMoney } from "@/domain/money";
import { planDay } from "@/domain/planning";
import { explainPriority, scoreTask, type PriorityInput } from "@/domain/priority";

const today = "2026-09-29"; // Tuesday

describe("dates", () => {
  it("resolves Spanish relative dates", () => {
    expect(parseSpanishDate("mañana", today)?.date).toBe("2026-09-30");
    expect(parseSpanishDate("pasado mañana", today)?.date).toBe("2026-10-01");
    expect(parseSpanishDate("el viernes", today)?.date).toBe("2026-10-02");
    expect(parseSpanishDate("el martes", today)?.date).toBe("2026-10-06");
    expect(parseSpanishDate("la próxima semana", today)?.date).toBe("2026-10-05");
    expect(parseSpanishDate("15 de octubre", today)?.date).toBe("2026-10-15");
    expect(parseSpanishDate("el 3", today)?.date).toBe("2026-10-03");
    expect(parseSpanishDate("en 3 días", today)?.date).toBe("2026-10-02");
    expect(parseSpanishDate("15/01", today)?.date).toBe("2027-01-15");
  });
  it("does not treat 'en la mañana' as tomorrow", () => {
    expect(parseSpanishDate("llamar en la mañana", today)).toBeNull();
    expect(parseSpanishDate("gasté 85 mil", today)).toBeNull();
  });
  it("parses times", () => {
    expect(parseSpanishTime("audiencia a las 9")?.minutes).toBe(9 * 60);
    expect(parseSpanishTime("a las 3")?.minutes).toBe(15 * 60);
    expect(parseSpanishTime("15:30")?.minutes).toBe(15 * 60 + 30);
    expect(parseSpanishTime("a las 7 de la noche")?.minutes).toBe(19 * 60);
  });
  it("computes calendar math in the user's timezone", () => {
    expect(todayIn("America/Bogota", new Date("2026-09-29T03:00:00Z"))).toBe("2026-09-28");
    expect(startOfWeek(today)).toBe("2026-09-28");
    expect(diffDays(today, addDays(today, 10))).toBe(10);
  });
});

describe("money", () => {
  it.each([
    ["gasté 85 mil en gasolina", 85000],
    ["gasté 80.000", 80000],
    ["$120.000 almuerzo", 120000],
    ["1,5 millones", 1500000],
    ["85k", 85000],
  ])("%s → %d", (text, amount) => expect(parseMoney(text)?.amount).toBe(amount));
  it("categorizes", () => {
    expect(categorizeExpense("gasolina")).toBe("Transporte");
    expect(categorizeExpense("algo raro")).toBe("Otros");
  });
});

const baseTask = (over: Partial<PriorityInput> = {}): PriorityInput => ({
  id: "t",
  title: "Tarea",
  priority: "MEDIUM",
  dueDate: null,
  scheduledDate: null,
  estimatedMinutes: 30,
  energy: null,
  impact: null,
  leverage: null,
  riskReduction: null,
  projectPriority: null,
  goalLinked: false,
  goalAtRisk: false,
  areaMode: null,
  isLegalDeadline: false,
  dependentsCount: 0,
  deferCount: 0,
  ...over,
});

describe("priority engine", () => {
  it("ranks urgent, aligned, legal work above loose tasks", () => {
    const urgent = scoreTask(baseTask({ dueDate: addDays(today, 1), goalLinked: true, isLegalDeadline: true }), { today });
    const loose = scoreTask(baseTask(), { today });
    expect(urgent.score).toBeGreaterThan(loose.score);
    expect(urgent.reasons).toContain("vence mañana");
  });
  it("is configurable", () => {
    const t = baseTask({ dueDate: today });
    const a = scoreTask(t, { today, weights: { urgency: 0 } });
    const b = scoreTask(t, { today, weights: { urgency: 0.6 } });
    expect(b.score).toBeGreaterThan(a.score);
  });
  it("explains", () => {
    const r = scoreTask(baseTask({ dueDate: addDays(today, 1), goalLinked: true, dependentsCount: 2 }), { today });
    expect(explainPriority("Escrito Carmen", 1, r)).toMatch(/^Lo puse como Big 1 porque vence mañana, empuja uno de tus objetivos y desbloquea 2 tareas posteriores\.$/);
  });
});

describe("capacity engine", () => {
  it("reproduces the spec example: 28h available, 18h committed, 16h tasks → overloaded", () => {
    const r = computeCapacity({ dailyWindowMinutes: 4 * 60, days: 7, restDays: 0, fixedCommitmentMinutes: 18 * 60, calendarMinutes: 0, plannedTaskMinutes: 16 * 60, recoveryMinutesPerDay: 0 });
    expect(r.slackMinutes).toBe(-6 * 60);
    expect(r.level).toBe("CRITICAL");
    expect(r.summary).toContain("No existe capacidad real");
  });
  it("escalates with sleep debt", () => {
    const base = { dailyWindowMinutes: 900, days: 7, restDays: 1, fixedCommitmentMinutes: 2400, calendarMinutes: 0, plannedTaskMinutes: 1200 };
    expect(computeCapacity({ ...base, avgSleepHours: 5 }).level).not.toBe(computeCapacity(base).level);
  });
  it("suggests relief lowest-value first", () => {
    const r = suggestRelief(
      [
        { id: "a", title: "Importante", score: 90, estimatedMinutes: 60, dueDate: null, isHardDeadline: false, energyLow: false, deferCount: 0 },
        { id: "b", title: "Aplazada", score: 20, estimatedMinutes: 60, dueDate: null, isHardDeadline: false, energyLow: false, deferCount: 4 },
      ],
      30,
    );
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ id: "b", action: "ELIMINATE" });
  });
});

describe("life score", () => {
  const area = (key: string, score: number | null, extra = {}) => ({ key, name: key, score, weight: 1, mode: "MAINTENANCE" as const, active: true, isFoundational: false, ...extra });
  it("weighted average with explanation", () => {
    const r = computeLifeScore([area("a", 80), area("b", 60, { weight: 3 })]);
    expect(r.score).toBe(65);
    expect(r.explanation).toContain("65");
  });
  it("penalizes critical foundations", () => {
    const r = computeLifeScore([area("career", 90), area("health", 40, { isFoundational: true })]);
    expect(r.penalty).toBeGreaterThan(0);
    expect(r.score).toBeLessThan(r.baseScore!);
    expect(r.explanation).toMatch(/crítico/);
  });
  it("returns null without ratings", () => {
    expect(computeLifeScore([area("a", null)]).score).toBeNull();
  });
  it("health traffic light", () => {
    expect(areaHealth(80, "MAINTENANCE")).toBe("GOOD");
    expect(areaHealth(80, "CRITICAL")).toBe("CRITICAL");
    expect(areaHealth(55, "MAINTENANCE")).toBe("WATCH");
  });
});

describe("planning", () => {
  it("builds a realistic day around fixed blocks, keeping margin", () => {
    const plan = planDay({
      date: "2026-09-30",
      today,
      dayStart: "06:00",
      dayEnd: "21:00",
      fixed: [{ title: "Audiencia", start: 9 * 60, end: 11 * 60, kind: "EVENT" }],
      deepWorkMinutes: 90,
      tasks: [
        { id: "carmen", title: "Escrito Carmen", score: 90, estimatedMinutes: 90, dueDate: "2026-09-30", energy: "HIGH", reasons: [] },
        { id: "olga", title: "Llamar a Olga", score: 60, estimatedMinutes: 20, dueDate: null, energy: "LOW", reasons: [] },
        { id: "gym", title: "Entrenar", score: 40, estimatedMinutes: 60, dueDate: null, energy: null, reasons: [], isTraining: true },
      ],
    });
    expect(plan.big3[0].taskId).toBe("carmen");
    const carmen = plan.blocks.find((b) => b.taskId === "carmen")!;
    expect(carmen.start).toBe("06:00");
    expect(carmen.kind).toBe("DEEP_WORK");
    expect(plan.blocks.find((b) => b.taskId === "gym")!.end).toBe("21:00");
    expect(plan.marginMinutes).toBeGreaterThan(60);
  });
  it("detects conflicts and defers what does not fit", () => {
    const plan = planDay({
      date: today,
      today,
      dayStart: "08:00",
      dayEnd: "10:00",
      fixed: [{ title: "A", start: 8 * 60, end: 9 * 60, kind: "EVENT" }, { title: "B", start: 8 * 60 + 30, end: 9 * 60 + 30, kind: "EVENT" }],
      tasks: [{ id: "x", title: "Grande", score: 50, estimatedMinutes: 120, dueDate: null, energy: null, reasons: [] }],
    });
    expect(plan.conflicts.length).toBe(1);
    expect(plan.deferred.map((d) => d.taskId)).toContain("x");
  });
});

describe("entity resolution", () => {
  const people = [{ id: "1", name: "Dr. Carlos Pérez", aliases: [] }, { id: "2", name: "Olga Martínez", aliases: [] }];
  it("links honorific and partial mentions", () => {
    expect(matchPerson("Carlos Pérez", people)[0]).toMatchObject({ id: "1" });
    expect(matchPerson("Carlos", people)[0].confidence).toBeGreaterThanOrEqual(0.8);
  });
  it("is ambiguous when two people share a first name", () => {
    const r = matchPerson("Carlos", [...people, { id: "3", name: "Carlos Ruiz", aliases: [] }]);
    expect(r.every((m) => m.confidence < 0.8)).toBe(true);
  });
  it("detects duplicate projects", () => {
    expect(findDuplicates("Proyecto Carmen", [{ id: "p", title: "Carmen" }])).toHaveLength(1);
    expect(similarity("Carmen", "PACE+")).toBeLessThan(0.5);
  });
  it("matches completion text to a task", () => {
    expect(bestTextMatch("la llamada a Olga", [{ id: "t", title: "Llamar a Olga" }, { id: "u", title: "Pagar tarjeta" }])?.id).toBe("t");
  });
});

describe("attention", () => {
  it("returns at most three, most severe first", () => {
    const items = computeAttention({
      today,
      overdueTasks: 6,
      staleProjects: [{ id: "p", title: "Proyecto Carmen", lastActivity: addDays(today, -8) }],
      overdueWaiting: [{ id: "w", who: "Carlos", item: "el contrato", since: today }],
      urgentDecisions: [],
      capacityLevel: "OVERLOADED",
      criticalFoundations: [],
      avgSleepHours: 5.5,
      pendingInbox: 9,
    });
    expect(items).toHaveLength(3);
    expect(items[0].severity).toBe(3);
  });
  it("mentions stale projects in plain Spanish", () => {
    const [item] = computeAttention({ today, overdueTasks: 0, staleProjects: [{ id: "p", title: "Proyecto Carmen", lastActivity: addDays(today, -7) }], overdueWaiting: [], urgentDecisions: [], capacityLevel: "NORMAL", criticalFoundations: [], avgSleepHours: null, pendingInbox: 0 });
    expect(item.message).toBe("Proyecto Carmen lleva 7 días sin movimiento.");
  });
});
