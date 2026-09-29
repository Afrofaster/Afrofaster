import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { isValidIsoDate } from "@/domain/dates";
import { AUTO_LINK_THRESHOLD, matchPerson, type PersonMatch } from "@/domain/entity-resolution";
import { people, personInteractions } from "@/server/db/schema";
import { UserFacingError, type Ctx } from "./context";

export type PersonRow = typeof people.$inferSelect;

export const PersonSchema = z.object({
  name: z.string().trim().min(1).max(120),
  relationship: z.string().trim().max(120).nullish(),
  company: z.string().trim().max(120).nullish(),
  role: z.string().trim().max(120).nullish(),
  birthday: z.string().refine(isValidIsoDate).nullish(),
  notes: z.string().trim().max(5000).nullish(),
  nextFollowUp: z.string().refine(isValidIsoDate).nullish(),
});

export async function listPeople(ctx: Ctx): Promise<PersonRow[]> {
  return ctx.tx.select().from(people).where(and(eq(people.userId, ctx.userId), isNull(people.deletedAt))).orderBy(asc(people.name));
}

export async function getPerson(ctx: Ctx, id: string): Promise<PersonRow> {
  const row = await ctx.tx.query.people.findFirst({ where: and(eq(people.id, id), eq(people.userId, ctx.userId), isNull(people.deletedAt)) });
  if (!row) throw new UserFacingError("No encontré a esa persona.", "NOT_FOUND");
  return row;
}

export async function findPeople(ctx: Ctx, mention: string): Promise<PersonMatch[]> {
  const all = await listPeople(ctx);
  return matchPerson(mention, all.map((p) => ({ id: p.id, name: p.name, aliases: p.aliases })));
}

/**
 * Links a mention to an existing person when confident and unambiguous;
 * otherwise creates a new person. Never merges two existing records.
 */
export async function resolveOrCreatePerson(ctx: Ctx, mention: string): Promise<{ person: PersonRow; created: boolean; alternatives: PersonMatch[] }> {
  const matches = await findPeople(ctx, mention);
  const top = matches[0];
  const unambiguous = top && top.confidence >= AUTO_LINK_THRESHOLD && (matches.length === 1 || matches[1].confidence < AUTO_LINK_THRESHOLD);
  if (top && unambiguous) return { person: await getPerson(ctx, top.id), created: false, alternatives: matches.slice(1) };
  const person = await createPerson(ctx, { name: mention.trim() });
  return { person, created: true, alternatives: matches };
}

export async function createPerson(ctx: Ctx, input: z.infer<typeof PersonSchema>): Promise<PersonRow> {
  const data = PersonSchema.parse(input);
  const [row] = await ctx.tx.insert(people).values({ userId: ctx.userId, ...data }).returning();
  return row;
}

export async function updatePerson(ctx: Ctx, id: string, patch: Partial<z.infer<typeof PersonSchema>>): Promise<PersonRow> {
  const data = PersonSchema.partial().parse(patch);
  await getPerson(ctx, id);
  const [row] = await ctx.tx.update(people).set(data).where(eq(people.id, id)).returning();
  return row;
}

export async function addInteraction(ctx: Ctx, personId: string, summary: string, kind = "NOTE") {
  await getPerson(ctx, personId);
  const [row] = await ctx.tx.insert(personInteractions).values({ userId: ctx.userId, personId, summary, kind, occurredAt: ctx.now }).returning();
  await ctx.tx.update(people).set({ lastInteractionAt: ctx.now }).where(eq(people.id, personId));
  return row;
}

export async function listInteractions(ctx: Ctx, personId: string) {
  return ctx.tx.select().from(personInteractions).where(and(eq(personInteractions.personId, personId), eq(personInteractions.userId, ctx.userId))).orderBy(desc(personInteractions.occurredAt)).limit(50);
}
