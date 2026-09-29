"use client";

import { useTransition } from "react";
import { confirmMemoryAction, forgetMemoryAction } from "@/app/actions/life";

export function MemoryRow({ id, content, confirmed }: { id: string; content: string; confirmed: boolean }) {
  const [pending, start] = useTransition();
  return (
    <li className="flex items-start gap-3 px-4 py-3.5" aria-busy={pending}>
      <div className="flex-1">
        <p className="text-[14.5px]">{content}</p>
        <p className="text-[12px] text-ink-3">{confirmed ? "Confirmada · LÍA la usa" : "Sin confirmar · LÍA no la usa todavía"}</p>
      </div>
      {!confirmed ? <button onClick={() => start(async () => { await confirmMemoryAction(id); })} className="rounded-full bg-ink px-3 py-1.5 text-[12.5px] font-medium text-bg">Confirmar</button> : null}
      <button onClick={() => start(async () => { await forgetMemoryAction(id); })} className="rounded-full border border-line px-3 py-1.5 text-[12.5px] text-ink-2">Olvidar</button>
    </li>
  );
}
