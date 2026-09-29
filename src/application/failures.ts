import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { isValidIsoDate } from "@/domain/dates";
import { failureLogs } from "@/server/db/schema";
import { UserFacingError, type Ctx } from "./context";

/** Failure log: learning from misses without blame. Focus on systems, not guilt. */
export const FailureSchema = z.object({
  event: z.string().trim().min(3, "Describe qué pasó").max(500),
  cause: z.string().trim().max(1000).nullish(),
  rootCause: z.string().trim().max(1000).nullish(),
  controllable: z.boolean().nullish(),
  systemFailure: z.boolean().nullish(),
  correction: z.string().trim().max(1000).nullish(),
  followUp: z.string().trim().max(500).nullish(),
  occurredAt: z.string().refine(isValidIsoDate).nullish(),
});

export async function createFailure(ctx: Ctx, input: z.infer<typeof FailureSchema>) {
  const data = FailureSchema.parse(input);
  const [row] = await ctx.tx.insert(failureLogs).values({ userId: ctx.userId, ...data, occurredAt: data.occurredAt ?? ctx.today }).returning();
  return row;
}

export async function listFailures(ctx: Ctx) {
  return ctx.tx.select().from(failureLogs).where(eq(failureLogs.userId, ctx.userId)).orderBy(desc(failureLogs.occurredAt), desc(failureLogs.createdAt)).limit(100);
}

export async function deleteFailure(ctx: Ctx, id: string) {
  const res = await ctx.tx.delete(failureLogs).where(and(eq(failureLogs.id, id), eq(failureLogs.userId, ctx.userId))).returning({ id: failureLogs.id });
  if (!res.length) throw new UserFacingError("No encontré ese registro.", "NOT_FOUND");
}

/** Share of logged misses caused by the system (not willpower) — the actionable part. */
export function systemShare(rows: Array<{ systemFailure: boolean | null }>): number | null {
  const known = rows.filter((r) => r.systemFailure !== null);
  if (known.length < 3) return null;
  return Math.round((known.filter((r) => r.systemFailure).length / known.length) * 100);
}
