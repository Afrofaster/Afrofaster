import type { Metadata } from "next";
import Link from "next/link";
import { Target } from "lucide-react";
import { listAreas } from "@/application/areas";
import { listGoals } from "@/application/goals";
import { NewGoalButton } from "@/components/features/entity-forms";
import { Badge, EmptyState, PageHeader, Progress, Segmented } from "@/components/ui/primitives";
import { formatRelative } from "@/domain/dates";
import { GOAL_HORIZON_LABEL, GOAL_STATUS_LABEL, type GoalStatus } from "@/domain/enums";
import { loadAsUser } from "@/server/action";

export const metadata: Metadata = { title: "Objetivos" };

const VIEWS: Record<string, { label: string; statuses: GoalStatus[] }> = {
  active: { label: "Activos", statuses: ["ACTIVE", "AT_RISK"] },
  draft: { label: "Borradores y pausados", statuses: ["DRAFT", "PAUSED"] },
  closed: { label: "Cerrados", statuses: ["ACHIEVED", "CANCELLED"] },
};

export default async function GoalsPage({ searchParams }: { searchParams: Promise<{ view?: string; new?: string }> }) {
  const sp = await searchParams;
  const view = sp.view && sp.view in VIEWS ? sp.view : "active";
  const data = await loadAsUser(async (ctx) => ({ goals: await listGoals(ctx, { statuses: VIEWS[view].statuses }), areas: await listAreas(ctx, { activeOnly: true }), today: ctx.today }));
  return (
    <div>
      <PageHeader title="Objetivos" subtitle="Lo que quieres conseguir, medible y con fecha." action={<NewGoalButton defaultOpen={sp.new === "1"} areas={data.areas.map((a) => ({ id: a.id, label: a.name }))} />} />
      <Segmented active={`/goals?view=${view}`} items={Object.entries(VIEWS).map(([k, v]) => ({ href: `/goals?view=${k}`, label: v.label }))} />
      {data.goals.length === 0 ? (
        <EmptyState icon={<Target className="h-5 w-5" />} title="Sin objetivos aquí" body="¿Qué tres cosas quieres conseguir en los próximos 90 días?" />
      ) : (
        <ul className="space-y-3">
          {data.goals.map((g) => (
            <li key={g.id}>
              <Link href={`/goals/${g.id}`} className="card block p-4 transition-shadow hover:shadow-[var(--shadow)]">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[16px] font-medium leading-snug">{g.title}</p>
                  <Badge tone={g.status === "AT_RISK" ? "bad" : g.status === "ACHIEVED" ? "good" : "neutral"}>{GOAL_STATUS_LABEL[g.status]}</Badge>
                </div>
                {g.progress !== null ? (
                  <div className="mt-3 flex items-center gap-3">
                    <Progress value={g.progress} tone={g.status === "AT_RISK" ? "warn" : "accent"} className="flex-1" />
                    <span className="text-[12px] tabular-nums text-ink-3">{g.currentValue ?? 0}/{g.target} {g.unit ?? ""}</span>
                  </div>
                ) : null}
                <p className="mt-2.5 text-[12.5px] text-ink-3">
                  {[g.areaName, GOAL_HORIZON_LABEL[g.horizon], g.deadline ? `Fecha ${formatRelative(g.deadline, data.today).toLowerCase()}` : null, `${g.activeProjects} ${g.activeProjects === 1 ? "proyecto activo" : "proyectos activos"}`].filter(Boolean).join(" · ")}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
