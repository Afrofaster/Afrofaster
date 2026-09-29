import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle, HeartPulse, Sparkles } from "lucide-react";
import { buildDailyBrief } from "@/application/reviews";
import { Card, SectionTitle } from "@/components/ui/primitives";
import { CAPACITY_LABEL } from "@/domain/enums";
import { formatLong, minutesToHHMM } from "@/domain/dates";
import { loadAsUser } from "@/server/action";

export const metadata: Metadata = { title: "Daily Brief" };

export default async function BriefPage() {
  const b = await loadAsUser(buildDailyBrief);
  return (
    <div className="space-y-6">
      <header className="animate-fade-up">
        <p className="eyebrow">Daily Brief · {formatLong(b.date)}</p>
        <h1 className="display mt-1.5 text-[2.1rem] leading-tight">{b.greeting}</h1>
      </header>

      <Card className="p-5">
        <p className="eyebrow mb-3">Big 3</p>
        {b.big3.length === 0 ? <p className="text-sm text-ink-3">Sin prioridades aún.</p> : (
          <ol className="space-y-2.5">{b.big3.map((x) => <li key={x.rank} className="flex gap-3 text-[15.5px]"><span className="display text-ink-3">{x.rank}</span><span className={x.done ? "text-ink-3 line-through" : ""}>{x.title}</span></li>)}</ol>
        )}
      </Card>

      <section>
        <SectionTitle title="Agenda" />
        <Card as="div" className="divide-y divide-line">
          {b.agenda.length === 0 ? <p className="p-4 text-sm text-ink-3">Sin eventos.</p> : b.agenda.map((e, i) => (
            <p key={i} className="flex gap-4 px-4 py-3 text-[14.5px]"><span className="w-12 font-mono text-[13px] text-ink-3">{e.allDay ? "día" : minutesToHHMM(e.start)}</span>{e.title}</p>
          ))}
          {b.deepWork ? <p className="flex gap-4 bg-accent-soft/60 px-4 py-3 text-[14.5px]"><span className="w-12 font-mono text-[13px] text-accent">{b.deepWork.start}</span>Deep work: {b.deepWork.title}</p> : null}
        </Card>
      </section>

      {b.attention.length ? (
        <section>
          <SectionTitle title="Atención" />
          <Card as="div" className="divide-y divide-line">
            {b.attention.map((a) => <Link key={a.key} href={a.href ?? "/"} className="flex gap-3 px-4 py-3 text-[14.5px] hover:bg-surface-2"><AlertCircle className="mt-0.5 h-4 w-4 text-warn" />{a.message}</Link>)}
          </Card>
        </section>
      ) : null}

      <div className="grid grid-cols-2 gap-2.5">
        <Card className="p-4"><p className="eyebrow flex items-center gap-1.5"><HeartPulse className="h-3.5 w-3.5" /> Salud</p><p className="mt-1.5 text-[14px]">{b.health.avgSleep !== null ? `Sueño ${b.health.avgSleep.toFixed(1)} h (3 días)` : "Sin datos de sueño"}</p></Card>
        <Card className="p-4"><p className="eyebrow">Capacidad</p><p className="mt-1.5 text-[14px]">{CAPACITY_LABEL[b.capacity.level]}</p><p className="text-[12px] text-ink-3">{b.capacity.summary}</p></Card>
      </div>

      <Card className="flex gap-3 p-5"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent" /><p className="text-[15px] leading-relaxed">{b.recommendation}</p></Card>
    </div>
  );
}
