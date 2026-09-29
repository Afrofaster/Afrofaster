/**
 * Rituals: Daily Brief, Daily Shutdown, Weekly CEO Meeting, Monthly Board.
 * Each produces a structured snapshot saved in `reviews` for history.
 */
import { and, desc, eq, gte, inArray, isNull, lt, lte, sql } from "drizzle-orm";
import { addDays, diffDays, endOfMonth, formatHours, startOfMonth, startOfWeek, type IsoDate } from "@/domain/dates";
import { OPEN_TASK_STATUSES, type ReviewType } from "@/domain/enums";
import { formatMoney } from "@/domain/money";
import { RELIEF_LABEL } from "@/domain/capacity";
import { decisions, inboxItems, priorities, reviewItems, reviews, tasks } from "@/server/db/schema";
import { track } from "./analytics";
import { snapshotLifeScore } from "./areas";
import { UserFacingError, type Ctx } from "./context";
import { eventsOn } from "./events";
import { listGoals } from "./goals";
import { buildDayPlan, getAttention, getBig3, getLifeStatus, getOpenLoops, rankedOpenTasks, runCapacityReview, setBig3 } from "./intelligence";
import { metricSeries, monthCashflow, recentAverage } from "./metrics";
import { listProjects } from "./projects";
import { recordVersion } from "./versions";

// ─── Daily brief ────────────────────────────────────────────────────────────
export async function buildDailyBrief(ctx: Ctx, date: IsoDate = ctx.today) {
  const [big3, events, capacity, attention, sleep, plan] = await Promise.all([
    getBig3(ctx, date),
    eventsOn(ctx, date),
    runCapacityReview(ctx, { from: date, days: 1 }),
    getAttention(ctx, null),
    recentAverage(ctx, "sleep_hours", 3),
    buildDayPlan(ctx, date),
  ]);
  const deepWork = plan.blocks.find((b) => b.kind === "DEEP_WORK");
  let recommendation: string;
  if (capacity.level === "CRITICAL" || capacity.level === "OVERLOADED") recommendation = "Hoy no añadas nada nuevo. Protege el Big 1 y renegocia lo que no quepa.";
  else if (sleep.avg !== null && sleep.avg < 6) recommendation = "Vienes durmiendo poco: haz lo esencial temprano y cierra el día a tiempo.";
  else if (big3[0]) recommendation = `Empieza por “${big3[0].title}” antes de revisar mensajes.`;
  else recommendation = "Día liviano: buen momento para avanzar un proyecto importante o descansar de verdad.";

  return {
    date,
    greeting: `Buenos días, ${ctx.displayName}.`,
    big3,
    agenda: events.map((e) => ({ title: e.title, allDay: e.allDay, start: e.startMinutes, end: e.endMinutes })),
    deepWork: deepWork ? { start: deepWork.start, end: deepWork.end, title: deepWork.title } : null,
    attention,
    health: { avgSleep: sleep.avg, sleepEntries: sleep.count },
    capacity: { level: capacity.level, summary: capacity.summary },
    plan,
    recommendation,
  };
}
export type DailyBrief = Awaited<ReturnType<typeof buildDailyBrief>>;

// ─── Daily shutdown ─────────────────────────────────────────────────────────
export async function buildShutdown(ctx: Ctx) {
  const tomorrow = addDays(ctx.today, 1);
  const [done, pendingToday, ranked] = await Promise.all([
    ctx.tx
      .select({ id: tasks.id, title: tasks.title })
      .from(tasks)
      .where(and(eq(tasks.userId, ctx.userId), eq(tasks.status, "DONE"), sql`(${tasks.completedAt} at time zone ${ctx.timezone})::date = ${ctx.today}`)),
    ctx.tx
      .select({ id: tasks.id, title: tasks.title, dueDate: tasks.dueDate, scheduledDate: tasks.scheduledDate, deferCount: tasks.deferCount })
      .from(tasks)
      .where(and(eq(tasks.userId, ctx.userId), isNull(tasks.deletedAt), inArray(tasks.status, [...OPEN_TASK_STATUSES]), sql`coalesce(${tasks.scheduledDate}, ${tasks.dueDate}) <= ${ctx.today}`)),
    rankedOpenTasks(ctx),
  ]);
  // Re-prioritize instead of rolling everything forward (spec §23).
  const scoreOf = new Map(ranked.map((t) => [t.id, t.priorityResult.score]));
  const pending = pendingToday
    .map((t) => {
      const score = scoreOf.get(t.id) ?? 0;
      const hard = t.dueDate !== null && t.dueDate <= tomorrow;
      const suggestion: "TOMORROW" | "LATER" | "DROP" = hard || score >= 55 ? "TOMORROW" : t.deferCount >= 3 ? "DROP" : "LATER";
      return { ...t, score, suggestion };
    })
    .sort((a, b) => b.score - a.score);
  return { date: ctx.today, tomorrow, done, pending };
}

export async function completeShutdown(
  ctx: Ctx,
  input: { decisions: Array<{ taskId: string; action: "TOMORROW" | "LATER" | "DROP" }>; blockers?: string; surprises?: string; learning?: string; tomorrowBig3?: string[] },
) {
  const tomorrow = addDays(ctx.today, 1);
  for (const d of input.decisions) {
    if (d.action === "TOMORROW") await ctx.tx.update(tasks).set({ scheduledDate: tomorrow, status: "SCHEDULED", deferCount: sql`${tasks.deferCount} + 1` }).where(and(eq(tasks.id, d.taskId), eq(tasks.userId, ctx.userId)));
    if (d.action === "LATER") await ctx.tx.update(tasks).set({ scheduledDate: null, status: "NEXT", deferCount: sql`${tasks.deferCount} + 1` }).where(and(eq(tasks.id, d.taskId), eq(tasks.userId, ctx.userId)));
    if (d.action === "DROP") await ctx.tx.update(tasks).set({ status: "CANCELLED" }).where(and(eq(tasks.id, d.taskId), eq(tasks.userId, ctx.userId)));
  }
  if (input.tomorrowBig3?.length) await setBig3(ctx, tomorrow, input.tomorrowBig3, "USER_CONFIRMED");
  const snapshot = await buildShutdown(ctx);
  const review = await saveReview(ctx, "DAILY_SHUTDOWN", ctx.today, ctx.today, {
    done: snapshot.done.map((t) => t.title),
    moved: input.decisions,
    blockers: input.blockers ?? null,
    surprises: input.surprises ?? null,
    learning: input.learning ?? null,
  });
  await track(ctx, "review_completed", { type: "DAILY_SHUTDOWN" });
  return review;
}

// ─── Weekly CEO meeting ─────────────────────────────────────────────────────
export async function buildWeeklyReview(ctx: Ctx) {
  const weekStart = startOfWeek(ctx.today);
  const nextWeek = addDays(weekStart, 7);
  const [status, goalsList, projectList, loops, capacity, nextCapacity, done, created, sleep, deepWork, openDecisions, ranked, previousReview] = await Promise.all([
    getLifeStatus(ctx),
    listGoals(ctx, { statuses: ["ACTIVE", "AT_RISK"] }),
    listProjects(ctx, { statuses: ["ACTIVE", "PAUSED", "PLANNED"] }),
    getOpenLoops(ctx),
    runCapacityReview(ctx, { from: weekStart, days: 7 }),
    runCapacityReview(ctx, { from: nextWeek, days: 7 }),
    ctx.tx
      .select({ id: tasks.id, title: tasks.title, projectId: tasks.projectId })
      .from(tasks)
      .where(and(eq(tasks.userId, ctx.userId), eq(tasks.status, "DONE"), sql`(${tasks.completedAt} at time zone ${ctx.timezone})::date >= ${weekStart}`)),
    ctx.tx.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(inboxItems).where(and(eq(inboxItems.userId, ctx.userId), gte(inboxItems.createdAt, new Date(ctx.now.getTime() - 7 * 86_400_000)))),
    recentAverage(ctx, "sleep_hours", 7),
    metricSeries(ctx, "deep_work_minutes", 6),
    ctx.tx.select({ id: decisions.id, question: decisions.question, deadline: decisions.deadline }).from(decisions).where(and(eq(decisions.userId, ctx.userId), isNull(decisions.deletedAt), eq(decisions.status, "OPEN"))),
    rankedOpenTasks(ctx),
    ctx.tx.select().from(reviews).where(and(eq(reviews.userId, ctx.userId), eq(reviews.type, "WEEKLY"), lt(reviews.periodStart, weekStart), isNull(reviews.deletedAt))).orderBy(desc(reviews.periodStart)).limit(1),
  ]);

  const staleProjects = projectList.filter((p) => p.status === "ACTIVE" && diffDays(isoOf(p.lastActivityAt, ctx), ctx.today) >= 7);
  const wins = done.slice(0, 8).map((t) => t.title);
  const misses = loops.overdue.slice(0, 6).map((t) => `${t.title} (vencida hace ${t.daysLate} d)`);
  const rootCauses: string[] = [];
  if (capacity.slackMinutes < 0) rootCauses.push(`Se planeó más de lo que cabía: faltaron ${formatHours(-capacity.slackMinutes)}.`);
  if (sleep.avg !== null && sleep.avg < 6.5) rootCauses.push(`Sueño promedio de ${sleep.avg.toFixed(1)} h: menos energía para lo importante.`);
  if (created[0] && created[0].n > done.length * 2 && created[0].n >= 8) rootCauses.push(`Capturaste ${created[0].n} cosas y cerraste ${done.length}: entra más de lo que sale.`);
  if (staleProjects.length >= 2) rootCauses.push(`${staleProjects.length} proyectos activos sin movimiento: demasiados frentes abiertos.`);

  const risks: string[] = [...status.goalsAtRisk.map((g) => `Objetivo en riesgo: ${g}`)];
  for (const a of status.areas.filter((x) => x.health === "CRITICAL")) risks.push(`${a.name} en estado crítico.`);
  if (nextCapacity.level === "OVERLOADED" || nextCapacity.level === "CRITICAL") risks.push(`La próxima semana ya supera tu capacidad (${nextCapacity.summary})`);

  const stopDoing: string[] = [
    ...staleProjects.slice(0, 3).map((p) => `Pausar “${p.title}” (sin movimiento desde hace ${diffDays(isoOf(p.lastActivityAt, ctx), ctx.today)} días) o definir su siguiente acción.`),
    ...ranked.filter((t) => t.deferCount >= 3).slice(0, 3).map((t) => `Eliminar o delegar “${t.title}”: aplazada ${t.deferCount} veces.`),
  ];
  const automation = await repeatedTaskTitles(ctx);
  for (const r of automation.slice(0, 2)) stopDoing.push(`“${r.title}” se repite ${r.count} veces: ¿la convertimos en recurrente?`);

  // Next week: Big 3 proposal + explicit NOT THIS WEEK.
  const nextEnd = addDays(nextWeek, 6);
  const nextCandidates = ranked.filter((t) => !t.scheduledDate || t.scheduledDate <= nextEnd);
  const nextBig3 = nextCandidates.slice(0, 3).map((t) => ({ id: t.id, title: t.title, reasons: t.priorityResult.reasons }));
  const notThisWeek = [
    ...nextCandidates.slice(3).filter((t) => t.priorityResult.score < 45).slice(0, 6).map((t) => t.title),
    ...projectList.filter((p) => p.status === "PLANNED").slice(0, 3).map((p) => `Proyecto: ${p.title}`),
  ];

  const deepWorkTotal = deepWork.reduce((s, e) => s + e.value, 0);
  const lifeScore = status.lifeScore;
  const summaryParts = [`Cerraste ${done.length} ${done.length === 1 ? "tarea" : "tareas"} esta semana.`];
  if (lifeScore.score !== null) summaryParts.push(`Life Score ${lifeScore.score}${lifeScore.delta !== null ? ` (${lifeScore.delta >= 0 ? "+" : ""}${lifeScore.delta})` : ""}.`);
  summaryParts.push(`Capacidad: ${capacity.summary}`);
  const recommendation =
    nextCapacity.slackMinutes < 0
      ? `La próxima semana no cabe todo. Antes de añadir, decide qué sale: ${nextCapacity.relief.slice(0, 2).map((r) => `${RELIEF_LABEL[r.action].toLowerCase()} “${r.title}”`).join(" y ") || "reduce compromisos"}.`
      : staleProjects.length > 2
        ? "Tienes demasiados frentes. Elige máximo tres proyectos en expansión y pausa el resto conscientemente."
        : nextBig3[0]
          ? `Protege el tiempo para “${nextBig3[0].title}” el lunes a primera hora.`
          : "Buen momento para definir qué proyecto merece tu mejor energía la próxima semana.";

  return {
    period: { start: weekStart, end: addDays(weekStart, 6) },
    executiveSummary: summaryParts.join(" "),
    lifeScore: { score: lifeScore.score, delta: lifeScore.delta, explanation: lifeScore.explanation },
    areas: status.areas.filter((a) => a.status === "ACTIVE"),
    goals: goalsList.map((g) => ({ id: g.id, title: g.title, status: g.status, progress: g.progress, deadline: g.deadline })),
    projects: projectList.filter((p) => p.status === "ACTIVE").map((p) => ({ id: p.id, title: p.title, progress: p.computedProgress, openTasks: p.openTasks, stale: staleProjects.some((s) => s.id === p.id), nextTask: p.nextTaskTitle })),
    wins,
    misses,
    rootCauses,
    risks,
    openLoops: { waiting: loops.waitingFor.length, decisions: loops.decisionRequired.length, overdue: loops.overdue.length },
    decisions: openDecisions,
    stopDoing,
    nextWeekBig3: nextBig3,
    notThisWeek,
    capacity: { thisWeek: capacity, nextWeek: nextCapacity },
    metrics: { avgSleep: sleep.avg, deepWorkMinutes: deepWorkTotal },
    recommendation,
    previous: previousReview[0] ? { id: previousReview[0].id, lifeScore: previousReview[0].lifeScore, perceivedControl: previousReview[0].perceivedControl, periodStart: previousReview[0].periodStart } : null,
  };
}
export type WeeklyReview = Awaited<ReturnType<typeof buildWeeklyReview>>;

export async function completeWeeklyReview(ctx: Ctx, input: { perceivedControl: number; wins?: string; learning?: string; nextWeekBig3?: string[]; notes?: string }) {
  if (!(input.perceivedControl >= 1 && input.perceivedControl <= 5)) throw new UserFacingError("Indica tu sensación de control entre 1 y 5.");
  const data = await buildWeeklyReview(ctx);
  const score = await snapshotLifeScore(ctx);
  const review = await saveReview(ctx, "WEEKLY", data.period.start, data.period.end, {
    ...data,
    userWins: input.wins ?? null,
    learning: input.learning ?? null,
    notes: input.notes ?? null,
  }, { perceivedControl: input.perceivedControl, lifeScore: score.score, summary: data.executiveSummary });
  const items: Array<{ section: string; text: string }> = [
    ...data.wins.map((text) => ({ section: "WIN", text })),
    ...data.misses.map((text) => ({ section: "MISS", text })),
    ...data.rootCauses.map((text) => ({ section: "ROOT_CAUSE", text })),
    ...data.risks.map((text) => ({ section: "RISK", text })),
    ...data.stopDoing.map((text) => ({ section: "STOP_DOING", text })),
    ...data.notThisWeek.map((text) => ({ section: "NOT_THIS_WEEK", text })),
  ];
  if (input.learning) items.push({ section: "LEARNING", text: input.learning });
  if (items.length) await ctx.tx.insert(reviewItems).values(items.map((it, i) => ({ userId: ctx.userId, reviewId: review.id, section: it.section, text: it.text, sortOrder: i })));
  const big3Ids = input.nextWeekBig3?.length ? input.nextWeekBig3 : data.nextWeekBig3.map((b) => b.id);
  const nextMonday = addDays(data.period.start, 7);
  await ctx.tx.delete(priorities).where(and(eq(priorities.userId, ctx.userId), eq(priorities.scope, "WEEK"), eq(priorities.periodStart, nextMonday)));
  const titles = await ctx.tx.select({ id: tasks.id, title: tasks.title }).from(tasks).where(and(eq(tasks.userId, ctx.userId), inArray(tasks.id, big3Ids.length ? big3Ids : ["00000000-0000-0000-0000-000000000000"])));
  const rows = big3Ids.slice(0, 3).map((id, i) => ({ userId: ctx.userId, scope: "WEEK", periodStart: nextMonday, rank: i + 1, taskId: id, title: titles.find((t) => t.id === id)?.title ?? "", origin: input.nextWeekBig3?.length ? "USER_CONFIRMED" : "AI_SUGGESTED" })).filter((r) => r.title);
  if (rows.length) await ctx.tx.insert(priorities).values(rows);
  await track(ctx, "review_completed", { type: "WEEKLY", perceivedControl: input.perceivedControl });
  return review;
}

// ─── Monthly board ──────────────────────────────────────────────────────────
export async function buildMonthlyBoard(ctx: Ctx) {
  const from = startOfMonth(ctx.today);
  const to = endOfMonth(ctx.today);
  const [status, goalsList, projectList, cash, sleep, completed, weeklies] = await Promise.all([
    getLifeStatus(ctx),
    listGoals(ctx),
    listProjects(ctx),
    monthCashflow(ctx),
    recentAverage(ctx, "sleep_hours", 30),
    ctx.tx.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(tasks).where(and(eq(tasks.userId, ctx.userId), eq(tasks.status, "DONE"), sql`(${tasks.completedAt} at time zone ${ctx.timezone})::date between ${from} and ${to}`)),
    ctx.tx.select({ perceivedControl: reviews.perceivedControl, lifeScore: reviews.lifeScore, periodStart: reviews.periodStart }).from(reviews).where(and(eq(reviews.userId, ctx.userId), eq(reviews.type, "WEEKLY"), gte(reviews.periodStart, addDays(from, -6)), lte(reviews.periodStart, to))),
  ]);
  const control = weeklies.filter((w) => w.perceivedControl !== null);
  return {
    period: { start: from, end: to },
    lifeScore: status.lifeScore,
    areas: status.areas,
    goals: goalsList.map((g) => ({ title: g.title, status: g.status, progress: g.progress })),
    projects: {
      completed: projectList.filter((p) => p.status === "COMPLETED" && p.updatedAt.toISOString().slice(0, 10) >= from).map((p) => p.title),
      active: projectList.filter((p) => p.status === "ACTIVE").length,
      stale: projectList.filter((p) => p.status === "ACTIVE" && diffDays(isoOf(p.lastActivityAt, ctx), ctx.today) >= 14).map((p) => p.title),
    },
    finances: { ...cash, incomeLabel: formatMoney(cash.income, ctx.currency), expensesLabel: formatMoney(cash.expenses, ctx.currency) },
    health: { avgSleep: sleep.avg, sleepEntries: sleep.count },
    execution: { tasksCompleted: completed[0]?.n ?? 0, weeklyReviews: weeklies.length, avgControl: control.length ? control.reduce((s, w) => s + (w.perceivedControl ?? 0), 0) / control.length : null },
  };
}

export async function completeMonthlyReview(ctx: Ctx, notes?: string) {
  const board = await buildMonthlyBoard(ctx);
  const score = await snapshotLifeScore(ctx);
  const review = await saveReview(ctx, "MONTHLY", board.period.start, board.period.end, { ...board, notes: notes ?? null }, { lifeScore: score.score, summary: `Mes con ${board.execution.tasksCompleted} tareas completadas.` });
  await track(ctx, "review_completed", { type: "MONTHLY" });
  return review;
}

// ─── Persistence & history ─────────────────────────────────────────────────
async function saveReview(ctx: Ctx, type: ReviewType, start: IsoDate, end: IsoDate, content: Record<string, unknown>, extra: { perceivedControl?: number; lifeScore?: number | null; summary?: string } = {}) {
  const existing = await ctx.tx.query.reviews.findFirst({ where: and(eq(reviews.userId, ctx.userId), eq(reviews.type, type), eq(reviews.periodStart, start), isNull(reviews.deletedAt)) });
  const values = { status: "COMPLETED", content, summary: extra.summary ?? null, perceivedControl: extra.perceivedControl ?? null, lifeScore: extra.lifeScore ?? null, completedAt: ctx.now, periodEnd: end };
  if (existing) {
    const [row] = await ctx.tx.update(reviews).set(values).where(eq(reviews.id, existing.id)).returning();
    await recordVersion(ctx, "review", row.id, { summary: existing.summary, perceivedControl: existing.perceivedControl, lifeScore: existing.lifeScore }, { summary: row.summary, perceivedControl: row.perceivedControl, lifeScore: row.lifeScore });
    return row;
  }
  const [row] = await ctx.tx.insert(reviews).values({ userId: ctx.userId, type, periodStart: start, ...values }).returning();
  return row;
}

export async function listReviews(ctx: Ctx, limit = 30) {
  return ctx.tx
    .select({ id: reviews.id, type: reviews.type, periodStart: reviews.periodStart, periodEnd: reviews.periodEnd, summary: reviews.summary, lifeScore: reviews.lifeScore, perceivedControl: reviews.perceivedControl, completedAt: reviews.completedAt })
    .from(reviews)
    .where(and(eq(reviews.userId, ctx.userId), isNull(reviews.deletedAt), inArray(reviews.type, ["WEEKLY", "MONTHLY", "DAILY_SHUTDOWN"])))
    .orderBy(desc(reviews.periodStart), desc(reviews.createdAt))
    .limit(limit);
}

export async function getReview(ctx: Ctx, id: string) {
  const row = await ctx.tx.query.reviews.findFirst({ where: and(eq(reviews.id, id), eq(reviews.userId, ctx.userId), isNull(reviews.deletedAt)) });
  if (!row) throw new UserFacingError("No encontré esa revisión.", "NOT_FOUND");
  const items = await ctx.tx.select().from(reviewItems).where(eq(reviewItems.reviewId, id));
  return { ...row, items };
}

/** Automation candidates: same task title created 3+ times in 6 weeks. */
async function repeatedTaskTitles(ctx: Ctx) {
  return ctx.tx
    .select({ title: sql<string>`min(${tasks.title})`, count: sql<number>`count(*)`.mapWith(Number) })
    .from(tasks)
    .where(and(eq(tasks.userId, ctx.userId), isNull(tasks.recurrence), gte(tasks.createdAt, new Date(ctx.now.getTime() - 42 * 86_400_000))))
    .groupBy(sql`lower(${tasks.title})`)
    .having(sql`count(*) >= 3`)
    .orderBy(desc(sql`count(*)`))
    .limit(5);
}

function isoOf(d: Date, ctx: Ctx): IsoDate {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ctx.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
