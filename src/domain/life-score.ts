/**
 * Life Score — weighted average of active, rated areas with structural
 * penalties when foundations (physical health, mental health, basic finances)
 * are critical. Always returns a human explanation: no magic numbers.
 */
import type { AreaMode, Trend } from "./enums";

export type LifeScoreArea = {
  key: string;
  name: string;
  score: number | null;
  weight: number;
  mode: AreaMode;
  active: boolean;
  isFoundational: boolean;
};

export type LifeScoreConfig = {
  foundationalPenalty: number;
  criticalThreshold: number;
};

export const DEFAULT_LIFE_SCORE_CONFIG: LifeScoreConfig = { foundationalPenalty: 6, criticalThreshold: 45 };

export type LifeScoreResult = {
  score: number | null;
  baseScore: number | null;
  penalty: number;
  ratedAreas: number;
  unratedAreas: string[];
  contributions: Array<{ key: string; name: string; score: number; weight: number }>;
  penalties: Array<{ key: string; name: string; points: number }>;
  explanation: string;
};

export function computeLifeScore(areas: LifeScoreArea[], config: Partial<LifeScoreConfig> = {}): LifeScoreResult {
  const cfg = { ...DEFAULT_LIFE_SCORE_CONFIG, ...config };
  const active = areas.filter((a) => a.active);
  const rated = active.filter((a): a is LifeScoreArea & { score: number } => a.score !== null);
  const unrated = active.filter((a) => a.score === null).map((a) => a.name);

  if (rated.length === 0) {
    return {
      score: null,
      baseScore: null,
      penalty: 0,
      ratedAreas: 0,
      unratedAreas: unrated,
      contributions: [],
      penalties: [],
      explanation: "Aún no has evaluado tus áreas de vida. Califícalas para calcular tu Life Score.",
    };
  }

  const totalWeight = rated.reduce((s, a) => s + a.weight, 0);
  const base = rated.reduce((s, a) => s + a.score * a.weight, 0) / totalWeight;

  const penalties = active
    .filter((a) => a.isFoundational && (a.mode === "CRITICAL" || (a.score !== null && a.score < cfg.criticalThreshold)))
    .map((a) => ({ key: a.key, name: a.name, points: cfg.foundationalPenalty }));
  const penalty = penalties.reduce((s, p) => s + p.points, 0);
  const score = Math.max(0, Math.min(100, Math.round(base - penalty)));

  const sortedByImpact = [...rated].sort((a, b) => a.score - b.score);
  const lowest = sortedByImpact.slice(0, 2).filter((a) => a.score < 70);
  const highest = [...rated].sort((a, b) => b.score - a.score)[0];

  const parts: string[] = [
    `Tu Life Score es ${score}: el promedio ponderado de ${rated.length} ${rated.length === 1 ? "área evaluada" : "áreas evaluadas"} es ${Math.round(base)}.`,
  ];
  if (penalties.length > 0) {
    parts.push(`Resto ${penalty} puntos porque ${penalties.map((p) => p.name.toLowerCase()).join(" y ")} ${penalties.length === 1 ? "está" : "están"} en estado crítico: son la base de todo lo demás.`);
  }
  if (lowest.length > 0) parts.push(`Lo que más te baja: ${lowest.map((a) => `${a.name} (${a.score})`).join(", ")}.`);
  if (highest && highest.score >= 75) parts.push(`Tu área más fuerte: ${highest.name} (${highest.score}).`);
  if (unrated.length > 0) parts.push(`${unrated.length} ${unrated.length === 1 ? "área activa no está evaluada" : "áreas activas no están evaluadas"} y no cuentan.`);

  return {
    score,
    baseScore: Math.round(base),
    penalty,
    ratedAreas: rated.length,
    unratedAreas: unrated,
    contributions: rated.map((a) => ({ key: a.key, name: a.name, score: a.score, weight: a.weight })),
    penalties,
    explanation: parts.join(" "),
  };
}

export function trendFromDelta(delta: number | null): Trend {
  if (delta === null || Math.abs(delta) < 2) return "STABLE";
  return delta > 0 ? "UP" : "DOWN";
}
