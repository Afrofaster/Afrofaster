"use server";

import { getDecision, saveDecisionAnalysis } from "@/application/decisions";
import { runCapacityReview } from "@/application/intelligence";
import { analyzeDecision } from "@/ai/decision-analysis";
import { runAction } from "@/server/action";

export async function analyzeDecisionAction(id: string) {
  return runAction(
    "analyzeDecision",
    async (ctx) => {
      const decision = await getDecision(ctx, id);
      const capacity = await runCapacityReview(ctx);
      const analysis = await analyzeDecision({
        question: decision.question,
        context: decision.context,
        options: decision.options.map((o) => o.label),
        capacityLevel: capacity.level,
        capacitySummary: capacity.summary,
        activeProjects: capacity.activeProjects,
      });
      await saveDecisionAnalysis(ctx, id, analysis);
      return analysis;
    },
    { message: "Análisis listo. La decisión sigue siendo tuya." },
  );
}
