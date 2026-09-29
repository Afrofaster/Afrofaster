/**
 * Deterministic Spanish intent router.
 *
 * Why rules first: captures must never depend on an external API, common
 * phrases should cost zero tokens, and the mandatory intent tests must be
 * stable. The LLM router is used only when these rules are unsure.
 */
import { capitalize, normalize, parseSpanishDate, parseSpanishTime, minutesToHHMM, type IsoDate } from "@/domain/dates";
import { DEFAULT_LIFE_AREAS } from "@/domain/life-areas";
import { categorizeExpense, parseMoney } from "@/domain/money";
import { emptyEntities, type Intent, type IntentEntities, type IntentResult } from "./schema";

type RuleContext = { today: IsoDate; noSplit?: boolean };

const ACCENTS: Record<string, string> = { a: "[aá]", e: "[eé]", i: "[ií]", o: "[oó]", u: "[uúü]", n: "[nñ]" };

/** Builds a regex matching a normalized fragment inside accented original text. */
function accentInsensitive(fragment: string): RegExp {
  const escaped = fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = escaped.replace(/[aeioun]/g, (c) => ACCENTS[c] ?? c);
  return new RegExp(pattern, "i");
}

function removeFragment(text: string, fragment: string | undefined): string {
  if (!fragment) return text;
  return text.replace(accentInsensitive(fragment), " ").replace(/\s+/g, " ").trim();
}

const LEADING_NOISE =
  /^(?:(?:hola\s+)?l[ií]a[,:]?\s+|oye[,]?\s+|por favor[,]?\s+|recu[eé]rdame(?:\s+que)?\s+|recordar(?:me)?\s+|tengo que\s+|debo\s+|necesito\s+|hay que\s+|me toca\s+|toca\s+|pendiente[:,]?\s+|no olvidar\s+|no olvides\s+|quiero\s+(?!que\b))+/i;

function cleanTitle(raw: string): string {
  let t = raw.trim();
  let prev = "";
  while (prev !== t) {
    prev = t;
    t = t.replace(LEADING_NOISE, "").trim();
  }
  t = t.replace(/^(?:que\s+|el\s+|la\s+)?/i, (m) => (/^que\s+/i.test(m) ? "" : m));
  t = t.replace(/[\s,;:.!¡¿?]+$/g, "").replace(/^[\s,;:.!¡¿?]+/g, "");
  return capitalize(t);
}

/** Keeps articles and lowercase: "el contrato" reads well in "Sigues esperando el contrato de Carlos". */
function cleanItem(raw: string): string | null {
  const t = raw.replace(/[\s,;:.!¡¿?]+$/g, "").trim();
  return t ? t.charAt(0).toLowerCase() + t.slice(1) : null;
}

function stripAddress(text: string): string {
  return text.replace(/^\s*(?:hola\s+)?l[ií]a[,:]?\s+/i, "").trim();
}

const TASK_VERBS =
  "llamar|enviar|mandar|escribir|pagar|revisar|comprar|preparar|terminar|hacer|agendar|redactar|radicar|presentar|contestar|responder|reservar|renovar|recoger|programar|buscar|leer|estudiar|investigar|confirmar|cotizar|firmar|entregar|actualizar|publicar|grabar|sacar|ir|visitar|llevar|traer|solicitar|pedir|cancelar|limpiar|arreglar|reparar|organizar|definir|diseñar|disenar|crear|montar|subir|descargar|imprimir|notificar|citar|preguntar|recordarle|avisar|hablar|reunirme|reunir|entrenar|correr|meditar|cocinar|lavar|tramitar|renovar|sustentar|elaborar|revisar|corregir|completar|finalizar|iniciar|empezar|comenzar|resolver|aprobar|validar|coordinar|contactar|agradecer|felicitar|devolver|consignar|transferir|declarar|facturar|cobrar|negociar|proponer|planear|planificar|practicar|repasar|escuchar|ver";

const PERSON_RE = /\b(?:a|con|para|de|le)\s+((?:(?:Dr|Dra|Sr|Sra|Ing|Lic)\.?\s+)?[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)/;
const NOT_PEOPLE = new Set(["Lía", "Lia", "Hoy", "Mañana", "Proyecto", "Big", "Inbox"]);

function extractPerson(text: string): string | null {
  const m = text.match(PERSON_RE);
  if (!m) return null;
  const name = m[1].trim();
  return NOT_PEOPLE.has(name.split(" ")[0]) ? null : name;
}

function detectArea(n: string): string | null {
  let best: { key: string; hits: number } | null = null;
  for (const area of DEFAULT_LIFE_AREAS) {
    const hits = area.keywords.filter((k) => new RegExp(`\\b${normalize(k)}`).test(n)).length;
    if (hits > 0 && (!best || hits > best.hits)) best = { key: area.key, hits };
  }
  return best?.key ?? null;
}

function detectProjectMention(text: string): string | null {
  const explicit = text.match(/\bproyecto\s+([A-ZÁÉÍÓÚÑ0-9][\wÁÉÍÓÚÑáéíóúñ+&-]*(?:\s+[A-ZÁÉÍÓÚÑ0-9][\wÁÉÍÓÚÑáéíóúñ+&-]*)?)/i);
  if (explicit) return explicit[1];
  const acronym = text.match(/\b(?:para|de|del|sobre|a|al)\s+([A-Z]{2,}[+]?)\b/);
  return acronym ? acronym[1] : null;
}

const WORD_NUMBERS: Record<string, number> = { una: 1, un: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10 };
function num(raw: string): number {
  return WORD_NUMBERS[raw] ?? Number(raw.replace(",", "."));
}

function result(intent: Intent, confidence: number, entities: Partial<IntentEntities> = {}, requiresConfirmation = false): IntentResult {
  return { intent, confidence, entities: { ...emptyEntities(), ...entities }, requires_confirmation: requiresConfirmation, classifier: "rules" };
}

// ─── Query intents ──────────────────────────────────────────────────────────
function matchQuery(n: string, ctx: RuleContext): IntentResult | null {
  const date = parseSpanishDate(n, ctx.today);

  if (/\b(por ?que|porque)\b.*\b(big ?[123]|prioridad|primero|priorizaste)\b/.test(n)) return result("EXPLAIN_PRIORITY", 0.9);
  if (/^(organiza(me)?|organizame|planea(me)?|planifica(me)?|arma(me)?|planeemos|organicemos|ayudame a (organizar|planear))\b/.test(n) || /\bque (deberia|debo|hago|puedo) hacer (hoy|manana|primero|ahora)\b/.test(n)) {
    return result("PLAN_DAY", 0.95, { date: date?.date ?? ctx.today });
  }
  if (/\b(estoy|me siento|ando) (saturad[oa]|abrumad[oa]|colapsad[oa]|desbordad[oa]|agotad[oa]|reventad[oa]|a tope)\b|\bno doy abasto\b|\btengo demasiad[oa]s?\b|\bno me alcanza el tiempo\b|\btengo capacidad\b|\bpuedo asumir\b/.test(n)) {
    return result("CAPACITY_REVIEW", 0.95);
  }
  if (/^(y )?(como|que tal) (vamos|voy|va todo|estoy|va mi (vida|semana|mes|dia))\b|\bestado (general|ejecutivo)\b|\bresumen ejecutivo\b|\bcomo vamos\b/.test(n)) {
    return result("EXECUTIVE_STATUS", 0.95);
  }
  if (/\b(revision|reunion) (semanal|ceo)\b|\bceo meeting\b|\bhagamos la revision\b|\brevisemos la semana\b/.test(n)) return result("WEEKLY_REVIEW", 0.95);
  if (/\b(cierre|cerrar|shutdown) (del|el) dia\b|\bcerremos el dia\b|^shutdown\b/.test(n)) return result("DAILY_SHUTDOWN", 0.95);
  if (/\b(daily )?brief\b|\bresumen (de|del) (hoy|dia)\b/.test(n)) return result("DAILY_BRIEF", 0.9);
  if (/\bque (tengo|hay) (pendiente|por hacer)\b|\bmis pendientes\b|^pendientes\??$|\bque (olvide|me falta)\b|\bque estoy esperando\b|\bopen loops\b/.test(n)) {
    return result("GET_OPEN_LOOPS", 0.93);
  }
  if (/\bque tengo (hoy|manana)\b|\bmi agenda\b|\bagenda de (hoy|manana)\b/.test(n)) return result("GET_TODAY", 0.9, { date: date?.date ?? ctx.today });
  if (/^(busca|buscar|encuentra|donde (esta|guarde))\b/.test(n)) return result("SEARCH", 0.85, { query: n.replace(/^(busca|buscar|encuentra|donde (esta|guarde))\s*/, "") });
  return null;
}

// ─── Capture intents ────────────────────────────────────────────────────────
export function classifyWithRules(input: string, ctx: RuleContext): IntentResult {
  const original = stripAddress(input.trim());
  const n = normalize(original);
  if (!n) return result("UNKNOWN", 0);

  const query = matchQuery(n, ctx);
  if (query) return query;

  const dateMatch = parseSpanishDate(n, ctx.today);
  const timeMatch = parseSpanishTime(n);
  const area = detectArea(n);

  const parts = splitCompound(original);
  if (parts.length >= 2 && !ctx.noSplit) {
    const actionable = parts.filter((p) => classifyWithRules(p, { ...ctx, noSplit: true }).intent !== "UNKNOWN");
    if (actionable.length >= 2) return result("MULTI_CAPTURE", 0.85, { date: dateMatch?.date ?? null, description: JSON.stringify(parts) });
  }

  // Decision
  const decision = original.match(/(?:tengo que|debo|necesito|hay que)\s+decidir\s+(?:si\s+)?(.+)$/i) ?? original.match(/^no s[eé] si\s+(.+)$/i) ?? original.match(/^(?:decisi[oó]n|decidir)[:\s]+(.+)$/i);
  if (decision) {
    const q = decision[1].replace(/[?.!]+$/, "").trim();
    return result("DECISION_FLOW", 0.93, { question: `¿${capitalize(q)}?`, title: capitalize(q), date: dateMatch?.date ?? null, area });
  }

  // Waiting for
  const waiting = original.match(
    /^(.+?)\s+(?:qued[oó]\s+(?:de|en)|(?:me\s+)?va\s+a|prometi[oó]|se\s+comprometi[oó]\s+a|dijo\s+que\s+(?:me\s+)?(?:enviar[ií]a|mandar[ií]a|pasar[ií]a|entregar[ií]a))\s+(?:enviar|mandar|pasar|entregar|dar|confirmar|compartir|traer|devolver|responder)?(?:me|nos|le)?\s*(.*)$/i,
  );
  if (waiting && /^[A-ZÁÉÍÓÚÑ]/.test(waiting[1].trim())) {
    const person = waiting[1].replace(/^(?:el|la|doctor|doctora)\s+/i, "").trim();
    const item = cleanItem(removeFragment(waiting[2] ?? "", dateMatch?.matched));
    return result("CREATE_WAITING_FOR", 0.94, { person, expectedItem: item, title: item ? capitalize(item) : null, date: dateMatch?.date ?? null, area });
  }
  const followUp = original.match(/^(?:haz(?:me)?\s+)?(?:seguimiento|seguir)\s+(?:de|a|con)\s+(.+?)(?:\s+(?:por|sobre|con)\s+(.+))?[.!]?$/i);
  if (followUp) {
    return result("CREATE_WAITING_FOR", 0.9, { person: capitalize(followUp[1].trim()), expectedItem: followUp[2] ? cleanItem(followUp[2]) : null, date: dateMatch?.date ?? null });
  }
  const waitingFor = original.match(/^estoy esperando\s+(?:que\s+)?(.+?)\s+(?:de|a)\s+([A-ZÁÉÍÓÚÑ][\wáéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][\wáéíóúñ]+)?)/);
  if (waitingFor) {
    return result("CREATE_WAITING_FOR", 0.9, { person: waitingFor[2], expectedItem: cleanItem(waitingFor[1]), date: dateMatch?.date ?? null });
  }

  // Metrics
  const sleep = n.match(/\bdormi\s+(\d+(?:[.,]\d+)?|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s*(?:horas?|h\b)(\s+y\s+media)?/);
  if (sleep) return result("LOG_METRIC", 0.97, { metricKey: "sleep_hours", metricValue: num(sleep[1]) + (sleep[2] ? 0.5 : 0), date: dateMatch?.date ?? ctx.today, area: "physical_health" });
  const weight = n.match(/\b(?:peso|pese|estoy pesando)\s+(\d+(?:[.,]\d+)?)\s*(?:kg|kilos)?\b/);
  if (weight) return result("LOG_METRIC", 0.95, { metricKey: "weight", metricValue: num(weight[1]), date: dateMatch?.date ?? ctx.today, area: "physical_health" });
  const deep = n.match(/(\d+(?:[.,]\d+)?)\s*(min|minutos|horas?|h)\s+de\s+(?:deep work|trabajo profundo)/) ?? n.match(/(?:deep work|trabajo profundo)[^\d]{0,20}(\d+(?:[.,]\d+)?)\s*(min|minutos|horas?|h)\b/);
  if (deep) {
    const minutes = /^h/.test(deep[2]) ? num(deep[1]) * 60 : num(deep[1]);
    return result("LOG_METRIC", 0.95, { metricKey: "deep_work_minutes", metricValue: minutes, date: dateMatch?.date ?? ctx.today, area: "career" });
  }
  const mood = n.match(/\b(?:mi\s+)?(?:estado de animo|animo|mood)\s+(?:es|esta|hoy|de)?\s*(?:en\s+)?(\d{1,2})\b/);
  if (mood) return result("LOG_METRIC", 0.9, { metricKey: "mood", metricValue: Math.min(10, num(mood[1])), date: ctx.today, area: "mental_health" });
  const training = n.match(/^(?:hoy\s+)?(?:entrene|hice ejercicio|fui al (?:gym|gimnasio)|corri|sali a correr|nade)\b(?:.*?(\d+)\s*(min|minutos|horas?|h|km)\b)?/);
  if (training) {
    if (training[1] && training[2] !== "km") {
      const minutes = /^h/.test(training[2]) ? num(training[1]) * 60 : num(training[1]);
      return result("LOG_METRIC", 0.93, { metricKey: "training_minutes", metricValue: minutes, date: ctx.today, area: "physical_health" });
    }
    return result("LOG_HABIT", 0.9, { title: "Entrenar", date: ctx.today, area: "physical_health" });
  }

  // Money
  const money = parseMoney(n);
  if (money && /\b(gaste|pague|compre|me costo|costo|gasto|pagamos|gastamos)\b/.test(n)) {
    const description = cleanTitle(removeFragment(removeFragment(original.replace(/^(?:hoy\s+|ayer\s+)?(?:gast[eé]|pagu[eé]|compr[eé]|me cost[oó])\s+/i, ""), money.matched), dateMatch?.matched).replace(/^(?:en|de|por)\s+/i, ""));
    return result("LOG_EXPENSE", 0.95, { amount: money.amount, category: categorizeExpense(n), description: description || null, title: description || null, date: dateMatch?.date ?? ctx.today, area: "finances" });
  }
  if (money && /\b(me pagaron|recibi|cobre|ingreso|ingresaron|me consignaron)\b/.test(n)) {
    return result("LOG_INCOME", 0.9, { amount: money.amount, category: "Ingreso", description: cleanTitle(original), date: dateMatch?.date ?? ctx.today, area: "finances" });
  }

  // Completion of an existing task
  const done = original.match(/^(?:ya\s+)?(termin[eé]|complet[eé]|acab[eé]|hice|finalic[eé]|listo[:,]?|hecho[:,]?|ya)\s+(.+)$/i);
  if (done && (!/^ya$/i.test(done[1]) || /^(llam|envi|mand|pagu|entregu|radiqu|habl|escrib|compr|revis|termin|hice)/i.test(done[2]))) {
    return result("COMPLETE_TASK", 0.9, { query: done[2].replace(/[.!]+$/, "") }, true);
  }

  // Idea
  const idea = original.match(/^(?:tengo\s+)?(?:una\s+)?(?:nueva\s+)?idea(?:\s+(?:de|para|sobre))?[:\s]+(.+)$/i) ?? original.match(/^se me ocurri[oó]\s+(?:que\s+)?(.+)$/i);
  if (idea || /^idea[:\s]/i.test(original)) {
    const body = idea ? idea[1] : original.replace(/^idea[:\s]+/i, "");
    return result("CAPTURE_IDEA", 0.93, { title: cleanTitle(body), project: detectProjectMention(original), area: area ?? "business" });
  }

  // Goal / project
  const goal = original.match(/^(?:mi\s+)?(?:objetivo|meta)(?:\s+(?:es|para\s+este\s+a[ñn]o\s+es|de\s+\S+\s+es))?[:\s]+(.+)$/i) ?? original.match(/^quiero\s+(?:lograr|conseguir|alcanzar)\s+(.+)$/i);
  if (goal) return result("CREATE_GOAL", 0.88, { title: cleanTitle(goal[1]), date: dateMatch?.date ?? null, area }, true);
  const project = original.match(/^(?:nuevo\s+proyecto|crear\s+(?:un\s+)?proyecto|proyecto\s+nuevo)[:\s]+(.+)$/i) ?? original.match(/^quiero\s+(?:empezar|arrancar|montar|iniciar|lanzar|crear)\s+(?:un|una)\s+(?:nuevo|nueva)?\s*(negocio|proyecto|emprendimiento|empresa|podcast|canal|marca.*)$/i);
  if (project) return result("CREATE_PROJECT", 0.85, { title: cleanTitle(project[1]), area: /negocio|emprendimiento|empresa/i.test(project[1]) ? "business" : area }, true);

  // Notes & preferences
  const note = original.match(/^(?:nota|anota(?:\s+que)?|apunta(?:\s+que)?|recuerda\s+que|dato)[:\s]+(.+)$/i);
  if (note) return result("CAPTURE_NOTE", 0.9, { title: cleanTitle(note[1]), description: note[1], area });
  if (/^(?:yo\s+)?(?:prefiero|me gusta m[aá]s|me funciona mejor)\b/i.test(original)) return result("CAPTURE_NOTE", 0.85, { title: cleanTitle(original), description: original, category: "PREFERENCE" });

  // Person update
  const talked = original.match(/^(?:habl[eé]|me\s+reun[ií]|almorc[eé]|estuve)\s+con\s+([A-ZÁÉÍÓÚÑ][\wáéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][\wáéíóúñ]+)?)(.*)$/);
  if (talked) return result("PERSON_UPDATE", 0.88, { person: talked[1], description: original, area });
  const birthday = original.match(/^(?:el\s+)?cumplea[ñn]os\s+de\s+([A-ZÁÉÍÓÚÑ][\wáéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][\wáéíóúñ]+)?)/);
  if (birthday && dateMatch) return result("PERSON_UPDATE", 0.85, { person: birthday[1], date: dateMatch.date, category: "BIRTHDAY" });

  // Event: a fixed appointment with a time → EVENT (never auto-converted to task).
  const eventNoun = /\b(audiencia|reunion|cita|junta|almuerzo con|cena con|clase|vuelo|entrevista|diligencia|consulta|comite|webinar|llamada con)\b/;
  if (timeMatch && eventNoun.test(n) && !new RegExp(`^(${TASK_VERBS})\\b`).test(removeFragment(n, dateMatch?.matched))) {
    let title = removeFragment(removeFragment(original, dateMatch?.matched), timeMatch.matched);
    title = title.replace(/^(?:tengo|hay|voy a tener)\s+(?:una?\s+)?/i, "");
    return result("CREATE_EVENT", 0.88, { title: cleanTitle(title), date: dateMatch?.date ?? ctx.today, time: minutesToHHMM(timeMatch.minutes), area });
  }

  // Task (default for actionable text)
  const withoutDate = removeFragment(original, dateMatch?.matched);
  const withoutTime = timeMatch ? removeFragment(withoutDate, timeMatch.matched) : withoutDate;
  const title = cleanTitle(withoutTime);
  const titleN = normalize(title);
  const startsWithVerb = new RegExp(`^(${TASK_VERBS})(le|les|lo|la|me)?\\b`).test(titleN);
  const hadObligation = /\b(tengo que|debo|necesito|hay que|recuerdame|me toca|no olvidar|pendiente|quiero)\b/.test(n);
  if (startsWithVerb || hadObligation) {
    return result("CREATE_TASK", startsWithVerb ? 0.92 : 0.8, {
      title,
      date: dateMatch?.date ?? null,
      time: timeMatch ? minutesToHHMM(timeMatch.minutes) : null,
      person: extractPerson(title),
      project: detectProjectMention(original),
      area,
    });
  }

  // Risk / document reference
  if (/\b(riesgo|peligro|me preocupa)\b/.test(n)) return result("CAPTURE_NOTE", 0.6, { title: cleanTitle(original), category: "RISK", area });

  // Short text with a date is probably a task; otherwise uncertain.
  if (dateMatch && title.split(" ").length <= 8) return result("CREATE_TASK", 0.6, { title, date: dateMatch.date, area });
  return result("UNKNOWN", 0.3, { title: cleanTitle(original), area });
}

const SPLIT_VERBS = `(?:quiero|necesito|tengo que|debo|hay que|${TASK_VERBS})`;

/** "tengo audiencia a las 9, necesito terminar X, llamar a Olga y quiero entrenar" → 4 parts. */
export function splitCompound(text: string): string[] {
  const cleaned = stripAddress(text).replace(/[.!]+$/, "");
  return cleaned
    .split(new RegExp(`\\s*[,;]\\s*(?:y\\s+)?|\\s+y\\s+(?=${SPLIT_VERBS}\\b)`, "i"))
    .map((p) => p.trim())
    .filter((p) => p.length > 2);
}
