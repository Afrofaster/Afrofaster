import type { Metadata } from "next";
import { ListChecks } from "lucide-react";
import { listAreas } from "@/application/areas";
import { listProjects } from "@/application/projects";
import { listTasks, type TaskFilter } from "@/application/tasks";
import { NewTaskButton } from "@/components/features/task-form";
import { toTaskItem } from "@/components/features/task-format";
import { TaskItem } from "@/components/features/task-item";
import { Card, EmptyState, PageHeader, Segmented } from "@/components/ui/primitives";
import { loadAsUser } from "@/server/action";

export const metadata: Metadata = { title: "Tareas" };

const VIEWS: Record<string, { label: string; filter: TaskFilter }> = {
  open: { label: "Abiertas", filter: { kind: "open" } },
  today: { label: "Hoy", filter: { kind: "today" } },
  upcoming: { label: "Próximas", filter: { kind: "upcoming" } },
  overdue: { label: "Vencidas", filter: { kind: "overdue" } },
  done: { label: "Hechas", filter: { kind: "done", limit: 60 } },
};

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ view?: string; new?: string; focus?: string }> }) {
  const sp = await searchParams;
  const view = sp.view && sp.view in VIEWS ? sp.view : "open";
  const data = await loadAsUser(async (ctx) => {
    const [tasks, projects, areas] = await Promise.all([listTasks(ctx, VIEWS[view].filter), listProjects(ctx, { statuses: ["ACTIVE", "PLANNED"] }), listAreas(ctx, { activeOnly: true })]);
    return { tasks, projects, areas, today: ctx.today };
  });
  return (
    <div>
      <PageHeader title="Tareas" subtitle="Una sola lista. Muchas vistas." action={<NewTaskButton defaultOpen={sp.new === "1"} projects={data.projects.map((p) => ({ id: p.id, label: p.title }))} areas={data.areas.map((a) => ({ id: a.id, label: a.name }))} />} />
      <Segmented active={`/tasks?view=${view}`} items={Object.entries(VIEWS).map(([k, v]) => ({ href: `/tasks?view=${k}`, label: v.label }))} />
      {data.tasks.length === 0 ? (
        <EmptyState icon={<ListChecks className="h-5 w-5" />} title={view === "done" ? "Aún no has completado tareas" : "No hay tareas aquí"} body="Captura lo que tengas en mente y LÍA lo convierte en tareas." />
      ) : (
        <Card as="div" className="divide-y divide-line">
          {data.tasks.map((t) => (
            <div key={t.id} id={t.id} className={sp.focus === t.id ? "bg-accent-soft/50" : undefined}>
              <TaskItem task={toTaskItem(t, data.today, { meta: [t.areaName && !t.projectTitle ? t.areaName : null, t.estimatedMinutes ? `${t.estimatedMinutes} min` : null].filter(Boolean).join(" · ") || null })} />
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
