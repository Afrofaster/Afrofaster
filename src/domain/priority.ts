/**
 * Priority engine — deterministic, configurable and explainable.
 *
 * Every factor is normalized to 0..1. The final score is 0..100.
 * `effort` is a *penalty*: bigger tasks score slightly lower all else equal.
 * The AI can enrich inputs (impact, leverage…), but never the formula.
 */
import { diffDays, type IsoDate } from "./dates";
import type { AreaMode, EnergyLevel, PriorityLevel } from "./enums";

export type PriorityWeights = {
  impact: number;
  alignment: number;
  urgency: number;
  riskReduction: number;
  leverage: number;
  effort: number;
  energy: number;
};

export const DEFAULT_PRIORITY_WEIGHTS: PriorityWeights = {
  impact: 0.25,
  alignment: 0.25,
  urgency: 0.15,
  riskReduction: 0.15,
  leverage: 0.1,
  effort: 0.1,
  energy: 0.05,
};

export type PriorityInput = {
  id: string;
  title: string;
  priority: PriorityLevel;
  dueDate: IsoDate | null;
  scheduledDate: IsoDate | null;
  estimatedMinutes: number | null;
  energy: EnergyLevel | null;
  impact: number | null; // 1..5
  leverage: number | null; // 1..5
  riskReduction: number | null; // 1..5
  projectPriority: PriorityLevel | null;
  goalLinked: boolean;
  goalAtRisk: boolean;
  areaMode: AreaMode | null;
  isLegalDeadline: boolean;
  /** Open tasks in the same project that come after this one (unblocks). */
  dependentsCount: number;
  deferCount: number;
};

export type PriorityContext = {
  today: IsoDate;
  currentEnergy?: EnergyLevel;
  weights?: Partial<PriorityWeights>;
};

export type PriorityFactor = keyof PriorityWeights;

export type PriorityResult = {
  id: string;
  score: number;
  factors: Record<PriorityFactor, number>;
  reasons: string[];
};

const LEVEL_VALUE: Record<PriorityLevel, number> = { LOW: 0.25, MEDIUM: 0.5, HIGH: 0.8, CRITICAL: 1 };
const ENERGY_VALUE: Record<EnergyLevel, number> = { LOW: 1, MEDIUM: 2, HIGH: 3 };

const scale5 = (v: number | null | undefined, fallback: number) =>
  v === null || v === undefined ? fallback : Math.min(1, Math.max(0, (v - 1) / 4));

export function urgencyFromDates(today: IsoDate, dueDate: IsoDate | null, scheduledDate: IsoDate | null): number {
  const ref = dueDate ?? scheduledDate;
  if (!ref) return 0.1;
  const days = diffDays(today, ref);
  if (days < 0) return 1; // overdue
  if (days === 0) return 0.95;
  if (days === 1) return 0.8;
  if (days <= 3) return 0.6;
  if (days <= 7) return 0.4;
  if (days <= 14) return 0.25;
  return 0.1;
}

export function scoreTask(task: PriorityInput, ctx: PriorityContext): PriorityResult {
  const w = { ...DEFAULT_PRIORITY_WEIGHTS, ...ctx.weights };
  const reasons: string[] = [];

  const impact = scale5(task.impact, LEVEL_VALUE[task.priority]);

  let alignment = 0.2;
  if (task.goalLinked) alignment = task.goalAtRisk ? 1 : 0.85;
  else if (task.projectPriority) alignment = 0.3 + LEVEL_VALUE[task.projectPriority] * 0.4;
  if (task.areaMode === "CRITICAL" || task.areaMode === "RECOVERY") alignment = Math.max(alignment, 0.8);
  else if (task.areaMode === "EXPANSION") alignment = Math.min(1, alignment + 0.1);

  const urgency = urgencyFromDates(ctx.today, task.dueDate, task.scheduledDate);

  let riskReduction = scale5(task.riskReduction, 0.2);
  if (task.isLegalDeadline) riskReduction = Math.max(riskReduction, 0.9);
  if (task.dueDate && diffDays(ctx.today, task.dueDate) < 0) riskReduction = Math.max(riskReduction, 0.7);

  const leverage = task.leverage !== null ? scale5(task.leverage, 0.3) : Math.min(1, 0.2 + task.dependentsCount * 0.2);

  const minutes = task.estimatedMinutes ?? 30;
  const effort = minutes <= 15 ? 0 : minutes <= 45 ? 0.2 : minutes <= 90 ? 0.45 : minutes <= 180 ? 0.7 : 1;

  let energy = 0.5;
  if (ctx.currentEnergy && task.energy) {
    const gap = ENERGY_VALUE[task.energy] - ENERGY_VALUE[ctx.currentEnergy];
    energy = gap <= 0 ? 1 : gap === 1 ? 0.4 : 0;
  }

  const raw =
    impact * w.impact +
    alignment * w.alignment +
    urgency * w.urgency +
    riskReduction * w.riskReduction +
    leverage * w.leverage +
    energy * w.energy -
    effort * w.effort;
  const max = w.impact + w.alignment + w.urgency + w.riskReduction + w.leverage + w.energy;
  const score = Math.round(Math.max(0, Math.min(1, raw / max)) * 100);

  // Explainability: human reasons for the strongest signals.
  if (task.dueDate) {
    const days = diffDays(ctx.today, task.dueDate);
    if (days < 0) reasons.push(`está vencida hace ${-days} ${-days === 1 ? "día" : "días"}`);
    else if (days === 0) reasons.push("vence hoy");
    else if (days === 1) reasons.push("vence mañana");
    else if (days <= 3) reasons.push(`vence en ${days} días`);
  }
  if (task.isLegalDeadline) reasons.push("tiene un término jurídico");
  if (task.goalLinked) reasons.push(task.goalAtRisk ? "empuja un objetivo en riesgo" : "empuja uno de tus objetivos");
  if (task.dependentsCount >= 2) reasons.push(`desbloquea ${task.dependentsCount} tareas posteriores`);
  if (task.priority === "CRITICAL" || task.priority === "HIGH") reasons.push("la marcaste como prioridad alta");
  if (task.areaMode === "CRITICAL" || task.areaMode === "RECOVERY") reasons.push("pertenece a un área que necesita atención");
  if (task.deferCount >= 3) reasons.push(`la has aplazado ${task.deferCount} veces`);

  return {
    id: task.id,
    score,
    factors: { impact, alignment, urgency, riskReduction, leverage, effort, energy },
    reasons,
  };
}

export function rankTasks<T extends PriorityInput>(tasks: T[], ctx: PriorityContext): Array<T & { priorityResult: PriorityResult }> {
  return tasks
    .map((t) => ({ ...t, priorityResult: scoreTask(t, ctx) }))
    .sort((a, b) => b.priorityResult.score - a.priorityResult.score || a.title.localeCompare(b.title));
}

export function explainPriority(title: string, rank: number, result: PriorityResult): string {
  const label = rank > 0 ? `Big ${rank}` : "prioritaria";
  if (result.reasons.length === 0) return `“${title}” es ${label} por su impacto relativo frente al resto de pendientes.`;
  const reasons = result.reasons.slice(0, 3);
  const joined = reasons.length === 1 ? reasons[0] : `${reasons.slice(0, -1).join(", ")} y ${reasons[reasons.length - 1]}`;
  return `Lo puse como ${label} porque ${joined}.`;
}
