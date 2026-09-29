"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { completeMonthlyReviewAction } from "@/app/actions/reviews";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/fields";
import { useToast } from "@/components/ui/toast";

export function MonthlyClose() {
  const [notes, setNotes] = useState("");
  const [busy, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <div className="space-y-3">
      <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Conclusiones del mes, en tus palabras." rows={3} />
      <Button className="w-full" size="lg" loading={busy} onClick={() => start(async () => { const r = await completeMonthlyReviewAction(notes); if (!r.ok) { toast.show({ message: r.error, tone: "error" }); return; } toast.show({ message: "Board mensual guardado." }); router.push(`/reviews/${r.data.id}`); })}>Guardar snapshot del mes</Button>
    </div>
  );
}
