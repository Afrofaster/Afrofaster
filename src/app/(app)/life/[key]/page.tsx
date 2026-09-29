import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getAreaByKey } from "@/application/areas";
import { UserFacingError } from "@/application/context";
import { listGoals } from "@/application/goals";
import { listProjects } from "@/application/projects";
import { listTasks } from "@/application/tasks";
import { saveAreaNotesAction } from "@/app/actions/life";
import { AreaModeSelect, AreaRater } from "@/components/features/area-controls";
import { ActionForm } from "@/components/features/forms";
import { toTaskItem } from "@/components/features/task-format";
import { TaskItem } from "@/components/features/task-item";
import { AreaIcon } from "@/components/ui/area-icon";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/fields";
import { Card, Divided, EmptyState, Progress, RowLink, SectionTitle } from "@/components/ui/primitives";
import { AREA_MODE_LABEL } from "@/domain/enums";
import { loadAsUser } from "@/server/action";

export const metadata: Metadata = { title: "Área de vida" };

export default async function AreaPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const data = await loadAsUser(async (ctx) => {
    try {
      const area = await getAreaByKey(ctx, key);
      const [goals, projects, tasks] = await Promise.all([listGoals(ctx, { areaId: area.id, statuses: ["ACTIVE", "AT_RISK", "DRAFT"] }), listProjects(ctx, { areaId: area.id, statuses: ["ACTIVE", "PLANNED", "PAUSED"] }), listTasks(ctx, { kind: "area", areaId: area.id })]);
      return { area, goals, projects, tasks, today: ctx.today };
    } catch (err) {
      if (err instanceof UserFacingError) return null;
      throw err;
    }
  });
  if (!data) notFound();
  const { area } = data;
  return (
    <div className="space-y-6">
      <Link href="/life" className="-ml-1 inline-flex items-center gap-1 text-[13px] text-ink-3 hover:text-ink"><ChevronLeft className="h-4 w-4" /> Vida</Link>
      <header className="flex items-center gap-4 animate-fade-up">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-accent-soft text-accent"><AreaIcon name={area.icon} className="h-6 w-6" /></span>
        <div>
          <h1 className="display text-[1.75rem] leading-tight">{area.name}</h1>
          <p className="text-[13px] text-ink-3">Modo {AREA_MODE_LABEL[area.mode].toLowerCase()} · {area.score === null ? "sin evaluar" : `${area.score}/100`}</p>
        </div>
      </header>
      <Card className="space-y-4 p-4">
        <div className="flex items-center justify-between"><p className="text-[14px] text-ink-2">¿Cómo está esta área hoy?</p><AreaModeSelect id={area.id} mode={area.mode} /></div>
        <AreaRater id={area.id} score={area.score} />
      </Card>
      <section>
        <SectionTitle title="Objetivos" />
        {data.goals.length === 0 ? <EmptyState title="Sin objetivos en esta área" /> : (
          <Divided>{data.goals.map((g) => <RowLink key={g.id} href={`/goals/${g.id}`} title={g.title} trailing={g.progress !== null ? <div className="w-16"><Progress value={g.progress} /></div> : undefined} />)}</Divided>
        )}
      </section>
      <section>
        <SectionTitle title="Proyectos" />
        {data.projects.length === 0 ? <EmptyState title="Sin proyectos en esta área" /> : (
          <Divided>{data.projects.map((p) => <RowLink key={p.id} href={`/projects/${p.id}`} title={p.title} subtitle={p.nextTaskTitle ?? "Sin siguiente acción"} />)}</Divided>
        )}
      </section>
      {data.tasks.length > 0 ? (
        <section>
          <SectionTitle title="Tareas sueltas" />
          <Card as="div" className="divide-y divide-line">{data.tasks.map((t) => <TaskItem key={t.id} task={toTaskItem(t, data.today)} />)}</Card>
        </section>
      ) : null}
      <section>
        <SectionTitle title="Notas" />
        <ActionForm action={saveAreaNotesAction.bind(null, area.id)} resetOnSuccess={false} className="space-y-2">
          <Textarea name="notes" defaultValue={area.notes ?? ""} placeholder="¿Qué significa estar bien en esta área para ti?" />
          <Button type="submit" size="sm" variant="secondary">Guardar notas</Button>
        </ActionForm>
      </section>
    </div>
  );
}
