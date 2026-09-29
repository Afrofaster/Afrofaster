/** Minimal line chart for score history. Neutral, no axes noise. */
export function Sparkline({ points, height = 56, className }: { points: Array<{ label: string; value: number }>; height?: number; className?: string }) {
  if (points.length < 2) return <p className="text-[12.5px] text-ink-3">El historial aparece desde la segunda medición.</p>;
  const width = 320;
  const values = points.map((p) => p.value);
  const min = Math.min(...values) - 5;
  const max = Math.max(...values) + 5;
  const x = (i: number) => (i / (points.length - 1)) * (width - 8) + 4;
  const y = (v: number) => height - 4 - ((v - min) / (max - min || 1)) * (height - 8);
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className} role="img" aria-label={`Tendencia: de ${points[0].value} a ${last.value}`}>
      <path d={`${d} L${x(points.length - 1)},${height} L${x(0)},${height} Z`} fill="var(--accent-soft)" opacity="0.7" />
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(points.length - 1)} cy={y(last.value)} r="3.5" fill="var(--accent)" />
    </svg>
  );
}
