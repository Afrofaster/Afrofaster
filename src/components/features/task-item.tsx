"use client";

import { useOptimistic, useTransition } from "react";
import { CalendarClock, Check, EllipsisVertical, FolderOpen, Trash2 } from "lucide-react";
import { completeTaskAction, deferTaskAction, deleteTaskAction, reopenTaskAction, restoreTaskAction } from "@/app/actions/tasks";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/toast";

export type TaskItemData = {
  id: string;
  title: string;
  done: boolean;
  meta?: string | null;
  dateLabel?: string | null;
  dateTone?: "overdue" | "today" | "normal";
  projectTitle?: string | null;
  badge?: string | null;
};

export function TaskItem({ task, compact = false, showActions = true }: { task: TaskItemData; compact?: boolean; showActions?: boolean }) {
  const [optimisticDone, setOptimisticDone] = useOptimistic(task.done);
  const [, startTransition] = useTransition();
  const toast = useToast();

  function toggle() {
    const next = !optimisticDone;
    startTransition(async () => {
      setOptimisticDone(next);
      const res = next ? await completeTaskAction(task.id) : await reopenTaskAction(task.id);
      if (!res.ok) toast.show({ message: res.error, tone: "error" });
      else if (next) toast.show({ message: `Hecho: ${task.title}`, action: { label: "Deshacer", onClick: () => void reopenTaskAction(task.id) } });
    });
  }

  function defer(days: number) {
    startTransition(async () => {
      const res = await deferTaskAction(task.id, days);
      toast.show(res.ok ? { message: days === 1 ? "Movida a mañana." : "Movida a la próxima semana.", tone: "info" } : { message: res.error, tone: "error" });
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await deleteTaskAction(task.id);
      toast.show(res.ok ? { message: "Tarea eliminada.", tone: "info", action: { label: "Deshacer", onClick: () => void restoreTaskAction(task.id) } } : { message: res.error, tone: "error" });
    });
  }

  return (
    <div className={cn("group flex items-start gap-3", compact ? "py-2.5" : "px-4 py-3.5")}>
      <button
        onClick={toggle}
        role="checkbox"
        aria-checked={optimisticDone}
        aria-label={optimisticDone ? `Marcar “${task.title}” como pendiente` : `Completar “${task.title}”`}
        className={cn(
          "mt-0.5 grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border-[1.5px] transition-all duration-200",
          optimisticDone ? "border-good bg-good text-white" : "border-line-strong hover:border-ink-2",
        )}
      >
        <Check className={cn("h-3 w-3 transition-transform", optimisticDone ? "scale-100" : "scale-0")} strokeWidth={3.2} />
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn("text-[15px] leading-snug transition-colors", optimisticDone ? "text-ink-3 line-through decoration-ink-3/60" : "text-ink")}>{task.title}</p>
        {task.meta || task.dateLabel || task.projectTitle || task.badge ? (
          <p className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12.5px] text-ink-3">
            {task.dateLabel ? <span className={cn(task.dateTone === "overdue" && "font-medium text-bad", task.dateTone === "today" && "text-accent")}>{task.dateLabel}</span> : null}
            {task.projectTitle ? (
              <span className="inline-flex items-center gap-1">
                <FolderOpen className="h-3 w-3" /> {task.projectTitle}
              </span>
            ) : null}
            {task.badge ? <span className="rounded-full bg-accent-soft px-1.5 py-px text-[11px] font-medium text-accent">{task.badge}</span> : null}
            {task.meta ? <span>{task.meta}</span> : null}
          </p>
        ) : null}
      </div>
      {showActions && !optimisticDone ? (
        <details className="relative">
          <summary className="grid h-8 w-8 cursor-pointer list-none place-items-center rounded-full text-ink-3 opacity-70 hover:bg-surface-2 hover:text-ink group-hover:opacity-100 [&::-webkit-details-marker]:hidden" aria-label="Más acciones">
            <EllipsisVertical className="h-4 w-4" />
          </summary>
          <div className="absolute right-0 top-9 z-20 w-48 overflow-hidden rounded-2xl border border-line bg-surface py-1 shadow-[var(--shadow-lg)]">
            <button onClick={() => defer(1)} className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm hover:bg-surface-2">
              <CalendarClock className="h-4 w-4 text-ink-3" /> Mover a mañana
            </button>
            <button onClick={() => defer(7)} className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm hover:bg-surface-2">
              <CalendarClock className="h-4 w-4 text-ink-3" /> Próxima semana
            </button>
            <button onClick={remove} className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm text-bad hover:bg-bad-soft">
              <Trash2 className="h-4 w-4" /> Eliminar
            </button>
          </div>
        </details>
      ) : null}
    </div>
  );
}
