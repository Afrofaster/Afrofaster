/**
 * Context Builder: sends the model only what the current intent needs —
 * never the whole database. Sensitive categories (health, finances) are
 * included only when the intent is about them.
 */
import type { Ctx } from "@/application/context";
import { eventsOn } from "@/application/events";
import { listGoals } from "@/application/goals";
import { buildDayPlan, getAttention, getBig3, getLifeStatus, getOpenLoops, runCapacityReview, weekCompletion } from "@/application/intelligence";
import { getInsights } from "@/application/insights";
import { searchMemories } from "@/application/memory";
import { recentAverage } from "@/application/metrics";
import { listProjects } from "@/application/projects";
import { addDays, minutesToHHMM } from "@/domain/dates";
import type { Intent } from "./intent/schema";

export type BuiltContext = { text: string; sections: string[] };

export async function buildContext(ctx: Ctx, intent: Intent, message: string, date?: string | null): Promise<BuiltContext> {
  const sections: string[] = [];
  const add = (name: string, body: string) => body.trim() && sections.push(`## ${name}\n${body.trim()}`);

  const memories = await searchMemories(ctx, message, 4);
  if (memories.length) add("Preferencias confirmadas", memories.map((m) => `- ${m.content}`).join("\n"));

  switch (intent) {
    case "PLAN_DAY":
    case "GET_TODAY":
    case "MULTI_CAPTURE": {
      const day = date ?? ctx.today;
      const [events, plan, sleep] = await Promise.all([eventsOn(ctx, day), buildDayPlan(ctx, day), recentAverage(ctx, "sleep_hours", 3)]);
      add(`Agenda ${day}`, events.map((e) => `- ${e.allDay ? "todo el día" : `${minutesToHHMM(e.startMinutes)}–${minutesToHHMM(e.endMinutes)}`} ${e.title}`).join("\n") || "- sin eventos");
      add("Plan propuesto (determinista)", JSON.stringify({ big3: plan.big3.map((b) => ({ title: b.title, reasons: b.reasons })), blocks: plan.blocks, deferred: plan.deferred, conflicts: plan.conflicts, marginMinutes: plan.marginMinutes }));
      if (sleep.avg !== null) add("Sueño reciente", `Promedio ${sleep.avg.toFixed(1)} h (${sleep.count} registros)`);
      break;
    }
    case "CAPACITY_REVIEW": {
      const c = await runCapacityReview(ctx);
      add("Capacidad 7 días", JSON.stringify({ level: c.level, summary: c.summary, signals: c.signals, relief: c.relief, activeProjects: c.activeProjects, openTasks: c.openTasks }));
      break;
    }
    case "EXECUTIVE_STATUS":
    case "WEEKLY_REVIEW": {
      const [status, week, capacity, attention, goals, big3] = await Promise.all([getLifeStatus(ctx), weekCompletion(ctx), runCapacityReview(ctx), getAttention(ctx, null), listGoals(ctx, { statuses: ["ACTIVE", "AT_RISK"] }), getBig3(ctx)]);
      add("Life Score", status.lifeScore.explanation);
      add("Áreas activas", status.areas.filter((a) => a.status === "ACTIVE").map((a) => `- ${a.name}: ${a.score ?? "sin evaluar"} (${a.health})`).join("\n"));
      add("Objetivos", goals.map((g) => `- ${g.title}: ${g.status}${g.progress !== null ? `, ${g.progress}%` : ""}`).join("\n"));
      add("Semana", `Tareas completadas desde el lunes: ${week.completed}`);
      add("Big 3 hoy", big3.map((b) => `${b.rank}. ${b.title}${b.done ? " ✓" : ""}`).join("\n"));
      add("Capacidad", `${capacity.level}: ${capacity.summary}`);
      add("Atención", attention.map((a) => `- ${a.message}`).join("\n"));
      const patterns = await getInsights(ctx);
      if (patterns.insights.length) add("Patrones con datos suficientes", patterns.insights.map((i) => `- ${i.message} (${i.sample})`).join("\n"));
      break;
    }
    case "GET_OPEN_LOOPS": {
      const loops = await getOpenLoops(ctx);
      add("Bucles abiertos", JSON.stringify(loops));
      break;
    }
    case "CREATE_PROJECT":
    case "DECISION_FLOW":
    case "GENERAL":
    case "UNKNOWN": {
      const [projects, capacity] = await Promise.all([listProjects(ctx, { statuses: ["ACTIVE"] }), runCapacityReview(ctx)]);
      add("Proyectos activos", projects.map((p) => `- ${p.title} (${p.computedProgress}%)`).join("\n") || "- ninguno");
      add("Capacidad", `${capacity.level}: ${capacity.summary}`);
      break;
    }
    default:
      break;
  }
  add("Fechas", `Hoy ${ctx.today}; mañana ${addDays(ctx.today, 1)}.`);
  return { text: sections.join("\n\n"), sections };
}
