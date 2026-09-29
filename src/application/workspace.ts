import { eq } from "drizzle-orm";
import { DEFAULT_LIFE_AREAS } from "@/domain/life-areas";
import { lifeAreas, metrics, userProfiles } from "@/server/db/schema";
import type { Ctx } from "./context";

export const DEFAULT_METRICS = [
  { key: "sleep_hours", name: "Sueño", unit: "h", area: "physical_health", aggregation: "AVG", direction: "HIGHER_BETTER", target: 7, sensitive: "HEALTH" },
  { key: "weight", name: "Peso", unit: "kg", area: "physical_health", aggregation: "LAST", direction: "LOWER_BETTER", target: null, sensitive: "HEALTH" },
  { key: "deep_work_minutes", name: "Deep work", unit: "min", area: "career", aggregation: "SUM", direction: "HIGHER_BETTER", target: 600, sensitive: null },
  { key: "training_minutes", name: "Entrenamiento", unit: "min", area: "physical_health", aggregation: "SUM", direction: "HIGHER_BETTER", target: 150, sensitive: "HEALTH" },
  { key: "mood", name: "Ánimo", unit: "/10", area: "mental_health", aggregation: "AVG", direction: "HIGHER_BETTER", target: 7, sensitive: "HEALTH" },
  { key: "energy", name: "Energía", unit: "/10", area: "mental_health", aggregation: "AVG", direction: "HIGHER_BETTER", target: 7, sensitive: "HEALTH" },
] as const;

/** Creates profile, the 15 life areas and base metrics. Idempotent. */
export async function initializeWorkspace(ctx: Ctx, displayName = "Jhony"): Promise<void> {
  await ctx.tx.insert(userProfiles).values({ userId: ctx.userId, displayName }).onConflictDoNothing();
  await ctx.tx
    .insert(lifeAreas)
    .values(
      DEFAULT_LIFE_AREAS.map((a, i) => ({
        userId: ctx.userId,
        key: a.key,
        name: a.name,
        icon: a.icon,
        sortOrder: i,
        weight: a.weight,
        isFoundational: a.isFoundational,
        sensitiveCategory: a.sensitiveCategory,
      })),
    )
    .onConflictDoNothing();
  const areas = await ctx.tx.select({ id: lifeAreas.id, key: lifeAreas.key }).from(lifeAreas).where(eq(lifeAreas.userId, ctx.userId));
  const areaId = new Map(areas.map((a) => [a.key, a.id]));
  await ctx.tx
    .insert(metrics)
    .values(
      DEFAULT_METRICS.map((m) => ({
        userId: ctx.userId,
        key: m.key,
        name: m.name,
        unit: m.unit,
        lifeAreaId: areaId.get(m.area) ?? null,
        aggregation: m.aggregation,
        direction: m.direction,
        target: m.target,
        sensitiveCategory: m.sensitive,
      })),
    )
    .onConflictDoNothing();
}
