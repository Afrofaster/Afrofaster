/**
 * Notification policy (Phase 6). Pure so it can be tested and reused by the
 * scheduled job: never exceed the user's daily budget, dedupe by key, and
 * let critical risks through first.
 */
export type NotificationKind = "MORNING_BRIEF" | "DEADLINE" | "WAITING_FOR" | "WEEKLY_REVIEW" | "MONTHLY_REVIEW" | "CRITICAL_RISK";

export type Candidate = { kind: NotificationKind; dedupeKey: string; title: string };

const RANK: Record<NotificationKind, number> = { CRITICAL_RISK: 0, MORNING_BRIEF: 1, DEADLINE: 2, WAITING_FOR: 3, WEEKLY_REVIEW: 4, MONTHLY_REVIEW: 5 };

export function selectNotifications(candidates: Candidate[], opts: { budget: number; sentToday: number; alreadySentKeys: Set<string> }): Candidate[] {
  const remaining = Math.max(0, opts.budget - opts.sentToday);
  const seen = new Set(opts.alreadySentKeys);
  return [...candidates]
    .sort((a, b) => RANK[a.kind] - RANK[b.kind])
    .filter((c) => (seen.has(c.dedupeKey) ? false : (seen.add(c.dedupeKey), true)))
    .slice(0, remaining);
}
