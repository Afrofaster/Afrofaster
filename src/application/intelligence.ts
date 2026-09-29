/**
 * Executive intelligence use cases: ranking, Big 3, capacity, day planning,
 * open loops, attention and life status. Data gathering lives here; the math
 * lives in src/domain so it stays deterministic and testable.
 */
import { and, asc, desc, eq, inArray, isNull, lt, lte, sql } from "drizzle-orm";
import { computeAttention, STALE_PROJECT_DAYS, type AttentionItem } from "@/domain/attention";
import { computeCapacity, suggestRelief, type CapacityResult, type ReliefSuggestion } from "@/domain/capacity";
import { addDays, diffDays, hhmmToMinutes, minutesNowIn, normalize, startOfWeek, type IsoDate } from "@/domain/dates";
import { OPEN_TASK_STATUSES, type EnergyLevel } from "@/domain/enums";
import { areaHealth } from "@/domain/life-areas";
import { planDay, type DayPlan } from "@/domain/planning";
import { explainPriority, rankTasks, type PriorityInput, type PriorityResult } from "@/domain/priority";
import { decisions, goals, inboxItems, lifeAreas, priorities, projects, tasks, userProfiles, waitingFor } from "@/server/db/schema";
import type { Ctx } from "./context";
import { computeCurrentLifeScore, listAreas } from "./areas";
import { fixedBlocksOn, fixedMinutesInRange } from "./events";
import { recentAverage } from "./metrics";
import { listWaiting } from "./waiting";

export type RankedTask = PriorityInput & {
  priorityResult: PriorityResult;
  projectTitle: string | null;
  areaName: string | null;
  status: string;
};

const TRAINING_RE = /\b(entrenar|entrenamiento|gym|gimnasio|correr|nadar|yoga|ejercicio)\b/;

export async function rankedOpenTasks(ctx: Ctx, opts: { currentEnergy?: EnergyLevel } = {}): Promise<RankedTask[]> {
  const rows = await ctx.tx
    .select({
      task: tasks,
      projectTitle: projects.title,
      projectPriority: projects.priority,
      projectMeta: projects.metadata,
      goalStatus: goals.status,
      areaName: lifeAreas.name,
      areaMode: lifeAreas.mode,
    })
    .from(tasks)
    .leftJoin(projects, eq(projects.id, tasks.projectId))
    .leftJoin(goals, eq(goals.id, projects.goalId))
    .leftJoin(lifeAreas, eq(lifeAreas.id, tasks.lifeAreaId))
    .where(and(eq(tasks.userId, ctx.userId), isNull(tasks.deletedAt), inArray(tasks.status, ["INBOX", "NEXT", "SCHEDULED", "IN_PROGRESS"])));

  const openPerProject = new Map<string, number>();
  for (const r of rows) if (r.task.projectId) openPerProject.set(r.task.projectId, (openPerProject.get(r.task.projectId) ?? 0) + 1);

  const profile = await ctx.tx.query.userProfiles.findFirst({ where: eq(userProfiles.userId, ctx.userId), columns: { priorityConfig: true } });
  const inputs = rows.map((r) => {
    const t = r.task;
    const siblings = t.projectId ? (openPerProject.get(t.projectId) ?? 1) - 1 : 0;
    return {
      id: t.id,
      title: t.title,
      priority: t.priority,
      dueDate: t.dueDate,
      scheduledDate: t.scheduledDate,
      estimatedMinutes: t.estimatedMinutes,
      energy: t.energy,
      impact: t.impact,
      leverage: t.leverage,
      riskReduction: t.riskReduction,
      projectPriority: r.projectPriority,
      goalLinked: r.goalStatus === "ACTIVE" || r.goalStatus === "AT_RISK",
      goalAtRisk: r.goalStatus === "AT_RISK",
      areaMode: r.areaMode,
      isLegalDeadline: Boolean(r.projectMeta?.legalDeadline && t.dueDate && t.dueDate <= r.projectMeta.legalDeadline),
      // Only the first open task in a project unblocks the rest.
      dependentsCount: siblings > 0 && isFirstInProject(t, rows.map((x) => x.task)) ? siblings : 0,
      deferCount: t.deferCount,
      projectTitle: r.projectTitle,
      areaName: r.areaName,
      status: t.status,
    };
  });
  return rankTasks(inputs, { today: ctx.today, currentEnergy: opts.currentEnergy, weights: profile?.priorityConfig });
}

function isFirstInProject(task: typeof tasks.$inferSelect, all: Array<typeof tasks.$inferSelect>): boolean {
  const key = (t: typeof tasks.$inferSelect) => `${t.dueDate ?? t.scheduledDate ?? "9999"}|${t.createdAt.toISOString()}`;
  return all.filter((t) => t.projectId === task.projectId).every((t) => key(task) <= key(t));
}

// ─── Big 3 ──────────────────────────────────────────────────────────────────
export type Big3Item = { rank: number; taskId: string | null; title: string; origin: "AI_SUGGESTED" | "USER_CONFIRMED"; reason: string | null; done: boolean; projectTitle: string | null };

export async function getBig3(ctx: Ctx, date: IsoDate = ctx.today): Promise<Big3Item[]> {
  const rows = await ctx.tx
    .select({ p: priorities, status: tasks.status, projectTitle: projects.title, deleted: tasks.deletedAt })
    .from(priorities)
    .leftJoin(tasks, eq(tasks.id, priorities.taskId))
    .leftJoin(projects, eq(projects.id, tasks.projectId))
    .where(and(eq(priorities.userId, ctx.userId), eq(priorities.scope, "DAY"), eq(priorities.periodStart, date)))
    .orderBy(asc(priorities.rank));
  const stored = rows
    .filter((r) => !r.deleted)
    .map((r) => ({ rank: r.p.rank, taskId: r.p.taskId, title: r.p.title, origin: r.p.origin as Big3Item["origin"], reason: r.p.reason, done: r.status === "DONE", projectTitle: r.projectTitle }));
  if (stored.length > 0) return stored;
  return suggestBig3(ctx, date);
}

/** Computes (without saving) the AI-suggested Big 3 for a date. */
export async function suggestBig3(ctx: Ctx, date: IsoDate = ctx.today): Promise<Big3Item[]> {
  const ranked = await rankedOpenTasks(ctx);
  const candidates = ranked.filter((t) => !t.scheduledDate || t.scheduledDate <= date);
  return candidates.slice(0, 3).map((t, i) => ({
    rank: i + 1,
    taskId: t.id,
    title: t.title,
    origin: "AI_SUGGESTED" as const,
    reason: explainPriority(t.title, i + 1, t.priorityResult),
    done: false,
    projectTitle: t.projectTitle,
  }));
}

export async function setBig3(ctx: Ctx, date: IsoDate, taskIds: string[], origin: Big3Item["origin"] = "USER_CONFIRMED") {
  const ids = [...new Set(taskIds)].slice(0, 3);
  const rows = ids.length
    ? await ctx.tx.select({ id: tasks.id, title: tasks.title }).from(tasks).where(and(eq(tasks.userId, ctx.userId), inArray(tasks.id, ids)))
    : [];
  const ranked = origin === "AI_SUGGESTED" ? await rankedOpenTasks(ctx) : [];
  await ctx.tx.delete(priorities).where(and(eq(priorities.userId, ctx.userId), eq(priorities.scope, "DAY"), eq(priorities.periodStart, date)));
  const values = ids
    .map((id, i) => {
      const row = rows.find((r) => r.id === id);
      if (!row) return null;
      const r = ranked.find((x) => x.id === id);
      return { userId: ctx.userId, scope: "DAY", periodStart: date, rank: i + 1, taskId: id, title: row.title, origin, reason: r ? explainPriority(row.title, i + 1, r.priorityResult) : null };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);
  if (values.length) await ctx.tx.insert(priorities).values(values);
  return getBig3(ctx, date);
}

// ─── Capacity ───────────────────────────────────────────────────────────────
export type CapacityReport = CapacityResult & { from: IsoDate; days: number; relief: ReliefSuggestion[]; openTasks: number; activeProjects: number };

export async function runCapacityReview(ctx: Ctx, opts: { from?: IsoDate; days?: number } = {}): Promise<CapacityReport> {
  const from = opts.from ?? ctx.today;
  const days = opts.days ?? 7;
  const prefs = ctx.preferences;
  const window = hhmmToMinutes(prefs.dayEnd ?? "21:00") - hhmmToMinutes(prefs.dayStart ?? "06:00");
  const restDays = Array.from({ length: days }, (_, i) => new Date(`${addDays(from, i)}T12:00:00Z`).getUTCDay()).filter((wd) => (prefs.restDays ?? [0]).includes(wd)).length;

  const [fixed, ranked, sleep, overdue, active] = await Promise.all([
    fixedMinutesInRange(ctx, from, days),
    rankedOpenTasks(ctx),
    recentAverage(ctx, "sleep_hours", 7),
    ctx.tx.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(tasks).where(and(eq(tasks.userId, ctx.userId), isNull(tasks.deletedAt), inArray(tasks.status, [...OPEN_TASK_STATUSES]), lt(tasks.dueDate, ctx.today))),
    ctx.tx.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(projects).where(and(eq(projects.userId, ctx.userId), isNull(projects.deletedAt), eq(projects.status, "ACTIVE"))),
  ]);

  const end = addDays(from, days - 1);
  // Planned work = open tasks due/scheduled in the window, plus overdue ones.
  const planned = ranked.filter((t) => {
    const ref = t.dueDate ?? t.scheduledDate;
    return ref !== null && ref <= end;
  });
  const plannedMinutes = planned.reduce((s, t) => s + (t.estimatedMinutes ?? 30), 0);

  const result = computeCapacity({
    dailyWindowMinutes: window,
    days,
    restDays,
    fixedCommitmentMinutes: fixed.fixedCommitmentMinutes,
    calendarMinutes: fixed.calendarMinutes,
    plannedTaskMinutes: plannedMinutes,
    avgSleepHours: sleep.count >= 3 ? sleep.avg : null,
    sleepTargetHours: prefs.sleepTargetHours ?? 7,
    overdueCount: overdue[0]?.n ?? 0,
    activeProjects: active[0]?.n ?? 0,
  });

  const toFree = result.slackMinutes < 0 ? -result.slackMinutes : result.level === "HIGH" ? 60 : 0;
  const relief = suggestRelief(
    planned.map((t) => ({
      id: t.id,
      title: t.title,
      score: t.priorityResult.score,
      estimatedMinutes: t.estimatedMinutes ?? 30,
      dueDate: t.dueDate,
      isHardDeadline: t.isLegalDeadline || (t.dueDate !== null && t.priority === "CRITICAL"),
      energyLow: t.energy === "LOW",
      deferCount: t.deferCount,
    })),
    toFree,
  );
  return { ...result, from, days, relief, openTasks: ranked.length, activeProjects: active[0]?.n ?? 0 };
}

// ─── Day planning ───────────────────────────────────────────────────────────
export async function buildDayPlan(ctx: Ctx, date: IsoDate = ctx.today): Promise<DayPlan> {
  const prefs = ctx.preferences;
  const [fixed, ranked, confirmed] = await Promise.all([
    fixedBlocksOn(ctx, date),
    rankedOpenTasks(ctx),
    ctx.tx
      .select({ taskId: priorities.taskId })
      .from(priorities)
      .where(and(eq(priorities.userId, ctx.userId), eq(priorities.scope, "DAY"), eq(priorities.periodStart, date), eq(priorities.origin, "USER_CONFIRMED")))
      .orderBy(asc(priorities.rank)),
  ]);
  const candidates = ranked.filter((t) => {
    const ref = t.scheduledDate ?? t.dueDate;
    // Today's plan: anything due/scheduled up to that date, plus top unscheduled work.
    return ref === null ? t.priorityResult.score >= 45 : ref <= date;
  });
  return planDay({
    date,
    today: ctx.today,
    dayStart: prefs.dayStart ?? "06:00",
    dayEnd: prefs.dayEnd ?? "21:00",
    nowMinutes: minutesNowIn(ctx.timezone, ctx.now),
    fixed,
    deepWorkMinutes: prefs.deepWorkMinutes ?? 90,
    confirmedBig3: confirmed.map((c) => c.taskId).filter((id): id is string => Boolean(id)),
    tasks: candidates.slice(0, 12).map((t) => ({
      id: t.id,
      title: t.title,
      score: t.priorityResult.score,
      estimatedMinutes: t.estimatedMinutes,
      dueDate: t.dueDate,
      energy: t.energy,
      reasons: t.priorityResult.reasons,
      isTraining: TRAINING_RE.test(normalize(t.title)),
    })),
  });
}

// ─── Open loops ─────────────────────────────────────────────────────────────
export async function getOpenLoops(ctx: Ctx) {
  const [ranked, waiting, openDecisions, overdue] = await Promise.all([
    rankedOpenTasks(ctx),
    listWaiting(ctx, "OPEN"),
    ctx.tx.select().from(decisions).where(and(eq(decisions.userId, ctx.userId), isNull(decisions.deletedAt), eq(decisions.status, "OPEN"))).orderBy(asc(decisions.deadline)),
    ctx.tx
      .select({ id: tasks.id, title: tasks.title, dueDate: tasks.dueDate })
      .from(tasks)
      .where(and(eq(tasks.userId, ctx.userId), isNull(tasks.deletedAt), inArray(tasks.status, [...OPEN_TASK_STATUSES]), lt(tasks.dueDate, ctx.today)))
      .orderBy(asc(tasks.dueDate)),
  ]);
  return {
    actionRequired: ranked.slice(0, 7).map((t) => ({ id: t.id, title: t.title, score: t.priorityResult.score, dueDate: t.dueDate, projectTitle: t.projectTitle })),
    waitingFor: waiting.map((w) => ({ id: w.id, who: w.personName ?? "alguien", item: w.expectedItem, followUpDate: w.followUpDate, overdue: w.followUpDate !== null && w.followUpDate <= ctx.today })),
    decisionRequired: openDecisions.map((d) => ({ id: d.id, question: d.question, deadline: d.deadline })),
    overdue: overdue.map((t) => ({ id: t.id, title: t.title, dueDate: t.dueDate, daysLate: t.dueDate ? diffDays(t.dueDate, ctx.today) : 0 })),
    totalOpenTasks: ranked.length,
  };
}
export type OpenLoops = Awaited<ReturnType<typeof getOpenLoops>>;

// ─── Attention & life status ────────────────────────────────────────────────
export async function getAttention(ctx: Ctx, capacityLevel?: CapacityReport["level"] | null): Promise<AttentionItem[]> {
  const staleBefore = new Date(ctx.now.getTime() - STALE_PROJECT_DAYS * 86_400_000);
  const [overdue, stale, waiting, urgentDecisions, areas, sleep, inbox] = await Promise.all([
    ctx.tx.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(tasks).where(and(eq(tasks.userId, ctx.userId), isNull(tasks.deletedAt), inArray(tasks.status, [...OPEN_TASK_STATUSES]), lt(tasks.dueDate, ctx.today))),
    ctx.tx
      .select({ id: projects.id, title: projects.title, lastActivityAt: projects.lastActivityAt })
      .from(projects)
      .where(and(eq(projects.userId, ctx.userId), isNull(projects.deletedAt), eq(projects.status, "ACTIVE"), lt(projects.lastActivityAt, staleBefore)))
      .orderBy(asc(projects.lastActivityAt))
      .limit(3),
    ctx.tx.select().from(waitingFor).where(and(eq(waitingFor.userId, ctx.userId), eq(waitingFor.status, "OPEN"), lte(waitingFor.followUpDate, ctx.today))).limit(3),
    ctx.tx.select().from(decisions).where(and(eq(decisions.userId, ctx.userId), isNull(decisions.deletedAt), eq(decisions.status, "OPEN"), lte(decisions.deadline, addDays(ctx.today, 3)))).limit(3),
    listAreas(ctx, { activeOnly: true }),
    recentAverage(ctx, "sleep_hours", 7),
    ctx.tx.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(inboxItems).where(and(eq(inboxItems.userId, ctx.userId), inArray(inboxItems.status, ["PENDING", "NEEDS_REVIEW"]))),
  ]);
  const level = capacityLevel === undefined ? (await runCapacityReview(ctx)).level : capacityLevel;
  return computeAttention({
    today: ctx.today,
    overdueTasks: overdue[0]?.n ?? 0,
    staleProjects: stale.map((p) => ({ id: p.id, title: p.title, lastActivity: isoFromDate(p.lastActivityAt, ctx) })),
    overdueWaiting: waiting.map((w) => ({ id: w.id, who: w.personName ?? "alguien", item: w.expectedItem, since: w.followUpDate ?? ctx.today })),
    urgentDecisions: urgentDecisions.filter((d) => d.deadline).map((d) => ({ id: d.id, question: d.question, deadline: d.deadline! })),
    capacityLevel: level,
    criticalFoundations: areas.filter((a) => a.isFoundational && areaHealth(a.score, a.mode) === "CRITICAL").map((a) => a.name),
    avgSleepHours: sleep.count >= 3 ? sleep.avg : null,
    pendingInbox: inbox[0]?.n ?? 0,
  });
}

function isoFromDate(d: Date, ctx: Ctx): IsoDate {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ctx.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export async function getLifeStatus(ctx: Ctx) {
  const [areas, lifeScore, activeGoals, activeProjects] = await Promise.all([
    listAreas(ctx),
    computeCurrentLifeScore(ctx),
    ctx.tx.select({ id: goals.id, title: goals.title, status: goals.status, lifeAreaId: goals.lifeAreaId }).from(goals).where(and(eq(goals.userId, ctx.userId), isNull(goals.deletedAt), inArray(goals.status, ["ACTIVE", "AT_RISK"]))),
    ctx.tx.select({ id: projects.id, lifeAreaId: projects.lifeAreaId }).from(projects).where(and(eq(projects.userId, ctx.userId), isNull(projects.deletedAt), eq(projects.status, "ACTIVE"))),
  ]);
  return {
    lifeScore,
    areas: areas.map((a) => ({
      id: a.id,
      key: a.key,
      name: a.name,
      icon: a.icon,
      score: a.score,
      trend: a.trend,
      mode: a.mode,
      status: a.status,
      health: areaHealth(a.score, a.mode),
      goals: activeGoals.filter((g) => g.lifeAreaId === a.id).length,
      projects: activeProjects.filter((p) => p.lifeAreaId === a.id).length,
      lastReviewedAt: a.lastReviewedAt,
    })),
    goalsAtRisk: activeGoals.filter((g) => g.status === "AT_RISK").map((g) => g.title),
  };
}

export async function weekCompletion(ctx: Ctx) {
  const from = startOfWeek(ctx.today);
  const rows = await ctx.tx
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(tasks)
    .where(and(eq(tasks.userId, ctx.userId), eq(tasks.status, "DONE"), sql`(${tasks.completedAt} at time zone ${ctx.timezone})::date >= ${from}`));
  const recent = await ctx.tx
    .select({ title: tasks.title, completedAt: tasks.completedAt })
    .from(tasks)
    .where(and(eq(tasks.userId, ctx.userId), eq(tasks.status, "DONE"), sql`(${tasks.completedAt} at time zone ${ctx.timezone})::date >= ${from}`))
    .orderBy(desc(tasks.completedAt))
    .limit(10);
  return { from, completed: rows[0]?.n ?? 0, recent };
}
