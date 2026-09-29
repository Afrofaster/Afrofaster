/**
 * LÍA orchestrator.
 *
 *   USER MESSAGE → INTENT → CONTEXT → (MODEL) → TOOL CALL → VALIDATION
 *   → AUTHORIZATION (confirmation) → DATABASE → RESPONSE
 *
 * Every intent has a deterministic handler built on real data, so LÍA is
 * useful without an API key and never invents numbers. When OpenAI is
 * configured, the model phrases answers from those facts and handles open
 * conversation through validated tool calls.
 */
import "server-only";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { zodResponsesFunction } from "openai/helpers/zod";
import type { ResponseInputItem } from "openai/resources/responses/responses";
import { applyIntent } from "@/application/capture";
import { runAsUser, UserFacingError, type Ctx } from "@/application/context";
import { findDuplicateGoal } from "@/application/goals";
import { buildDayPlan, getAttention, getBig3, getLifeStatus, getOpenLoops, runCapacityReview, weekCompletion } from "@/application/intelligence";
import { buildDailyBrief } from "@/application/reviews";
import { globalSearch } from "@/application/search";
import { listTasks, matchOpenTask } from "@/application/tasks";
import { eventsOn } from "@/application/events";
import { RELIEF_LABEL } from "@/domain/capacity";
import { CAPACITY_LABEL } from "@/domain/enums";
import { formatHours, formatRelative, minutesToHHMM, WEEKDAY_NAMES, weekdayOf } from "@/domain/dates";
import { log } from "@/lib/logger";
import type { Db } from "@/server/db/factory";
import { agentActionLogs, conversations, inboxItems, messages, people, projects, userProfiles, type MessageCard, type PendingAction } from "@/server/db/schema";
import { buildContext } from "./context-builder";
import { classifyWithRules, splitCompound } from "./intent/rules";
import { classifyIntent } from "./intent/router";
import { isQueryIntent, type IntentResult } from "./intent/schema";
import { errorCode, getOpenAI, isAIConfigured, modelFor, recordAIUsage } from "./openai";
import { LIA_PROMPT_VERSION, liaSystemPrompt } from "./prompts/lia-system";
import { getTool, parseToolArgs, TOOLS, type ToolResult } from "./tools/registry";

export type ChatMessageDTO = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  cards: MessageCard[];
  pendingAction: PendingAction | null;
  createdAt: string;
};

export type ChatEvent = { type: "status"; label: string } | { type: "message"; message: ChatMessageDTO; conversationId: string };

type Reply = { text: string; cards: MessageCard[]; pending: PendingAction | null; mode: "none" | "phrase" | "agent" };

// ─── Tool execution with audit log ──────────────────────────────────────────
export async function executeTool(ctx: Ctx, conversationId: string | null, name: string, rawArgs: unknown, opts: { confirmed?: boolean } = {}): Promise<{ status: "SUCCESS" | "PENDING" | "ERROR"; result?: ToolResult; pending?: PendingAction; error?: string }> {
  const parsed = parseToolArgs(name, rawArgs);
  if (!parsed.ok) {
    await ctx.tx.insert(agentActionLogs).values({ userId: ctx.userId, conversationId, tool: name, input: safeInput(rawArgs), status: "ERROR", error: parsed.error });
    return { status: "ERROR", error: parsed.error };
  }
  const { tool, args } = parsed;
  if (tool.requiresConfirmation && !opts.confirmed) {
    const [row] = await ctx.tx
      .insert(agentActionLogs)
      .values({ userId: ctx.userId, conversationId, tool: name, input: safeInput(args), status: "PENDING_CONFIRMATION", confirmationRequired: true })
      .returning({ id: agentActionLogs.id });
    return { status: "PENDING", pending: { tool: name, args: args as Record<string, unknown>, summary: tool.describe(args), status: "PENDING", logId: row.id } };
  }
  const started = Date.now();
  try {
    const result = await ctx.tx.transaction((sp) => tool.execute({ ...ctx, tx: sp }, args));
    await ctx.tx.insert(agentActionLogs).values({ userId: ctx.userId, conversationId, tool: name, input: safeInput(args), result: { summary: result.summary, href: result.href ?? null }, status: "SUCCESS", confirmationRequired: tool.requiresConfirmation, confirmed: tool.requiresConfirmation ? true : null, latencyMs: Date.now() - started });
    return { status: "SUCCESS", result };
  } catch (err) {
    const message = err instanceof UserFacingError ? err.message : "No pude completar la acción.";
    log.warn("agent.tool_failed", { tool: name, err });
    await ctx.tx.insert(agentActionLogs).values({ userId: ctx.userId, conversationId, tool: name, input: safeInput(args), status: "ERROR", error: message, latencyMs: Date.now() - started });
    return { status: "ERROR", error: message };
  }
}

/** Tool inputs can contain personal text; keep them but cap size. */
function safeInput(args: unknown): Record<string, unknown> {
  const json = JSON.stringify(args ?? {});
  return json.length > 4000 ? { truncated: true } : (JSON.parse(json) as Record<string, unknown>);
}

// ─── Public entry points ────────────────────────────────────────────────────
export async function handleChatMessage(db: Db, userId: string, input: { text: string; conversationId?: string | null }, emit: (e: ChatEvent) => void = () => undefined): Promise<{ conversationId: string; message: ChatMessageDTO }> {
  const text = input.text.trim().slice(0, 4000);
  if (!text) throw new UserFacingError("Escribe un mensaje.");

  emit({ type: "status", label: "Pensando…" });
  const setup = await runAsUser(db, userId, async (ctx) => {
    const conversationId = await ensureConversation(ctx, input.conversationId ?? null, text);
    await ctx.tx.insert(messages).values({ userId, conversationId, role: "USER", content: text });
    const [projectRows, peopleRows, profile] = await Promise.all([
      ctx.tx.select({ title: projects.title }).from(projects).where(and(eq(projects.userId, userId), isNull(projects.deletedAt), inArray(projects.status, ["ACTIVE", "PLANNED", "IDEA", "PAUSED"]))),
      ctx.tx.select({ name: people.name }).from(people).where(and(eq(people.userId, userId), isNull(people.deletedAt))),
      ctx.tx.query.userProfiles.findFirst({ where: eq(userProfiles.userId, userId), columns: { aiEnabled: true } }),
    ]);
    return { conversationId, today: ctx.today, timezone: ctx.timezone, projects: projectRows.map((p) => p.title), people: peopleRows.map((p) => p.name), aiEnabled: profile?.aiEnabled ?? true };
  });
  const aiOn = setup.aiEnabled && isAIConfigured();

  const intent = await classifyIntent(text, { ...setup, aiEnabled: aiOn, onUsage: (u) => recordAIUsage(db, userId, u) });
  emit({ type: "status", label: isQueryIntent(intent.intent) ? "Revisando tus datos…" : "Organizando…" });

  const { reply, context, history } = await runAsUser(db, userId, async (ctx) => {
    const r = await deterministicReply(ctx, setup.conversationId, text, intent);
    const needsModel = aiOn && r.mode !== "none";
    const c = needsModel ? await buildContext(ctx, intent.intent, text, intent.entities.date) : null;
    const h = needsModel ? await recentHistory(ctx, setup.conversationId) : [];
    return { reply: r, context: c, history: h };
  });

  let finalText = reply.text;
  let pending = reply.pending;
  const cards = [...reply.cards];
  if (aiOn && reply.mode !== "none" && context) {
    emit({ type: "status", label: reply.mode === "agent" ? "Pensando con tus datos…" : "Redactando…" });
    const ai = await runModel(db, userId, setup.conversationId, { text, reply, context: context.text, history, mode: reply.mode, today: setup.today, timezone: setup.timezone });
    if (ai) {
      finalText = ai.text || finalText;
      // In agent mode the model decided what to do; its proposal replaces the generic fallback.
      pending = reply.mode === "agent" ? ai.pending : pending ?? ai.pending;
      if (reply.mode === "agent") cards.length = 0;
      cards.push(...ai.cards);
    }
  }

  emit({ type: "status", label: "Guardando…" });
  const message = await runAsUser(db, userId, async (ctx) => {
    const [row] = await ctx.tx.insert(messages).values({ userId, conversationId: setup.conversationId, role: "ASSISTANT", content: finalText, intent: intent.intent, cards, pendingAction: pending }).returning();
    await ctx.tx.update(conversations).set({ lastMessageAt: ctx.now }).where(eq(conversations.id, setup.conversationId));
    return toDTO(row);
  });
  emit({ type: "message", message, conversationId: setup.conversationId });
  return { conversationId: setup.conversationId, message };
}

/** Executes (or rejects) a pending action after explicit user confirmation. */
export async function resolvePendingAction(db: Db, userId: string, messageId: string, decision: "confirm" | "reject", overrideArgs?: Record<string, unknown>): Promise<{ message: ChatMessageDTO; status: PendingAction["status"] }> {
  return runAsUser(db, userId, async (ctx) => {
    const msg = await ctx.tx.query.messages.findFirst({ where: and(eq(messages.id, messageId), eq(messages.userId, userId)) });
    if (!msg?.pendingAction) throw new UserFacingError("No hay ninguna acción pendiente en ese mensaje.", "NOT_FOUND");
    if (msg.pendingAction.status !== "PENDING") throw new UserFacingError("Esa acción ya fue resuelta.", "CONFLICT");
    const action = msg.pendingAction;
    const args = overrideArgs ? { ...action.args, ...overrideArgs } : action.args;

    let content: string;
    let status: PendingAction["status"];
    const cards: MessageCard[] = [];
    if (decision === "reject") {
      status = "REJECTED";
      content = "Entendido, no hice nada.";
      if (action.logId) await ctx.tx.update(agentActionLogs).set({ status: "REJECTED", confirmed: false }).where(eq(agentActionLogs.id, action.logId));
    } else {
      const res = await executeTool(ctx, msg.conversationId, action.tool, args, { confirmed: true });
      if (action.logId) await ctx.tx.update(agentActionLogs).set({ status: res.status === "SUCCESS" ? "CONFIRMED" : "ERROR", confirmed: true }).where(eq(agentActionLogs.id, action.logId));
      if (res.status === "SUCCESS" && res.result) {
        status = "CONFIRMED";
        content = res.result.summary;
        if (res.result.href) cards.push({ kind: "link", data: { href: res.result.href, label: "Ver" } });
      } else {
        status = "FAILED";
        content = `${res.error ?? "No pude completarlo."} Tu información sigue intacta.`;
      }
    }
    await ctx.tx.update(messages).set({ pendingAction: { ...action, args, status } }).where(eq(messages.id, messageId));
    const [row] = await ctx.tx.insert(messages).values({ userId, conversationId: msg.conversationId, role: "ASSISTANT", content, cards }).returning();
    return { message: toDTO(row), status };
  });
}

export async function loadConversation(db: Db, userId: string, conversationId?: string | null) {
  return runAsUser(db, userId, async (ctx) => {
    const conv = conversationId
      ? await ctx.tx.query.conversations.findFirst({ where: and(eq(conversations.id, conversationId), eq(conversations.userId, userId)) })
      : await ctx.tx.query.conversations.findFirst({ where: eq(conversations.userId, userId), orderBy: [desc(conversations.lastMessageAt)] });
    if (!conv) return { conversationId: null, messages: [] as ChatMessageDTO[] };
    const rows = await ctx.tx.select().from(messages).where(and(eq(messages.conversationId, conv.id), inArray(messages.role, ["USER", "ASSISTANT"]))).orderBy(desc(messages.createdAt)).limit(60);
    return { conversationId: conv.id, messages: rows.reverse().map(toDTO) };
  });
}

function toDTO(row: typeof messages.$inferSelect): ChatMessageDTO {
  return { id: row.id, role: row.role === "USER" ? "USER" : "ASSISTANT", content: row.content, cards: row.cards, pendingAction: row.pendingAction ?? null, createdAt: row.createdAt.toISOString() };
}

async function ensureConversation(ctx: Ctx, id: string | null, firstText: string): Promise<string> {
  if (id) {
    const existing = await ctx.tx.query.conversations.findFirst({ where: and(eq(conversations.id, id), eq(conversations.userId, ctx.userId)) });
    if (existing) return existing.id;
  }
  const [row] = await ctx.tx.insert(conversations).values({ userId: ctx.userId, title: firstText.slice(0, 80) }).returning({ id: conversations.id });
  return row.id;
}

async function recentHistory(ctx: Ctx, conversationId: string) {
  const rows = await ctx.tx.select({ role: messages.role, content: messages.content }).from(messages).where(and(eq(messages.conversationId, conversationId), inArray(messages.role, ["USER", "ASSISTANT"]))).orderBy(desc(messages.createdAt)).limit(9);
  // Drop the message we just stored; it is sent separately.
  return rows.slice(1).reverse().map((r) => ({ role: r.role === "USER" ? ("user" as const) : ("assistant" as const), content: r.content.slice(0, 1200) }));
}

// ─── Deterministic handlers ─────────────────────────────────────────────────
async function deterministicReply(ctx: Ctx, conversationId: string, text: string, intent: IntentResult): Promise<Reply> {
  const e = intent.entities;
  const card = (kind: string, data: Record<string, unknown>): MessageCard => ({ kind, data });

  switch (intent.intent) {
    case "CREATE_TASK":
    case "CREATE_WAITING_FOR":
    case "CAPTURE_IDEA":
    case "CAPTURE_NOTE":
    case "LOG_EXPENSE":
    case "LOG_INCOME":
    case "LOG_METRIC":
    case "LOG_HABIT":
    case "CREATE_EVENT":
    case "PERSON_UPDATE": {
      const started = Date.now();
      const [item] = await ctx.tx.insert(inboxItems).values({ userId: ctx.userId, rawText: text, source: "CHAT" }).returning();
      const result = await ctx.tx.transaction((sp) => applyIntent({ ...ctx, tx: sp }, item.id, text, intent, "CHAT"));
      await ctx.tx.insert(agentActionLogs).values({ userId: ctx.userId, conversationId, tool: "capture_item", input: { intent: intent.intent, classifier: intent.classifier }, result: { status: result.status, entity: result.entity?.type ?? null }, status: "SUCCESS", latencyMs: Date.now() - started });
      let out = result.message;
      if (intent.intent === "CREATE_TASK") {
        const capacity = await runCapacityReview(ctx);
        if (capacity.level === "OVERLOADED" || capacity.level === "CRITICAL") out += `\n\nOjo: esta semana ya estás en ${CAPACITY_LABEL[capacity.level].toLowerCase()}. Si esto es importante, dime qué sale para hacerle espacio.`;
      }
      if (intent.intent === "CREATE_WAITING_FOR" && result.entity) out = result.message;
      return { text: out, cards: result.entity?.href ? [card("entity", { ...result.entity })] : [], pending: null, mode: "none" };
    }

    case "MULTI_CAPTURE": {
      const lines: string[] = [];
      const parts = splitCompound(text);
      for (const part of parts) {
        const sub = classifyWithRules(part, { today: ctx.today, noSplit: true });
        if (sub.intent === "UNKNOWN" || isQueryIntent(sub.intent)) continue;
        if (!sub.entities.date && e.date && (sub.intent === "CREATE_TASK" || sub.intent === "CREATE_EVENT")) sub.entities.date = e.date;
        const [item] = await ctx.tx.insert(inboxItems).values({ userId: ctx.userId, rawText: part, source: "CHAT" }).returning();
        const r = await ctx.tx.transaction((sp) => applyIntent({ ...ctx, tx: sp }, item.id, part, sub, "CHAT"));
        lines.push(`• ${r.message}`);
      }
      await ctx.tx.insert(agentActionLogs).values({ userId: ctx.userId, conversationId, tool: "capture_item", input: { intent: "MULTI_CAPTURE", parts: parts.length }, status: "SUCCESS" });
      const date = e.date ?? ctx.today;
      const plan = await buildDayPlan(ctx, date);
      const header = `Registré lo que me contaste:\n${lines.join("\n")}`;
      return { text: `${header}\n\n${planText(plan, date, ctx.today)}`, cards: [card("plan", { ...plan })], pending: big3Pending(plan, date), mode: "phrase" };
    }

    case "COMPLETE_TASK": {
      const match = await matchOpenTask(ctx, e.query ?? text);
      if (!match || match.confidence < 0.5) return { text: "No encontré una tarea abierta que coincida. ¿Cómo se llamaba?", cards: [], pending: null, mode: "none" };
      const res = await executeTool(ctx, conversationId, "complete_task", { task_id: match.id, title: match.title });
      return { text: `¿Marco como hecha “${match.title}”?`, cards: [], pending: res.pending ?? null, mode: "none" };
    }

    case "CREATE_GOAL": {
      const title = e.title ?? text;
      const dup = await findDuplicateGoal(ctx, title);
      if (dup) return { text: `Ya tienes un objetivo muy parecido: “${dup.title}”. ¿Lo actualizamos en vez de crear otro?`, cards: [card("link", { href: `/goals/${dup.id}`, label: "Abrir objetivo" })], pending: null, mode: "none" };
      const res = await executeTool(ctx, conversationId, "create_goal", { title, outcome: null, metric: null, baseline: null, target: null, deadline: e.date, area_key: e.area });
      return { text: `Propongo crear el objetivo “${title}”. Para que sea útil, luego defínele una métrica y una fecha.`, cards: [], pending: res.pending ?? null, mode: "phrase" };
    }

    case "CREATE_PROJECT": {
      const capacity = await runCapacityReview(ctx);
      const title = e.title && !/^(negocio|proyecto|emprendimiento|empresa)$/i.test(e.title) ? e.title : "Nuevo negocio";
      const crowded = capacity.activeProjects >= 5 || capacity.level === "OVERLOADED" || capacity.level === "CRITICAL";
      const questions = "Antes de crear tareas, pensemos:\n• ¿Qué problema resuelve y para quién?\n• ¿Cómo se alinea con tus objetivos de 90 días?\n• ¿Cuántas horas por semana exige y de dónde salen?\n• ¿Qué dejarías de hacer (costo de oportunidad)?";
      const text2 = crowded
        ? `Antes de convertirlo en proyecto activo, lo guardaría como oportunidad. Actualmente tienes ${capacity.activeProjects} proyectos activos y ${capacity.summary.charAt(0).toLowerCase()}${capacity.summary.slice(1)}\n\n${questions}`
        : `Buena idea para explorar. ${questions}`;
      const res = await executeTool(ctx, conversationId, "create_project", { title, desired_outcome: null, area_key: e.area ?? "business", status: crowded ? "IDEA" : "PLANNED", target_date: null });
      return { text: text2, cards: [], pending: res.pending ?? null, mode: "phrase" };
    }

    case "DECISION_FLOW": {
      const res = await executeTool(ctx, conversationId, "create_decision", { question: e.question ?? text, context: null, options: [], deadline: e.date });
      const capacity = await runCapacityReview(ctx);
      const body = `Abrí la decisión en tu diario. Antes de decidir:\n• ¿Qué ganas concretamente y qué te cuesta en horas por semana?\n• ¿Es reversible? Si lo es, decide rápido; si no, busca más información.\n• ¿A qué dirías que no si dices que sí?\n\nContexto: tu capacidad está ${CAPACITY_LABEL[capacity.level].toLowerCase()} — ${capacity.summary}`;
      return { text: body, cards: res.result?.href ? [card("link", { href: res.result.href, label: "Abrir decisión y analizar" })] : [], pending: null, mode: "phrase" };
    }

    case "PLAN_DAY": {
      const date = e.date ?? ctx.today;
      const plan = await buildDayPlan(ctx, date);
      await ctx.tx.insert(agentActionLogs).values({ userId: ctx.userId, conversationId, tool: "plan_day", input: { date }, result: { blocks: plan.blocks.length, deferred: plan.deferred.length }, status: "SUCCESS" });
      return { text: planText(plan, date, ctx.today), cards: [card("plan", { ...plan })], pending: big3Pending(plan, date), mode: "phrase" };
    }

    case "GET_TODAY": {
      const date = e.date ?? ctx.today;
      const [events, tasks, big3] = await Promise.all([eventsOn(ctx, date), listTasks(ctx, { kind: "date", date }), getBig3(ctx, date)]);
      const lines = [
        events.length ? `Agenda:\n${events.map((ev) => `• ${ev.allDay ? "Todo el día" : minutesToHHMM(ev.startMinutes)} — ${ev.title}`).join("\n")}` : "Sin eventos en la agenda.",
        big3.length ? `Big 3:\n${big3.map((b) => `${b.rank}. ${b.title}${b.done ? " ✓" : ""}`).join("\n")}` : "",
        tasks.length ? `${tasks.length} ${tasks.length === 1 ? "tarea programada" : "tareas programadas"}.` : "",
      ].filter(Boolean);
      return { text: lines.join("\n\n"), cards: [card("link", { href: "/today", label: "Abrir Hoy" })], pending: null, mode: "none" };
    }

    case "GET_OPEN_LOOPS": {
      const loops = await getOpenLoops(ctx);
      const parts = [
        loops.overdue.length ? `Vencidas (${loops.overdue.length}):\n${loops.overdue.slice(0, 4).map((t) => `• ${t.title} — hace ${t.daysLate} d`).join("\n")}` : "",
        loops.actionRequired.length ? `Lo más importante por hacer:\n${loops.actionRequired.slice(0, 4).map((t) => `• ${t.title}`).join("\n")}` : "",
        loops.waitingFor.length ? `Esperando de otros (${loops.waitingFor.length}):\n${loops.waitingFor.slice(0, 4).map((w) => `• ${w.item} — ${w.who}${w.overdue ? " (toca seguimiento)" : ""}`).join("\n")}` : "",
        loops.decisionRequired.length ? `Decisiones abiertas:\n${loops.decisionRequired.slice(0, 3).map((d) => `• ${d.question}`).join("\n")}` : "",
      ].filter(Boolean);
      return { text: parts.length ? parts.join("\n\n") : "No tienes bucles abiertos. Todo está bajo control.", cards: [card("loops", { counts: { overdue: loops.overdue.length, waiting: loops.waitingFor.length, decisions: loops.decisionRequired.length, open: loops.totalOpenTasks } })], pending: null, mode: "none" };
    }

    case "CAPACITY_REVIEW": {
      const c = await runCapacityReview(ctx);
      await ctx.tx.insert(agentActionLogs).values({ userId: ctx.userId, conversationId, tool: "run_capacity_review", input: {}, result: { level: c.level }, status: "SUCCESS" });
      const intro =
        c.level === "NORMAL"
          ? `Por los números, tu semana tiene espacio (${c.summary.toLowerCase()}) — así que la saturación puede venir de otro lado: demasiados frentes abiertos o poco descanso.`
          : `Tiene sentido que te sientas así. ${c.summary}`;
      const relief = c.relief.length
        ? `\n\nPropongo aliviar así:\n${c.relief.slice(0, 5).map((r) => `• ${RELIEF_LABEL[r.action]}: ${r.title} (${formatHours(r.minutes)}) — ${r.reason}`).join("\n")}`
        : "";
      const signals = c.signals.length ? `\n\nSeñales: ${c.signals.join(" ")}` : "";
      return { text: `${intro}${relief}${signals}\n\nRegla para esta semana: no añadir nada nuevo sin sacar algo.`, cards: [card("capacity", { level: c.level, utilization: c.utilization, slackMinutes: c.slackMinutes, relief: c.relief })], pending: null, mode: "phrase" };
    }

    case "EXECUTIVE_STATUS": {
      const [status, week, capacity, attention, big3] = await Promise.all([getLifeStatus(ctx), weekCompletion(ctx), runCapacityReview(ctx), getAttention(ctx, null), getBig3(ctx)]);
      const ls = status.lifeScore;
      const done = big3.filter((b) => b.done).length;
      const lines = [
        ls.score !== null ? `Life Score ${ls.score}${ls.delta !== null ? ` (${ls.delta >= 0 ? "+" : ""}${ls.delta})` : ""}.` : "Aún no evaluaste tus áreas, así que no hay Life Score.",
        `Esta semana cerraste ${week.completed} ${week.completed === 1 ? "tarea" : "tareas"}; hoy llevas ${done}/${big3.length} del Big 3.`,
        `Capacidad ${CAPACITY_LABEL[capacity.level].toLowerCase()}: ${capacity.summary}`,
        status.goalsAtRisk.length ? `Objetivos en riesgo: ${status.goalsAtRisk.join(", ")}.` : "",
        attention.length ? `Lo que requiere atención:\n${attention.map((a) => `• ${a.message}`).join("\n")}` : "Nada urgente requiere tu atención.",
      ].filter(Boolean);
      return { text: lines.join("\n"), cards: [card("status", { lifeScore: ls.score, delta: ls.delta, completed: week.completed, capacity: capacity.level })], pending: null, mode: "phrase" };
    }

    case "WEEKLY_REVIEW":
      return { text: "Hagamos tu CEO Meeting semanal: resultados, causas, riesgos, qué dejar de hacer y el Big 3 de la próxima semana. Toma unos 10 minutos.", cards: [card("link", { href: "/reviews/weekly", label: "Empezar revisión semanal" })], pending: null, mode: "none" };

    case "DAILY_BRIEF": {
      const brief = await buildDailyBrief(ctx);
      const text2 = [brief.greeting, brief.big3.length ? `Big 3: ${brief.big3.map((b) => b.title).join(" · ")}.` : "", `Capacidad: ${brief.capacity.summary}`, brief.recommendation].filter(Boolean).join("\n");
      return { text: text2, cards: [card("link", { href: "/brief", label: "Ver Daily Brief" })], pending: null, mode: "none" };
    }

    case "DAILY_SHUTDOWN":
      return { text: "Cerremos el día: qué completaste, qué queda y qué merece ir a mañana (no todo).", cards: [card("link", { href: "/shutdown", label: "Cerrar el día" })], pending: null, mode: "none" };

    case "EXPLAIN_PRIORITY": {
      const big3 = await getBig3(ctx);
      return { text: big3.length ? big3.map((b) => `${b.rank}. ${b.title} — ${b.reason ?? "elegida por ti."}`).join("\n") : "Aún no hay Big 3 para hoy.", cards: [], pending: null, mode: "none" };
    }

    case "SEARCH": {
      const hits = await globalSearch(ctx, e.query ?? text, 5);
      return { text: hits.length ? `Encontré ${hits.length}:` : "No encontré nada con eso.", cards: hits.map((h) => card("link", { href: h.href, label: `${h.subtitle}: ${h.title}` })), pending: null, mode: "none" };
    }

    default: {
      return {
        text: "No estoy segura de qué necesitas con esto. ¿Quieres que lo guarde en tu Inbox, o me cuentas un poco más?",
        cards: [card("suggestions", { items: ["¿Qué tengo pendiente?", "Organízame mañana", "¿Cómo vamos?"] })],
        pending: { tool: "capture_item", args: { text }, summary: `Guardar en Inbox: “${text.slice(0, 80)}”`, status: "PENDING" },
        mode: "agent",
      };
    }
  }
}

function planText(plan: Awaited<ReturnType<typeof buildDayPlan>>, date: string, today: string): string {
  const when = date === today ? "Hoy" : formatRelative(date, today) === "Mañana" ? "Mañana" : `El ${WEEKDAY_NAMES[weekdayOf(date)]}`;
  const first = plan.blocks.find((b) => b.taskId);
  const lines = [
    `${when}: ${plan.summary}`,
    first ? `Empieza a las ${first.start} con “${first.title}”. Abajo tienes el plan completo.` : "",
    plan.conflicts.length ? `\nConflictos: ${plan.conflicts.join(" ")}` : "",
    plan.deferred.length ? `\nQueda fuera: ${plan.deferred.slice(0, 4).map((d) => d.title).join(", ")}.` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

function big3Pending(plan: Awaited<ReturnType<typeof buildDayPlan>>, date: string): PendingAction | null {
  if (plan.big3.length === 0) return null;
  return { tool: "set_big3", args: { date, task_ids: plan.big3.map((b) => b.taskId), titles: plan.big3.map((b) => b.title) }, summary: `Confirmar Big 3: ${plan.big3.map((b) => b.title).join(" · ")}`, status: "PENDING" };
}

// ─── Model layer ────────────────────────────────────────────────────────────
const MAX_TOOL_ROUNDS = 4;

async function runModel(
  db: Db,
  userId: string,
  conversationId: string,
  p: { text: string; reply: Reply; context: string; history: Array<{ role: "user" | "assistant"; content: string }>; mode: "phrase" | "agent"; today: string; timezone: string },
): Promise<{ text: string; pending: PendingAction | null; cards: MessageCard[] } | null> {
  const model = modelFor("main");
  const displayName = await runAsUser(db, userId, async (ctx) => ctx.displayName);
  const instructions = `${liaSystemPrompt({ displayName, today: p.today, weekday: WEEKDAY_NAMES[weekdayOf(p.today)], timezone: p.timezone })}\n\n# CONTEXTO (datos reales)\n${p.context}`;
  const input: ResponseInputItem[] = [...p.history.map((h) => ({ role: h.role, content: h.content }) as ResponseInputItem)];

  if (p.mode === "phrase") {
    input.push({
      role: "user",
      content: `${p.text}\n\n[Borrador calculado por el sistema con datos reales — reescríbelo de forma natural y breve, sin cambiar cifras, horas ni hechos, sin añadir tareas que no existan. Si hay una acción pendiente de confirmación, menciónala en una frase.]\n${p.reply.text}${p.reply.pending ? `\n[Acción pendiente: ${p.reply.pending.summary}]` : ""}`,
    });
    const started = Date.now();
    try {
      const res = await getOpenAI().responses.create({ model, instructions, input, max_output_tokens: 700 });
      await recordAIUsage(db, userId, { purpose: `chat_phrase:${LIA_PROMPT_VERSION}`, model, inputTokens: res.usage?.input_tokens, outputTokens: res.usage?.output_tokens, latencyMs: Date.now() - started, success: true });
      return { text: res.output_text.trim(), pending: null, cards: [] };
    } catch (err) {
      await recordAIUsage(db, userId, { purpose: "chat_phrase", model, latencyMs: Date.now() - started, success: false, errorCode: errorCode(err) });
      return null;
    }
  }

  // Agent mode: open conversation with validated tool calls.
  const tools = TOOLS.map((t) => zodResponsesFunction({ name: t.name, description: t.description, parameters: t.parameters }));
  input.push({ role: "user", content: p.text });
  let pending: PendingAction | null = null;
  const cards: MessageCard[] = [];
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const started = Date.now();
    let res;
    try {
      res = await getOpenAI().responses.parse({ model, instructions, input, tools, max_output_tokens: 900 });
      await recordAIUsage(db, userId, { purpose: `chat_agent:${LIA_PROMPT_VERSION}`, model, inputTokens: res.usage?.input_tokens, outputTokens: res.usage?.output_tokens, latencyMs: Date.now() - started, success: true });
    } catch (err) {
      await recordAIUsage(db, userId, { purpose: "chat_agent", model, latencyMs: Date.now() - started, success: false, errorCode: errorCode(err) });
      return null;
    }
    const calls = res.output.filter((o) => o.type === "function_call");
    if (calls.length === 0) return { text: res.output_text.trim(), pending, cards };
    for (const call of calls) {
      if (call.type !== "function_call") continue;
      input.push({ type: "function_call", call_id: call.call_id, name: call.name, arguments: call.arguments });
      let args: unknown = {};
      try {
        args = JSON.parse(call.arguments);
      } catch {
        args = {};
      }
      const outcome = await runAsUser(db, userId, (ctx) => executeTool(ctx, conversationId, call.name, args));
      let output: string;
      if (outcome.status === "PENDING" && outcome.pending) {
        pending ??= outcome.pending;
        output = JSON.stringify({ status: "PENDIENTE_DE_CONFIRMACION", note: "El usuario verá un botón para confirmar. No digas que ya está hecho." });
      } else if (outcome.status === "SUCCESS" && outcome.result) {
        if (outcome.result.href && getTool(call.name)?.requiresConfirmation === false && !call.name.startsWith("get_") && call.name !== "search" && call.name !== "plan_day" && call.name !== "run_capacity_review") {
          cards.push({ kind: "link", data: { href: outcome.result.href, label: "Ver" } });
        }
        output = JSON.stringify({ status: "OK", summary: outcome.result.summary, data: outcome.result.data ?? null }).slice(0, 6000);
      } else {
        output = JSON.stringify({ status: "ERROR", error: outcome.error });
      }
      input.push({ type: "function_call_output", call_id: call.call_id, output });
    }
  }
  return { text: "Hice lo que pude con tus datos; si falta algo, dime.", pending, cards };
}

export async function listConversations(db: Db, userId: string) {
  return runAsUser(db, userId, (ctx) => ctx.tx.select().from(conversations).where(eq(conversations.userId, userId)).orderBy(desc(conversations.lastMessageAt)).limit(20));
}

