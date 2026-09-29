/**
 * Day planner: turns ranked tasks + fixed time into a realistic proposal.
 * Deterministic so it is testable; LÍA only narrates the result.
 */
import { diffDays, formatHours, hhmmToMinutes, minutesToHHMM, type IsoDate } from "./dates";

export type FixedBlock = { title: string; start: number; end: number; kind: "EVENT" | "COMMITMENT" };

export type PlannableTask = {
  id: string;
  title: string;
  score: number;
  estimatedMinutes: number | null;
  dueDate: IsoDate | null;
  energy: "LOW" | "MEDIUM" | "HIGH" | null;
  reasons: string[];
  isTraining?: boolean;
};

export type PlanBlock = {
  start: string;
  end: string;
  title: string;
  kind: "EVENT" | "COMMITMENT" | "DEEP_WORK" | "TASK" | "TRAINING";
  taskId?: string;
};

export type DayPlan = {
  date: IsoDate;
  big3: Array<{ taskId: string; title: string; reasons: string[] }>;
  blocks: PlanBlock[];
  deferred: Array<{ taskId: string; title: string; reason: string }>;
  conflicts: string[];
  capacityMinutes: number;
  plannedMinutes: number;
  fixedMinutes: number;
  marginMinutes: number;
  utilization: number;
  summary: string;
};

export type PlanDayInput = {
  date: IsoDate;
  today: IsoDate;
  dayStart: string;
  dayEnd: string;
  /** For today: don't plan in the past. */
  nowMinutes?: number;
  fixed: FixedBlock[];
  tasks: PlannableTask[];
  deepWorkMinutes?: number;
  bufferRatio?: number;
  confirmedBig3?: string[];
};

const DEFAULT_ESTIMATE = 30;

export function planDay(input: PlanDayInput): DayPlan {
  const dayStart = hhmmToMinutes(input.dayStart);
  const dayEnd = hhmmToMinutes(input.dayEnd);
  const startAt = input.date === input.today && input.nowMinutes !== undefined ? Math.max(dayStart, roundUp(input.nowMinutes, 15)) : dayStart;
  const bufferRatio = input.bufferRatio ?? 0.15;
  const conflicts: string[] = [];

  const fixed = [...input.fixed].sort((a, b) => a.start - b.start);
  for (let i = 1; i < fixed.length; i++) {
    if (fixed[i].start < fixed[i - 1].end) conflicts.push(`“${fixed[i - 1].title}” se cruza con “${fixed[i].title}”.`);
  }

  // Free slots between fixed blocks, inside the working window.
  const slots: Array<{ start: number; end: number }> = [];
  let cursor = startAt;
  for (const block of fixed) {
    if (block.end <= cursor) continue;
    if (block.start > cursor) slots.push({ start: cursor, end: Math.min(block.start, dayEnd) });
    cursor = Math.max(cursor, block.end);
  }
  if (cursor < dayEnd) slots.push({ start: cursor, end: dayEnd });
  const usableSlots = slots.filter((s) => s.end - s.start >= 15);

  const freeMinutes = usableSlots.reduce((s, x) => s + (x.end - x.start), 0);
  const fixedMinutes = fixed.reduce((s, b) => s + Math.max(0, Math.min(b.end, dayEnd) - Math.max(b.start, startAt)), 0);
  const capacity = Math.floor(freeMinutes * (1 - bufferRatio));

  // Big 3: user-confirmed first, then highest score.
  const byId = new Map(input.tasks.map((t) => [t.id, t]));
  const confirmed = (input.confirmedBig3 ?? []).map((id) => byId.get(id)).filter((t): t is PlannableTask => Boolean(t));
  const rest = input.tasks.filter((t) => !confirmed.some((c) => c.id === t.id) && !t.isTraining).sort((a, b) => b.score - a.score);
  const big3 = [...confirmed, ...rest].slice(0, 3);

  // Placement order: Big 1 into the first long slot (deep work), then the rest.
  const ordered = [...big3, ...rest.filter((t) => !big3.includes(t)), ...input.tasks.filter((t) => t.isTraining)];
  const blocks: PlanBlock[] = fixed.map((f) => ({ start: minutesToHHMM(f.start), end: minutesToHHMM(f.end), title: f.title, kind: f.kind }));
  const deferred: DayPlan["deferred"] = [];
  let planned = 0;

  const remaining = usableSlots.map((s) => ({ ...s }));
  for (const [index, task] of ordered.entries()) {
    const isBig1 = index === 0 && big3.length > 0;
    const minutes = isBig1 ? Math.max(task.estimatedMinutes ?? DEFAULT_ESTIMATE, Math.min(input.deepWorkMinutes ?? 90, 120)) : task.estimatedMinutes ?? DEFAULT_ESTIMATE;
    if (planned + minutes > capacity && !isHardToday(task, input.date)) {
      deferred.push({ taskId: task.id, title: task.title, reason: "No cabe con margen hoy." });
      continue;
    }
    const slot = task.isTraining ? lastFitting(remaining, minutes) : remaining.find((s) => s.end - s.start >= minutes);
    if (!slot) {
      if (isHardToday(task, input.date)) conflicts.push(`“${task.title}” vence y no hay un bloque libre de ${formatHours(minutes)}.`);
      deferred.push({ taskId: task.id, title: task.title, reason: "No hay un bloque libre suficiente." });
      continue;
    }
    const start = task.isTraining ? slot.end - minutes : slot.start;
    const end = start + minutes;
    if (task.isTraining) slot.end = start;
    else slot.start = end;
    planned += minutes;
    blocks.push({
      start: minutesToHHMM(start),
      end: minutesToHHMM(end),
      title: task.title,
      kind: task.isTraining ? "TRAINING" : isBig1 && minutes >= 60 ? "DEEP_WORK" : "TASK",
      taskId: task.id,
    });
  }

  blocks.sort((a, b) => a.start.localeCompare(b.start));
  const margin = Math.max(0, freeMinutes - planned);
  const utilization = freeMinutes === 0 ? 1 : planned / freeMinutes;
  const summary = buildSummary({ big3, planned, margin, deferred: deferred.length, utilization, fixedMinutes });

  return {
    date: input.date,
    big3: big3.map((t) => ({ taskId: t.id, title: t.title, reasons: t.reasons })),
    blocks,
    deferred,
    conflicts,
    capacityMinutes: freeMinutes,
    plannedMinutes: planned,
    fixedMinutes,
    marginMinutes: margin,
    utilization: Math.round(utilization * 100) / 100,
    summary,
  };
}

function isHardToday(task: PlannableTask, date: IsoDate): boolean {
  return task.dueDate !== null && diffDays(date, task.dueDate) <= 0;
}

function lastFitting(slots: Array<{ start: number; end: number }>, minutes: number) {
  for (let i = slots.length - 1; i >= 0; i--) if (slots[i].end - slots[i].start >= minutes) return slots[i];
  return undefined;
}

function roundUp(value: number, step: number): number {
  return Math.ceil(value / step) * step;
}

function buildSummary(p: { big3: PlannableTask[]; planned: number; margin: number; deferred: number; utilization: number; fixedMinutes: number }): string {
  const tight = p.utilization > 0.8 || p.fixedMinutes > 6 * 60;
  const parts = [tight ? "Tu día está ajustado." : "Tu día tiene espacio."];
  if (p.big3[0]) parts.push(`Big 1: ${p.big3[0].title}.`);
  parts.push(`Te dejo aproximadamente ${formatHours(p.margin)} de margen para imprevistos.`);
  if (p.deferred > 0) parts.push(`${p.deferred} ${p.deferred === 1 ? "tarea queda" : "tareas quedan"} fuera para no sobrecargarte.`);
  return parts.join(" ");
}
