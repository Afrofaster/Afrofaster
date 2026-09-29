import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { isValidIsoDate } from "@/domain/dates";
import { decisionOptions, decisions, type DecisionAnalysis } from "@/server/db/schema";
import { UserFacingError, type Ctx } from "./context";

export const DecisionCreateSchema = z.object({
  question: z.string().trim().min(3).max(500),
  context: z.string().trim().max(5000).nullish(),
  deadline: z.string().refine(isValidIsoDate).nullish(),
  options: z.array(z.string().trim().min(1).max(200)).max(8).nullish(),
  lifeAreaId: z.string().uuid().nullish(),
  projectId: z.string().uuid().nullish(),
});

export type DecisionRow = typeof decisions.$inferSelect;
export type DecisionOptionRow = typeof decisionOptions.$inferSelect;

export async function createDecision(ctx: Ctx, input: z.infer<typeof DecisionCreateSchema>, inboxItemId: string | null = null): Promise<DecisionRow> {
  const data = DecisionCreateSchema.parse(input);
  const [row] = await ctx.tx
    .insert(decisions)
    .values({
      userId: ctx.userId,
      question: data.question,
      context: data.context ?? null,
      deadline: data.deadline ?? null,
      lifeAreaId: data.lifeAreaId ?? null,
      projectId: data.projectId ?? null,
      inboxItemId,
    })
    .returning();
  const options = data.options?.length ? data.options : inferOptions(data.question);
  if (options.length) await ctx.tx.insert(decisionOptions).values(options.map((label) => ({ userId: ctx.userId, decisionId: row.id, label })));
  return row;
}

/** "¿Acepto un nuevo cliente?" → ["Sí, aceptar", "No aceptar"]. Yes/no questions only. */
function inferOptions(question: string): string[] {
  const q = question.replace(/[¿?]/g, "").trim();
  const verb = q.split(" ")[0]?.toLowerCase() ?? "";
  if (/^(acepto|aceptar|tomo|tomar|contrato|contratar|compro|comprar|renuncio|renunciar|hago|hacer|invierto|invertir|me mudo|mudarme|vendo|vender|sigo|seguir)$/.test(verb)) {
    return [`Sí: ${q.charAt(0).toLowerCase()}${q.slice(1)}`, "No, por ahora"];
  }
  return [];
}

export async function getDecision(ctx: Ctx, id: string) {
  const row = await ctx.tx.query.decisions.findFirst({ where: and(eq(decisions.id, id), eq(decisions.userId, ctx.userId), isNull(decisions.deletedAt)) });
  if (!row) throw new UserFacingError("No encontré esa decisión.", "NOT_FOUND");
  const options = await ctx.tx.select().from(decisionOptions).where(eq(decisionOptions.decisionId, id)).orderBy(asc(decisionOptions.createdAt));
  return { ...row, options };
}

export async function listDecisions(ctx: Ctx) {
  return ctx.tx
    .select({
      d: decisions,
      optionCount: sql<number>`(select count(*) from ${decisionOptions} o where o.decision_id = ${decisions.id})`.mapWith(Number),
    })
    .from(decisions)
    .where(and(eq(decisions.userId, ctx.userId), isNull(decisions.deletedAt)))
    .orderBy(asc(sql`case ${decisions.status} when 'OPEN' then 0 when 'DECIDED' then 1 else 2 end`), desc(decisions.createdAt))
    .then((rows) => rows.map((r) => ({ ...r.d, optionCount: r.optionCount })));
}

export const DecisionUpdateSchema = z.object({
  context: z.string().max(5000).nullish(),
  assumptions: z.string().max(5000).nullish(),
  risks: z.string().max(5000).nullish(),
  deadline: z.string().refine(isValidIsoDate).nullish(),
  reviewDate: z.string().refine(isValidIsoDate).nullish(),
  outcome: z.string().max(5000).nullish(),
  outcomeRating: z.number().int().min(1).max(5).nullish(),
});

export async function updateDecision(ctx: Ctx, id: string, patch: z.infer<typeof DecisionUpdateSchema>) {
  const data = DecisionUpdateSchema.parse(patch);
  await getDecision(ctx, id);
  const next: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) if (v !== undefined) next[k] = v;
  if (data.outcome) next.status = "REVIEWED";
  const [row] = await ctx.tx.update(decisions).set(next as Partial<typeof decisions.$inferInsert>).where(eq(decisions.id, id)).returning();
  return row;
}

/** The user decides — LÍA only records. */
export async function decide(ctx: Ctx, id: string, choice: { optionId?: string | null; decision: string; rationale?: string | null; reviewDate?: string | null }) {
  await getDecision(ctx, id);
  if (choice.optionId) {
    await ctx.tx.update(decisionOptions).set({ isChosen: false }).where(eq(decisionOptions.decisionId, id));
    await ctx.tx.update(decisionOptions).set({ isChosen: true }).where(and(eq(decisionOptions.id, choice.optionId), eq(decisionOptions.decisionId, id)));
  }
  const [row] = await ctx.tx
    .update(decisions)
    .set({ status: "DECIDED", decision: choice.decision, rationale: choice.rationale ?? null, reviewDate: choice.reviewDate ?? null, decidedAt: ctx.now })
    .where(eq(decisions.id, id))
    .returning();
  return row;
}

export async function addDecisionOption(ctx: Ctx, decisionId: string, label: string, pros?: string, cons?: string) {
  await getDecision(ctx, decisionId);
  const [row] = await ctx.tx.insert(decisionOptions).values({ userId: ctx.userId, decisionId, label: label.trim(), pros: pros ?? null, cons: cons ?? null }).returning();
  return row;
}

export async function saveDecisionAnalysis(ctx: Ctx, id: string, analysis: DecisionAnalysis) {
  await ctx.tx.update(decisions).set({ analysis }).where(and(eq(decisions.id, id), eq(decisions.userId, ctx.userId)));
}
