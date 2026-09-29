/**
 * Hourly background job: calendar sync + notification planning + push.
 * Runs per user inside that user's RLS scope; one user's failure never
 * stops the others.
 */
import { isNull } from "drizzle-orm";
import { log } from "@/lib/logger";
import { withAuthContext, type Db } from "@/server/db/factory";
import { users } from "@/server/db/schema";
import type { PushTarget } from "@/integrations/push";
import { getCalendarConnection, syncCalendar } from "./calendar";
import { runAsUser } from "./context";
import { listPushSubscriptions, markSent, planNotifications, removePushSubscription } from "./notifications";

export type JobDeps = {
  sendPush?: (target: PushTarget, payload: { title: string; body?: string; href?: string }) => Promise<"ok" | "gone" | "error">;
  syncCalendars?: boolean;
  now?: Date;
};

export async function runHourlyJobs(db: Db, deps: JobDeps = {}) {
  const userRows = await withAuthContext(db, (tx) => tx.select({ id: users.id }).from(users).where(isNull(users.deletedAt)));
  const summary = { users: userRows.length, notifications: 0, pushed: 0, synced: 0, errors: 0 };
  for (const { id } of userRows) {
    try {
      if (deps.syncCalendars) {
        const connected = await runAsUser(db, id, (ctx) => getCalendarConnection(ctx), deps.now);
        if (connected?.status === "CONNECTED") {
          await runAsUser(db, id, (ctx) => syncCalendar(ctx), deps.now)
            .then(() => (summary.synced += 1))
            .catch((err) => log.warn("job.calendar_sync_failed", { err }));
        }
      }
      const selected = await runAsUser(db, id, (ctx) => planNotifications(ctx), deps.now);
      summary.notifications += selected.length;
      if (selected.length === 0 || !deps.sendPush) continue;
      const subs = await runAsUser(db, id, (ctx) => listPushSubscriptions(ctx), deps.now);
      const delivered: string[] = [];
      for (const n of selected) {
        for (const s of subs) {
          const r = await deps.sendPush({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, { title: n.title, body: n.body, href: n.href });
          if (r === "ok") {
            summary.pushed += 1;
            delivered.push(n.dedupeKey);
          }
          if (r === "gone") await runAsUser(db, id, (ctx) => removePushSubscription(ctx, s.endpoint), deps.now);
        }
      }
      await runAsUser(db, id, (ctx) => markSent(ctx, [...new Set(delivered)]), deps.now);
    } catch (err) {
      summary.errors += 1;
      log.error("job.user_failed", { err });
    }
  }
  return summary;
}
