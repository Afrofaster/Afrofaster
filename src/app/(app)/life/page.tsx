import type { Metadata } from "next";
import Link from "next/link";
import { lifeScoreHistory } from "@/application/areas";
import { getLifeStatus } from "@/application/intelligence";
import { AreaActiveToggle, AreaModeSelect, AreaRater } from "@/components/features/area-controls";
import { AreaIcon } from "@/components/ui/area-icon";
import { Card, PageHeader, SectionTitle } from "@/components/ui/primitives";
import { HealthDot, ScoreRing } from "@/components/ui/score-ring";
import { Sparkline } from "@/components/ui/sparkline";
import { loadAsUser } from "@/server/action";

export const metadata: Metadata = { title: "Vida" };

export default async function LifePage() {
  const data = await loadAsUser(async (ctx) => ({ status: await getLifeStatus(ctx), history: await lifeScoreHistory(ctx, 30) }));
  const { lifeScore, areas } = data.status;
  const active = areas.filter((a) => a.status === "ACTIVE");
  const dormant = areas.filter((a) => a.status !== "ACTIVE");

  return (
    <div className="space-y-7">
      <PageHeader title="Tu vida" subtitle="15 áreas. Las activas cuentan para tu Life Score." />

      <Card className="p-5">
        <div className="flex items-center gap-5">
          <ScoreRing score={lifeScore.score} size={104}>
            <span className="display text-3xl">{lifeScore.score ?? "—"}</span>
          </ScoreRing>
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Life Score · últimos 30 días</p>
            <Sparkline className="mt-2 h-14 w-full" points={data.history.map((h) => ({ label: h.date, value: h.score }))} />
          </div>
        </div>
        <p className="mt-4 border-t border-line pt-3 text-[13.5px] leading-relaxed text-ink-2">{lifeScore.explanation}</p>
      </Card>

      <section>
        <SectionTitle title={`Áreas activas · ${active.length}`} />
        <ul className="space-y-2.5">
          {active.map((a) => (
            <li key={a.key} className="card p-4">
              <div className="mb-3 flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-surface-2 text-ink-2"><AreaIcon name={a.icon} /></span>
                <Link href={`/life/${a.key}`} className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-[15px] font-medium"><HealthDot health={a.health} /> <span className="leading-snug">{a.name}</span></span>
                  <span className="text-[12px] text-ink-3">{a.goals} objetivos · {a.projects} proyectos{a.trend !== "STABLE" ? ` · ${a.trend === "UP" ? "↑ subiendo" : "↓ bajando"}` : ""}</span>
                </Link>
                <AreaModeSelect id={a.id} mode={a.mode} />
              </div>
              <AreaRater id={a.id} score={a.score} />
            </li>
          ))}
        </ul>
      </section>

      <section>
        <SectionTitle title="Activar o desactivar áreas" />
        <Card as="div" className="divide-y divide-line">
          {areas.map((a) => (
            <div key={a.key} className="flex items-center gap-3 px-4 py-3">
              <AreaIcon name={a.icon} className="h-4 w-4 text-ink-3" />
              <span className="flex-1 text-[14px]">{a.name}</span>
              <AreaActiveToggle id={a.id} active={a.status === "ACTIVE"} />
            </div>
          ))}
        </Card>
        {dormant.length > 0 ? <p className="mt-2 px-1 text-[12.5px] text-ink-3">Las áreas inactivas no se evalúan: enfocarse también es decidir qué no atender ahora.</p> : null}
      </section>
    </div>
  );
}
