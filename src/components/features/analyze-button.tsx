"use client";

import { useTransition } from "react";
import { Sparkles } from "lucide-react";
import { analyzeDecisionAction } from "@/app/actions/decisions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export function AnalyzeDecisionButton({ id, hasAnalysis }: { id: string; hasAnalysis: boolean }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <Button variant="soft" size="sm" loading={pending} onClick={() => start(async () => { const r = await analyzeDecisionAction(id); toast.show(r.ok ? { message: r.message ?? "Listo." } : { message: r.error, tone: "error" }); })}>
      {!pending ? <Sparkles className="h-3.5 w-3.5" /> : null} {pending ? "Analizando…" : hasAnalysis ? "Re-analizar" : "Analizar con LÍA"}
    </Button>
  );
}
