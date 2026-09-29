/**
 * Lightweight entity resolution for people and duplicate detection for
 * projects/goals/tasks. Conservative by design: suggest, never auto-merge
 * on low confidence.
 */
import { normalize } from "./dates";

const HONORIFICS = /^(dr|dra|doctor|doctora|sr|sra|senor|senora|srta|lic|ing|abog|prof|don|dona)\.?\s+/;
const STOPWORDS = new Set(["el", "la", "los", "las", "de", "del", "y", "a", "para", "por", "un", "una", "proyecto", "objetivo", "meta"]);

export function normalizeName(name: string): string {
  let n = normalize(name).replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  while (HONORIFICS.test(n)) n = n.replace(HONORIFICS, "");
  return n;
}

export function tokens(text: string): string[] {
  return normalizeName(text)
    .split(" ")
    .filter((t) => t.length > 0 && !STOPWORDS.has(t));
}

function bigrams(text: string): Set<string> {
  const s = ` ${text} `;
  const out = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2));
  return out;
}

/** Sørensen–Dice coefficient on character bigrams (0..1). */
export function similarity(a: string, b: string): number {
  const x = tokens(a).join(" ");
  const y = tokens(b).join(" ");
  if (!x || !y) return 0;
  if (x === y) return 1;
  const A = bigrams(x);
  const B = bigrams(y);
  let inter = 0;
  for (const g of A) if (B.has(g)) inter++;
  return (2 * inter) / (A.size + B.size);
}

export type PersonCandidate = { id: string; name: string; aliases: string[] };
export type PersonMatch = { id: string; name: string; confidence: number };

/**
 * "Dr. Carlos Pérez", "Carlos Pérez" and "Carlos" may be the same person.
 * - exact (after removing honorifics) or alias match → 0.97
 * - mention is a token-prefix of exactly one candidate ("Carlos") → 0.82
 * - same when several candidates share it → 0.5 each (ambiguous)
 * - fuzzy similarity otherwise
 */
export function matchPerson(mention: string, candidates: PersonCandidate[]): PersonMatch[] {
  const m = normalizeName(mention);
  if (!m) return [];
  const mTokens = m.split(" ");
  const scored = candidates.map((c) => {
    const names = [c.name, ...c.aliases].map(normalizeName);
    if (names.includes(m)) return { id: c.id, name: c.name, confidence: 0.97 };
    const cTokens = normalizeName(c.name).split(" ");
    const subset = mTokens.every((t) => cTokens.includes(t));
    if (subset) return { id: c.id, name: c.name, confidence: 0.82, subset: true };
    return { id: c.id, name: c.name, confidence: Math.round(similarity(m, c.name) * 0.9 * 100) / 100 };
  });
  const subsetMatches = scored.filter((s) => "subset" in s);
  if (subsetMatches.length > 1) for (const s of subsetMatches) s.confidence = 0.5;
  return scored
    .filter((s) => s.confidence >= 0.4)
    .map(({ id, name, confidence }) => ({ id, name, confidence }))
    .sort((a, b) => b.confidence - a.confidence);
}

export const AUTO_LINK_THRESHOLD = 0.8;
export const DUPLICATE_THRESHOLD = 0.82;

export type TitledRecord = { id: string; title: string };

/** Returns likely duplicates of `title` (e.g. "Proyecto Carmen" vs "Carmen"). */
export function findDuplicates<T extends TitledRecord>(title: string, existing: T[], threshold = DUPLICATE_THRESHOLD): Array<T & { similarity: number }> {
  return existing
    .map((r) => ({ ...r, similarity: similarity(title, r.title) }))
    .filter((r) => r.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity);
}

/**
 * Finds the record whose title best overlaps the free-text mention, e.g.
 * "terminé la llamada a Olga" → task "Llamar a Olga". Uses stem overlap so
 * "llamada"/"llamar" match.
 */
export function bestTextMatch<T extends TitledRecord>(text: string, records: T[]): (T & { confidence: number }) | null {
  const stem = (w: string) => w.slice(0, Math.max(4, w.length - 3));
  const q = tokens(text).filter((t) => t.length > 2).map(stem);
  if (q.length === 0) return null;
  let best: (T & { confidence: number }) | null = null;
  for (const r of records) {
    const rt = tokens(r.title).filter((t) => t.length > 2).map(stem);
    if (rt.length === 0) continue;
    const hits = rt.filter((t) => q.some((x) => x.startsWith(t) || t.startsWith(x))).length;
    const confidence = hits / rt.length;
    if (hits > 0 && (!best || confidence > best.confidence)) best = { ...r, confidence: Math.round(confidence * 100) / 100 };
  }
  return best;
}
