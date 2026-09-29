"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import type { WeeklyReview } from "@/application/reviews";
import { completeWeeklyReviewAction } from "@/app/actions/reviews";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/fields";
import { Badge, Progress } from "@/components/ui/primitives";
import { HealthDot } from "@/components/ui/score-ring";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { findAreaDefinition } from "@/domain/life-areas";

const STEPS = ["Resumen", "Resultados", "Riesgos", "Próxima semana", "Cierre"];

export function WeeklyReviewFlow({ data }: { data: WeeklyReview }) {
  const [step, setStep] = useState(0);
  const [big3, setBig3] = useState<string[]>(data.nextWeekBig3.map((b) => b.id));
  const [control, setControl] = useState<number | null>(null);
  const [learning, setLearning] = useState("");
  const [wins, setWins] = useState("");
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  function finish() {
    if (!control) {
      toast.show({ message: "Indica qué tanto control sentiste (1–5).", tone: "error" });
      return;
    }
    start(async () => {
      const res = await completeWeeklyReviewAction({ perceivedControl: control, learning, wins, nextWeekBig3: big3 });
      if (!res.ok) { toast.show({ message: res.error, tone: "error" }); return; }
      toast.show({ message: "Revisión guardada. Buena semana." });
      router.push(`/reviews/${res.data.id}`);
    });
  }

  return (
    <div className="space-y-5">
      <nav className="flex gap-1.5" aria-label="Pasos">
        {STEPS.map((s, i) => (
          <button key={s} onClick={() => setStep(i)} className="flex-1 text-left" aria-current={i === step ? "step" : undefined}>
            <span className={cn("block h-1 rounded-full transition-colors", i <= step ? "bg-ink" : "bg-surface-3")} />
            <span className={cn("mt-1.5 hidden text-[11px] sm:block", i === step ? "text-ink" : "text-ink-3")}>{s}</span>
          </button>
        ))}
      </nav>

      <div key={step} className="space-y-4 animate-fade-up">
        {step === 0 ? (
          <>
            <Section title="Executive summary"><p className="text-[15px] leading-relaxed">{data.executiveSummary}</p></Section>
            <Section title={`Life Score ${data.lifeScore.score ?? "—"}${data.lifeScore.delta !== null ? ` (${data.lifeScore.delta >= 0 ? "+" : ""}${data.lifeScore.delta})` : ""}`}>
              <p className="text-[13.5px] leading-relaxed text-ink-2">{data.lifeScore.explanation}</p>
            </Section>
            <Section title="Áreas">
              <ul className="grid grid-cols-2 gap-x-4 gap-y-2">
                {data.areas.map((a) => <li key={a.key} className="flex items-center gap-2 text-[13.5px]"><HealthDot health={a.health} /> <span className="truncate">{findAreaDefinition(a.key)?.short ?? a.name}</span><span className="ml-auto tabular-nums text-ink-3">{a.score ?? "—"}</span></li>)}
              </ul>
            </Section>
            <Section title="Objetivos">
              {data.goals.length === 0 ? <Empty /> : data.goals.map((g) => (
                <div key={g.id} className="mb-2.5 last:mb-0">
                  <div className="flex justify-between text-[14px]"><span>{g.title}</span>{g.status === "AT_RISK" ? <Badge tone="bad">En riesgo</Badge> : null}</div>
                  {g.progress !== null ? <Progress value={g.progress} className="mt-1.5" /> : null}
                </div>
              ))}
            </Section>
            <Section title="Proyectos activos">
              {data.projects.length === 0 ? <Empty /> : data.projects.map((p) => (
                <p key={p.id} className="flex justify-between py-1 text-[14px]"><span className={p.stale ? "text-warn" : ""}>{p.title}{p.stale ? " · sin movimiento" : ""}</span><span className="tabular-nums text-ink-3">{p.progress}%</span></p>
              ))}
            </Section>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <Section title="Wins"><List items={data.wins} empty="Esta semana no se cerraron tareas registradas." /></Section>
            <Field label="¿Algún logro que no quedó registrado?"><Textarea value={wins} onChange={(e) => setWins(e.target.value)} rows={2} /></Field>
            <Section title="Misses"><List items={data.misses} empty="Nada vencido. Bien." /></Section>
            <Section title="Causas raíz (sin culpas)"><List items={data.rootCauses} empty="No detecto causas sistémicas esta semana." /></Section>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Section title="Riesgos"><List items={data.risks} empty="Sin riesgos relevantes." /></Section>
            <Section title="Bucles abiertos">
              <p className="text-[14px] text-ink-2">{data.openLoops.overdue} vencidas · {data.openLoops.waiting} en espera · {data.openLoops.decisions} decisiones</p>
            </Section>
            <Section title="Decisiones pendientes"><List items={data.decisions.map((d) => d.question)} empty="Ninguna." /></Section>
            <Section title="Stop doing"><List items={data.stopDoing} empty="Nada que recortar esta semana." /></Section>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <Section title="Big 3 de la próxima semana">
              {data.nextWeekBig3.length === 0 ? <Empty /> : data.nextWeekBig3.map((b) => {
                const on = big3.includes(b.id);
                return (
                  <button key={b.id} onClick={() => setBig3((s) => (on ? s.filter((x) => x !== b.id) : [...s, b.id].slice(0, 3)))} className="flex w-full items-start gap-3 py-2 text-left">
                    <span className={cn("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border-[1.5px]", on ? "border-ink bg-ink text-bg" : "border-line-strong")}>{on ? <Check className="h-3 w-3" strokeWidth={3} /> : null}</span>
                    <span><span className="block text-[14.5px]">{b.title}</span>{b.reasons[0] ? <span className="text-[12.5px] text-ink-3">{b.reasons.slice(0, 2).join(", ")}</span> : null}</span>
                  </button>
                );
              })}
            </Section>
            <Section title="Not this week">
              <p className="mb-2 text-[12.5px] text-ink-3">Decidir qué no hacer también es estrategia.</p>
              <List items={data.notThisWeek} empty="Nada explícitamente fuera." />
            </Section>
            <Section title="Capacidad próxima semana"><p className="text-[14px]">{data.capacity.nextWeek.level} — {data.capacity.nextWeek.summary}</p></Section>
            <Section title="Recomendación ejecutiva"><p className="text-[15px] leading-relaxed">{data.recommendation}</p></Section>
          </>
        ) : null}

        {step === 4 ? (
          <>
            <Section title="¿Qué tanto control sentiste sobre tu semana?">
              <div className="flex gap-2" role="radiogroup" aria-label="Control percibido">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} role="radio" aria-checked={control === n} onClick={() => setControl(n)} className={cn("h-12 flex-1 rounded-2xl text-[16px] font-medium transition-colors", control === n ? "bg-ink text-bg" : "bg-surface-2 text-ink-2 hover:bg-surface-3")}>{n}</button>
                ))}
              </div>
              <p className="mt-2 flex justify-between text-[11.5px] text-ink-3"><span>Ninguno</span><span>Total</span></p>
            </Section>
            <Field label="¿Qué aprendiste?"><Textarea value={learning} onChange={(e) => setLearning(e.target.value)} rows={3} placeholder="Una frase basta." /></Field>
          </>
        ) : null}
      </div>

      <div className="flex gap-2 pt-2">
        {step > 0 ? <Button variant="secondary" onClick={() => setStep(step - 1)}><ArrowLeft className="h-4 w-4" /> Atrás</Button> : null}
        {step < STEPS.length - 1 ? (
          <Button className="ml-auto" onClick={() => setStep(step + 1)}>Siguiente <ArrowRight className="h-4 w-4" /></Button>
        ) : (
          <Button className="ml-auto" onClick={finish} loading={pending}>Guardar revisión</Button>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-4">
      <p className="eyebrow mb-2.5">{title}</p>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="px-1 text-[13px] font-medium text-ink-2">{label}</span>
      {children}
    </label>
  );
}

function List({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <p className="text-[14px] text-ink-3">{empty}</p>;
  return <ul className="space-y-1.5 text-[14px] leading-snug">{items.map((i, k) => <li key={k} className="flex gap-2"><span className="text-ink-3">•</span>{i}</li>)}</ul>;
}

function Empty() {
  return <p className="text-[14px] text-ink-3">Nada por aquí.</p>;
}
