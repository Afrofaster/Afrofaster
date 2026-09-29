import "server-only";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import type { DecisionAnalysis } from "@/server/db/schema";
import { errorCode, getOpenAI, isAIConfigured, modelFor, type AIUsage } from "./openai";

const AnalysisSchema = z.object({
  alternatives: z.array(z.string()),
  benefits: z.array(z.string()),
  costs: z.array(z.string()),
  risks: z.array(z.string()),
  reversibility: z.string(),
  opportunityCost: z.string(),
  missingInformation: z.array(z.string()),
  questions: z.array(z.string()),
});

export type DecisionInput = {
  question: string;
  context: string | null;
  options: string[];
  capacitySummary: string;
  capacityLevel: string;
  activeProjects: number;
};

/**
 * analyze_decision: structures the decision, never makes it.
 * Deterministic scaffold without AI; richer analysis with it.
 */
export async function analyzeDecision(input: DecisionInput, onUsage?: (u: AIUsage) => Promise<void> | void): Promise<DecisionAnalysis> {
  const base = scaffold(input);
  if (!isAIConfigured()) return base;
  const model = modelFor("main");
  const started = Date.now();
  try {
    const res = await getOpenAI().responses.parse({
      model,
      instructions:
        "Eres LÍA, Chief of Staff personal. Analiza una decisión del usuario en español, de forma concisa y concreta. No decides por él. No inventes hechos: si falta información, dilo en missingInformation. Considera su capacidad actual. Máximo 4 elementos por lista, frases cortas.",
      input: `Decisión: ${input.question}\nContexto: ${input.context ?? "(sin contexto)"}\nOpciones: ${input.options.join(" | ") || "(no definidas)"}\nCapacidad actual: ${input.capacityLevel} — ${input.capacitySummary}\nProyectos activos: ${input.activeProjects}`,
      text: { format: zodTextFormat(AnalysisSchema, "decision_analysis") },
    });
    await onUsage?.({ purpose: "analyze_decision", model, inputTokens: res.usage?.input_tokens, outputTokens: res.usage?.output_tokens, latencyMs: Date.now() - started, success: Boolean(res.output_parsed) });
    const parsed = AnalysisSchema.safeParse(res.output_parsed);
    return parsed.success ? { ...parsed.data, generatedAt: new Date().toISOString() } : base;
  } catch (err) {
    await onUsage?.({ purpose: "analyze_decision", model, latencyMs: Date.now() - started, success: false, errorCode: errorCode(err) });
    return base;
  }
}

function scaffold(input: DecisionInput): DecisionAnalysis {
  const overloaded = input.capacityLevel === "OVERLOADED" || input.capacityLevel === "CRITICAL";
  return {
    alternatives: input.options.length ? input.options : ["Aceptar", "Rechazar", "Aceptar con condiciones (alcance, precio o fecha distintos)", "Posponer la decisión con una fecha clara"],
    benefits: ["¿Qué ganas concretamente (dinero, aprendizaje, relación, posición)?"],
    costs: [`Tiempo y energía: ${input.capacitySummary}`],
    risks: overloaded ? ["Tu capacidad ya está al límite: aceptar sin quitar algo aumenta el riesgo de incumplir lo actual."] : ["¿Qué pasa si sale mal? ¿Quién más se ve afectado?"],
    reversibility: "¿Es una puerta de dos vías (reversible) o de una sola vía? Las reversibles se deciden rápido; las irreversibles, con más información.",
    opportunityCost: overloaded ? `Con ${input.activeProjects} proyectos activos, decir sí implica decir no (o más tarde) a otra cosa. ¿A qué?` : "¿A qué dirías que no si dices que sí?",
    missingInformation: ["¿Cuánto tiempo semanal exige realmente?", "¿Cuál es el peor escenario razonable?"],
    questions: ["¿Esto te acerca a tus objetivos de 90 días?", "Si hoy tuvieras la mitad del tiempo libre, ¿lo aceptarías?"],
    generatedAt: new Date().toISOString(),
  };
}
