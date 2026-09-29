"use client";

import { useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Plus, X } from "lucide-react";
import { completeOnboardingAction, skipOnboardingAction } from "@/app/actions/settings";
import { LiaOrb } from "@/components/layout/lia-orb";
import { AreaIcon } from "@/components/ui/area-icon";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/fields";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";

type Area = { key: string; name: string; short: string; icon: string; foundational: boolean };
type Commitment = { title: string; weekdays: number[]; startTime: string; endTime: string };

const DAYS = ["D", "L", "M", "X", "J", "V", "S"];
const DEFAULT_ACTIVE = ["physical_health", "mental_health", "finances", "career", "education", "business", "family", "partner"];
const PRESETS: Commitment[] = [
  { title: "Trabajo / oficina", weekdays: [1, 2, 3, 4, 5], startTime: "08:00", endTime: "17:00" },
  { title: "Clases", weekdays: [2, 4], startTime: "18:30", endTime: "21:00" },
  { title: "Gimnasio", weekdays: [1, 3, 5], startTime: "06:00", endTime: "07:00" },
];

export function OnboardingFlow({ defaultName, areas }: { defaultName: string; areas: Area[] }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(defaultName);
  const [active, setActive] = useState<string[]>(DEFAULT_ACTIVE);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [goals, setGoals] = useState<Array<{ title: string; areaKey: string | null }>>([{ title: "", areaKey: null }, { title: "", areaKey: null }, { title: "", areaKey: null }]);
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [draft, setDraft] = useState<Commitment>({ title: "", weekdays: [1, 2, 3, 4, 5], startTime: "08:00", endTime: "12:00" });
  const [busy, start] = useTransition();
  const toast = useToast();
  const total = 6;

  const activeAreas = areas.filter((a) => active.includes(a.key));
  const filledGoals = goals.filter((g) => g.title.trim());

  function finish() {
    start(async () => {
      const res = await completeOnboardingAction({ displayName: name.trim() || "Jhony", areas: active, goals: filledGoals, commitments, scores: Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, v * 10])) });
      if (res && !res.ok) toast.show({ message: res.error, tone: "error" });
    });
  }

  return (
    <div>
      <div className="mb-8 flex items-center gap-3">
        <LiaOrb size={30} />
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-3"><div className="h-full rounded-full bg-ink transition-[width] duration-500" style={{ width: `${((step + 1) / total) * 100}%` }} /></div>
        <span className="text-[12px] tabular-nums text-ink-3">{step + 1}/{total}</span>
      </div>

      <div key={step} className="animate-fade-up">
        {step === 0 ? (
          <Step title="Hola. Soy LÍA." body="Seré tu Chief of Staff: ordeno, recuerdo, priorizo y te ayudo a ejecutar lo que importa. En menos de 10 minutos armamos tu primer tablero de vida.">
            <label className="mb-2 block text-[14px] text-ink-2" htmlFor="ob-name">¿Cómo quieres que te llame?</label>
            <Input id="ob-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </Step>
        ) : null}

        {step === 1 ? (
          <Step title="¿Qué áreas te importan hoy?" body="Las activas cuentan para tu Life Score. Puedes cambiarlas cuando quieras.">
            <div className="grid grid-cols-2 gap-2">
              {areas.map((a) => {
                const on = active.includes(a.key);
                return (
                  <button key={a.key} onClick={() => setActive((s) => (on ? s.filter((k) => k !== a.key) : [...s, a.key]))} aria-pressed={on} className={cn("flex items-center gap-2.5 rounded-2xl border px-3 py-3 text-left text-[13.5px] transition-colors", on ? "border-ink bg-surface text-ink shadow-sm" : "border-line text-ink-3")}>
                    <AreaIcon name={a.icon} className="h-4 w-4 shrink-0" /> <span className="leading-tight">{a.short}</span>
                  </button>
                );
              })}
            </div>
          </Step>
        ) : null}

        {step === 2 ? (
          <Step title="¿Cómo está cada una hoy?" body="Del 1 al 10, sin pensarlo mucho. Es tu punto de partida, no un examen.">
            <div className="space-y-3">
              {activeAreas.map((a) => (
                <div key={a.key}>
                  <div className="mb-1.5 flex justify-between text-[13.5px]"><span>{a.short}</span><span className="tabular-nums text-ink-3">{scores[a.key] ?? "—"}</span></div>
                  <input type="range" min={1} max={10} value={scores[a.key] ?? 6} onChange={(e) => setScores((s) => ({ ...s, [a.key]: Number(e.target.value) }))} className="w-full accent-[var(--accent)]" aria-label={`Calificación de ${a.short}`} />
                </div>
              ))}
            </div>
          </Step>
        ) : null}

        {step === 3 ? (
          <Step title="¿Qué tres cosas quieres conseguir en los próximos 90 días?" body="Resultados concretos. Menos es más.">
            <div className="space-y-3">
              {goals.map((g, i) => (
                <div key={i} className="card space-y-2 p-3">
                  <Input value={g.title} onChange={(e) => setGoals((s) => s.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} placeholder={["Terminar la maestría", "Conseguir 3 clientes nuevos", "Entrenar 3 veces por semana"][i]} aria-label={`Objetivo ${i + 1}`} />
                  <Select value={g.areaKey ?? ""} onChange={(e) => setGoals((s) => s.map((x, j) => (j === i ? { ...x, areaKey: e.target.value || null } : x)))} aria-label="Área" className="h-10 text-[13.5px]">
                    <option value="">Área (opcional)</option>
                    {activeAreas.map((a) => <option key={a.key} value={a.key}>{a.short}</option>)}
                  </Select>
                </div>
              ))}
            </div>
          </Step>
        ) : null}

        {step === 4 ? (
          <Step title="¿Cuáles son tus compromisos fijos?" body="Trabajo, clases, entrenamiento… LÍA los descuenta de tu capacidad real.">
            <div className="mb-3 flex flex-wrap gap-2">
              {PRESETS.filter((p) => !commitments.some((c) => c.title === p.title)).map((p) => (
                <button key={p.title} onClick={() => setCommitments((c) => [...c, p])} className="flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-[13px] text-ink-2 hover:text-ink"><Plus className="h-3.5 w-3.5" /> {p.title}</button>
              ))}
            </div>
            {commitments.length ? (
              <ul className="card mb-3 divide-y divide-line">
                {commitments.map((c, i) => (
                  <li key={i} className="flex items-center gap-2 px-4 py-2.5 text-[14px]">
                    <span className="flex-1">{c.title} <span className="text-ink-3">· {c.weekdays.map((d) => DAYS[d]).join("")} {c.startTime}–{c.endTime}</span></span>
                    <button onClick={() => setCommitments((s) => s.filter((_, j) => j !== i))} aria-label="Quitar"><X className="h-4 w-4 text-ink-3" /></button>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="card space-y-2.5 p-3">
              <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Otro compromiso" aria-label="Compromiso" />
              <div className="flex gap-1">
                {DAYS.map((d, i) => {
                  const on = draft.weekdays.includes(i);
                  return <button key={i} onClick={() => setDraft({ ...draft, weekdays: on ? draft.weekdays.filter((x) => x !== i) : [...draft.weekdays, i] })} aria-pressed={on} className={cn("h-9 flex-1 rounded-xl text-[12.5px] font-medium", on ? "bg-ink text-bg" : "bg-surface-2 text-ink-3")}>{d}</button>;
                })}
              </div>
              <div className="flex gap-2">
                <Input type="time" value={draft.startTime} onChange={(e) => setDraft({ ...draft, startTime: e.target.value })} aria-label="Inicio" />
                <Input type="time" value={draft.endTime} onChange={(e) => setDraft({ ...draft, endTime: e.target.value })} aria-label="Fin" />
                <Button variant="secondary" className="h-12" disabled={!draft.title.trim() || draft.weekdays.length === 0} onClick={() => { setCommitments((c) => [...c, draft]); setDraft({ ...draft, title: "" }); }}>Añadir</Button>
              </div>
            </div>
          </Step>
        ) : null}

        {step === 5 ? (
          <Step title="Esto entendí de tu vida" body="Revísalo. Al confirmar, construyo tu primer tablero.">
            <div className="space-y-3">
              <Summary label="Te llamaré">{name || "Jhony"}</Summary>
              <Summary label={`Áreas activas · ${activeAreas.length}`}>{activeAreas.map((a) => a.short).join(" · ")}</Summary>
              <Summary label="Objetivos a 90 días">{filledGoals.length ? filledGoals.map((g) => g.title).join(" · ") : "Ninguno por ahora"}</Summary>
              <Summary label="Compromisos fijos">{commitments.length ? commitments.map((c) => c.title).join(" · ") : "Ninguno"}</Summary>
              <div className="card flex items-start gap-3 p-4">
                <CalendarDays className="mt-0.5 h-4 w-4 text-ink-3" />
                <p className="text-[13.5px] text-ink-2">Google Calendar se conecta más adelante (solo lectura). Por ahora, dile a LÍA tus citas: “mañana audiencia a las 9”.</p>
              </div>
            </div>
          </Step>
        ) : null}
      </div>

      <div className="mt-8 flex gap-2">
        {step > 0 ? <Button variant="secondary" onClick={() => setStep(step - 1)}><ArrowLeft className="h-4 w-4" /></Button> : null}
        {step < total - 1 ? (
          <Button className="flex-1" size="lg" onClick={() => setStep(step + 1)} disabled={step === 1 && active.length === 0}>Continuar <ArrowRight className="h-4 w-4" /></Button>
        ) : (
          <Button className="flex-1" size="lg" onClick={finish} loading={busy}>Construir mi tablero</Button>
        )}
      </div>
      {step === 0 ? (
        <form action={skipOnboardingAction} className="mt-4 text-center"><button className="text-[13px] text-ink-3 hover:text-ink">Omitir por ahora</button></form>
      ) : null}
    </div>
  );
}

function Step({ title, body, children }: { title: string; body: string; children: React.ReactNode }) {
  return (
    <div>
      <h1 className="display text-[1.9rem] leading-tight">{title}</h1>
      <p className="mt-2 mb-6 text-[15px] leading-relaxed text-ink-2">{body}</p>
      {children}
    </div>
  );
}

function Summary({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="card p-4">
      <p className="eyebrow mb-1">{label}</p>
      <p className="text-[14.5px]">{children}</p>
    </div>
  );
}
