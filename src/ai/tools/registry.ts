/**
 * LÍA tools. The model never touches the database: it can only call these,
 * every argument is validated with Zod, and sensitive tools are turned into
 * pending actions that the user must confirm.
 */
import { z } from "zod";
import type { Ctx } from "@/application/context";
import { acceptSuggestion, applyIntent } from "@/application/capture";
import { classifyWithRules } from "@/ai/intent/rules";
import { createDecision } from "@/application/decisions";
import { createGoal } from "@/application/goals";
import { buildDayPlan, getLifeStatus, getOpenLoops, runCapacityReview, setBig3 } from "@/application/intelligence";
import { logMetric } from "@/application/metrics";
import { createProject } from "@/application/projects";
import { globalSearch } from "@/application/search";
import { completeTask, createTask, listTasks, updateTask } from "@/application/tasks";
import { createWaitingFor } from "@/application/waiting";
import { areaIdByKey } from "@/application/areas";
import { eventsOn } from "@/application/events";
import { inboxItems } from "@/server/db/schema";
import { ENERGY_LEVELS, PRIORITY_LEVELS, PROJECT_STATUSES, TASK_STATUSES } from "@/domain/enums";
import { isValidIsoDate } from "@/domain/dates";

const isoDate = z.string().refine(isValidIsoDate, "Fecha YYYY-MM-DD");
const nullableDate = isoDate.nullable();

export type ToolResult = { summary: string; data?: unknown; href?: string };

export type ToolDef<S extends z.ZodTypeAny = z.ZodTypeAny> = {
  name: string;
  description: string;
  parameters: S;
  /** Sensitive tools are never executed directly by the model. */
  requiresConfirmation: boolean;
  /** Human sentence for the confirmation card. */
  describe: (args: z.infer<S>) => string;
  execute: (ctx: Ctx, args: z.infer<S>) => Promise<ToolResult>;
};

function tool<S extends z.ZodTypeAny>(def: ToolDef<S>): ToolDef<S> {
  return def;
}

export const TOOLS = [
  tool({
    name: "capture_item",
    description: "Guarda cualquier pensamiento en el Inbox y lo organiza automáticamente (tarea, idea, nota, gasto, métrica…). Úsalo cuando el usuario comparte algo para recordar.",
    parameters: z.object({ text: z.string().min(1).max(2000) }),
    requiresConfirmation: false,
    describe: (a) => `Capturar: “${a.text}”`,
    execute: async (ctx, a) => {
      const [item] = await ctx.tx.insert(inboxItems).values({ userId: ctx.userId, rawText: a.text, source: "CHAT" }).returning();
      const r = await applyIntent(ctx, item.id, a.text, classifyWithRules(a.text, { today: ctx.today }), "CHAT");
      return { summary: r.message, data: r.entity, href: r.entity?.href };
    },
  }),
  tool({
    name: "create_task",
    description: "Crea una tarea. scheduled_date = cuándo hacerla; due_date = fecha límite real.",
    parameters: z.object({
      title: z.string().min(1).max(300),
      description: z.string().max(2000).nullable(),
      due_date: nullableDate,
      scheduled_date: nullableDate,
      estimated_minutes: z.number().int().positive().max(1440).nullable(),
      energy: z.enum(ENERGY_LEVELS).nullable(),
      priority: z.enum(PRIORITY_LEVELS).nullable(),
      area_key: z.string().nullable(),
      project_id: z.string().uuid().nullable(),
    }),
    requiresConfirmation: false,
    describe: (a) => `Crear tarea: ${a.title}`,
    execute: async (ctx, a) => {
      const t = await createTask(ctx, { title: a.title, description: a.description, dueDate: a.due_date, scheduledDate: a.scheduled_date, estimatedMinutes: a.estimated_minutes, energy: a.energy, priority: a.priority ?? undefined, lifeAreaId: await areaIdByKey(ctx, a.area_key), projectId: a.project_id }, { createdBy: "LIA", source: "LIA" });
      return { summary: `Tarea creada: ${t.title}`, data: { id: t.id }, href: "/today" };
    },
  }),
  tool({
    name: "update_task",
    description: "Modifica una tarea existente (estado, prioridad, fechas, proyecto, estimación, descripción). Requiere confirmación.",
    parameters: z.object({
      task_id: z.string().uuid(),
      status: z.enum(TASK_STATUSES).nullable(),
      priority: z.enum(PRIORITY_LEVELS).nullable(),
      due_date: nullableDate,
      scheduled_date: nullableDate,
      estimated_minutes: z.number().int().positive().max(1440).nullable(),
      description: z.string().max(2000).nullable(),
    }),
    requiresConfirmation: true,
    describe: (a) => `Actualizar tarea${a.scheduled_date ? ` → ${a.scheduled_date}` : ""}${a.priority ? ` · prioridad ${a.priority.toLowerCase()}` : ""}${a.status ? ` · ${a.status.toLowerCase()}` : ""}`,
    execute: async (ctx, a) => {
      const patch: Record<string, unknown> = {};
      if (a.status) patch.status = a.status;
      if (a.priority) patch.priority = a.priority;
      if (a.due_date) patch.dueDate = a.due_date;
      if (a.scheduled_date) patch.scheduledDate = a.scheduled_date;
      if (a.estimated_minutes) patch.estimatedMinutes = a.estimated_minutes;
      if (a.description) patch.description = a.description;
      const t = await updateTask(ctx, a.task_id, patch);
      return { summary: `Actualicé “${t.title}”.`, href: "/tasks" };
    },
  }),
  tool({
    name: "complete_task",
    description: "Marca una tarea como hecha (registra completed_at, nunca borra). Requiere confirmación.",
    parameters: z.object({ task_id: z.string().uuid(), title: z.string().nullable() }),
    requiresConfirmation: true,
    describe: (a) => `Marcar como hecha: ${a.title ?? "la tarea"}`,
    execute: async (ctx, a) => {
      const t = await completeTask(ctx, a.task_id);
      return { summary: `Hecho: ${t.title} ✓`, href: "/today" };
    },
  }),
  tool({
    name: "create_project",
    description: "Crea un proyecto (resultado que requiere varias acciones). Antes considera capacidad y duplicados. Requiere confirmación.",
    parameters: z.object({ title: z.string().min(1).max(200), desired_outcome: z.string().max(1000).nullable(), area_key: z.string().nullable(), status: z.enum(PROJECT_STATUSES).nullable(), target_date: nullableDate }),
    requiresConfirmation: true,
    describe: (a) => `Crear proyecto${a.status === "IDEA" ? " (como idea)" : ""}: ${a.title}`,
    execute: async (ctx, a) => {
      const p = await createProject(ctx, { title: a.title, desiredOutcome: a.desired_outcome, lifeAreaId: await areaIdByKey(ctx, a.area_key), status: a.status ?? "PLANNED", targetDate: a.target_date }, { createdBy: "LIA" });
      return { summary: `Proyecto creado: ${p.title}`, href: `/projects/${p.id}` };
    },
  }),
  tool({
    name: "create_goal",
    description: "Crea un objetivo medible con fecha. Requiere confirmación.",
    parameters: z.object({ title: z.string().min(1).max(200), outcome: z.string().max(1000).nullable(), metric: z.string().max(200).nullable(), baseline: z.number().nullable(), target: z.number().nullable(), deadline: nullableDate, area_key: z.string().nullable() }),
    requiresConfirmation: true,
    describe: (a) => `Crear objetivo: ${a.title}`,
    execute: async (ctx, a) => {
      const g = await createGoal(ctx, { title: a.title, outcome: a.outcome, metric: a.metric, baseline: a.baseline, target: a.target, deadline: a.deadline, lifeAreaId: await areaIdByKey(ctx, a.area_key) }, { createdBy: "LIA" });
      return { summary: `Objetivo creado: ${g.title}`, href: `/goals/${g.id}` };
    },
  }),
  tool({
    name: "create_waiting_for",
    description: "Registra algo que el usuario espera de otra persona, para hacer seguimiento.",
    parameters: z.object({ person: z.string().min(1).max(120), expected_item: z.string().max(300).nullable(), expected_date: nullableDate }),
    requiresConfirmation: false,
    describe: (a) => `Seguimiento: ${a.expected_item ?? "pendiente"} de ${a.person}`,
    execute: async (ctx, a) => {
      const { waiting, person } = await createWaitingFor(ctx, { person: a.person, expectedItem: a.expected_item, expectedDate: a.expected_date });
      return { summary: `En espera: ${waiting.expectedItem} de ${person.name}.`, href: "/waiting" };
    },
  }),
  tool({
    name: "log_metric",
    description: "Registra una métrica: sleep_hours, weight, deep_work_minutes, training_minutes, mood, energy.",
    parameters: z.object({ key: z.string().min(1).max(40), value: z.number(), date: nullableDate }),
    requiresConfirmation: false,
    describe: (a) => `Registrar ${a.key} = ${a.value}`,
    execute: async (ctx, a) => {
      const { metric } = await logMetric(ctx, a.key, a.value, a.date ?? ctx.today);
      return { summary: `${metric.name}: ${a.value} registrado.`, href: "/metrics" };
    },
  }),
  tool({
    name: "create_decision",
    description: "Abre una decisión en el diario de decisiones (pregunta, contexto, opciones, fecha límite).",
    parameters: z.object({ question: z.string().min(3).max(500), context: z.string().max(3000).nullable(), options: z.array(z.string().max(200)).max(6), deadline: nullableDate }),
    requiresConfirmation: false,
    describe: (a) => `Abrir decisión: ${a.question}`,
    execute: async (ctx, a) => {
      const d = await createDecision(ctx, { question: a.question, context: a.context, options: a.options, deadline: a.deadline });
      return { summary: `Decisión abierta: ${d.question}`, href: `/decisions/${d.id}` };
    },
  }),
  tool({
    name: "get_today",
    description: "Obtiene agenda, tareas y prioridades de una fecha (por defecto hoy).",
    parameters: z.object({ date: nullableDate }),
    requiresConfirmation: false,
    describe: () => "Consultar el día",
    execute: async (ctx, a) => {
      const date = a.date ?? ctx.today;
      const [events, tasks] = await Promise.all([eventsOn(ctx, date), listTasks(ctx, { kind: "date", date })]);
      return { summary: `${events.length} eventos y ${tasks.length} tareas para ${date}.`, data: { events: events.map((e) => ({ title: e.title, start: e.startMinutes, end: e.endMinutes })), tasks: tasks.map((t) => ({ id: t.id, title: t.title, due: t.dueDate, project: t.projectTitle })) } };
    },
  }),
  tool({
    name: "get_open_loops",
    description: "Bucles abiertos: acciones requeridas, en espera, decisiones pendientes y vencidas.",
    parameters: z.object({}),
    requiresConfirmation: false,
    describe: () => "Consultar pendientes",
    execute: async (ctx) => {
      const loops = await getOpenLoops(ctx);
      return { summary: `${loops.actionRequired.length} acciones clave, ${loops.waitingFor.length} en espera, ${loops.decisionRequired.length} decisiones, ${loops.overdue.length} vencidas.`, data: loops };
    },
  }),
  tool({
    name: "get_life_status",
    description: "Snapshot de todas las áreas de vida y el Life Score explicado.",
    parameters: z.object({}),
    requiresConfirmation: false,
    describe: () => "Consultar estado de vida",
    execute: async (ctx) => {
      const s = await getLifeStatus(ctx);
      return { summary: s.lifeScore.explanation, data: { lifeScore: s.lifeScore.score, delta: s.lifeScore.delta, areas: s.areas.filter((a) => a.status === "ACTIVE").map((a) => ({ name: a.name, score: a.score, health: a.health, mode: a.mode })), goalsAtRisk: s.goalsAtRisk } };
    },
  }),
  tool({
    name: "plan_day",
    description: "Propone el plan realista de un día: Big 3, bloques, capacidad usada, conflictos y tareas diferidas.",
    parameters: z.object({ date: nullableDate }),
    requiresConfirmation: false,
    describe: () => "Planear el día",
    execute: async (ctx, a) => {
      const plan = await buildDayPlan(ctx, a.date ?? ctx.today);
      return { summary: plan.summary, data: plan };
    },
  }),
  tool({
    name: "run_capacity_review",
    description: "Analiza la capacidad de los próximos 7 días y sugiere qué eliminar, delegar, diferir o reducir.",
    parameters: z.object({}),
    requiresConfirmation: false,
    describe: () => "Revisar capacidad",
    execute: async (ctx) => {
      const c = await runCapacityReview(ctx);
      return { summary: `${c.level}: ${c.summary}`, data: { level: c.level, summary: c.summary, signals: c.signals, relief: c.relief } };
    },
  }),
  tool({
    name: "set_big3",
    description: "Fija el Big 3 confirmado por el usuario para una fecha. Requiere confirmación.",
    parameters: z.object({ date: isoDate, task_ids: z.array(z.string().uuid()).min(1).max(3), titles: z.array(z.string()).max(3) }),
    requiresConfirmation: true,
    describe: (a) => `Confirmar Big 3: ${a.titles.join(" · ")}`,
    execute: async (ctx, a) => {
      await setBig3(ctx, a.date, a.task_ids, "USER_CONFIRMED");
      return { summary: "Big 3 confirmado.", href: "/today" };
    },
  }),
  tool({
    name: "accept_inbox_suggestion",
    description: "Aplica la sugerencia pendiente de un elemento del Inbox. Requiere confirmación.",
    parameters: z.object({ item_id: z.string().uuid(), label: z.string() }),
    requiresConfirmation: true,
    describe: (a) => a.label,
    execute: async (ctx, a) => {
      const e = await acceptSuggestion(ctx, a.item_id);
      return { summary: `Listo: ${e.title}`, href: e.href };
    },
  }),
  tool({
    name: "search",
    description: "Busca en tareas, proyectos, objetivos, personas, decisiones y notas.",
    parameters: z.object({ query: z.string().min(2).max(100) }),
    requiresConfirmation: false,
    describe: (a) => `Buscar “${a.query}”`,
    execute: async (ctx, a) => {
      const hits = await globalSearch(ctx, a.query, 5);
      return { summary: `${hits.length} resultados.`, data: hits };
    },
  }),
] as const;

export type ToolName = (typeof TOOLS)[number]["name"];

export function getTool(name: string): ToolDef | undefined {
  return (TOOLS as readonly ToolDef[]).find((t) => t.name === name);
}

/** Used by tests and the confirm endpoint: validate args before anything runs. */
export function parseToolArgs(name: string, args: unknown): { ok: true; tool: ToolDef; args: unknown } | { ok: false; error: string } {
  const t = getTool(name);
  if (!t) return { ok: false, error: `Herramienta desconocida: ${name}` };
  const parsed = t.parameters.safeParse(args);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Argumentos inválidos" };
  return { ok: true, tool: t, args: parsed.data };
}

