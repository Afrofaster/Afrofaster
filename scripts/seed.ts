/**
 * Development seed: user "Jhony", his 15 life areas and a realistic week.
 * Refuses to run in production. Idempotent-ish: skips if the user exists
 * unless --reset is passed (which deletes that user and recreates it).
 */
import { config } from "dotenv";
import { eq, sql } from "drizzle-orm";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

async function main() {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    throw new Error("El seed de desarrollo nunca se ejecuta en producción.");
  }
  const { createDb, withAuthContext } = await import("../src/server/db/factory");
  const { users, userProfiles, projects } = await import("../src/server/db/schema");
  const { registerUser } = await import("../src/server/auth/service");
  const { runAsUser } = await import("../src/application/context");
  const { updateArea, listAreas, snapshotLifeScore } = await import("../src/application/areas");
  const { createGoal } = await import("../src/application/goals");
  const { createProject, createMilestone } = await import("../src/application/projects");
  const { createTask, completeTask } = await import("../src/application/tasks");
  const { createWaitingFor } = await import("../src/application/waiting");
  const { createDecision } = await import("../src/application/decisions");
  const { createPerson } = await import("../src/application/people");
  const { logMetric, logTransaction } = await import("../src/application/metrics");
  const { createCommitment, createEvent } = await import("../src/application/events");
  const { addDays } = await import("../src/domain/dates");

  const url = process.argv.includes("--test") ? process.env.TEST_DATABASE_URL : process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL no configurada");
  const db = createDb(url, { max: 2 });
  const email = (process.env.SEED_USER_EMAIL ?? "jhony@lia.local").toLowerCase();
  const password = process.env.SEED_USER_PASSWORD ?? "lia-dev-password";

  const existing = await withAuthContext(db, (tx) => tx.query.users.findFirst({ where: sql`lower(${users.email}) = ${email}` }));
  if (existing && !process.argv.includes("--reset")) {
    console.log(`• ${email} ya existe (usa --reset para recrearlo).`);
    process.exit(0);
  }
  if (existing) await withAuthContext(db, (tx) => tx.delete(users).where(eq(users.id, existing.id)));

  const user = await registerUser(db, { email, password, displayName: "Jhony" });

  await runAsUser(db, user.id, async (ctx) => {
    const t = ctx.today;
    await ctx.tx.update(userProfiles).set({
      onboardingCompletedAt: ctx.now,
      preferences: { dayStart: "06:00", dayEnd: "21:30", deepWorkMinutes: 90, sleepTargetHours: 7, restDays: [0], trainingTime: "18:00" },
    }).where(eq(userProfiles.userId, user.id));

    const areas = await listAreas(ctx);
    const id = (key: string) => areas.find((a) => a.key === key)!.id;
    const scores: Record<string, [number, "EXPANSION" | "MAINTENANCE" | "WATCH" | "RECOVERY"]> = {
      identity: [72, "MAINTENANCE"], physical_health: [58, "RECOVERY"], mental_health: [66, "WATCH"], spirituality: [70, "MAINTENANCE"],
      partner: [78, "MAINTENANCE"], family: [74, "MAINTENANCE"], friendships: [55, "WATCH"], career: [82, "EXPANSION"],
      education: [64, "EXPANSION"], business: [71, "EXPANSION"], finances: [63, "WATCH"], personal_brand: [48, "MAINTENANCE"],
      home_admin: [69, "MAINTENANCE"], leisure: [52, "MAINTENANCE"], purpose: [75, "MAINTENANCE"],
    };
    for (const [key, [score, mode]] of Object.entries(scores)) await updateArea(ctx, id(key), { score, mode });

    const maestria = await createGoal(ctx, { title: "Terminar la maestría este año", outcome: "Tesis sustentada y aprobada", metric: "Capítulos terminados", unit: "capítulos", baseline: 1, target: 5, currentValue: 2, deadline: addDays(t, 80), horizon: "QUARTER", lifeAreaId: id("education"), priority: "HIGH" });
    const clientes = await createGoal(ctx, { title: "Llegar a 8 clientes recurrentes", metric: "Clientes activos", unit: "clientes", baseline: 3, target: 8, currentValue: 5, deadline: addDays(t, 85), horizon: "QUARTER", lifeAreaId: id("career"), priority: "HIGH" });
    await createGoal(ctx, { title: "Entrenar 3 veces por semana", metric: "Sesiones/semana", baseline: 0, target: 3, currentValue: 1, deadline: addDays(t, 90), horizon: "QUARTER", lifeAreaId: id("physical_health"), priority: "MEDIUM", status: "AT_RISK" });

    const carmen = await createProject(ctx, { title: "Proyecto Carmen", desiredOutcome: "Demanda radicada y audiencia preparada", lifeAreaId: id("career"), goalId: clientes.id, priority: "HIGH", targetDate: addDays(t, 20), metadata: { client: "Carmen Rojas", caseReference: "2026-00412", courtOrEntity: "Juzgado 12 Civil", legalDeadline: addDays(t, 6) } });
    const pace = await createProject(ctx, { title: "PACE+", desiredOutcome: "Primer contrato firmado de servicio para abogados", lifeAreaId: id("business"), priority: "MEDIUM", targetDate: addDays(t, 45) });
    const tesis = await createProject(ctx, { title: "Tesis de maestría", desiredOutcome: "Capítulo 3 entregado al director", lifeAreaId: id("education"), goalId: maestria.id, priority: "HIGH", targetDate: addDays(t, 30) });
    const marca = await createProject(ctx, { title: "Serie de artículos en LinkedIn", lifeAreaId: id("personal_brand"), priority: "LOW", status: "ACTIVE" });
    await createMilestone(ctx, carmen.id, "Radicar demanda", addDays(t, 6));
    await createMilestone(ctx, carmen.id, "Preparar audiencia", addDays(t, 18));
    await createMilestone(ctx, tesis.id, "Borrador capítulo 3", addDays(t, 14));

    const olga = await createPerson(ctx, { name: "Olga Martínez", relationship: "Cliente", company: "Martínez & Cía." });
    await createPerson(ctx, { name: "Dr. Carlos Pérez", relationship: "Colega", role: "Abogado litigante" });
    await createPerson(ctx, { name: "Diana Gómez", relationship: "Cliente" });

    await createTask(ctx, { title: "Terminar el escrito de Carmen", projectId: carmen.id, dueDate: addDays(t, 1), estimatedMinutes: 120, priority: "CRITICAL", energy: "HIGH" });
    await createTask(ctx, { title: "Llamar a Olga", personId: olga.id, scheduledDate: t, estimatedMinutes: 20, lifeAreaId: id("career") });
    await createTask(ctx, { title: "Enviar propuesta PACE", projectId: pace.id, dueDate: addDays(t, 3), estimatedMinutes: 60, priority: "HIGH" });
    await createTask(ctx, { title: "Leer 2 papers para el capítulo 3", projectId: tesis.id, scheduledDate: addDays(t, 2), estimatedMinutes: 90, energy: "HIGH" });
    await createTask(ctx, { title: "Pagar la tarjeta de crédito", lifeAreaId: id("finances"), dueDate: addDays(t, -1), estimatedMinutes: 10, priority: "HIGH", energy: "LOW" });
    await createTask(ctx, { title: "Entrenar", lifeAreaId: id("physical_health"), scheduledDate: t, estimatedMinutes: 60 });
    await createTask(ctx, { title: "Renovar el SOAT", lifeAreaId: id("home_admin"), dueDate: addDays(t, 9), estimatedMinutes: 20, energy: "LOW" });
    await createTask(ctx, { title: "Escribir borrador del artículo sobre tutelas", projectId: marca.id, estimatedMinutes: 90, priority: "LOW" });
    const done = await createTask(ctx, { title: "Revisar contrato de Diana", lifeAreaId: id("career"), scheduledDate: addDays(t, -1), estimatedMinutes: 45 });
    await completeTask(ctx, done.id);

    await createWaitingFor(ctx, { person: "Carlos", expectedItem: "el contrato firmado", expectedDate: addDays(t, 3), projectId: pace.id });
    await createDecision(ctx, { question: "¿Acepto un nuevo cliente corporativo?", context: "Me ofrecieron una asesoría mensual. Buen ingreso, pero esta semana ya estoy al límite.", deadline: addDays(t, 4), lifeAreaId: id("business") });

    await createCommitment(ctx, { title: "Oficina / atención a clientes", weekdays: [1, 2, 3, 4, 5], startTime: "08:00", endTime: "12:00" });
    await createCommitment(ctx, { title: "Clase de maestría", weekdays: [2, 4], startTime: "18:30", endTime: "21:00" });
    await createEvent(ctx, { title: "Audiencia caso Carmen", date: addDays(t, 1), time: "09:00", durationMinutes: 120 });

    const sleep = [6.5, 5.5, 7, 6, 5, 7.5, 6];
    for (let i = 0; i < sleep.length; i++) await logMetric(ctx, "sleep_hours", sleep[i], addDays(t, -i));
    await logMetric(ctx, "deep_work_minutes", 90, addDays(t, -1));
    await logMetric(ctx, "mood", 7, t);
    await logTransaction(ctx, { kind: "EXPENSE", amount: 85000, category: "Transporte", description: "Gasolina" });
    await logTransaction(ctx, { kind: "EXPENSE", amount: 42000, category: "Alimentación", description: "Almuerzo con cliente" });
    await logTransaction(ctx, { kind: "INCOME", amount: 3500000, category: "Ingreso", description: "Honorarios Carmen" });

    await ctx.tx.update(projects).set({ lastActivityAt: new Date(ctx.now.getTime() - 9 * 86_400_000) }).where(eq(projects.id, marca.id));
    await snapshotLifeScore(ctx);
  });

  console.log(`✓ Seed listo → ${email} / ${password}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("✗ Seed falló:", err);
  process.exit(1);
});
