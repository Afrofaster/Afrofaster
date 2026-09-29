import type { Metadata } from "next";
import { buildMonthlyBoard } from "@/application/reviews";
import { MonthlyClose } from "@/components/features/monthly-close";
import { Card, PageHeader, Progress, SectionTitle, Stat } from "@/components/ui/primitives";
import { HealthDot } from "@/components/ui/score-ring";
import { loadAsUser } from "@/server/action";

export const metadata: Metadata = { title: "Board mensual" };

export default async function MonthlyPage() {
  const b = await loadAsUser(buildMonthlyBoard);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow={`${b.period.start} → ${b.period.end}`} title="Monthly Board" subtitle="Resultados, tiempo, dinero, salud y tendencias." />
      <div className="grid grid-cols-2 gap-2.5">
        <Stat label="Life Score" value={b.lifeScore.score ?? "—"} hint={b.lifeScore.delta !== null ? `${b.lifeScore.delta >= 0 ? "+" : ""}${b.lifeScore.delta}` : undefined} />
        <Stat label="Tareas cerradas" value={b.execution.tasksCompleted} hint={`${b.execution.weeklyReviews} revisiones semanales`} />
        <Stat label="Ingresos" value={<span className="text-lg">{b.finances.incomeLabel}</span>} />
        <Stat label="Gastos" value={<span className="text-lg">{b.finances.expensesLabel}</span>} />
        <Stat label="Sueño promedio" value={b.health.avgSleep !== null ? `${b.health.avgSleep.toFixed(1)} h` : "—"} />
        <Stat label="Control percibido" value={b.execution.avgControl !== null ? `${b.execution.avgControl.toFixed(1)}/5` : "—"} />
      </div>
      <section>
        <SectionTitle title="Objetivos" />
        <Card className="space-y-3 p-4">{b.goals.length === 0 ? <p className="text-sm text-ink-3">Sin objetivos.</p> : b.goals.map((g) => <div key={g.title}><p className="text-[14px]">{g.title}</p>{g.progress !== null ? <Progress value={g.progress} className="mt-1.5" /> : null}</div>)}</Card>
      </section>
      <section>
        <SectionTitle title="Proyectos" />
        <Card className="space-y-1 p-4 text-[14px]">
          <p>{b.projects.active} activos · {b.projects.completed.length} completados este mes</p>
          {b.projects.stale.length ? <p className="text-warn">Estancados +14 días: {b.projects.stale.join(", ")}</p> : null}
        </Card>
      </section>
      <section>
        <SectionTitle title="Áreas" />
        <Card className="grid grid-cols-2 gap-2 p-4">{b.areas.filter((a) => a.status === "ACTIVE").map((a) => <p key={a.key} className="flex items-center gap-2 text-[13.5px]"><HealthDot health={a.health} />{a.name}</p>)}</Card>
      </section>
      <MonthlyClose />
    </div>
  );
}
