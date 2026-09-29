"use client";

import { useOptimistic, useTransition } from "react";
import { rateAreaAction, setAreaModeAction, toggleAreaActiveAction } from "@/app/actions/life";
import { AREA_MODES, AREA_MODE_LABEL, type AreaMode } from "@/domain/enums";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/toast";

/** 1–10 self-rating. Stored as 0–100 so formulas stay fine-grained. */
export function AreaRater({ id, score }: { id: string; score: number | null }) {
  const [value, setValue] = useOptimistic(score === null ? null : Math.round(score / 10));
  const [, start] = useTransition();
  const toast = useToast();
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Calificación del 1 al 10">
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} de 10`}
          onClick={() =>
            start(async () => {
              setValue(n);
              const res = await rateAreaAction(id, n * 10);
              if (!res.ok) toast.show({ message: res.error, tone: "error" });
            })
          }
          className={cn(
            "h-8 flex-1 rounded-lg text-[12px] font-medium tabular-nums transition-colors",
            value === n ? "bg-ink text-bg" : value !== null && n < value ? "bg-surface-3 text-ink-2" : "bg-surface-2 text-ink-3 hover:bg-surface-3",
          )}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

export function AreaModeSelect({ id, mode }: { id: string; mode: AreaMode }) {
  const [pending, start] = useTransition();
  return (
    <select
      aria-label="Modo del área"
      disabled={pending}
      defaultValue={mode}
      onChange={(e) => start(async () => { await setAreaModeAction(id, e.target.value as AreaMode); })}
      className="h-8 rounded-full border border-line bg-surface px-2.5 text-[12px] font-medium text-ink-2"
    >
      {AREA_MODES.map((m) => <option key={m} value={m}>{AREA_MODE_LABEL[m]}</option>)}
    </select>
  );
}

export function AreaActiveToggle({ id, active }: { id: string; active: boolean }) {
  const [on, setOn] = useOptimistic(active);
  const [, start] = useTransition();
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={on ? "Área activa" : "Área inactiva"}
      onClick={() => start(async () => { setOn(!on); await toggleAreaActiveAction(id, !on); })}
      className={cn("relative h-6 w-10 shrink-0 rounded-full transition-colors", on ? "bg-good" : "bg-surface-3")}
    >
      <span className={cn("absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", on ? "translate-x-4" : "translate-x-0")} />
    </button>
  );
}
