import { eq } from "drizzle-orm";
import { productEvents, userProfiles } from "@/server/db/schema";
import { log } from "@/lib/logger";
import type { Ctx } from "./context";

export type ProductEventName =
  | "capture_created"
  | "task_completed"
  | "review_completed"
  | "feature_used"
  | "plan_generated"
  | "ai_correction";

/** Opt-out product analytics: only event names and small enum-like props, never free text. */
export async function track(ctx: Ctx, name: ProductEventName, props: Record<string, string | number | boolean> = {}): Promise<void> {
  try {
    const profile = await ctx.tx.query.userProfiles.findFirst({ where: eq(userProfiles.userId, ctx.userId), columns: { analyticsEnabled: true } });
    if (profile && !profile.analyticsEnabled) return;
    // Savepoint: an analytics failure must never abort the user's transaction.
    await ctx.tx.transaction(async (sp) => {
      await sp.insert(productEvents).values({ userId: ctx.userId, name, props });
    });
  } catch (err) {
    log.warn("analytics.failed", { name, err });
  }
}
