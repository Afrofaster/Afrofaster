import Link from "next/link";
import { AlertCircle, CalendarClock, ChevronRight, Inbox, Sparkles } from "lucide-react";
import { getHomeSnapshot } from "@/application/dashboard";
import { Big3Card } from "@/components/features/big3";
import { LifeScoreCard } from "@/components/features/life-score-card";
import { QuickCapture } from "@/components/features/quick-capture";
import { LiaOrb } from "@/components/layout/lia-orb";
import { AreaIcon } from "@/components/ui/area-icon";
import { Card, SectionTitle } from "@/components/ui/primitives";
import { HealthDot } from "@/components/ui/score-ring";
import { formatLong, formatRelative, minutesToHHMM } from "@/domain/dates";
import { findAreaDefinition } from "@/domain/life-areas";
import { cn } from "@/lib/cn";
import { loadAsUser } from "@/server/action";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const [home, { welcome }] = await Promise.all([loadAsUser(getHomeSnapshot), searchParams]);

  return (
    <div className="space-y-7">
      <header className="animate-fade-up">
        <p className="eyebrow">{formatLong(home.today)}</p>
        <h1 className="display mt-1.5 text-[2.15rem] leading-[1.08]">{home.greeting}</h1>
      </header>

      {welcome ? (
        <Card className="relative overflow-hidden p-5 animate-fade-up">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-30 blur-2xl orb" aria-hidden />
          <div className="relative flex gap-4">
            <LiaOrb size={40} />
            <div>
              <p className="display text-lg">Tu primer tablero de vida está listo.</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-2">
                Ya conozco tus áreas, tus objetivos a 90 días y tus compromisos fijos. A partir de ahora, cuéntame lo que pase y yo lo organizo.
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      <QuickCapture />

      <LifeScoreCard score={home.lifeScore} capacity={home.capacity} />

      <section aria-labelledby="big3-title">
        <h2 id="big3-title" className="sr-only">Big 3</h2>
        <Big3Card items={home.big3} date={home.today} />
      </section>

      <section>
        <SectionTitle title="Lo próximo" />
        <Link href="/today" className="card flex items-center gap-4 p-4 transition-colors hover:bg-surface-2">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent">
            <CalendarClock className="h-5 w-5" />
          </span>
          {home.nextUp ? (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-medium">{home.nextUp.title}</span>
              <span className="text-[13px] text-ink-3">
                {home.nextUp.kind === "event" && home.nextUp.startMinutes !== null ? `Hoy · ${minutesToHHMM(home.nextUp.startMinutes)}` : home.nextUp.date ? formatRelative(home.nextUp.date, home.today) : "Sin fecha"}
                {home.nextUp.kind === "event" ? " · Evento" : " · Tarea"}
              </span>
            </span>
          ) : (
            <span className="flex-1 text-[15px] text-ink-2">Nada agendado. Buen momento para lo importante.</span>
          )}
          <ChevronRight className="h-4 w-4 text-ink-3" />
        </Link>
      </section>

      <section>
        <SectionTitle title="Atención" />
        {home.attention.length === 0 ? (
          <Card className="flex items-center gap-3 p-4 text-[14px] text-ink-2">
            <Sparkles className="h-4 w-4 text-good" /> Nada urgente requiere tu atención. Así se ve el control.
          </Card>
        ) : (
          <Card as="div" className="divide-y divide-line overflow-hidden">
            {home.attention.map((a) => (
              <Link key={a.key} href={a.href ?? "/"} className="flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2">
                <AlertCircle className={cn("mt-0.5 h-4 w-4 shrink-0", a.severity === 3 ? "text-bad" : a.severity === 2 ? "text-warn" : "text-ink-3")} />
                <span className="flex-1 text-[14.5px] leading-snug">{a.message}</span>
              </Link>
            ))}
          </Card>
        )}
      </section>

      <section>
        <SectionTitle title="Áreas de vida" action={<Link href="/life" className="text-[13px] font-medium text-accent">Ver todo</Link>} />
        <Card className="p-3">
          {home.areas.length === 0 ? (
            <p className="p-2 text-sm text-ink-2">No tienes áreas activas. <Link href="/life" className="text-accent">Actívalas</Link>.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-1 sm:grid-cols-3">
              {home.areas.map((a) => (
                <li key={a.key}>
                  <Link href={`/life/${a.key}`} className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition-colors hover:bg-surface-2">
                    <AreaIcon name={a.icon} className="h-4 w-4 text-ink-3" />
                    <span className="min-w-0 flex-1 truncate text-[13.5px]">{findAreaDefinition(a.key)?.short ?? a.name}</span>
                    <HealthDot health={a.health} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      {home.pendingInbox > 0 ? (
        <Link href="/inbox" className="flex items-center justify-center gap-2 text-[13px] text-ink-3 hover:text-ink">
          <Inbox className="h-4 w-4" /> {home.pendingInbox} {home.pendingInbox === 1 ? "elemento" : "elementos"} en tu Inbox por revisar
        </Link>
      ) : null}
    </div>
  );
}
