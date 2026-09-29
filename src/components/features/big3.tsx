import Link from "next/link";
import { Sparkles } from "lucide-react";
import type { Big3Item } from "@/application/intelligence";
import { Card, EmptyState } from "@/components/ui/primitives";
import { ConfirmBig3Button } from "./confirm-big3";
import { TaskItem } from "./task-item";

export function Big3Card({ items, date, title = "Big 3" }: { items: Big3Item[]; date: string; title?: string }) {
  const suggested = items.length > 0 && items.every((i) => i.origin === "AI_SUGGESTED");
  const done = items.filter((i) => i.done).length;
  if (items.length === 0) {
    return (
      <EmptyState icon={<Sparkles className="h-5 w-5" />} title="Sin prioridades todavía" body="Cuando tengas tareas, LÍA propondrá tus tres prioridades del día.">
        <Link href="/lia?q=organ%C3%ADzame%20hoy" className="text-sm font-medium text-accent">Pedirle a LÍA que organice mi día</Link>
      </EmptyState>
    );
  }
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-4 pb-1">
        <div>
          <h2 className="display text-xl">{title}</h2>
          <p className="text-[12.5px] text-ink-3">{suggested ? "Sugeridas por LÍA" : "Confirmadas por ti"} · {done}/{items.length} hechas</p>
        </div>
        {suggested ? <ConfirmBig3Button taskIds={items.map((i) => i.taskId).filter((id): id is string => Boolean(id))} date={date} /> : null}
      </div>
      <ol className="divide-y divide-line">
        {items.map((item) => (
          <li key={item.rank} className="relative">
            <span className="display absolute left-4 top-[18px] w-4 text-center text-[13px] text-ink-3" aria-hidden>
              {item.rank}
            </span>
            <div className="pl-6">
              {item.taskId ? (
                <TaskItem task={{ id: item.taskId, title: item.title, done: item.done, projectTitle: item.projectTitle, meta: null }} />
              ) : (
                <p className="px-4 py-3.5 text-[15px]">{item.title}</p>
              )}
              {item.reason && !item.done ? <p className="-mt-2 px-4 pb-3 pl-[52px] text-[12.5px] leading-snug text-ink-3">{item.reason}</p> : null}
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}
