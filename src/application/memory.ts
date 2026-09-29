import { and, desc, eq, isNull, or, sql, gt } from "drizzle-orm";
import type { MemoryKind, MemoryPersistence, SensitiveCategory } from "@/domain/enums";
import { memories } from "@/server/db/schema";
import type { Ctx } from "./context";

/**
 * Memory rules (spec §17): nothing becomes a permanent truth automatically.
 * Captured preferences start unconfirmed and temporary; only an explicit
 * confirmation promotes them.
 */
export async function rememberCandidate(
  ctx: Ctx,
  input: { kind: MemoryKind; content: string; confidence: number; importance?: number; sensitive?: SensitiveCategory | null; sourceMessageId?: string | null },
) {
  const persistence: MemoryPersistence = "TEMPORARY";
  const [row] = await ctx.tx
    .insert(memories)
    .values({
      userId: ctx.userId,
      kind: input.kind,
      content: input.content.slice(0, 1000),
      confidence: Math.max(0, Math.min(1, input.confidence)),
      importance: input.importance ?? 3,
      persistence,
      confirmed: false,
      sensitiveCategory: input.sensitive ?? null,
      sourceMessageId: input.sourceMessageId ?? null,
      expiresAt: new Date(ctx.now.getTime() + 30 * 86_400_000),
    })
    .returning();
  return row;
}

export async function confirmMemory(ctx: Ctx, id: string, persistence: MemoryPersistence = "LONG_TERM") {
  const [row] = await ctx.tx
    .update(memories)
    .set({ confirmed: true, persistence, expiresAt: null, confidence: 1 })
    .where(and(eq(memories.id, id), eq(memories.userId, ctx.userId)))
    .returning();
  return row;
}

export async function forgetMemory(ctx: Ctx, id: string) {
  await ctx.tx.update(memories).set({ deletedAt: ctx.now }).where(and(eq(memories.id, id), eq(memories.userId, ctx.userId)));
}

export async function listMemories(ctx: Ctx, opts: { includeUnconfirmed?: boolean } = {}) {
  const conditions = [eq(memories.userId, ctx.userId), isNull(memories.deletedAt), or(isNull(memories.expiresAt), gt(memories.expiresAt, ctx.now))!];
  if (!opts.includeUnconfirmed) conditions.push(eq(memories.confirmed, true));
  return ctx.tx.select().from(memories).where(and(...conditions)).orderBy(desc(memories.importance), desc(memories.createdAt)).limit(100);
}

/**
 * Keyword retrieval over confirmed memories. Semantic (vector) search is the
 * Phase 5 upgrade path: same signature, pgvector underneath.
 */
export async function searchMemories(ctx: Ctx, query: string, limit = 5) {
  const words = query
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/\W+/)
    .filter((w) => w.length > 3)
    .slice(0, 8);
  if (words.length === 0) return [];
  const likeAny = or(...words.map((w) => sql`unaccent(lower(${memories.content})) like ${`%${w}%`}`))!;
  return ctx.tx
    .select({ id: memories.id, content: memories.content, kind: memories.kind, confirmed: memories.confirmed })
    .from(memories)
    .where(and(eq(memories.userId, ctx.userId), isNull(memories.deletedAt), eq(memories.confirmed, true), likeAny))
    .orderBy(desc(memories.importance))
    .limit(limit);
}
