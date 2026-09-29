"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Archive, Check } from "lucide-react";
import { acceptSuggestionAction, archiveInboxAction, convertInboxAction } from "@/app/actions/life";
import { Badge } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

type Props = { id: string; text: string; typeLabel: string; status: string; when: string; suggestion: { action?: string; taskTitle?: string; title?: string } | null; error: string | null; reviewable: boolean };

export function InboxItemRow({ id, text, typeLabel, status, when, suggestion, error, reviewable }: Props) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const run = (fn: () => Promise<{ ok: boolean; error?: string; data?: unknown }>, ok: string) =>
    start(async () => {
      const res = await fn();
      toast.show(res.ok ? { message: ok } : { message: res.error ?? "No pude hacerlo.", tone: "error" });
    });
  const suggestionLabel =
    suggestion?.action === "COMPLETE_TASK" ? `Completar “${suggestion.taskTitle}”` : suggestion?.action === "CREATE_PROJECT" ? `Crear proyecto “${suggestion.title}”` : suggestion?.action === "CREATE_GOAL" ? `Crear objetivo “${suggestion.title}”` : null;

  return (
    <li className="px-4 py-3.5" aria-busy={pending}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] leading-snug">{text}</p>
          <p className="mt-1 flex items-center gap-2 text-[12px] text-ink-3">
            <Badge tone={status === "NEEDS_REVIEW" ? "warn" : "neutral"}>{typeLabel}</Badge> {when}
          </p>
          {error ? <p className="mt-1 text-[12.5px] text-ink-3">{error}</p> : null}
        </div>
        {reviewable ? (
          <button onClick={() => run(() => archiveInboxAction(id), "Archivado.")} className="grid h-8 w-8 place-items-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label="Archivar">
            <Archive className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      {reviewable ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {suggestionLabel ? (
            <button onClick={() => run(() => acceptSuggestionAction(id), "Hecho.")} className="inline-flex items-center gap-1 rounded-full bg-ink px-3 py-1.5 text-[12.5px] font-medium text-bg">
              <Check className="h-3.5 w-3.5" /> {suggestionLabel}
            </button>
          ) : null}
          {(["TASK", "PROJECT", "GOAL", "IDEA", "NOTE"] as const).map((t) => (
            <button key={t} onClick={() => run(() => convertInboxAction(id, t), "Convertido.")} className="rounded-full border border-line px-3 py-1.5 text-[12.5px] text-ink-2 hover:border-line-strong hover:text-ink">
              {{ TASK: "Tarea", PROJECT: "Proyecto", GOAL: "Objetivo", IDEA: "Idea", NOTE: "Nota" }[t]}
            </button>
          ))}
          <Link href={`/lia?q=${encodeURIComponent(text)}`} className="rounded-full border border-line px-3 py-1.5 text-[12.5px] text-accent">Preguntar a LÍA</Link>
        </div>
      ) : null}
    </li>
  );
}
