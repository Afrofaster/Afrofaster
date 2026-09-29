import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { UserFacingError } from "@/application/context";
import { getReview } from "@/application/reviews";
import { Card, SectionTitle } from "@/components/ui/primitives";
import { formatShort } from "@/domain/dates";
import { loadAsUser } from "@/server/action";

export const metadata: Metadata = { title: "Revisión" };

const SECTIONS: Record<string, string> = { WIN: "Wins", MISS: "Misses", ROOT_CAUSE: "Causas raíz", RISK: "Riesgos", STOP_DOING: "Stop doing", NOT_THIS_WEEK: "Not this week", LEARNING: "Aprendizaje" };

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await loadAsUser(async (ctx) => {
    try { return await getReview(ctx, id); } catch (err) { if (err instanceof UserFacingError) return null; throw err; }
  });
  if (!r) notFound();
  const content = r.content as Record<string, unknown>;
  const grouped = Object.keys(SECTIONS).map((k) => [k, r.items.filter((i) => i.section === k)] as const).filter(([, v]) => v.length);
  return (
    <div className="space-y-6">
      <Link href="/reviews" className="-ml-1 inline-flex items-center gap-1 text-[13px] text-ink-3 hover:text-ink"><ChevronLeft className="h-4 w-4" /> Revisiones</Link>
      <header>
        <p className="eyebrow">{formatShort(r.periodStart)} – {formatShort(r.periodEnd)}</p>
        <h1 className="display mt-1 text-[2rem]">{r.type === "WEEKLY" ? "CEO Meeting" : r.type === "MONTHLY" ? "Monthly Board" : "Cierre del día"}</h1>
        {r.summary ? <p className="mt-2 text-[15px] text-ink-2">{r.summary}</p> : null}
        <p className="mt-2 text-[13px] text-ink-3">{[r.lifeScore !== null ? `Life Score ${r.lifeScore}` : null, r.perceivedControl ? `Control percibido ${r.perceivedControl}/5` : null].filter(Boolean).join(" · ")}</p>
      </header>
      {typeof content.recommendation === "string" ? <Card className="p-4"><p className="eyebrow mb-1">Recomendación</p><p className="text-[15px]">{content.recommendation}</p></Card> : null}
      {grouped.map(([k, items]) => (
        <section key={k}>
          <SectionTitle title={SECTIONS[k]} />
          <Card className="p-4"><ul className="space-y-1.5 text-[14px]">{items.map((i) => <li key={i.id}>• {i.text}</li>)}</ul></Card>
        </section>
      ))}
      {r.type === "DAILY_SHUTDOWN" ? (
        <Card className="space-y-2 p-4 text-[14px]">
          {["blockers", "surprises", "learning"].map((k) => typeof content[k] === "string" && content[k] ? <p key={k}><span className="text-ink-3">{{ blockers: "Bloqueos", surprises: "Imprevistos", learning: "Aprendizaje" }[k]}: </span>{String(content[k])}</p> : null)}
          <p className="text-ink-3">Completado: {Array.isArray(content.done) ? (content.done as string[]).join(", ") || "—" : "—"}</p>
        </Card>
      ) : null}
    </div>
  );
}
