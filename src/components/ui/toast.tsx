"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/cn";

type ToastTone = "success" | "info" | "error";
type Toast = { id: number; message: string; tone: ToastTone; href?: string; hrefLabel?: string; action?: { label: string; onClick: () => void } };
type ToastInput = Omit<Toast, "id" | "tone"> & { tone?: ToastTone; duration?: number };

const ToastContext = createContext<{ show: (t: ToastInput) => number; dismiss: (id: number) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), []);
  const show = useCallback(
    (t: ToastInput) => {
      counter.current += 1;
      const id = counter.current;
      setToasts((all) => [...all.slice(-2), { ...t, id, tone: t.tone ?? "success" }]);
      window.setTimeout(() => dismiss(id), t.duration ?? 4200);
      return id;
    },
    [dismiss],
  );
  const value = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-4 pt-[max(env(safe-area-inset-top),12px)]" aria-live="polite" role="status">
        {toasts.map((t) => (
          <div key={t.id} className="glass pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border border-line px-4 py-3 shadow-[var(--shadow-lg)] animate-fade-up">
            <span className={cn("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full", t.tone === "success" && "bg-good-soft text-good", t.tone === "info" && "bg-accent-soft text-accent", t.tone === "error" && "bg-bad-soft text-bad")}>
              {t.tone === "success" ? <Check className="h-3 w-3" strokeWidth={3} /> : t.tone === "error" ? <TriangleAlert className="h-3 w-3" /> : <Info className="h-3 w-3" />}
            </span>
            <p className="min-w-0 flex-1 text-sm leading-snug text-ink">{t.message}</p>
            {t.href ? (
              <Link href={t.href} className="shrink-0 text-sm font-medium text-accent" onClick={() => dismiss(t.id)}>
                {t.hrefLabel ?? "Ver"}
              </Link>
            ) : null}
            {t.action ? (
              <button className="shrink-0 text-sm font-medium text-accent" onClick={() => { t.action?.onClick(); dismiss(t.id); }}>
                {t.action.label}
              </button>
            ) : null}
            <button onClick={() => dismiss(t.id)} className="shrink-0 text-ink-3 hover:text-ink" aria-label="Cerrar">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
