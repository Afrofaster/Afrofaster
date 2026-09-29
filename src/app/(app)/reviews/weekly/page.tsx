import type { Metadata } from "next";
import { buildWeeklyReview } from "@/application/reviews";
import { WeeklyReviewFlow } from "@/components/features/weekly-review-flow";
import { PageHeader } from "@/components/ui/primitives";
import { formatShort } from "@/domain/dates";
import { loadAsUser } from "@/server/action";

export const metadata: Metadata = { title: "Revisión semanal" };

export default async function WeeklyReviewPage() {
  const data = await loadAsUser(buildWeeklyReview);
  return (
    <div>
      <PageHeader eyebrow={`Semana ${formatShort(data.period.start)} – ${formatShort(data.period.end)}`} title="CEO Meeting" subtitle="Qué cambió, qué aprendiste y qué sigue." />
      <WeeklyReviewFlow data={data} />
    </div>
  );
}
