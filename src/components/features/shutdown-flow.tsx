"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { completeShutdownAction } from "@/app/actions/reviews";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/fields";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";

type Pending = { id: string; title: string; suggestion: "TOMORROW" | "LATER" | "DROP"; score: number };
const LABEL = { TOMORROW: "Mañana", LATER: "Más adelante", DROP: "Soltar" } as const;

export function ShutdownFlow({ done, pending }: { done: Array<{ id: string; title: string }>; pending: Pending[] }) {
  const [choices, setChoices] = useState<Record<string, Pending["suggestion"]>>(Object.fromEntries(pending.map((p) => [p.id, p.suggestion])));
  const [blockers, setBlockers] = useState("");
  const [surprises, setSurprises] = useState("");
  const [learning, setLearning] = useState("");
  const [busy, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const tomorrow = pending.filter((p) => choices[p.id] === "TOMORROW");

  return (
    <div className="space-y-5">
      <section className="card p-4">
        <p className="eyebrow mb-2">Completado hoy · {done.length}</p>
        {done.length ? <ul className="space-y-1 text-[14.5px]">{done.map((d) => <li key={d.id}>✓ {d.title}</li>)}</ul> : <p className="text-[14px] text-ink-3">Nada marcado como hecho. A veces el día es de apagar incendios; también cuenta.</p>}
      </section>

      <section className="card p-4">
        <p className="eyebrow mb-1">Pendiente · decide, no arrastres</p>
        <p className="mb-3 text-[12.5px] text-ink-3">LÍA no mueve todo a mañana: repriorizamos.</p>
        {pending.length === 0 ? <p className="text-[14px] text-ink-3">No quedó nada pendiente de hoy.</p> : (
          <ul className="space-y-3">
            {pending.map((p) => (
              <li key={p.id}>
                <p className="text-[14.5px]">{p.title}</p>
                <div className="mt-1.5 flex gap-1.5">
                  {(Object.keys(LABEL) as Array<keyof typeof LABEL>).map((k) => (
                    <button key={k} onClick={() => setChoices((c) => ({ ...c, [p.id]: k }))} aria-pressed={choices[p.id] === k} className={cn("rounded-full border px-3 py-1 text-[12.5px] transition-colors", choices[p.id] === k ? "border-ink bg-ink text-bg" : "border-line text-ink-2")}>{LABEL[k]}</button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
        {tomorrow.length > 3 ? <p className="mt-3 text-[12.5px] text-warn">Estás pasando {tomorrow.length} tareas a mañana. ¿Caben de verdad?</p> : null}
      </section>

      <label className="block space-y-1.5"><span className="px-1 text-[13px] font-medium text-ink-2">Bloqueos</span><Textarea value={blockers} onChange={(e) => setBlockers(e.target.value)} rows={2} /></label>
      <label className="block space-y-1.5"><span className="px-1 text-[13px] font-medium text-ink-2">Imprevistos</span><Textarea value={surprises} onChange={(e) => setSurprises(e.target.value)} rows={2} /></label>
      <label className="block space-y-1.5"><span className="px-1 text-[13px] font-medium text-ink-2">Aprendizaje del día</span><Textarea value={learning} onChange={(e) => setLearning(e.target.value)} rows={2} /></label>

      <Button
        size="lg"
        className="w-full"
        loading={busy}
        onClick={() =>
          start(async () => {
            const res = await completeShutdownAction({ decisions: Object.entries(choices).map(([taskId, action]) => ({ taskId, action })), blockers, surprises, learning, tomorrowBig3: tomorrow.slice(0, 3).map((t) => t.id) });
            if (!res.ok) { toast.show({ message: res.error, tone: "error" }); return; }
            toast.show({ message: "Día cerrado. Desconéctate tranquilo." });
            router.push("/");
          })
        }
      >
        Cerrar el día
      </Button>
    </div>
  );
}
