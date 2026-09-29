/**
 * Universal capture — "persist first, enrich second".
 *
 *  1. Save the raw text (committed immediately; nothing can lose it).
 *  2. Classify outside any DB transaction (rules → LLM when unsure).
 *  3. Apply the classification inside a savepoint. If anything fails the
 *     item stays in the Inbox as NEEDS_REVIEW with the original text intact.
 */
import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { classifyWithRules, splitCompound } from "@/ai/intent/rules";
import { INTENT_TO_INBOX_TYPE, isQueryIntent, type IntentResult } from "@/ai/intent/schema";
import { formatRelative, normalize } from "@/domain/dates";
import { INBOX_ITEM_TYPES, INBOX_TYPE_LABEL, type InboxItemType, type InboxStatus } from "@/domain/enums";
import { formatMoney } from "@/domain/money";
import { log } from "@/lib/logger";
import type { Db } from "@/server/db/factory";
import { inboxItems, people, projects, userProfiles } from "@/server/db/schema";
import { track } from "./analytics";
import { areaIdByKey } from "./areas";
import { runAsUser, UserFacingError, type Ctx } from "./context";
import { createDecision } from "./decisions";
import { createEvent } from "./events";
import { createGoal } from "./goals";
import { rememberCandidate } from "./memory";
import { logHabit, logMetric, logTransaction } from "./metrics";
import { addInteraction, findPeople, resolveOrCreatePerson, updatePerson } from "./people";
import { createProject, matchProjectMention } from "./projects";
import { completeTask, createTask, findDuplicateOpenTask, matchOpenTask } from "./tasks";
import { createWaitingFor } from "./waiting";

export const CaptureInputSchema = z.object({
  text: z.string().trim().min(1, "Escribe algo para capturar").max(2000, "Demasiado largo (máx. 2000 caracteres)"),
  clientId: z.string().max(80).nullish(),
  source: z.enum(["QUICK_CAPTURE", "CHAT", "OFFLINE_SYNC", "VOICE", "ONBOARDING"]).default("QUICK_CAPTURE"),
});

export type CaptureEntity = { type: string; id: string; title: string; href?: string };

export type CaptureResult = {
  itemId: string;
  status: InboxStatus;
  type: InboxItemType;
  intent: IntentResult["intent"];
  confidence: number;
  message: string;
  entity: CaptureEntity | null;
  redirect: string | null;
  suggestion: Record<string, unknown> | null;
  children?: CaptureResult[];
};

export type Classifier = (text: string, ctx: { today: string; timezone: string; projects: string[]; people: string[]; aiEnabled: boolean }) => Promise<IntentResult>;

const rulesOnly: Classifier = async (text, ctx) => classifyWithRules(text, { today: ctx.today });

export async function capture(db: Db, userId: string, input: z.input<typeof CaptureInputSchema>, classify: Classifier = rulesOnly): Promise<CaptureResult> {
  const data = CaptureInputSchema.parse(input);

  // 1 · Persist (idempotent by clientId for offline sync).
  const persisted = await runAsUser(db, userId, async (ctx) => {
    if (data.clientId) {
      const existing = await ctx.tx.query.inboxItems.findFirst({ where: and(eq(inboxItems.userId, userId), eq(inboxItems.clientId, data.clientId)) });
      if (existing) return { item: existing, duplicate: true, classifyCtx: null };
    }
    const [item] = await ctx.tx.insert(inboxItems).values({ userId, rawText: data.text, source: data.source, clientId: data.clientId ?? null }).returning();
    const [projectRows, peopleRows, profile] = await Promise.all([
      ctx.tx.select({ title: projects.title }).from(projects).where(and(eq(projects.userId, userId), isNull(projects.deletedAt), inArray(projects.status, ["IDEA", "PLANNED", "ACTIVE", "PAUSED"]))),
      ctx.tx.select({ name: people.name }).from(people).where(and(eq(people.userId, userId), isNull(people.deletedAt))),
      ctx.tx.query.userProfiles.findFirst({ where: eq(userProfiles.userId, userId), columns: { aiEnabled: true } }),
    ]);
    return {
      item,
      duplicate: false,
      classifyCtx: { today: ctx.today, timezone: ctx.timezone, projects: projectRows.map((p) => p.title), people: peopleRows.map((p) => p.name), aiEnabled: profile?.aiEnabled ?? true },
    };
  });

  if (persisted.duplicate || !persisted.classifyCtx) return resultFromItem(persisted.item);

  // 2 · Classify (never inside a transaction; never fatal).
  let intent: IntentResult;
  try {
    intent = await classify(data.text, persisted.classifyCtx);
  } catch (err) {
    log.warn("capture.classify_failed", { err });
    intent = classifyWithRules(data.text, { today: persisted.classifyCtx.today });
  }

  // 3 · Enrich.
  return runAsUser(db, userId, async (ctx) => {
    const item = persisted.item;
    try {
      const outcome = await ctx.tx.transaction((sp) => applyIntent({ ...ctx, tx: sp }, item.id, data.text, intent, data.source));
      await track(ctx, "capture_created", { type: outcome.type, status: outcome.status, classifier: intent.classifier, source: data.source });
      return outcome;
    } catch (err) {
      const message = err instanceof UserFacingError ? err.message : "No pude organizarlo automáticamente.";
      log.warn("capture.apply_failed", { intent: intent.intent, err });
      await ctx.tx
        .update(inboxItems)
        .set({ status: "NEEDS_REVIEW", type: INTENT_TO_INBOX_TYPE[intent.intent] ?? "UNKNOWN", confidence: intent.confidence, parsed: intentToJson(intent), classifier: intent.classifier, error: message })
        .where(eq(inboxItems.id, item.id));
      return {
        itemId: item.id,
        status: "NEEDS_REVIEW",
        type: INTENT_TO_INBOX_TYPE[intent.intent] ?? "UNKNOWN",
        intent: intent.intent,
        confidence: intent.confidence,
        message: `${message} Quedó guardado en tu Inbox.`,
        entity: null,
        redirect: null,
        suggestion: null,
      };
    }
  });
}

function intentToJson(intent: IntentResult): Record<string, unknown> {
  return { intent: intent.intent, confidence: intent.confidence, entities: intent.entities, requires_confirmation: intent.requires_confirmation };
}

const DEADLINE_WORDS = /\b(antes del?|vence|plazo|limite|a mas tardar|termino|entrega)\b/;

/** Applies a classified intent. Exported so the LÍA agent reuses the exact same pipeline. */
export async function applyIntent(ctx: Ctx, itemId: string, text: string, intent: IntentResult, source: string): Promise<CaptureResult> {
  const e = intent.entities;
  const type: InboxItemType = INTENT_TO_INBOX_TYPE[intent.intent] ?? "UNKNOWN";
  const base = { itemId, type, intent: intent.intent, confidence: intent.confidence, redirect: null, suggestion: null };

  const finish = async (status: InboxStatus, message: string, entity: CaptureEntity | null, suggestion: Record<string, unknown> | null = null, finalType: InboxItemType = type): Promise<CaptureResult> => {
    await ctx.tx
      .update(inboxItems)
      .set({
        status,
        type: finalType,
        confidence: intent.confidence,
        parsed: { ...intentToJson(intent), ...(suggestion ? { suggestion } : {}) },
        classifier: intent.classifier,
        resultEntityType: entity?.type ?? null,
        resultEntityId: entity?.id ?? null,
        processedAt: status === "PROCESSED" ? ctx.now : null,
        error: null,
      })
      .where(eq(inboxItems.id, itemId));
    return { ...base, type: finalType, status, message, entity, suggestion };
  };

  if (isQueryIntent(intent.intent)) {
    await ctx.tx.update(inboxItems).set({ status: "ARCHIVED", classifier: intent.classifier, parsed: intentToJson(intent), processedAt: ctx.now }).where(eq(inboxItems.id, itemId));
    return { ...base, status: "ARCHIVED", message: "Eso es una pregunta para LÍA.", entity: null, redirect: `/lia?q=${encodeURIComponent(text)}`, suggestion: null };
  }

  const areaId = await areaIdByKey(ctx, e.area);

  switch (intent.intent) {
    case "CREATE_TASK": {
      const title = e.title ?? text;
      const dup = await findDuplicateOpenTask(ctx, title);
      if (dup) return finish("PROCESSED", `Ya tenías esta tarea: “${dup.title}”.`, { type: "task", id: dup.id, title: dup.title, href: "/today" });
      const project = await matchProjectMention(ctx, `${text} ${e.project ?? ""}`);
      let personId: string | null = null;
      if (e.person) {
        const matches = await findPeople(ctx, e.person);
        if (matches[0] && matches[0].confidence >= 0.8 && (matches.length === 1 || matches[1].confidence < 0.8)) personId = matches[0].id;
      }
      const isDeadline = DEADLINE_WORDS.test(normalize(text));
      const task = await createTask(
        ctx,
        {
          title,
          dueDate: isDeadline ? e.date : null,
          scheduledDate: isDeadline ? null : e.date,
          lifeAreaId: project ? null : areaId,
          projectId: project?.id ?? null,
          personId,
          description: e.time ? `Hora sugerida: ${e.time}` : null,
        },
        { createdBy: "LIA", source: source === "CHAT" ? "LIA" : "CAPTURE", inboxItemId: itemId },
      );
      const when = e.date ? ` · ${formatRelative(e.date, ctx.today)}` : "";
      const inProject = project ? ` · ${project.title}` : "";
      return finish("PROCESSED", `Tarea creada: ${task.title}${when}${inProject}`, { type: "task", id: task.id, title: task.title, href: project ? `/projects/${project.id}` : "/today" });
    }

    case "CREATE_WAITING_FOR": {
      if (!e.person) return finish("NEEDS_REVIEW", "¿De quién estás esperando algo? Quedó en tu Inbox.", null);
      const project = await matchProjectMention(ctx, text);
      const { waiting, person, personCreated } = await createWaitingFor(ctx, { person: e.person, expectedItem: e.expectedItem, expectedDate: e.date, projectId: project?.id ?? null }, itemId);
      const when = waiting.expectedDate ? ` para el ${formatRelative(waiting.expectedDate, ctx.today).toLowerCase()}` : "";
      return finish(
        "PROCESSED",
        `En espera: ${waiting.expectedItem} de ${person.name}${when}. Te recordaré hacer seguimiento.`,
        { type: "waiting_for", id: waiting.id, title: `${waiting.expectedItem} · ${person.name}`, href: "/waiting" },
        personCreated ? { personCreated: person.name } : null,
      );
    }

    case "CAPTURE_IDEA": {
      const project = await matchProjectMention(ctx, `${text} ${e.project ?? ""}`);
      const title = e.title ?? text;
      return finish("PROCESSED", `Idea guardada${project ? ` en ${project.title}` : ""}: ${title}`, { type: "idea", id: itemId, title, href: "/inbox?view=ideas" }, project ? { projectId: project.id, projectTitle: project.title } : null);
    }

    case "CAPTURE_NOTE": {
      if (e.category === "PREFERENCE") {
        const memory = await rememberCandidate(ctx, { kind: "PREFERENCE", content: e.description ?? text, confidence: 0.6 });
        return finish("PROCESSED", "Anotado como preferencia. Confírmala en Ajustes → Memoria para que LÍA la use.", { type: "memory", id: memory.id, title: memory.content, href: "/settings/memory" });
      }
      const noteType: InboxItemType = e.category === "RISK" ? "RISK" : "NOTE";
      return finish("PROCESSED", `${noteType === "RISK" ? "Riesgo" : "Nota"} guardada.`, { type: "note", id: itemId, title: e.title ?? text, href: "/inbox?view=notes" }, null, noteType);
    }

    case "LOG_METRIC": {
      if (!e.metricKey || e.metricValue === null) return finish("NEEDS_REVIEW", "No entendí el valor de la métrica.", null);
      const { metric, entry } = await logMetric(ctx, e.metricKey, e.metricValue, e.date ?? ctx.today, itemId);
      const extra = e.metricKey === "sleep_hours" && e.metricValue < 6 ? " Dormir menos de 6 h reduce tu capacidad: lo tendré en cuenta al planear." : "";
      return finish("PROCESSED", `${metric.name}: ${formatNumber(entry.value)} ${metric.unit ?? ""} registrado.${extra}`.replace(/\s+\./, "."), { type: "metric", id: entry.id, title: metric.name, href: "/metrics" });
    }

    case "LOG_HABIT": {
      const { habit } = await logHabit(ctx, e.title ?? "Hábito", e.area, e.date ?? ctx.today);
      return finish("PROCESSED", `Registrado: ${habit.name} ✓`, { type: "habit", id: habit.id, title: habit.name, href: "/metrics" });
    }

    case "LOG_EXPENSE":
    case "LOG_INCOME": {
      if (e.amount === null) return finish("NEEDS_REVIEW", "No encontré el monto.", null);
      const kind = intent.intent === "LOG_INCOME" ? "INCOME" : "EXPENSE";
      const tx = await logTransaction(ctx, { kind, amount: e.amount, category: e.category, description: e.description, occurredOn: e.date ?? ctx.today }, itemId);
      const label = kind === "INCOME" ? "Ingreso" : "Gasto";
      return finish("PROCESSED", `${label} registrado: ${formatMoney(tx.amount, ctx.currency)}${tx.category ? ` · ${tx.category}` : ""}`, { type: "transaction", id: tx.id, title: tx.description ?? label, href: "/metrics?tab=finanzas" });
    }

    case "CREATE_EVENT": {
      if (!e.date) return finish("NEEDS_REVIEW", "¿Qué día es el evento?", null);
      const event = await createEvent(ctx, { title: e.title ?? text, date: e.date, time: e.time });
      return finish("PROCESSED", `Evento agendado: ${event.title} · ${formatRelative(e.date, ctx.today)}${e.time ? ` ${e.time}` : ""}`, { type: "event", id: event.id, title: event.title, href: "/today" });
    }

    case "PERSON_UPDATE": {
      if (!e.person) return finish("NEEDS_REVIEW", "¿Sobre quién es esta nota?", null);
      const { person } = await resolveOrCreatePerson(ctx, e.person);
      if (e.category === "BIRTHDAY" && e.date) await updatePerson(ctx, person.id, { birthday: e.date });
      else await addInteraction(ctx, person.id, e.description ?? text);
      return finish("PROCESSED", `Anotado en ${person.name}.`, { type: "person", id: person.id, title: person.name, href: `/people/${person.id}` });
    }

    case "DECISION_FLOW": {
      const question = e.question ?? text;
      const decision = await createDecision(ctx, { question, deadline: e.date, lifeAreaId: areaId }, itemId);
      return finish("PROCESSED", `Decisión abierta: ${decision.question}`, { type: "decision", id: decision.id, title: decision.question, href: `/decisions/${decision.id}` });
    }

    case "COMPLETE_TASK": {
      const match = await matchOpenTask(ctx, e.query ?? text);
      if (!match || match.confidence < 0.5) return finish("NEEDS_REVIEW", "No encontré una tarea abierta que coincida. Quedó en tu Inbox.", null);
      return finish("NEEDS_REVIEW", `¿Marco como hecha “${match.title}”?`, null, { action: "COMPLETE_TASK", taskId: match.id, taskTitle: match.title, confidence: match.confidence });
    }

    case "CREATE_PROJECT":
    case "CREATE_GOAL": {
      const kind = intent.intent === "CREATE_PROJECT" ? "proyecto" : "objetivo";
      const title = e.title ?? text;
      return finish("NEEDS_REVIEW", `Propuesta de ${kind}: “${title}”. Revísalo antes de activarlo.`, null, { action: intent.intent, title, areaKey: e.area, date: e.date });
    }

    case "MULTI_CAPTURE": {
      const parts = splitCompound(text);
      const children: CaptureResult[] = [];
      for (const part of parts) {
        const sub = classifyWithRules(part, { today: ctx.today, noSplit: true });
        if (sub.intent === "UNKNOWN" || isQueryIntent(sub.intent)) continue;
        if (!sub.entities.date && e.date && (sub.intent === "CREATE_TASK" || sub.intent === "CREATE_EVENT")) sub.entities.date = e.date;
        const [child] = await ctx.tx.insert(inboxItems).values({ userId: ctx.userId, rawText: part, source }).returning();
        children.push(await applyIntent(ctx, child.id, part, sub, source));
      }
      await ctx.tx.update(inboxItems).set({ status: "ARCHIVED", classifier: intent.classifier, parsed: { ...intentToJson(intent), children: children.map((c) => c.itemId) }, processedAt: ctx.now }).where(eq(inboxItems.id, itemId));
      return { ...base, status: "PROCESSED", message: `${children.length} elementos organizados.`, entity: null, suggestion: null, children };
    }

    default:
      return finish("NEEDS_REVIEW", "Guardado en tu Inbox. No estoy segura de qué es, lo revisamos juntos.", null, null, "UNKNOWN");
  }
}

function formatNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function resultFromItem(item: typeof inboxItems.$inferSelect): CaptureResult {
  return {
    itemId: item.id,
    status: item.status,
    type: item.type,
    intent: ((item.parsed?.intent as IntentResult["intent"]) ?? "UNKNOWN"),
    confidence: item.confidence ?? 0,
    message: "Ya estaba capturado.",
    entity: item.resultEntityId && item.resultEntityType ? { type: item.resultEntityType, id: item.resultEntityId, title: item.rawText } : null,
    redirect: null,
    suggestion: null,
  };
}

// ─── Inbox review actions ───────────────────────────────────────────────────
export async function listInbox(ctx: Ctx, view: "review" | "ideas" | "notes" | "all" = "review") {
  const conditions = [eq(inboxItems.userId, ctx.userId)];
  if (view === "review") conditions.push(inArray(inboxItems.status, ["PENDING", "NEEDS_REVIEW"]));
  if (view === "ideas") conditions.push(eq(inboxItems.type, "IDEA"), inArray(inboxItems.status, ["PROCESSED", "NEEDS_REVIEW"]));
  if (view === "notes") conditions.push(inArray(inboxItems.type, ["NOTE", "RISK", "DOCUMENT_REFERENCE"]), inArray(inboxItems.status, ["PROCESSED", "NEEDS_REVIEW"]));
  return ctx.tx.query.inboxItems.findMany({ where: and(...conditions), orderBy: (t, { desc }) => [desc(t.createdAt)], limit: 200 });
}

async function getItem(ctx: Ctx, id: string) {
  const item = await ctx.tx.query.inboxItems.findFirst({ where: and(eq(inboxItems.id, id), eq(inboxItems.userId, ctx.userId)) });
  if (!item) throw new UserFacingError("No encontré ese elemento del Inbox.", "NOT_FOUND");
  return item;
}

/** Accepts LÍA's suggestion for an item that required confirmation. */
export async function acceptSuggestion(ctx: Ctx, id: string): Promise<CaptureEntity> {
  const item = await getItem(ctx, id);
  const suggestion = (item.parsed?.suggestion ?? null) as { action?: string; taskId?: string; title?: string; areaKey?: string | null; date?: string | null } | null;
  if (!suggestion?.action) throw new UserFacingError("Este elemento no tiene una sugerencia pendiente.");
  let entity: CaptureEntity;
  if (suggestion.action === "COMPLETE_TASK" && suggestion.taskId) {
    const task = await completeTask(ctx, suggestion.taskId);
    entity = { type: "task", id: task.id, title: task.title, href: "/today" };
  } else if (suggestion.action === "CREATE_PROJECT" && suggestion.title) {
    const project = await createProject(ctx, { title: suggestion.title, lifeAreaId: await areaIdByKey(ctx, suggestion.areaKey), status: "PLANNED" }, { createdBy: "LIA" });
    entity = { type: "project", id: project.id, title: project.title, href: `/projects/${project.id}` };
  } else if (suggestion.action === "CREATE_GOAL" && suggestion.title) {
    const goal = await createGoal(ctx, { title: suggestion.title, lifeAreaId: await areaIdByKey(ctx, suggestion.areaKey), deadline: suggestion.date ?? null }, { createdBy: "LIA" });
    entity = { type: "goal", id: goal.id, title: goal.title, href: `/goals/${goal.id}` };
  } else {
    throw new UserFacingError("No pude aplicar esta sugerencia.");
  }
  await ctx.tx.update(inboxItems).set({ status: "PROCESSED", resultEntityType: entity.type, resultEntityId: entity.id, processedAt: ctx.now }).where(eq(inboxItems.id, id));
  return entity;
}

export const ConvertTargetSchema = z.enum(["TASK", "PROJECT", "GOAL", "IDEA", "NOTE"]);

/** Manual conversion — the user corrects LÍA. Recorded as an AI correction signal. */
export async function convertInboxItem(ctx: Ctx, id: string, target: z.infer<typeof ConvertTargetSchema>, title?: string): Promise<CaptureEntity> {
  const item = await getItem(ctx, id);
  const name = (title ?? item.rawText).trim().slice(0, 200);
  let entity: CaptureEntity;
  switch (target) {
    case "TASK": {
      const task = await createTask(ctx, { title: name }, { source: "CAPTURE", inboxItemId: id });
      entity = { type: "task", id: task.id, title: task.title, href: "/today" };
      break;
    }
    case "PROJECT": {
      const p = await createProject(ctx, { title: name, status: "PLANNED" });
      entity = { type: "project", id: p.id, title: p.title, href: `/projects/${p.id}` };
      break;
    }
    case "GOAL": {
      const g = await createGoal(ctx, { title: name });
      entity = { type: "goal", id: g.id, title: g.title, href: `/goals/${g.id}` };
      break;
    }
    default:
      entity = { type: target.toLowerCase(), id, title: name };
  }
  if (item.type !== target && item.type !== "UNKNOWN") await track(ctx, "ai_correction", { from: item.type, to: target });
  await ctx.tx.update(inboxItems).set({ status: "PROCESSED", type: target, resultEntityType: entity.type, resultEntityId: entity.id, processedAt: ctx.now }).where(eq(inboxItems.id, id));
  return entity;
}

export async function archiveInboxItem(ctx: Ctx, id: string) {
  await getItem(ctx, id);
  await ctx.tx.update(inboxItems).set({ status: "ARCHIVED", processedAt: ctx.now }).where(eq(inboxItems.id, id));
}

export function inboxTypeLabel(type: string): string {
  return (INBOX_ITEM_TYPES as readonly string[]).includes(type) ? INBOX_TYPE_LABEL[type as InboxItemType] : type;
}
