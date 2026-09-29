import { normalize } from "./dates";

export type MoneyMatch = { amount: number; matched: string };

/**
 * Parses Colombian-style amounts: "85 mil", "80.000", "$120.000", "1,5 millones",
 * "2 millones", "85k", "45000". Returns null when no amount is present.
 */
export function parseMoney(text: string): MoneyMatch | null {
  const t = normalize(text);
  const patterns: Array<[RegExp, (m: RegExpMatchArray) => number]> = [
    [/\$?\s?(\d+(?:[.,]\d+)?)\s*(millones|millon)\b/, (m) => toNumber(m[1]) * 1_000_000],
    [/\$?\s?(\d+(?:[.,]\d+)?)\s*(mil|k)\b/, (m) => toNumber(m[1]) * 1_000],
    [/\$\s?(\d{1,3}(?:[.,]\d{3})+|\d+)/, (m) => toThousands(m[1])],
    [/\b(\d{1,3}(?:\.\d{3})+)\b/, (m) => toThousands(m[1])],
    [/\b(\d{4,})\b/, (m) => Number(m[1])],
  ];
  for (const [regex, resolve] of patterns) {
    const m = t.match(regex);
    if (m) {
      const amount = Math.round(resolve(m) * 100) / 100;
      if (Number.isFinite(amount) && amount > 0) return { amount, matched: m[0].trim() };
    }
  }
  return null;
}

/** "1,5" → 1.5 ; "1.5" → 1.5 (used before a multiplier word). */
function toNumber(raw: string): number {
  return Number(raw.replace(",", "."));
}

/** "80.000" / "1,200,000" → 80000 / 1200000 (thousands separators). */
function toThousands(raw: string): number {
  return Number(raw.replace(/[.,]/g, ""));
}

export function formatMoney(amount: number, currency = "COP", locale = "es-CO"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "COP" ? 0 : 2,
  }).format(amount);
}

const EXPENSE_CATEGORIES: Array<[string, string[]]> = [
  ["Transporte", ["gasolina", "taxi", "uber", "peaje", "parqueadero", "bus", "transporte", "didi", "combustible"]],
  ["Alimentación", ["almuerzo", "comida", "cena", "desayuno", "restaurante", "cafe", "domicilio", "rappi"]],
  ["Mercado", ["mercado", "supermercado", "exito", "d1", "carulla"]],
  ["Hogar", ["arriendo", "servicios", "internet", "luz", "agua", "gas natural", "administracion"]],
  ["Salud", ["medico", "farmacia", "drogueria", "medicina", "eps", "odontologo", "gimnasio", "gym"]],
  ["Educación", ["maestria", "curso", "libro", "matricula", "universidad"]],
  ["Ocio", ["cine", "concierto", "viaje", "bar", "salida"]],
  ["Trabajo", ["oficina", "papeleria", "notaria", "tramite", "copias", "software", "suscripcion"]],
];

export function categorizeExpense(text: string): string {
  const t = normalize(text);
  for (const [category, keywords] of EXPENSE_CATEGORIES) {
    if (keywords.some((k) => t.includes(k))) return category;
  }
  return "Otros";
}
