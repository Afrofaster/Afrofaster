import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import type { LifeScoreView } from "@/application/areas";
import { CAPACITY_LABEL, type CapacityLevel } from "@/domain/enums";
import { Card } from "@/components/ui/primitives";
import { ScoreRing } from "@/components/ui/score-ring";
import { cn } from "@/lib/cn";

export function LifeScoreCard({ score, capacity }: { score: LifeScoreView; capacity: { level: CapacityLevel; summary: string } }) {
  const delta = score.delta;
  const TrendIcon = delta === null || Math.abs(delta) < 2 ? ArrowRight : delta > 0 ? ArrowUpRight : ArrowDownRight;
  const trendText = delta === null ? "Sin historial aún" : Math.abs(delta) < 2 ? "Estable" : `${delta > 0 ? "+" : ""}${delta} vs. ${score.previousDate ? "última medición" : "antes"}`;
  const capacityTone = { NORMAL: "text-good bg-good-soft", HIGH: "text-warn bg-warn-soft", OVERLOADED: "text-bad bg-bad-soft", CRITICAL: "text-bad bg-bad-soft" }[capacity.level];
  return (
    <Card className="p-5">
      <div className="flex items-center gap-5">
        <ScoreRing score={score.score} size={112}>
          <div className="text-center">
            <p className="display text-[2.1rem] leading-none">{score.score ?? "—"}</p>
            <p className="mt-0.5 text-[10.5px] tracking-wide text-ink-3">/ 100</p>
          </div>
        </ScoreRing>
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Life Score</p>
          <p className={cn("mt-1 flex items-center gap-1 text-sm font-medium", delta !== null && delta >= 2 && "text-good", delta !== null && delta <= -2 && "text-bad", (delta === null || Math.abs(delta) < 2) && "text-ink-2")}>
            <TrendIcon className="h-4 w-4" /> {trendText}
          </p>
          <p className={cn("mt-3 inline-flex rounded-full px-2.5 py-1 text-[12px] font-medium", capacityTone)}>Capacidad {CAPACITY_LABEL[capacity.level].toLowerCase()}</p>
          <p className="mt-1.5 text-[12.5px] leading-snug text-ink-3">{capacity.summary}</p>
        </div>
      </div>
      <details className="group mt-4 border-t border-line pt-3">
        <summary className="flex cursor-pointer list-none items-center justify-between text-[13px] font-medium text-ink-2 hover:text-ink [&::-webkit-details-marker]:hidden">
          ¿Por qué tengo {score.score ?? "este puntaje"}?
          <span className="text-ink-3 transition-transform group-open:rotate-90">›</span>
        </summary>
        <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">{score.explanation}</p>
        {score.score === null ? (
          <Link href="/life" className="mt-2 inline-block text-[13px] font-medium text-accent">Evaluar mis áreas →</Link>
        ) : null}
      </details>
    </Card>
  );
}
