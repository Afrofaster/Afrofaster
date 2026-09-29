import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { runAsUser } from "@/application/context";
import { createTask, getTask, listTasks } from "@/application/tasks";
import { authenticate, createSession, registerUser, revokeSession, validateSession } from "@/server/auth/service";
import { withUser } from "@/server/db/factory";
import { lifeAreas, tasks, users } from "@/server/db/schema";
import { makeUser, resetDb, testDb } from "../support/db";

describe("auth & sessions", () => {
  beforeAll(resetDb);

  it("registers, authenticates and creates the 15 life areas", async () => {
    const user = await registerUser(testDb(), { email: "Jhony@Example.com", password: "una-clave-segura", displayName: "Jhony" });
    expect(await authenticate(testDb(), "jhony@example.com", "una-clave-segura")).toBe(user.id);
    expect(await authenticate(testDb(), "jhony@example.com", "mala-clave-123")).toBeNull();
    const areas = await withUser(testDb(), user.id, (tx) => tx.select().from(lifeAreas));
    expect(areas).toHaveLength(15);
  });

  it("rejects duplicate emails and weak passwords", async () => {
    await expect(registerUser(testDb(), { email: "jhony@example.com", password: "otra-clave-segura" })).rejects.toThrow(/Ya existe/);
    await expect(registerUser(testDb(), { email: "x@example.com", password: "corta" })).rejects.toThrow();
  });

  it("stores only hashed session tokens and revokes them", async () => {
    const user = await makeUser();
    const { token } = await createSession(testDb(), user.id, "vitest");
    expect((await validateSession(testDb(), token))?.userId).toBe(user.id);
    await revokeSession(testDb(), token);
    expect(await validateSession(testDb(), token)).toBeNull();
    expect(await validateSession(testDb(), "garbage")).toBeNull();
  });
});

describe("row level security", () => {
  it("isolates users even when a query forgets the user filter", async () => {
    const a = await makeUser("A");
    const b = await makeUser("B");
    const taskA = await runAsUser(testDb(), a.id, (ctx) => createTask(ctx, { title: "Secreto de A" }));

    // Raw query with NO user filter, running as B: RLS must hide A's rows.
    const visibleToB = await withUser(testDb(), b.id, (tx) => tx.select().from(tasks));
    expect(visibleToB.find((t) => t.id === taskA.id)).toBeUndefined();
    await expect(runAsUser(testDb(), b.id, (ctx) => getTask(ctx, taskA.id))).rejects.toThrow(/No encontré/);
    expect(await runAsUser(testDb(), b.id, (ctx) => listTasks(ctx, { kind: "open" }))).toHaveLength(0);
  });

  it("blocks writing rows for another user", async () => {
    const a = await makeUser();
    const b = await makeUser();
    await expect(withUser(testDb(), b.id, (tx) => tx.insert(tasks).values({ userId: a.id, title: "inyectada" }))).rejects.toThrow();
  });

  it("hides everything without a user context", async () => {
    await makeUser();
    const rows = await testDb().transaction((tx) => tx.select().from(tasks));
    expect(rows).toHaveLength(0);
    const u = await testDb().transaction((tx) => tx.select().from(users));
    expect(u).toHaveLength(0);
    const direct = await testDb().execute(sql`select count(*)::int as n from life_areas`);
    expect(Number((direct as unknown as Array<{ n: number }>)[0].n)).toBe(0);
  });
});
