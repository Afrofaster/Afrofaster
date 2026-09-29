import { diffDays, formatRelative } from "@/domain/dates";
import type { TaskItemData } from "./task-item";

type TaskLike = { id: string; title: string; status: string; dueDate: string | null; scheduledDate: string | null; projectTitle?: string | null; estimatedMinutes?: number | null };

/** Server-side formatting so client rows stay dumb and fast. */
export function toTaskItem(t: TaskLike, today: string, extra: Partial<TaskItemData> = {}): TaskItemData {
  const ref = t.dueDate ?? t.scheduledDate;
  let dateLabel: string | null = null;
  let dateTone: TaskItemData["dateTone"] = "normal";
  if (ref) {
    const d = diffDays(today, ref);
    if (t.dueDate && d < 0) {
      dateLabel = `Vencida · ${formatRelative(ref, today)}`;
      dateTone = "overdue";
    } else {
      const rel = formatRelative(ref, today);
      dateLabel = t.dueDate ? `Vence ${rel.charAt(0).toLowerCase()}${rel.slice(1)}` : rel;
      if (d <= 0) dateTone = "today";
    }
  }
  return {
    id: t.id,
    title: t.title,
    done: t.status === "DONE",
    dateLabel,
    dateTone,
    projectTitle: t.projectTitle ?? null,
    meta: t.estimatedMinutes ? `${t.estimatedMinutes} min` : null,
    ...extra,
  };
}
