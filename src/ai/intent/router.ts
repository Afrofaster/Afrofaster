import "server-only";
import { zodTextFormat } from "openai/helpers/zod";
import { DEFAULT_LIFE_AREAS } from "@/domain/life-areas";
import { errorCode, getOpenAI, isAIConfigured, modelFor, type AIUsage } from "../openai";
import { classifyWithRules } from "./rules";
import { INTENTS, IntentResultSchema, type IntentResult } from "./schema";

export type ClassifyContext = {
  today: string;
  timezone: string;
  projects: string[];
  people: string[];
  aiEnabled: boolean;
  onUsage?: (usage: AIUsage) => void | Promise<void>;
};

/** Rules above this confidence skip the LLM entirely (zero cost, zero latency). */
export const RULES_CONFIDENT = 0.85;

export async function classifyIntent(text: string, ctx: ClassifyContext): Promise<IntentResult> {
  const rules = classifyWithRules(text, { today: ctx.today });
  if (rules.confidence >= RULES_CONFIDENT || !ctx.aiEnabled || !isAIConfigured()) return rules;
  const llm = await classifyWithLLM(text, ctx);
  if (!llm) return rules;
  if (llm.confidence < rules.confidence) return rules;
  // Deterministic parses (dates, amounts) are more reliable than the model's.
  const entities = { ...llm.entities };
  for (const key of ["date", "amount", "metricValue"] as const) {
    if (rules.entities[key] !== null && rules.intent === llm.intent) (entities as Record<string, unknown>)[key] = rules.entities[key];
  }
  return { ...llm, entities, classifier: "hybrid" };
}

const INSTRUCTIONS = `Clasificas mensajes breves de un usuario hispanohablante para LÍA, su sistema operativo personal.
Devuelve la intención más probable y extrae entidades. Reglas:
- No inventes datos. Si algo no aparece en el texto, usa null.
- Resuelve fechas relativas a partir de HOY y devuélvelas como YYYY-MM-DD.
- "title" debe ser una acción breve en infinitivo para tareas ("Llamar a Olga").
- Una tarea (CREATE_TASK) NO es un evento: CREATE_EVENT solo si hay una cita con hora fija.
- Si alguien quedó en enviar/entregar algo, es CREATE_WAITING_FOR.
- Si es una pregunta o petición a LÍA (planear, estado, revisión), usa la intención de consulta correspondiente.
- Si hay duda real, usa UNKNOWN con confianza baja.
- confidence entre 0 y 1. requires_confirmation=true para crear proyectos/objetivos o completar/modificar registros existentes.
Intenciones válidas: ${INTENTS.join(", ")}.
Áreas de vida (usa la key): ${DEFAULT_LIFE_AREAS.map((a) => `${a.key}=${a.short}`).join(", ")}.
Métricas (metricKey): sleep_hours, weight, deep_work_minutes, training_minutes, mood, energy.`;

async function classifyWithLLM(text: string, ctx: ClassifyContext): Promise<IntentResult | null> {
  const model = modelFor("fast");
  const started = Date.now();
  try {
    const response = await getOpenAI().responses.parse({
      model,
      instructions: INSTRUCTIONS,
      input: [
        {
          role: "user",
          content: `HOY: ${ctx.today} (zona ${ctx.timezone})\nProyectos existentes: ${ctx.projects.slice(0, 30).join(" | ") || "ninguno"}\nPersonas conocidas: ${ctx.people.slice(0, 50).join(" | ") || "ninguna"}\n\nMensaje: """${text.slice(0, 1500)}"""`,
        },
      ],
      text: { format: zodTextFormat(IntentResultSchema, "intent_result") },
    });
    const parsed = IntentResultSchema.safeParse(response.output_parsed);
    await ctx.onUsage?.({ purpose: "intent_router", model, inputTokens: response.usage?.input_tokens, outputTokens: response.usage?.output_tokens, latencyMs: Date.now() - started, success: parsed.success });
    if (!parsed.success) return null;
    return { ...parsed.data, confidence: Math.max(0, Math.min(1, parsed.data.confidence)), classifier: "llm" };
  } catch (err) {
    await ctx.onUsage?.({ purpose: "intent_router", model, latencyMs: Date.now() - started, success: false, errorCode: errorCode(err) });
    return null;
  }
}
