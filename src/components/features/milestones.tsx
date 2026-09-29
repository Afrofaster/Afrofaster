"use client";

import { useTransition } from "react";
import { Check, Flag } from "lucide-react";
import { createMilestoneAction, toggleMilestoneAction } from "@/app/actions/life";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/fields";
import { cn } from "@/lib/cn";
import { ActionForm } from "./forms";

export function Milestones({ projectId, items }: { projectId: string; items: Array<{ id: string; title: string; dueDate: string | null; done: boolean; dueLabel: string | null }> }) {
  const [, start] = useTransition();
  return (
    <div className="card overflow-hidden">
      <ul className="divide-y divide-line">
        {items.map((m) => (
          <li key={m.id} className="flex items-center gap-3 px-4 py-3">
            <button onClick={() => start(async () => { await toggleMilestoneAction(m.id); })} className={cn("grid h-6 w-6 place-items-center rounded-lg border-[1.5px]", m.done ? "border-accent bg-accent text-accent-ink" : "border-line-strong")} aria-label={m.done ? "Marcar hito pendiente" : "Completar hito"}>
              {m.done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <Flag className="h-3 w-3 text-ink-3" />}
            </button>
            <span className={cn("flex-1 text-[14.5px]", m.done && "text-ink-3 line-through")}>{m.title}</span>
            {m.dueLabel ? <span className="text-[12px] text-ink-3">{m.dueLabel}</span> : null}
          </li>
        ))}
      </ul>
      <ActionForm action={createMilestoneAction.bind(null, projectId)} className="flex gap-2 border-t border-line p-3">
        <Input name="title" placeholder="Nuevo hito…" required className="h-10 flex-1" />
        <Input name="dueDate" type="date" className="h-10 w-36" aria-label="Fecha del hito" />
        <Button size="sm" variant="secondary" type="submit" className="h-10">Añadir</Button>
      </ActionForm>
    </div>
  );
}
