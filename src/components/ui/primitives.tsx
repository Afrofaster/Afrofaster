import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

export function Card({ className, children, as: As = "section" }: { className?: string; children: ReactNode; as?: "section" | "div" | "article" | "li" }) {
  return <As className={cn("card", className)}>{children}</As>;
}

export function SectionTitle({ title, action, className }: { title: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-2.5 flex items-center justify-between px-1", className)}>
      <h2 className="eyebrow">{title}</h2>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, action, eyebrow }: { title: string; subtitle?: ReactNode; action?: ReactNode; eyebrow?: string }) {
  return (
    <header className="mb-6 flex items-end justify-between gap-4 animate-fade-up">
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow mb-1.5">{eyebrow}</p> : null}
        <h1 className="display text-[2rem] leading-[1.1] font-medium text-ink">{title}</h1>
        {subtitle ? <p className="mt-1.5 text-[15px] text-ink-2">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

type Tone = "neutral" | "accent" | "good" | "warn" | "bad";
const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink-2",
  accent: "bg-accent-soft text-accent",
  good: "bg-good-soft text-good",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-medium", tones[tone], className)}>{children}</span>;
}

export function Progress({ value, tone = "accent", className, label }: { value: number; tone?: Tone; className?: string; label?: string }) {
  const color = { neutral: "bg-ink-3", accent: "bg-accent", good: "bg-good", warn: "bg-warn", bad: "bg-bad" }[tone];
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-3", className)} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={cn("h-full rounded-full transition-[width] duration-500", color)} style={{ width: `${v}%` }} />
    </div>
  );
}

export function EmptyState({ icon, title, body, children }: { icon?: ReactNode; title: string; body?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-[var(--radius-card)] border border-dashed border-line-strong px-6 py-10 text-center animate-fade-up">
      {icon ? <div className="mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-surface-2 text-ink-2">{icon}</div> : null}
      <p className="text-[15px] font-medium text-ink">{title}</p>
      {body ? <p className="mt-1 max-w-xs text-sm text-ink-2">{body}</p> : null}
      {children ? <div className="mt-4 flex flex-wrap justify-center gap-2">{children}</div> : null}
    </div>
  );
}

export function RowLink({ href, icon, title, subtitle, trailing, className }: { href: string; icon?: ReactNode; title: ReactNode; subtitle?: ReactNode; trailing?: ReactNode; className?: string }) {
  return (
    <Link href={href} className={cn("flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2 active:bg-surface-3", className)}>
      {icon ? <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-ink-2">{icon}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] text-ink">{title}</span>
        {subtitle ? <span className="mt-0.5 block truncate text-[13px] text-ink-3">{subtitle}</span> : null}
      </span>
      {trailing}
      <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
    </Link>
  );
}

export function Divided({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("card divide-y divide-line overflow-hidden", className)}>{children}</div>;
}

export function Stat({ label, value, hint, className }: { label: string; value: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <div className={cn("card p-4", className)}>
      <p className="eyebrow">{label}</p>
      <p className="display mt-1.5 text-2xl text-ink">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-ink-3">{hint}</p> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden />;
}

export function Segmented({ items, active }: { items: Array<{ href: string; label: string; count?: number }>; active: string }) {
  return (
    <nav className="no-scrollbar -mx-4 mb-5 flex gap-1.5 overflow-x-auto px-4" aria-label="Filtros">
      {items.map((it) => (
        <Link
          key={it.href}
          href={it.href}
          aria-current={active === it.href ? "page" : undefined}
          className={cn(
            "shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors",
            active === it.href ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-2 hover:text-ink",
          )}
        >
          {it.label}
          {it.count !== undefined && it.count > 0 ? <span className="ml-1.5 opacity-60">{it.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}
