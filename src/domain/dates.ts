/**
 * Date utilities. Calendar dates are ISO strings ("2026-09-29") computed in the
 * user's timezone — never `new Date("2026-09-29")` arithmetic in local time.
 */

export type IsoDate = string;

const WEEKDAYS: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
};

const MONTHS: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

export const WEEKDAY_NAMES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTH_NAMES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export function stripAccents(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Lowercase + accent-free + collapsed whitespace; ñ becomes n. */
export function normalize(text: string): string {
  return stripAccents(text.toLowerCase()).replace(/\s+/g, " ").trim();
}

export function todayIn(timezone: string, now: Date = new Date()): IsoDate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Minutes since midnight in the user's timezone. */
export function minutesNowIn(timezone: string, now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

export function hourIn(timezone: string, now: Date = new Date()): number {
  return Math.floor(minutesNowIn(timezone, now) / 60);
}

function toUtc(iso: IsoDate): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtc(date: Date): IsoDate {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  const d = toUtc(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtc(d);
}

export function diffDays(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000);
}

export function weekdayOf(iso: IsoDate): number {
  return toUtc(iso).getUTCDay();
}

/** Monday of the ISO week containing `iso`. */
export function startOfWeek(iso: IsoDate): IsoDate {
  const wd = weekdayOf(iso);
  return addDays(iso, wd === 0 ? -6 : 1 - wd);
}

export function startOfMonth(iso: IsoDate): IsoDate {
  return `${iso.slice(0, 7)}-01`;
}

export function endOfMonth(iso: IsoDate): IsoDate {
  const [y, m] = iso.split("-").map(Number);
  return fromUtc(new Date(Date.UTC(y, m, 0)));
}

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return fromUtc(toUtc(value)) === value;
}

/** "mar 29 sep" style short label, relative when close to today. */
export function formatRelative(iso: IsoDate, today: IsoDate): string {
  const diff = diffDays(today, iso);
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Mañana";
  if (diff === -1) return "Ayer";
  if (diff > 1 && diff < 7) return capitalize(WEEKDAY_NAMES[weekdayOf(iso)]);
  if (diff < -1 && diff > -7) return `Hace ${-diff} días`;
  return formatShort(iso);
}

export function formatShort(iso: IsoDate): string {
  const d = toUtc(iso);
  return `${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()].slice(0, 3)}`;
}

export function formatLong(iso: IsoDate): string {
  const d = toUtc(iso);
  return `${capitalize(WEEKDAY_NAMES[d.getUTCDay()])} ${d.getUTCDate()} de ${MONTH_NAMES[d.getUTCMonth()]}`;
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function minutesToHHMM(total: number): string {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(total)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function hhmmToMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function formatHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

// ─── Natural-language date extraction (Spanish) ────────────────────────────

export type DateMatch = { date: IsoDate; matched: string };

/**
 * Extracts the first date expression from Spanish text relative to `today`.
 * Returns the matched fragment (in normalized form) so callers can strip it
 * from titles. Returns null when nothing date-like is found — never guesses.
 */
export function parseSpanishDate(text: string, today: IsoDate): DateMatch | null {
  const t = normalize(text);
  const rules: Array<[RegExp, (m: RegExpMatchArray) => IsoDate | null]> = [
    [/\b(\d{4})-(\d{2})-(\d{2})\b/, (m) => (isValidIsoDate(m[0]) ? m[0] : null)],
    [/\bpasado manana\b/, () => addDays(today, 2)],
    // "mañana" as a day, but not "en la mañana" / "esta mañana" / "por la mañana"
    [/(?<!(?:la|esta|de|por) )\bmanana\b/, () => addDays(today, 1)],
    [/\b(esta manana|esta tarde|esta noche|hoy)\b/, () => today],
    [/\ben (\d{1,2}|un|una|dos|tres|cuatro|cinco) (dias?|semanas?)\b/, (m) => {
      const n = wordToNumber(m[1]);
      return addDays(today, m[2].startsWith("semana") ? n * 7 : n);
    }],
    [/\b(la )?(proxima|otra) semana\b|\bla semana que viene\b/, () => addDays(startOfWeek(today), 7)],
    [/\bfin de mes\b|\bfinal de mes\b/, () => endOfMonth(today)],
    [/\b(el )?(proximo |este )?(lunes|martes|miercoles|jueves|viernes|sabado|domingo)( que viene| de la otra semana)?\b/, (m) => {
      const target = WEEKDAYS[m[3]];
      const current = weekdayOf(today);
      // "el viernes", "este viernes", "el próximo viernes" → next occurrence.
      let delta = (target - current + 7) % 7;
      if (delta === 0) delta = 7;
      // "el lunes de la otra semana" → the occurrence in next week.
      if (m[4]?.includes("otra semana") && addDays(today, delta) < addDays(startOfWeek(today), 7)) delta += 7;
      return addDays(today, delta);
    }],
    [/\b(\d{1,2}) de (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?: de (\d{4}))?\b/, (m) => {
      const day = Number(m[1]);
      const month = MONTHS[m[2]];
      let year = m[3] ? Number(m[3]) : Number(today.slice(0, 4));
      let iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      if (!isValidIsoDate(iso)) return null;
      if (!m[3] && iso < today) {
        year += 1;
        iso = `${year}-${iso.slice(5)}`;
      }
      return iso;
    }],
    [/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/, (m) => {
      const day = Number(m[1]);
      const month = Number(m[2]);
      let year = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : Number(today.slice(0, 4));
      let iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      if (!isValidIsoDate(iso)) return null;
      if (!m[3] && iso < today) {
        year += 1;
        iso = `${year}-${iso.slice(5)}`;
      }
      return iso;
    }],
    [/\bel (\d{1,2})\b(?! de)(?!:)(?! ?(?:am|pm|h\b|horas|mil|k\b|%))/, (m) => {
      const day = Number(m[1]);
      if (day < 1 || day > 31) return null;
      let iso = `${today.slice(0, 8)}${String(day).padStart(2, "0")}`;
      if (!isValidIsoDate(iso)) return null;
      if (iso < today) {
        const next = addDays(endOfMonth(today), 1);
        iso = `${next.slice(0, 8)}${String(day).padStart(2, "0")}`;
        if (!isValidIsoDate(iso)) return null;
      }
      return iso;
    }],
  ];

  for (const [regex, resolve] of rules) {
    const m = t.match(regex);
    if (m) {
      const date = resolve(m);
      if (date) return { date, matched: m[0] };
    }
  }
  return null;
}

export type TimeMatch = { minutes: number; matched: string };

/** "a las 9", "9am", "3 pm", "15:30", "a las 6 de la tarde". */
export function parseSpanishTime(text: string): TimeMatch | null {
  const t = normalize(text);
  const m =
    t.match(/\ba las? (\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?(?:\s*de la (manana|tarde|noche))?/) ??
    t.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)?\b()/) ??
    t.match(/\b(\d{1,2})\s*(am|pm)\b()()/);
  if (!m) return null;
  let hour: number;
  let minute = 0;
  let suffix: string | undefined;
  let period: string | undefined;
  if (m[2] && /^\d{2}$/.test(m[2])) {
    hour = Number(m[1]);
    minute = Number(m[2]);
    suffix = m[3];
    period = m[4];
  } else if (m[2] === "am" || m[2] === "pm") {
    hour = Number(m[1]);
    suffix = m[2];
  } else {
    hour = Number(m[1]);
    suffix = m[3];
    period = m[4];
  }
  if (hour > 23 || minute > 59) return null;
  const pm = suffix?.startsWith("p") || period === "tarde" || period === "noche";
  if (pm && hour < 12) hour += 12;
  if (suffix?.startsWith("a") && hour === 12) hour = 0;
  // "a las 3" without qualifier: assume working hours (3 → 15:00).
  if (!suffix && !period && hour >= 1 && hour <= 6 && !m[2]) hour += 12;
  return { minutes: hour * 60 + minute, matched: m[0] };
}

function wordToNumber(word: string): number {
  const map: Record<string, number> = { un: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5 };
  return map[word] ?? Number(word);
}
