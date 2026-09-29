import type { Metadata } from "next";
import Link from "next/link";
import { CalendarRange, ClipboardCheck, Moon } from "lucide-react";
import { listReviews } from "@/application/reviews";
import { Divided, EmptyState, PageHeader, RowLink, SectionTitle } from "@/components/ui/primitives";
import { formatShort } from "@/domain/dates";
import { loadAsUser } from "@/server/action";

export const metadata: Metadata = { title: "Revisiones" };

const TYPE = { WEEKLY: "Semanal", MONTHLY: "Mensual", DAILY_SHUTDOWN: "Cierre del día", DAILY_BRIEF: "Brief" } as const;

export default async function ReviewsPage() {
  const reviews = await loadAsUser((ctx) => listReviews(ctx));
  return (
    <div className="space-y-6">
      <PageHeader title="Revisiones" subtitle="Detenerse para ver el mapa completo." />
      <div className="grid grid-cols-3 gap-2.5">
        <Link href="/reviews/weekly" className="card flex flex-col items-start gap-3 p-4 hover:shadow-[var(--shadow)]"><ClipboardCheck className="h-5 w-5 text-accent" /><span className="text-[14px] font-medium">Semanal</span></Link>
        <Link href="/reviews/monthly" className="card flex flex-col items-start gap-3 p-4 hover:shadow-[var(--shadow)]"><CalendarRange className="h-5 w-5 text-accent" /><span className="text-[14px] font-medium">Mensual</span></Link>
        <Link href="/shutdown" className="card flex flex-col items-start gap-3 p-4 hover:shadow-[var(--shadow)]"><Moon className="h-5 w-5 text-accent" /><span className="text-[14px] font-medium">Cierre</span></Link>
      </div>
      <section>
        <SectionTitle title="Historial" />
        {reviews.length === 0 ? <EmptyState title="Aún no hay revisiones" body="Tu primera revisión semanal toma unos 10 minutos." /> : (
          <Divided>
            {reviews.map((r) => <RowLink key={r.id} href={`/reviews/${r.id}`} title={`${TYPE[r.type]} · ${formatShort(r.periodStart)}`} subtitle={[r.lifeScore !== null ? `Life Score ${r.lifeScore}` : null, r.perceivedControl ? `Control ${r.perceivedControl}/5` : null, r.summary].filter(Boolean).join(" · ")} />)}
          </Divided>
        )}
      </section>
    </div>
  );
}
