/**
 * Notification policy (Phase 6). Pure so it can be tested and reused by the
 * scheduled job: only useful notifications, at the right local hour, never
 * above the user's daily budget, deduped, critical risks first.
 */
export type NotificationKind = "MORNING_BRIEF" | "DEADLINE" | "WAITING_FOR" | "WEEKLY_REVIEW" | "MONTHLY_REVIEW" | "CRITICAL_RISK";

export type Candidate = { kind: NotificationKind; dedupeKey: string; title: string; body?: string; href?: string };

const RANK: Record<NotificationKind, number> = { CRITICAL_RISK: 0, MORNING_BRIEF: 1, DEADLINE: 2, WAITING_FOR: 3, WEEKLY_REVIEW: 4, MONTHLY_REVIEW: 5 };

export function selectNotifications(candidates: Candidate[], opts: { budget: number; sentToday: number; alreadySentKeys: Set<string> }): Candidate[] {
  const remaining = Math.max(0, opts.budget - opts.sentToday);
  const seen = new Set(opts.alreadySentKeys);
  return [...candidates]
    .sort((a, b) => RANK[a.kind] - RANK[b.kind])
    .filter((c) => (seen.has(c.dedupeKey) ? false : (seen.add(c.dedupeKey), true)))
    .slice(0, remaining);
}

export type CandidateInput = {
  today: string;
  hour: number;
  weekday: number; // 0 = Sunday
  isLastDayOfMonth: boolean;
  weekStart: string;
  briefHour: number;
  big1: string | null;
  dueSoon: Array<{ id: string; title: string; dueDate: string }>;
  followUps: Array<{ id: string; who: string; item: string }>;
  weeklyReviewDone: boolean;
  monthlyReviewDone: boolean;
  capacityLevel: "NORMAL" | "HIGH" | "OVERLOADED" | "CRITICAL" | null;
};

/** A window of a few hours so a missed hourly run still delivers once (dedupe keeps it single). */
const inWindow = (hour: number, start: number, span = 3) => hour >= start && hour < start + span;

export function buildCandidates(i: CandidateInput): Candidate[] {
  const out: Candidate[] = [];
  if (inWindow(i.hour, i.briefHour)) {
    out.push({ kind: "MORNING_BRIEF", dedupeKey: `brief:${i.today}`, title: "Tu Daily Brief está listo", body: i.big1 ? `Big 1: ${i.big1}` : "Revisa tu día en un minuto.", href: "/brief" });
  }
  if (inWindow(i.hour, i.briefHour + 1) && i.dueSoon.length > 0) {
    const first = i.dueSoon[0];
    out.push({
      kind: "DEADLINE",
      dedupeKey: `deadline:${i.today}`,
      title: i.dueSoon.length === 1 ? `Vence pronto: ${first.title}` : `${i.dueSoon.length} tareas vencen pronto`,
      body: i.dueSoon.slice(0, 3).map((t) => t.title).join(" · "),
      href: "/today",
    });
  }
  if (inWindow(i.hour, 10)) {
    for (const f of i.followUps.slice(0, 2)) {
      out.push({ kind: "WAITING_FOR", dedupeKey: `waiting:${f.id}:${i.today}`, title: `Sigues esperando ${f.item}`, body: `De ${f.who}. ¿Le haces seguimiento?`, href: "/waiting" });
    }
  }
  if (i.weekday === 0 && inWindow(i.hour, 17) && !i.weeklyReviewDone) {
    out.push({ kind: "WEEKLY_REVIEW", dedupeKey: `weekly:${i.weekStart}`, title: "Hora de tu CEO Meeting semanal", body: "10 minutos para ver qué cambió y qué sigue.", href: "/reviews/weekly" });
  }
  if (i.isLastDayOfMonth && inWindow(i.hour, 17) && !i.monthlyReviewDone) {
    out.push({ kind: "MONTHLY_REVIEW", dedupeKey: `monthly:${i.today.slice(0, 7)}`, title: "Cierra el mes con tu Monthly Board", href: "/reviews/monthly" });
  }
  if (i.capacityLevel === "CRITICAL" && i.hour >= 8 && i.hour < 20) {
    out.push({ kind: "CRITICAL_RISK", dedupeKey: `risk:capacity:${i.weekStart}`, title: "Tu semana está en capacidad crítica", body: "Antes de añadir nada, decidamos qué sale.", href: "/lia?q=estoy%20saturado" });
  }
  return out;
}
