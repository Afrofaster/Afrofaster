import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { UserFacingError } from "@/application/context";
import { getGoal, goalProgress } from "@/application/goals";
import { listProjects } from "@/application/projects";
import { updateGoalProgressAction } from "@/app/actions/life";
import { ActionForm } from "@/components/features/forms";
import { StatusPicker } from "@/components/features/status-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/fields";
import { Card, EmptyState, Progress, RowLink, SectionTitle, Divided } from "@/components/ui/primitives";
import { ScoreRing } from "@/components/ui/score-ring";
import { diffDays, formatLong } from "@/domain/dates";
import { GOAL_HORIZON_LABEL } from "@/domain/enums";
import { loadAsUser } from "@/server/action";
import { entityVersions } from "@/server/db/schema";
import { and, desc, eq } from "drizzle-orm";

export const metadata: Metadata = { title: "Objetivo" };

export default async function GoalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadAsUser(async (ctx) => {
    try {
      const goal = await getGoal(ctx, id);
      const [projects, history] = await Promise.all([
        listProjects(ctx, { goalId: id }),
        ctx.tx.select().from(entityVersions).where(and(eq(entityVersions.entityType, "goal"), eq(entityVersions.entityId, id))).orderBy(desc(entityVersions.createdAt)).limit(8),
      ]);
      return { goal, projects, history, today: ctx.today };
    } catch (err) {
      if (err instanceof UserFacingError) return null;
      throw err;
    }
  });
  if (!data) notFound();
  const { goal, today } = data;
  const progress = goalProgress(goal);
  const daysLeft = goal.deadline ? diffDays(today, goal.deadline) : null;

  return (
    <div className="space-y-6">
      <Link href="/goals" className="-ml-1 inline-flex items-center gap-1 text-[13px] text-ink-3 hover:text-ink"><ChevronLeft className="h-4 w-4" /> Objetivos</Link>
      <header className="flex items-start justify-between gap-3 animate-fade-up">
        <div>
          <p className="eyebrow">{GOAL_HORIZON_LABEL[goal.horizon]}</p>
          <h1 className="display mt-1 text-[2rem] leading-tight">{goal.title}</h1>
          {goal.outcome ? <p className="mt-2 text-[15px] text-ink-2">{goal.outcome}</p> : null}
        </div>
        <StatusPicker kind="goal" id={goal.id} value={goal.status} />
      </header>

      <Card className="flex items-center gap-5 p-5">
        <ScoreRing score={progress} size={96} stroke={8}>
          <span className="display text-2xl">{progress === null ? "—" : `${progress}%`}</span>
        </ScoreRing>
        <div className="flex-1 space-y-2">
          {goal.metric ? <p className="text-[14px] text-ink-2">{goal.metric}: <span className="font-medium text-ink">{goal.currentValue ?? "—"}</span> de {goal.target ?? "—"} {goal.unit ?? ""}</p> : <p className="text-[14px] text-ink-2">Sin métrica definida.</p>}
          {goal.deadline ? <p className="text-[13px] text-ink-3">{formatLong(goal.deadline)} · {daysLeft !== null && daysLeft >= 0 ? `quedan ${daysLeft} días` : "fecha vencida"}</p> : null}
          {goal.target !== null ? (
            <ActionForm action={updateGoalProgressAction.bind(null, goal.id)} resetOnSuccess={false} className="flex gap-2 pt-1">
              <Input name="currentValue" type="number" step="any" defaultValue={goal.currentValue ?? ""} className="h-9 w-28" aria-label="Valor actual" />
              <Button size="sm" variant="secondary" type="submit" className="h-9">Actualizar</Button>
            </ActionForm>
          ) : null}
        </div>
      </Card>

      <section>
        <SectionTitle title="Proyectos que lo empujan" action={<Link href="/projects?new=1" className="text-[13px] font-medium text-accent">Nuevo</Link>} />
        {data.projects.length === 0 ? (
          <EmptyState title="Ningún proyecto conectado" body="Un objetivo sin proyectos es un deseo. Conecta al menos uno." />
        ) : (
          <Divided>
            {data.projects.map((p) => (
              <RowLink key={p.id} href={`/projects/${p.id}`} title={p.title} subtitle={p.nextTaskTitle ? `Siguiente: ${p.nextTaskTitle}` : "Sin siguiente acción"} trailing={<div className="w-16"><Progress value={p.computedProgress} /></div>} />
            ))}
          </Divided>
        )}
      </section>

      {data.history.length > 0 ? (
        <section>
          <SectionTitle title="Historial" />
          <Card as="div" className="divide-y divide-line">
            {data.history.map((h) => (
              <p key={h.id} className="px-4 py-2.5 text-[13px] text-ink-2">
                <span className="text-ink-3">{h.createdAt.toISOString().slice(0, 10)} · </span>
                {h.before ? `Cambió ${h.changedFields.join(", ")}` : "Objetivo creado"} {h.changedBy === "LIA" ? "(LÍA)" : ""}
              </p>
            ))}
          </Card>
        </section>
      ) : null}
    </div>
  );
}
