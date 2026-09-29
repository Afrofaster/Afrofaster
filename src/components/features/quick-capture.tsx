"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowUp, CloudOff } from "lucide-react";
import { cn } from "@/lib/cn";
import { enqueueCapture, newClientId, QUEUE_EVENT, readQueue } from "@/lib/offline-queue";
import { useToast } from "@/components/ui/toast";

type CaptureResponse = { message: string; redirect: string | null; entity: { href?: string } | null; status: string; children?: unknown[] };

export function useCapture() {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  async function submit(text: string): Promise<boolean> {
    const clientId = newClientId();
    if (!navigator.onLine) {
      enqueueCapture(text, clientId);
      toast.show({ message: "Sin conexión: guardado en este dispositivo. Lo sincronizo al volver.", tone: "info" });
      return true;
    }
    try {
      const res = await fetch("/api/capture", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, clientId }) });
      const data = (await res.json().catch(() => ({}))) as Partial<CaptureResponse> & { error?: string };
      if (!res.ok) {
        if (res.status >= 500) {
          enqueueCapture(text, clientId);
          toast.show({ message: "No pude guardarlo en el servidor. Lo guardé aquí y lo reintento.", tone: "error" });
          return true;
        }
        toast.show({ message: data.error ?? "No pude guardar la captura.", tone: "error" });
        return false;
      }
      if (data.redirect) {
        router.push(data.redirect);
        return true;
      }
      toast.show({ message: data.message ?? "Capturado.", tone: data.status === "NEEDS_REVIEW" ? "info" : "success", href: data.entity?.href ?? (data.status === "NEEDS_REVIEW" ? "/inbox" : undefined) });
      startTransition(() => router.refresh());
      return true;
    } catch {
      enqueueCapture(text, clientId);
      toast.show({ message: "Se cortó la conexión. Lo guardé aquí y lo sincronizo después.", tone: "info" });
      return true;
    }
  }
  return { submit, pending };
}

export function QuickCapture({ autoFocus = false, placeholder = "¿Qué tienes en mente?", onDone, className }: { autoFocus?: boolean; placeholder?: string; onDone?: () => void; className?: string }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [queued, setQueued] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { submit } = useCapture();

  useEffect(() => {
    const update = () => setQueued(readQueue().length);
    update();
    window.addEventListener(QUEUE_EVENT, update);
    return () => window.removeEventListener(QUEUE_EVENT, update);
  }, []);

  async function onSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    const ok = await submit(value);
    setBusy(false);
    if (ok) {
      setText("");
      onDone?.();
    }
    inputRef.current?.focus();
  }

  return (
    <form onSubmit={onSubmit} className={cn("card relative flex items-end gap-2 p-2 pl-4 transition-shadow focus-within:shadow-[var(--shadow)]", className)}>
      <label htmlFor="quick-capture" className="sr-only">
        Captura rápida
      </label>
      <textarea
        id="quick-capture"
        ref={inputRef}
        value={text}
        rows={1}
        autoFocus={autoFocus}
        onChange={(e) => {
          setText(e.target.value);
          e.target.style.height = "auto";
          e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void onSubmit();
          }
        }}
        placeholder={placeholder}
        maxLength={2000}
        enterKeyHint="send"
        className="max-h-40 min-h-11 flex-1 resize-none bg-transparent py-2.5 text-[15.5px] leading-snug outline-none"
      />
      {queued > 0 ? (
        <span className="mb-2.5 flex items-center gap-1 text-[11px] text-warn" title="Capturas pendientes de sincronizar">
          <CloudOff className="h-3.5 w-3.5" /> {queued}
        </span>
      ) : null}
      <button type="submit" disabled={!text.trim() || busy} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-bg transition-opacity disabled:opacity-25" aria-label="Guardar captura">
        {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" /> : <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.4} />}
      </button>
    </form>
  );
}
