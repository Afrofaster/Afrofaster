import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { acceptSuggestion, capture, convertInboxItem, listInbox } from "@/application/capture";
import { runAsUser } from "@/application/context";
import { createTask, listTasks } from "@/application/tasks";
import { createProject } from "@/application/projects";
import { addDays, todayIn } from "@/domain/dates";
import { withUser } from "@/server/db/factory";
import { calendarEvents, decisions, inboxItems, metricEntries, people, tasks, transactions, waitingFor } from "@/server/db/schema";
import { makeUser, resetDb, testDb } from "../support/db";

const tz = "America/Bogota";

describe("universal capture (spec §59 end-to-end)", () => {
  let userId: string;
  beforeAll(async () => {
    await resetDb();
    userId = (await makeUser()).id;
  });
  const today = () => todayIn(tz);
  const cap = (text: string, clientId?: string) => capture(testDb(), userId, { text, clientId });
  const q = <T,>(fn: Parameters<typeof withUser<T>>[2]) => withUser(testDb(), userId, fn);

  it("1 · mañana llamar a Olga → task scheduled tomorrow", async () => {
    const r = await cap("mañana llamar a Olga");
    expect(r).toMatchObject({ status: "PROCESSED", type: "TASK", intent: "CREATE_TASK" });
    const [t] = await q((tx) => tx.select().from(tasks).where(eq(tasks.title, "Llamar a Olga")));
    expect(t.scheduledDate).toBe(addDays(today(), 1));
    expect(t.createdBy).toBe("LIA");
    expect(t.inboxItemId).toBe(r.itemId);
  });

  it("2 · waiting for Carlos, with person created and follow-up", async () => {
    const r = await cap("Carlos quedó de mandarme el contrato el viernes");
    expect(r.type).toBe("WAITING_FOR");
    const [w] = await q((tx) => tx.select().from(waitingFor));
    expect(w).toMatchObject({ expectedItem: "el contrato", personName: "Carlos", status: "OPEN" });
    expect(w.followUpDate).toBe(addDays(w.expectedDate!, 1));
    expect(await q((tx) => tx.select().from(people))).toHaveLength(1);
  });

  it("3 · idea", async () => {
    expect((await cap("tengo una idea de un servicio para abogados")).type).toBe("IDEA");
  });

  it("4 · dormí 5 horas → metric", async () => {
    await cap("dormí 5 horas");
    const [e] = await q((tx) => tx.select().from(metricEntries));
    expect(e.value).toBe(5);
  });

  it("5 · expense", async () => {
    await cap("gasté 85 mil en gasolina");
    const [t] = await q((tx) => tx.select().from(transactions));
    expect(t).toMatchObject({ amount: 85000, kind: "EXPENSE", category: "Transporte", currency: "COP" });
  });

  it("6–8 · questions are routed to LÍA, not stored as tasks", async () => {
    for (const text of ["organízame mañana", "estoy saturado", "cómo vamos"]) {
      const r = await cap(text);
      expect(r.status).toBe("ARCHIVED");
      expect(r.redirect).toContain("/lia?q=");
    }
  });

  it("9 · decision", async () => {
    await cap("tengo que decidir si acepto un nuevo cliente");
    const [d] = await q((tx) => tx.select().from(decisions));
    expect(d.question).toBe("¿Acepto un nuevo cliente?");
  });

  it("10 · completion is proposed, then confirmed", async () => {
    const r = await cap("terminé la llamada a Olga");
    expect(r.status).toBe("NEEDS_REVIEW");
    expect(r.suggestion).toMatchObject({ action: "COMPLETE_TASK", taskTitle: "Llamar a Olga" });
    await runAsUser(testDb(), userId, (ctx) => acceptSuggestion(ctx, r.itemId));
    const [t] = await q((tx) => tx.select().from(tasks).where(eq(tasks.title, "Llamar a Olga")));
    expect(t.status).toBe("DONE");
    expect(t.completedAt).not.toBeNull();
  });

  it("events are events, not tasks", async () => {
    await cap("mañana tengo audiencia a las 9");
    expect(await q((tx) => tx.select().from(calendarEvents))).toHaveLength(1);
  });

  it("never duplicates tasks and is idempotent for offline sync", async () => {
    await cap("enviar propuesta al banco");
    const dup = await cap("enviar propuesta al banco");
    expect(dup.message).toMatch(/Ya tenías/);
    const a = await cap("revisar el correo del juzgado", "client-1");
    const b = await cap("revisar el correo del juzgado", "client-1");
    expect(b.itemId).toBe(a.itemId);
    const items = await q((tx) => tx.select().from(inboxItems).where(and(eq(inboxItems.clientId, "client-1"))));
    expect(items).toHaveLength(1);
  });

  it("relates tasks to existing projects", async () => {
    const project = await runAsUser(testDb(), userId, (ctx) => createProject(ctx, { title: "PACE+" }));
    await cap("enviar propuesta PACE el viernes");
    const list = await runAsUser(testDb(), userId, (ctx) => listTasks(ctx, { kind: "project", projectId: project.id }));
    expect(list.map((t) => t.title)).toContain("Enviar propuesta PACE");
  });

  it("does not create duplicate projects", async () => {
    await expect(runAsUser(testDb(), userId, (ctx) => createProject(ctx, { title: "Proyecto PACE+" }))).rejects.toThrow(/Ya existe/);
  });

  it("keeps unknown input in the inbox for review and lets the user correct it", async () => {
    const r = await cap("asdf qwerty");
    expect(r.status).toBe("NEEDS_REVIEW");
    const review = await runAsUser(testDb(), userId, (ctx) => listInbox(ctx, "review"));
    expect(review.some((i) => i.id === r.itemId)).toBe(true);
    const entity = await runAsUser(testDb(), userId, (ctx) => convertInboxItem(ctx, r.itemId, "TASK"));
    expect(entity.type).toBe("task");
  });

  it("persists first: a failing classifier never loses the text", async () => {
    const r = await capture(testDb(), userId, { text: "algo importante que no debo perder" }, async () => {
      throw new Error("LLM caído");
    });
    const [item] = await q((tx) => tx.select().from(inboxItems).where(eq(inboxItems.id, r.itemId)));
    expect(item.rawText).toBe("algo importante que no debo perder");
  });

  it("creates tasks through the application layer with validation", async () => {
    await expect(runAsUser(testDb(), userId, (ctx) => createTask(ctx, { title: "" }))).rejects.toThrow();
  });
});
