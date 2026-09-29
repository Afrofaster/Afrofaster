import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Moon, Sparkles } from "lucide-react";
import { listAreas } from "@/application/areas";
import { eventsOn, fixedBlocksOn } from "@/application/events";
import { getBig3 } from "@/application/intelligence";
import { listProjects } from "@/application/projects";
import { listTasks } from "@/application/tasks";
import { Big3Card } from "@/components/features/big3";
import { NewTaskButton } from "@/components/features/task-form";
import { toTaskItem } from "@/components/features/task-format";
import { TaskItem } from "@/components/features/task-item";
import { ButtonLink } from "@/components/ui/button";
import { Card, EmptyState, PageHeader, SectionTitle } from "@/components/ui/primitives";
import { addDays, formatLong, minutesToHHMM } from "@/domain/dates";
import { loadAsUser } from "@/server/action";

export const metadata: Metadata = { title: "Hoy" };

export default async function TodayPage() {
  const data = await loadAsUser(async (ctx) => {
    const [big3, today, upcoming, fixed, events, projects, areas] = await Promise.all([
      getBig3(ctx),
      listTasks(ctx, { kind: "today" }),
      listTasks(ctx, { kind: "upcoming" }),
      fixedBlocksOn(ctx, ctx.today),
      eventsOn(ctx, ctx.today),
      listProjects(ctx, { statuses: ["ACTIVE", "PLANNED"] }),
      listAreas(ctx, { activeOnly: true }),
    ]);
    return { ctx: { today: ctx.today }, big3, today, upcoming: upcoming.filter((t) => (t.scheduledDate ?? t.dueDate)! <= addDays(ctx.today, 7)), fixed, allDay: events.filter((e) => e.allDay), projects, areas };
  });
  const { today } = data.ctx;
  const big3Ids = new Set(data.big3.map((b) => b.taskId));
  const rest = data.today.filter((t) => !big3Ids.has(t.id));
  const overdue = rest.filter((t) => t.dueDate && t.dueDate < today);
  const todays = rest.filter((t) => !(t.dueDate && t.dueDate < today));

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={formatLong(today)}
        title="Hoy"
        action={<NewTaskButton defaultDate={today} projects={data.projects.map((p) => ({ id: p.id, label: p.title }))} areas={data.areas.map((a) => ({ id: a.id, label: a.name }))} />}
      />

      <div className="grid grid-cols-2 gap-2.5">
        <ButtonLink href="/lia?q=organ%C3%ADzame%20hoy" variant="secondary" className="h-12 rounded-2xl">
          <Sparkles className="h-4 w-4 text-accent" /> Organizar mi día
        </ButtonLink>
        <ButtonLink href="/shutdown" variant="secondary" className="h-12 rounded-2xl">
          <Moon className="h-4 w-4 text-ink-3" /> Cerrar el día
        </ButtonLink>
      </div>

      <Big3Card items={data.big3} date={today} />

      <section>
        <SectionTitle title="Agenda" action={<Link href="/brief" className="text-[13px] font-medium text-accent">Daily Brief</Link>} />
        {data.fixed.length === 0 && data.allDay.length === 0 ? (
          <Card className="flex items-center gap-3 p-4 text-sm text-ink-2">
            <CalendarDays className="h-4 w-4 text-ink-3" /> Sin compromisos fijos hoy.
          </Card>
        ) : (
          <Card as="div" className="divide-y divide-line">
            {data.allDay.map((e) => (
              <div key={e.id} className="flex gap-4 px-4 py-3 text-[14.5px]"><span className="w-24 shrink-0 text-ink-3">Todo el día</span>{e.title}</div>
            ))}
            {data.fixed.map((b, i) => (
              <div key={i} className="flex gap-4 px-4 py-3">
                <span className="w-24 shrink-0 font-mono text-[13px] tabular-nums text-ink-3">{minutesToHHMM(b.start)}–{minutesToHHMM(b.end)}</span>
                <span className="text-[14.5px]">{b.title}</span>
                {b.kind === "COMMITMENT" ? <span className="ml-auto text-[11.5px] text-ink-3">Fijo</span> : null}
              </div>
            ))}
          </Card>
        )}
      </section>

      {overdue.length > 0 ? (
        <section>
          <SectionTitle title={`Vencidas · ${overdue.length}`} />
          <Card as="div" className="divide-y divide-line">
            {overdue.map((t) => <TaskItem key={t.id} task={toTaskItem(t, today)} />)}
          </Card>
        </section>
      ) : null}

      <section>
        <SectionTitle title="Para hoy" />
        {todays.length === 0 ? (
          <EmptyState title="Nada más programado para hoy" body="Todo lo de hoy está en tu Big 3. Protege tu foco." />
        ) : (
          <Card as="div" className="divide-y divide-line">
            {todays.map((t) => <TaskItem key={t.id} task={toTaskItem(t, today)} />)}
          </Card>
        )}
      </section>

      {data.upcoming.length > 0 ? (
        <section>
          <SectionTitle title="Próximos 7 días" action={<Link href="/tasks" className="text-[13px] font-medium text-accent">Todas</Link>} />
          <Card as="div" className="divide-y divide-line">
            {data.upcoming.slice(0, 8).map((t) => <TaskItem key={t.id} task={toTaskItem(t, today)} />)}
          </Card>
        </section>
      ) : null}
    </div>
  );
}
