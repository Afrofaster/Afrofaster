import { and, eq, isNull, sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { decisions, goals, inboxItems, people, projects, tasks } from "@/server/db/schema";
import type { Ctx } from "./context";

export type SearchHit = { type: "task" | "project" | "goal" | "person" | "decision" | "note"; id: string; title: string; subtitle: string | null; href: string };

/** Accent- and case-insensitive substring match. Semantic search can layer on later. */
function matches(column: PgColumn | SQL, q: string): SQL {
  return sql`unaccent(lower(${column})) like unaccent(lower(${`%${q}%`}))`;
}

export async function globalSearch(ctx: Ctx, rawQuery: string, limitPerType = 6): Promise<SearchHit[]> {
  const q = rawQuery.trim().replace(/[%_\\]/g, "").slice(0, 100);
  if (q.length < 2) return [];
  const [t, p, g, pe, d, n] = await Promise.all([
    ctx.tx.select({ id: tasks.id, title: tasks.title, status: tasks.status }).from(tasks).where(and(eq(tasks.userId, ctx.userId), isNull(tasks.deletedAt), sql`(${matches(tasks.title, q)} or ${matches(sql`coalesce(${tasks.description}, '')`, q)})`)).limit(limitPerType),
    ctx.tx.select({ id: projects.id, title: projects.title, status: projects.status }).from(projects).where(and(eq(projects.userId, ctx.userId), isNull(projects.deletedAt), matches(projects.title, q))).limit(limitPerType),
    ctx.tx.select({ id: goals.id, title: goals.title, status: goals.status }).from(goals).where(and(eq(goals.userId, ctx.userId), isNull(goals.deletedAt), matches(goals.title, q))).limit(limitPerType),
    ctx.tx.select({ id: people.id, name: people.name, company: people.company }).from(people).where(and(eq(people.userId, ctx.userId), isNull(people.deletedAt), sql`(${matches(people.name, q)} or ${matches(sql`array_to_string(${people.aliases}, ' ')`, q)})`)).limit(limitPerType),
    ctx.tx.select({ id: decisions.id, question: decisions.question, status: decisions.status }).from(decisions).where(and(eq(decisions.userId, ctx.userId), isNull(decisions.deletedAt), matches(decisions.question, q))).limit(limitPerType),
    ctx.tx.select({ id: inboxItems.id, rawText: inboxItems.rawText, type: inboxItems.type }).from(inboxItems).where(and(eq(inboxItems.userId, ctx.userId), sql`${inboxItems.type} in ('NOTE','IDEA','RISK','DOCUMENT_REFERENCE')`, matches(inboxItems.rawText, q))).limit(limitPerType),
  ]);
  return [
    ...t.map((x) => ({ type: "task" as const, id: x.id, title: x.title, subtitle: x.status === "DONE" ? "Tarea hecha" : "Tarea", href: `/tasks?focus=${x.id}` })),
    ...p.map((x) => ({ type: "project" as const, id: x.id, title: x.title, subtitle: "Proyecto", href: `/projects/${x.id}` })),
    ...g.map((x) => ({ type: "goal" as const, id: x.id, title: x.title, subtitle: "Objetivo", href: `/goals/${x.id}` })),
    ...pe.map((x) => ({ type: "person" as const, id: x.id, title: x.name, subtitle: x.company ?? "Persona", href: `/people/${x.id}` })),
    ...d.map((x) => ({ type: "decision" as const, id: x.id, title: x.question, subtitle: "Decisión", href: `/decisions/${x.id}` })),
    ...n.map((x) => ({ type: "note" as const, id: x.id, title: x.rawText, subtitle: x.type === "IDEA" ? "Idea" : "Nota", href: `/inbox?view=${x.type === "IDEA" ? "ideas" : "notes"}` })),
  ];
}
