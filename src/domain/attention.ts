/**
 * Attention: at most three alerts that matter right now. Silence is a feature.
 */
import { diffDays, type IsoDate } from "./dates";
import type { CapacityLevel } from "./enums";

export type AttentionSeverity = 1 | 2 | 3; // 3 = most important

export type AttentionItem = {
  key: string;
  severity: AttentionSeverity;
  message: string;
  href?: string;
};

export type AttentionInput = {
  today: IsoDate;
  overdueTasks: number;
  staleProjects: Array<{ id: string; title: string; lastActivity: IsoDate }>;
  overdueWaiting: Array<{ id: string; who: string; item: string; since: IsoDate }>;
  urgentDecisions: Array<{ id: string; question: string; deadline: IsoDate }>;
  capacityLevel: CapacityLevel | null;
  criticalFoundations: string[];
  avgSleepHours: number | null;
  pendingInbox: number;
};

export const STALE_PROJECT_DAYS = 7;

export function computeAttention(input: AttentionInput, limit = 3): AttentionItem[] {
  const items: AttentionItem[] = [];

  if (input.capacityLevel === "CRITICAL" || input.capacityLevel === "OVERLOADED") {
    items.push({
      key: "capacity",
      severity: 3,
      message: input.capacityLevel === "CRITICAL" ? "Tu semana está en capacidad crítica. Toca quitar, no añadir." : "Esta semana supera tu capacidad real.",
      href: "/lia?q=estoy%20saturado",
    });
  }
  for (const area of input.criticalFoundations) {
    items.push({ key: `area-${area}`, severity: 3, message: `${area} está en estado crítico.`, href: "/life" });
  }
  if (input.avgSleepHours !== null && input.avgSleepHours < 6) {
    items.push({ key: "sleep", severity: 2, message: `Promedio de sueño de ${input.avgSleepHours.toFixed(1)} h esta semana.`, href: "/metrics" });
  }
  if (input.overdueTasks > 0) {
    items.push({
      key: "overdue",
      severity: input.overdueTasks >= 5 ? 3 : 2,
      message: `${input.overdueTasks} ${input.overdueTasks === 1 ? "tarea vencida" : "tareas vencidas"}.`,
      href: "/today",
    });
  }
  for (const d of input.urgentDecisions) {
    const days = diffDays(input.today, d.deadline);
    items.push({
      key: `decision-${d.id}`,
      severity: days <= 1 ? 3 : 2,
      message: days < 0 ? `Decisión vencida: ${d.question}` : `Decidir ${days === 0 ? "hoy" : days === 1 ? "mañana" : `en ${days} días`}: ${d.question}`,
      href: `/decisions/${d.id}`,
    });
  }
  for (const p of input.staleProjects) {
    const days = diffDays(p.lastActivity, input.today);
    items.push({ key: `project-${p.id}`, severity: days >= 14 ? 2 : 1, message: `${p.title} lleva ${days} días sin movimiento.`, href: `/projects/${p.id}` });
  }
  for (const w of input.overdueWaiting) {
    items.push({ key: `waiting-${w.id}`, severity: 2, message: `Sigues esperando ${w.item} de ${w.who}.`, href: "/waiting" });
  }
  if (input.pendingInbox >= 5) {
    items.push({ key: "inbox", severity: 1, message: `${input.pendingInbox} elementos sin procesar en tu Inbox.`, href: "/inbox" });
  }

  return items.sort((a, b) => b.severity - a.severity).slice(0, limit);
}
