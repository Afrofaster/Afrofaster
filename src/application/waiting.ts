import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { addDays, isValidIsoDate } from "@/domain/dates";
import { people, projects, waitingFor } from "@/server/db/schema";
import { UserFacingError, type Ctx } from "./context";
import { resolveOrCreatePerson } from "./people";

export const WaitingCreateSchema = z.object({
  person: z.string().trim().min(1).max(120),
  expectedItem: z.string().trim().max(300).nullish(),
  expectedDate: z.string().refine(isValidIsoDate).nullish(),
  followUpDate: z.string().refine(isValidIsoDate).nullish(),
  projectId: z.string().uuid().nullish(),
  notes: z.string().max(2000).nullish(),
});

export type WaitingRow = typeof waitingFor.$inferSelect & { projectTitle: string | null };

export async function createWaitingFor(ctx: Ctx, input: z.infer<typeof WaitingCreateSchema>, inboxItemId: string | null = null) {
  const data = WaitingCreateSchema.parse(input);
  const { person, created } = await resolveOrCreatePerson(ctx, data.person);
  // Follow up the day after the promised date, or in 3 days when no date was given.
  const followUp = data.followUpDate ?? (data.expectedDate ? addDays(data.expectedDate, 1) : addDays(ctx.today, 3));
  const [row] = await ctx.tx
    .insert(waitingFor)
    .values({
      userId: ctx.userId,
      personId: person.id,
      personName: person.name,
      expectedItem: data.expectedItem ?? "seguimiento",
      expectedDate: data.expectedDate ?? null,
      followUpDate: followUp,
      projectId: data.projectId ?? null,
      notes: data.notes ?? null,
      inboxItemId,
    })
    .returning();
  return { waiting: row, person, personCreated: created };
}

export async function listWaiting(ctx: Ctx, status: "OPEN" | "ALL" = "OPEN"): Promise<WaitingRow[]> {
  const conditions = [eq(waitingFor.userId, ctx.userId)];
  if (status === "OPEN") conditions.push(eq(waitingFor.status, "OPEN"));
  const rows = await ctx.tx
    .select({ w: waitingFor, projectTitle: projects.title, personName: people.name })
    .from(waitingFor)
    .leftJoin(projects, eq(projects.id, waitingFor.projectId))
    .leftJoin(people, eq(people.id, waitingFor.personId))
    .where(and(...conditions))
    .orderBy(asc(sql`case ${waitingFor.status} when 'OPEN' then 0 else 1 end`), asc(waitingFor.followUpDate));
  return rows.map((r) => ({ ...r.w, personName: r.personName ?? r.w.personName, projectTitle: r.projectTitle }));
}

export async function resolveWaiting(ctx: Ctx, id: string, status: "RECEIVED" | "CANCELLED") {
  const [row] = await ctx.tx
    .update(waitingFor)
    .set({ status, receivedAt: status === "RECEIVED" ? ctx.now : null })
    .where(and(eq(waitingFor.id, id), eq(waitingFor.userId, ctx.userId)))
    .returning();
  if (!row) throw new UserFacingError("No encontré ese seguimiento.", "NOT_FOUND");
  return row;
}

export async function snoozeWaiting(ctx: Ctx, id: string, days = 2) {
  const [row] = await ctx.tx
    .update(waitingFor)
    .set({ followUpDate: addDays(ctx.today, days) })
    .where(and(eq(waitingFor.id, id), eq(waitingFor.userId, ctx.userId)))
    .returning();
  if (!row) throw new UserFacingError("No encontré ese seguimiento.", "NOT_FOUND");
  return row;
}
