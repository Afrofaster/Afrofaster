import { cn } from "@/lib/cn";

/** Circular score (0–100) with a soft gradient stroke. */
export function ScoreRing({ score, size = 120, stroke = 9, className, children }: { score: number | null; size?: number; stroke?: number; className?: string; children?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const value = score ?? 0;
  const tone = score === null ? "var(--line-strong)" : value >= 75 ? "var(--good)" : value >= 55 ? "var(--accent)" : value >= 40 ? "var(--warn)" : "var(--bad)";
  return (
    <div className={cn("relative grid place-items-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * value) / 100}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(.2,.7,.2,1)" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

export function HealthDot({ health, className }: { health: "GOOD" | "WATCH" | "CRITICAL" | "UNKNOWN"; className?: string }) {
  const color = { GOOD: "bg-good", WATCH: "bg-warn", CRITICAL: "bg-bad", UNKNOWN: "bg-line-strong" }[health];
  const label = { GOOD: "Bien", WATCH: "Vigilar", CRITICAL: "Crítico", UNKNOWN: "Sin evaluar" }[health];
  return <span className={cn("inline-block h-2 w-2 shrink-0 rounded-full", color, className)} role="img" aria-label={label} title={label} />;
}
