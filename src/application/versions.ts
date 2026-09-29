import type { CreatedBy } from "@/domain/enums";
import { entityVersions } from "@/server/db/schema";
import type { Ctx } from "./context";

/** Records an append-only change for important entities (goals, project status, reviews, scores). */
export async function recordVersion(
  ctx: Ctx,
  entityType: string,
  entityId: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown>,
  changedBy: CreatedBy = "USER",
): Promise<void> {
  const changed = Object.keys(after).filter((k) => JSON.stringify(before?.[k]) !== JSON.stringify(after[k]));
  if (before && changed.length === 0) return;
  await ctx.tx.insert(entityVersions).values({
    userId: ctx.userId,
    entityType,
    entityId,
    changedFields: before ? changed : Object.keys(after),
    before,
    after,
    changedBy,
  });
}
