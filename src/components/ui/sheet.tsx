"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

/** Accessible bottom sheet (mobile) / centered dialog (desktop) built on <dialog>. */
export function Sheet({ open, onClose, title, children, className }: { open: boolean; onClose: () => void; title: string; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-label={title}
      className={cn(
        "m-0 mt-auto w-full max-w-none rounded-t-[28px] border border-line bg-surface p-0 text-ink shadow-[var(--shadow-lg)] backdrop:bg-transparent",
        "sm:m-auto sm:max-w-lg sm:rounded-[28px]",
        "open:animate-fade-up",
        className,
      )}
    >
      <div className="safe-bottom max-h-[88dvh] overflow-y-auto px-5 pt-3 pb-5">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line-strong sm:hidden" aria-hidden />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="display text-xl">{title}</h2>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full text-ink-2 hover:bg-surface-2" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
