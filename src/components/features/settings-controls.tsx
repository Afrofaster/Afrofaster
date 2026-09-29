"use client";

import { useEffect, useOptimistic, useState, useTransition } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { setNotificationBudgetAction, setPrivacyAction } from "@/app/actions/settings";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/toast";

type Theme = "light" | "dark" | "system";

function applyTheme(t: Theme) {
  const dark = t === "dark" || (t === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
}

export function ThemePicker() {
  const [theme, setTheme] = useState<Theme>("system");
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading a browser-only preference after mount
      setTheme((localStorage.getItem("lia-theme") as Theme | null) ?? "system");
    } catch {
      // Storage blocked: keep system.
    }
  }, []);
  function apply(t: Theme) {
    setTheme(t);
    try {
      localStorage.setItem("lia-theme", t);
    } catch {
      // ignore
    }
    applyTheme(t);
  }
  const opts: Array<[Theme, string, typeof Sun]> = [["light", "Claro", Sun], ["dark", "Oscuro", Moon], ["system", "Sistema", Monitor]];
  return (
    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tema">
      {opts.map(([v, label, Icon]) => (
        <button key={v} role="radio" aria-checked={theme === v} onClick={() => apply(v)} className={cn("flex flex-col items-center gap-1.5 rounded-2xl border py-3 text-[13px] transition-colors", theme === v ? "border-ink bg-surface-2 text-ink" : "border-line text-ink-2")}>
          <Icon className="h-4 w-4" /> {label}
        </button>
      ))}
    </div>
  );
}

export function PrivacySwitch({ field, value, label, description }: { field: "analyticsEnabled" | "aiEnabled"; value: boolean; label: string; description: string }) {
  const [on, setOn] = useOptimistic(value);
  const [, start] = useTransition();
  const toast = useToast();
  return (
    <div className="flex items-start gap-4 px-4 py-3.5">
      <div className="flex-1">
        <p className="text-[14.5px]">{label}</p>
        <p className="text-[12.5px] leading-snug text-ink-3">{description}</p>
      </div>
      <button role="switch" aria-checked={on} aria-label={label} onClick={() => start(async () => { setOn(!on); const r = await setPrivacyAction(field, !on); if (!r.ok) toast.show({ message: r.error, tone: "error" }); })} className={cn("relative mt-1 h-6 w-10 shrink-0 rounded-full transition-colors", on ? "bg-good" : "bg-surface-3")}>
        <span className={cn("absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", on ? "translate-x-4" : "translate-x-0")} />
      </button>
    </div>
  );
}

export function NotificationBudget({ value }: { value: number }) {
  const [v, setV] = useOptimistic(value);
  const [, start] = useTransition();
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className="flex-1"><p className="text-[14.5px]">Presupuesto diario de notificaciones</p><p className="text-[12.5px] text-ink-3">LÍA nunca te enviará más de esto al día. Menos es mejor.</p></div>
      <div className="flex items-center gap-2">
        {[1, 3, 5].map((n) => (
          <button key={n} onClick={() => start(async () => { setV(n); await setNotificationBudgetAction(n); })} aria-pressed={v === n} className={cn("h-9 w-9 rounded-full text-[13px] font-medium", v === n ? "bg-ink text-bg" : "bg-surface-2 text-ink-2")}>{n}</button>
        ))}
      </div>
    </div>
  );
}
