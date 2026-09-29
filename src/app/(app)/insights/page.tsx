import type { Metadata } from "next";
import { Lightbulb } from "lucide-react";
import { getInsights } from "@/application/insights";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { loadAsUser } from "@/server/action";

export const metadata: Metadata = { title: "Patrones" };

export default async function InsightsPage() {
  const data = await loadAsUser(getInsights);
  return (
    <div className="space-y-5">
      <PageHeader title="Patrones" subtitle="Solo afirmo una relación cuando hay datos suficientes." />
      {data.insights.length === 0 ? (
        <EmptyState
          icon={<Lightbulb className="h-5 w-5" />}
          title="Aún no hay patrones confiables"
          body={
            data.daysNeeded > 0
              ? `Necesito unos ${data.daysNeeded} días más con sueño registrado y Big 3 para comparar. Llevas ${data.trackedDays}.`
              : "Con los datos actuales no aparece ninguna diferencia relevante. Eso también es información."
          }
        />
      ) : (
        <ul className="space-y-3">
          {data.insights.map((i) => (
            <li key={i.key}>
              <Card className="p-5">
                <p className="display text-xl leading-snug">{i.message}</p>
                <p className="mt-3 flex items-center gap-2 text-[12.5px] text-ink-3">
                  <Badge tone={i.strength === "fuerte" ? "accent" : "neutral"}>Relación {i.strength}</Badge> {i.sample} · correlación, no causalidad
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
