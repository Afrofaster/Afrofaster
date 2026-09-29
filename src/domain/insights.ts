/**
 * Patterns. Rule: never claim a correlation without enough data.
 * Each insight states its sample size so the user can judge it.
 */
export const MIN_DAYS_PER_GROUP = 5;

export type DayRecord = { date: string; sleepHours: number | null; big3Planned: number; big3Done: number; deepWorkMinutes: number | null };

export type Insight = { key: string; message: string; strength: "fuerte" | "moderada"; sample: string };

function rate(days: DayRecord[]): number {
  const planned = days.reduce((s, d) => s + d.big3Planned, 0);
  return planned === 0 ? 0 : days.reduce((s, d) => s + d.big3Done, 0) / planned;
}

/** "Tus días con menos de 6 h de sueño tienen 31 % menos cumplimiento del Big 3." */
export function sleepVsBig3(days: DayRecord[], threshold = 6): Insight | null {
  const usable = days.filter((d) => d.sleepHours !== null && d.big3Planned > 0);
  const low = usable.filter((d) => d.sleepHours! < threshold);
  const ok = usable.filter((d) => d.sleepHours! >= threshold);
  if (low.length < MIN_DAYS_PER_GROUP || ok.length < MIN_DAYS_PER_GROUP) return null;
  const rLow = rate(low);
  const rOk = rate(ok);
  if (rOk === 0) return null;
  const diff = Math.round(((rOk - rLow) / rOk) * 100);
  if (Math.abs(diff) < 10) return null;
  return {
    key: "sleep-big3",
    message: diff > 0 ? `Tus días con menos de ${threshold} h de sueño tienen ${diff} % menos cumplimiento del Big 3.` : `Curioso: tus días con menos de ${threshold} h de sueño tienen ${-diff} % más cumplimiento del Big 3.`,
    strength: Math.abs(diff) >= 25 && low.length + ok.length >= 20 ? "fuerte" : "moderada",
    sample: `${low.length} días con poco sueño vs ${ok.length} días descansado`,
  };
}

export function deepWorkVsBig3(days: DayRecord[], threshold = 60): Insight | null {
  const usable = days.filter((d) => d.deepWorkMinutes !== null && d.big3Planned > 0);
  const deep = usable.filter((d) => d.deepWorkMinutes! >= threshold);
  const shallow = usable.filter((d) => d.deepWorkMinutes! < threshold);
  if (deep.length < MIN_DAYS_PER_GROUP || shallow.length < MIN_DAYS_PER_GROUP) return null;
  const rDeep = rate(deep);
  const rShallow = rate(shallow);
  if (rShallow === 0 && rDeep === 0) return null;
  const diff = Math.round((rDeep - rShallow) * 100);
  if (Math.abs(diff) < 10) return null;
  return {
    key: "deep-big3",
    message: `Los días con al menos ${threshold} min de deep work cumples ${Math.round(rDeep * 100)} % del Big 3, frente a ${Math.round(rShallow * 100)} % los demás.`,
    strength: Math.abs(diff) >= 25 ? "fuerte" : "moderada",
    sample: `${deep.length} vs ${shallow.length} días`,
  };
}

export function daysNeeded(days: DayRecord[]): number {
  const withSleep = days.filter((d) => d.sleepHours !== null && d.big3Planned > 0).length;
  return Math.max(0, MIN_DAYS_PER_GROUP * 2 - withSleep);
}
