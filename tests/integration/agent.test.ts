import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { handleChatMessage, resolvePendingAction } from "@/ai/orchestrator";
import { parseToolArgs } from "@/ai/tools/registry";
import { runAsUser } from "@/application/context";
import { exportUserData } from "@/application/export";
import { buildWeeklyReview, completeShutdown, completeWeeklyReview, buildShutdown } from "@/application/reviews";
import { createTask } from "@/application/tasks";
import { addDays, todayIn } from "@/domain/dates";
import { withUser } from "@/server/db/factory";
import { agentActionLogs, goals, projects, reviews, tasks, waitingFor } from "@/server/db/schema";
import { makeUser, resetDb, testDb } from "../support/db";

describe("LÍA agent (no API key: deterministic path)", () => {
  let userId: string;
  beforeAll(async () => {
    await resetDb();
    userId = (await makeUser()).id;
    const today = todayIn("America/Bogota");
    await runAsUser(testDb(), userId, async (ctx) => {
      await createTask(ctx, { title: "Terminar el escrito de Carmen", dueDate: addDays(today, 1), estimatedMinutes: 120, priority: "CRITICAL" });
      await createTask(ctx, { title: "Llamar a Olga", scheduledDate: today, estimatedMinutes: 20 });
    });
  });
  const chat = (text: string) => handleChatMessage(testDb(), userId, { text });

  it("organízame mañana → plan with Big 3 pending confirmation", async () => {
    const statuses: string[] = [];
    const { message } = await handleChatMessage(testDb(), userId, { text: "organízame mañana" }, (e) => e.type === "status" && statuses.push(e.label));
    expect(statuses).toContain("Pensando…");
    expect(message.cards[0].kind).toBe("plan");
    expect(message.pendingAction).toMatchObject({ tool: "set_big3", status: "PENDING" });
    const res = await resolvePendingAction(testDb(), userId, message.id, "confirm");
    expect(res.status).toBe("CONFIRMED");
  });

  it("haz seguimiento de Carlos → waiting for", async () => {
    await chat("Haz seguimiento de Carlos");
    const rows = await withUser(testDb(), userId, (tx) => tx.select().from(waitingFor));
    expect(rows[0].personName).toBe("Carlos");
  });

  it("estoy saturado → capacity analysis with relief rule", async () => {
    const { message } = await chat("estoy saturado");
    expect(message.cards[0].kind).toBe("capacity");
    expect(message.content).toMatch(/no añadir nada nuevo sin sacar algo/);
  });

  it("cómo vamos → executive status from real data", async () => {
    const { message } = await chat("¿cómo vamos?");
    expect(message.cards[0].kind).toBe("status");
    expect(message.content).toMatch(/Capacidad/);
  });

  it("sensitive actions require confirmation and can be rejected", async () => {
    const { message } = await chat("terminé la llamada a Olga");
    expect(message.pendingAction?.tool).toBe("complete_task");
    const rejected = await resolvePendingAction(testDb(), userId, message.id, "reject");
    expect(rejected.status).toBe("REJECTED");
    const [olga] = await withUser(testDb(), userId, (tx) => tx.select().from(tasks).where(eq(tasks.title, "Llamar a Olga")));
    expect(olga.status).not.toBe("DONE");
    await expect(resolvePendingAction(testDb(), userId, message.id, "confirm")).rejects.toThrow(/ya fue resuelta/);
  });

  it("new business → analysis before creating, as an idea when crowded", async () => {
    const { message } = await chat("Quiero empezar un nuevo negocio");
    expect(message.content).toMatch(/costo de oportunidad/);
    expect(message.pendingAction?.tool).toBe("create_project");
    expect(await withUser(testDb(), userId, (tx) => tx.select().from(projects))).toHaveLength(0);
    await resolvePendingAction(testDb(), userId, message.id, "confirm");
    expect(await withUser(testDb(), userId, (tx) => tx.select().from(projects))).toHaveLength(1);
  });

  it("goals are proposed, with edit before confirming", async () => {
    const { message } = await chat("mi objetivo es terminar la maestría este año");
    await resolvePendingAction(testDb(), userId, message.id, "confirm", { title: "Terminar la maestría en 2026" });
    const [g] = await withUser(testDb(), userId, (tx) => tx.select().from(goals));
    expect(g.title).toBe("Terminar la maestría en 2026");
  });

  it("does not turn unclear messages into tasks", async () => {
    const before = await withUser(testDb(), userId, (tx) => tx.select().from(tasks));
    const { message } = await chat("hmm no sé");
    const after = await withUser(testDb(), userId, (tx) => tx.select().from(tasks));
    expect(after.length).toBe(before.length);
    expect(message.pendingAction?.tool).toBe("capture_item");
  });

  it("audits every tool action", async () => {
    const logs = await withUser(testDb(), userId, (tx) => tx.select().from(agentActionLogs));
    const tools = new Set(logs.map((l) => l.tool));
    for (const t of ["plan_day", "set_big3", "complete_task", "create_project", "capture_item"]) expect(tools.has(t)).toBe(true);
    expect(logs.some((l) => l.status === "REJECTED")).toBe(true);
  });

  it("validates tool arguments before anything runs", () => {
    expect(parseToolArgs("complete_task", { task_id: "not-a-uuid", title: null }).ok).toBe(false);
    expect(parseToolArgs("drop_database", {}).ok).toBe(false);
  });

  it("weekly review and shutdown persist history", async () => {
    await runAsUser(testDb(), userId, async (ctx) => {
      const weekly = await buildWeeklyReview(ctx);
      expect(weekly.notThisWeek).toBeDefined();
      await completeWeeklyReview(ctx, { perceivedControl: 4, learning: "Menos frentes" });
      const s = await buildShutdown(ctx);
      await completeShutdown(ctx, { decisions: s.pending.map((p) => ({ taskId: p.id, action: "LATER" })) });
    });
    const rows = await withUser(testDb(), userId, (tx) => tx.select().from(reviews));
    expect(rows.map((r) => r.type).sort()).toEqual(["DAILY_SHUTDOWN", "WEEKLY"]);
  });

  it("exports all user data as JSON", async () => {
    const data = await runAsUser(testDb(), userId, exportUserData);
    expect(data.format).toBe("lia-export");
    expect(data.data.tasks.length).toBeGreaterThan(0);
    expect(data.data.lifeAreas).toHaveLength(15);
  });
});
