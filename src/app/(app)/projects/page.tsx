import type { Metadata } from "next";
import Link from "next/link";
import { FolderKanban } from "lucide-react";
import { listAreas } from "@/application/areas";
import { listGoals } from "@/application/goals";
import { listProjects } from "@/application/projects";
import { NewProjectButton } from "@/components/features/entity-forms";
import { Badge, EmptyState, PageHeader, Progress, Segmented } from "@/components/ui/primitives";
import { diffDays, formatRelative } from "@/domain/dates";
import { PRIORITY_LABEL, PROJECT_STATUS_LABEL, type ProjectStatus } from "@/domain/enums";
import { loadAsUser } from "@/server/action";

export const metadata: Metadata = { title: "Proyectos" };

const VIEWS: Record<string, { label: string; statuses: ProjectStatus[] }> = {
  active: { label: "Activos", statuses: ["ACTIVE"] },
  pipeline: { label: "En cola", statuses: ["IDEA", "PLANNED", "PAUSED"] },
  closed: { label: "Cerrados", statuses: ["COMPLETED", "CANCELLED"] },
};

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ view?: string; new?: string }> }) {
  const sp = await searchParams;
  const view = sp.view && sp.view in VIEWS ? sp.view : "active";
  const data = await loadAsUser(async (ctx) => ({
    projects: await listProjects(ctx, { statuses: VIEWS[view].statuses }),
    areas: await listAreas(ctx, { activeOnly: true }),
    goals: await listGoals(ctx, { statuses: ["ACTIVE", "AT_RISK", "DRAFT"] }),
    today: ctx.today,
    now: ctx.now,
  }));
  return (
    <div>
      <PageHeader title="Proyectos" subtitle="Resultados que requieren varias acciones." action={<NewProjectButton defaultOpen={sp.new === "1"} areas={data.areas.map((a) => ({ id: a.id, label: a.name }))} goals={data.goals.map((g) => ({ id: g.id, label: g.title }))} />} />
      <Segmented active={`/projects?view=${view}`} items={Object.entries(VIEWS).map(([k, v]) => ({ href: `/projects?view=${k}`, label: v.label }))} />
      {data.projects.length === 0 ? (
        <EmptyState icon={<FolderKanban className="h-5 w-5" />} title={view === "active" ? "No tienes proyectos activos" : "Nada por aquí"} body="Crea uno o cuéntale a LÍA qué quieres conseguir.">
          <Link href="/lia?q=quiero%20empezar%20un%20proyecto" className="text-sm font-medium text-accent">Hablar con LÍA</Link>
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {data.projects.map((p) => {
            const idle = Math.floor((data.now.getTime() - p.lastActivityAt.getTime()) / 86_400_000);
            return (
              <li key={p.id}>
                <Link href={`/projects/${p.id}`} className="card block p-4 transition-shadow hover:shadow-[var(--shadow)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[16px] font-medium">{p.title}</p>
                      <p className="mt-0.5 truncate text-[13px] text-ink-3">{[p.areaName, p.goalTitle ? `→ ${p.goalTitle}` : null].filter(Boolean).join(" ") || "Sin área"}</p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      {p.status !== "ACTIVE" ? <Badge>{PROJECT_STATUS_LABEL[p.status]}</Badge> : null}
                      {p.priority === "HIGH" || p.priority === "CRITICAL" ? <Badge tone="accent">{PRIORITY_LABEL[p.priority]}</Badge> : null}
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <Progress value={p.computedProgress} className="flex-1" label="Progreso" />
                    <span className="text-[12px] tabular-nums text-ink-3">{p.computedProgress}%</span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-ink-3">
                    {p.nextTaskTitle ? <span className="text-ink-2">Siguiente: {p.nextTaskTitle}</span> : <span className="text-warn">Sin siguiente acción definida</span>}
                    <span>{p.openTasks} abiertas</span>
                    {p.targetDate ? <span className={diffDays(data.today, p.targetDate) < 0 ? "text-bad" : ""}>Meta {formatRelative(p.targetDate, data.today).toLowerCase()}</span> : null}
                    {p.status === "ACTIVE" && idle >= 7 ? <span className="text-warn">{idle} días sin movimiento</span> : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
