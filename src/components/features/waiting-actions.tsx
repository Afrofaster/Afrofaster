"use client";

import { useTransition } from "react";
import { resolveWaitingAction, snoozeWaitingAction } from "@/app/actions/life";
import { useToast } from "@/components/ui/toast";

export function WaitingActions({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) => start(async () => { const r = await fn(); toast.show(r.ok ? { message: msg } : { message: r.error ?? "Error", tone: "error" }); });
  return (
    <div className="mt-3 flex gap-1.5" aria-busy={pending}>
      <button onClick={() => run(() => resolveWaitingAction(id, "RECEIVED"), "Recibido ✓")} className="rounded-full bg-ink px-3 py-1.5 text-[12.5px] font-medium text-bg">Recibido</button>
      <button onClick={() => run(() => snoozeWaitingAction(id), "Te recuerdo en 2 días.")} className="rounded-full border border-line px-3 py-1.5 text-[12.5px] text-ink-2">Recordar en 2 días</button>
      <button onClick={() => run(() => resolveWaitingAction(id, "CANCELLED"), "Descartado.")} className="rounded-full px-3 py-1.5 text-[12.5px] text-ink-3 hover:text-bad">Ya no aplica</button>
    </div>
  );
}
