"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { Plus } from "lucide-react";
import type { ActionResult } from "@/server/action";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";

/** Form bound to a Server Action returning ActionResult: toast feedback, reset, refresh. */
export function ActionForm({ action, children, className, onSuccess, resetOnSuccess = true }: { action: (form: FormData) => Promise<ActionResult<unknown> | void>; children: ReactNode; className?: string; onSuccess?: () => void; resetOnSuccess?: boolean }) {
  const ref = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <form
      ref={ref}
      className={className}
      aria-busy={pending}
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        start(async () => {
          const res = await action(data);
          if (res && !res.ok) {
            toast.show({ message: res.error, tone: "error" });
            return;
          }
          if (res?.message) toast.show({ message: res.message });
          if (resetOnSuccess) ref.current?.reset();
          onSuccess?.();
          router.refresh();
        });
      }}
    >
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
    </form>
  );
}

export function SheetButton({ label, title, children, variant = "secondary", icon = true, defaultOpen = false }: { label: string; title: string; children: (close: () => void) => ReactNode; variant?: "primary" | "secondary" | "soft"; icon?: boolean; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <>
      <Button size="sm" variant={variant} onClick={() => setOpen(true)}>
        {icon ? <Plus className="h-4 w-4" /> : null}
        {label}
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title={title}>
        {open ? children(() => setOpen(false)) : null}
      </Sheet>
    </>
  );
}
