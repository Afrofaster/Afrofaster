import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Scale } from "lucide-react";
import { UserFacingError } from "@/application/context";
import { getProject, listMilestones, listProjects } from "@/application/projects";
import { listTasks } from "@/application/tasks";
import { updateProjectAction } from "@/app/actions/life";
import { ActionForm } from "@/components/features/forms";
import { Milestones } from "@/components/features/milestones";
import { StatusPicker } from "@/components/features/status-picker";
import { NewTaskButton } from "@/components/features/task-form";
import { toTaskItem } from "@/components/features/task-format";
import { TaskItem } from "@/components/features/task-item";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/fields";
import { Card, EmptyState, Progress, SectionTitle } from "@/components/ui/primitives";
import { formatRelative, formatShort } from "@/domain/dates";
import { listAttachments } from "@/application/attachments";
import { AttachmentsPanel } from "@/components/features/attachments-panel";
import { loadAsUser } from "@/server/action";

export const metadata: Metadata = { title: "Proyecto" };

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadAsUser(async (ctx) => {
    try {
      const project = await getProject(ctx, id);
      const [tasks, milestones, summary, files] = await Promise.all([listTasks(ctx, { kind: "project", projectId: id }), listMilestones(ctx, id), listProjects(ctx), listAttachments(ctx, "project", id)]);
      return { project, tasks, milestones, files, summary: summary.find((s) => s.id === id)!, today: ctx.today };
    } catch (err) {
      if (err instanceof UserFacingError) return null;
      throw err;
    }
  });
  if (!data) notFound();
  const { project, summary, today } = data;
  const open = data.tasks.filter((t) => t.status !== "DONE" && t.status !== "CANCELLED");
  const done = data.tasks.filter((t) => t.status === "DONE");
  const meta = project.metadata;
  const legal = meta.client || meta.caseReference || meta.courtOrEntity || meta.legalDeadline;

  return (
    <div className="space-y-6">
      <Link href="/projects" className="-ml-1 inline-flex items-center gap-1 text-[13px] text-ink-3 hover:text-ink"><ChevronLeft className="h-4 w-4" /> Proyectos</Link>
      <header className="animate-fade-up">
        <div className="flex items-start justify-between gap-3">
          <h1 className="display text-[2rem] leading-tight">{project.title}</h1>
          <StatusPicker kind="project" id={project.id} value={project.status} />
        </div>
        {project.desiredOutcome ? <p className="mt-2 text-[15px] text-ink-2">Resultado: {project.desiredOutcome}</p> : null}
        <div className="mt-4 flex items-center gap-3">
          <Progress value={summary.computedProgress} className="flex-1" />
          <span className="text-[13px] tabular-nums text-ink-2">{summary.computedProgress}%</span>
        </div>
        <p className="mt-2 text-[13px] text-ink-3">
          {[summary.areaName, summary.goalTitle ? `Objetivo: ${summary.goalTitle}` : null, project.targetDate ? `Meta: ${formatRelative(project.targetDate, today)}` : null].filter(Boolean).join(" · ")}
        </p>
      </header>

      {legal ? (
        <Card className="p-4">
          <p className="eyebrow mb-3 flex items-center gap-1.5"><Scale className="h-3.5 w-3.5" /> Datos jurídicos</p>
          <dl className="grid grid-cols-2 gap-3 text-[14px]">
            {meta.client ? <div><dt className="text-[12px] text-ink-3">Cliente</dt><dd>{meta.client}</dd></div> : null}
            {meta.caseReference ? <div><dt className="text-[12px] text-ink-3">Radicado</dt><dd className="font-mono text-[13px]">{meta.caseReference}</dd></div> : null}
            {meta.courtOrEntity ? <div><dt className="text-[12px] text-ink-3">Juzgado / entidad</dt><dd>{meta.courtOrEntity}</dd></div> : null}
            {meta.legalDeadline ? <div><dt className="text-[12px] text-ink-3">Término</dt><dd className="font-medium text-bad">{formatRelative(meta.legalDeadline, today)} · {formatShort(meta.legalDeadline)}</dd></div> : null}
          </dl>
        </Card>
      ) : null}

      <section>
        <SectionTitle title={`Siguientes acciones · ${open.length}`} action={<NewTaskButton defaultProjectId={project.id} />} />
        {open.length === 0 ? (
          <EmptyState title="Sin siguiente acción" body="Un proyecto sin siguiente acción no avanza. ¿Cuál es el próximo paso físico y visible?" />
        ) : (
          <Card as="div" className="divide-y divide-line">
            {open.map((t) => <TaskItem key={t.id} task={toTaskItem(t, today)} />)}
          </Card>
        )}
      </section>

      <section>
        <SectionTitle title="Hitos" />
        <Milestones projectId={project.id} items={data.milestones.map((m) => ({ id: m.id, title: m.title, dueDate: m.dueDate, done: Boolean(m.completedAt), dueLabel: m.dueDate ? formatRelative(m.dueDate, today) : null }))} />
      </section>

      {done.length > 0 ? (
        <section>
          <SectionTitle title={`Hechas · ${done.length}`} />
          <Card as="div" className="divide-y divide-line">
            {done.slice(0, 10).map((t) => <TaskItem key={t.id} task={toTaskItem(t, today)} showActions={false} />)}
          </Card>
        </section>
      ) : null}

      <section>
        <SectionTitle title="Documentos" />
        <AttachmentsPanel entityType="project" entityId={project.id} items={data.files} />
      </section>

      <section>
        <SectionTitle title="Editar" />
        <Card className="p-4">
          <ActionForm action={updateProjectAction.bind(null, project.id)} resetOnSuccess={false} className="space-y-3">
            <Field label="Nombre" htmlFor="e-title"><Input id="e-title" name="title" defaultValue={project.title} required /></Field>
            <Field label="Resultado deseado" htmlFor="e-out"><Input id="e-out" name="desiredOutcome" defaultValue={project.desiredOutcome ?? ""} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Fecha objetivo" htmlFor="e-date"><Input id="e-date" name="targetDate" type="date" defaultValue={project.targetDate ?? ""} /></Field>
              <Field label="Próximo paso (nota)" htmlFor="e-next"><Input id="e-next" name="nextAction" defaultValue={project.nextAction ?? ""} /></Field>
            </div>
            <Button type="submit" variant="secondary">Guardar cambios</Button>
          </ActionForm>
        </Card>
      </section>
    </div>
  );
}
