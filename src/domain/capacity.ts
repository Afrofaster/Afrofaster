/**
 * Capacity engine. The single most important guardrail in LÍA:
 * before adding anything, check whether there is real time for it.
 *
 *   AVAILABLE − FIXED COMMITMENTS − CALENDAR − RECOVERY − PLANNED TASKS = SLACK
 */
import { formatHours } from "./dates";
import type { CapacityLevel } from "./enums";

export type CapacityInput = {
  /** Waking discretionary window per day in minutes (dayEnd − dayStart). */
  dailyWindowMinutes: number;
  days: number;
  restDays: number;
  fixedCommitmentMinutes: number;
  calendarMinutes: number;
  plannedTaskMinutes: number;
  /** Meals, transitions, rest. */
  recoveryMinutesPerDay?: number;
  avgSleepHours?: number | null;
  sleepTargetHours?: number;
  overdueCount?: number;
  activeProjects?: number;
};

export type CapacityResult = {
  level: CapacityLevel;
  availableMinutes: number;
  committedMinutes: number;
  plannedTaskMinutes: number;
  recoveryMinutes: number;
  slackMinutes: number;
  utilization: number;
  signals: string[];
  summary: string;
};

const LEVELS: CapacityLevel[] = ["NORMAL", "HIGH", "OVERLOADED", "CRITICAL"];

export function computeCapacity(input: CapacityInput): CapacityResult {
  const workingDays = Math.max(0, input.days - input.restDays);
  const recoveryPerDay = input.recoveryMinutesPerDay ?? 120;
  const signals: string[] = [];

  let recovery = recoveryPerDay * input.days;
  const sleepTarget = input.sleepTargetHours ?? 7;
  if (input.avgSleepHours !== null && input.avgSleepHours !== undefined && input.avgSleepHours < sleepTarget - 0.5) {
    // Sleep debt must be paid back from the same pool of hours.
    recovery += Math.round((sleepTarget - input.avgSleepHours) * 60 * input.days * 0.5);
    signals.push(`Duermes en promedio ${input.avgSleepHours.toFixed(1)} h (meta ${sleepTarget} h).`);
  }

  // Rest days keep a small window (errands, family) but are not for planned work.
  const available = input.dailyWindowMinutes * workingDays + Math.round(input.dailyWindowMinutes * 0.25 * input.restDays);
  const committed = input.fixedCommitmentMinutes + input.calendarMinutes;
  const usable = Math.max(1, available - recovery);
  const demand = committed + input.plannedTaskMinutes;
  const utilization = demand / usable;
  const slack = usable - demand;

  let levelIndex = utilization < 0.75 ? 0 : utilization < 0.95 ? 1 : utilization < 1.15 ? 2 : 3;
  if (signals.length > 0 && levelIndex < 3 && utilization >= 0.6) levelIndex += 1;
  if ((input.overdueCount ?? 0) >= 10 && levelIndex < 3) {
    levelIndex += 1;
    signals.push(`${input.overdueCount} tareas vencidas acumuladas.`);
  }
  if ((input.activeProjects ?? 0) > 6) signals.push(`${input.activeProjects} proyectos activos a la vez.`);

  const level = LEVELS[levelIndex];
  const summary =
    slack < 0
      ? `No existe capacidad real para todo esto: faltan ${formatHours(-slack)}.`
      : level === "NORMAL"
        ? `Tienes ${formatHours(slack)} de margen.`
        : `Estás cerca del límite: quedan ${formatHours(slack)} de margen.`;

  return {
    level,
    availableMinutes: available,
    committedMinutes: committed,
    plannedTaskMinutes: input.plannedTaskMinutes,
    recoveryMinutes: recovery,
    slackMinutes: slack,
    utilization: Math.round(utilization * 100) / 100,
    signals,
    summary,
  };
}

export type ReliefCandidate = {
  id: string;
  title: string;
  score: number;
  estimatedMinutes: number;
  dueDate: string | null;
  isHardDeadline: boolean;
  energyLow: boolean;
  deferCount: number;
};

export type ReliefAction = "ELIMINATE" | "DELEGATE" | "DEFER" | "REDUCE" | "RENEGOTIATE";

export type ReliefSuggestion = { id: string; title: string; action: ReliefAction; minutes: number; reason: string };

/**
 * Picks the lowest-value work to remove until the overload is covered.
 * Order of preference follows the product rule: eliminate → delegate → defer → reduce.
 */
export function suggestRelief(candidates: ReliefCandidate[], minutesToFree: number): ReliefSuggestion[] {
  if (minutesToFree <= 0) return [];
  const sorted = [...candidates].sort((a, b) => a.score - b.score);
  const out: ReliefSuggestion[] = [];
  let freed = 0;
  for (const c of sorted) {
    if (freed >= minutesToFree) break;
    let action: ReliefAction;
    let reason: string;
    if (c.deferCount >= 3 && c.score < 40) {
      action = "ELIMINATE";
      reason = `La has aplazado ${c.deferCount} veces: probablemente no importa tanto.`;
    } else if (c.energyLow && c.score < 45) {
      action = "DELEGATE";
      reason = "Tarea operativa de bajo impacto: alguien más podría hacerla.";
    } else if (c.isHardDeadline) {
      action = c.estimatedMinutes >= 90 ? "REDUCE" : "RENEGOTIATE";
      reason = c.estimatedMinutes >= 90 ? "Tiene fecha firme: reduce el alcance a lo mínimo viable." : "Tiene fecha firme: negocia un nuevo plazo si puedes.";
    } else if (c.estimatedMinutes >= 120 && c.score < 60) {
      action = "REDUCE";
      reason = "Es grande y no es crítica: define una versión más pequeña.";
    } else {
      action = "DEFER";
      reason = "No es de las más importantes esta semana.";
    }
    const minutes = action === "REDUCE" ? Math.round(c.estimatedMinutes / 2) : c.estimatedMinutes;
    freed += minutes;
    out.push({ id: c.id, title: c.title, action, minutes, reason });
  }
  return out;
}

export const RELIEF_LABEL: Record<ReliefAction, string> = {
  ELIMINATE: "Eliminar",
  DELEGATE: "Delegar",
  DEFER: "Diferir",
  REDUCE: "Reducir",
  RENEGOTIATE: "Renegociar",
};
