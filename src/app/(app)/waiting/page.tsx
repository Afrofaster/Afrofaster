import type { Metadata } from "next";
import { Hourglass } from "lucide-react";
import { listWaiting } from "@/application/waiting";
import { createWaitingAction } from "@/app/actions/life";
import { ActionForm, SheetButton } from "@/components/features/forms";
import { WaitingActions } from "@/components/features/waiting-actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/fields";
import { Badge, EmptyState, PageHeader } from "@/components/ui/primitives";
import { formatRelative } from "@/domain/dates";
import { loadAsUser } from "@/server/action";

export const metadata: Metadata = { title: "En espera" };

export default async function WaitingPage() {
  const data = await loadAsUser(async (ctx) => ({ items: await listWaiting(ctx, "ALL"), today: ctx.today }));
  const open = data.items.filter((w) => w.status === "OPEN");
  const closed = data.items.filter((w) => w.status !== "OPEN").slice(0, 10);
  return (
    <div className="space-y-5">
      <PageHeader
        title="En espera"
        subtitle="Lo que otros quedaron de hacer. LÍA te recuerda hacer seguimiento."
        action={
          <SheetButton label="Nuevo" title="Estoy esperando…" variant="primary">
            {(close) => (
              <ActionForm action={createWaitingAction} onSuccess={close} className="space-y-4">
                <Field label="¿De quién?" htmlFor="w-p"><Input id="w-p" name="person" required placeholder="Carlos" autoFocus /></Field>
                <Field label="¿Qué?" htmlFor="w-i"><Input id="w-i" name="expectedItem" placeholder="el contrato firmado" /></Field>
                <Field label="¿Para cuándo?" htmlFor="w-d"><Input id="w-d" name="expectedDate" type="date" /></Field>
                <Button type="submit" size="lg" className="w-full">Guardar</Button>
              </ActionForm>
            )}
          </SheetButton>
        }
      />
      {open.length === 0 ? (
        <EmptyState icon={<Hourglass className="h-5 w-5" />} title="No esperas nada de nadie" body='Di “Carlos quedó de mandarme el contrato el viernes” y LÍA lo registra.' />
      ) : (
        <ul className="space-y-2.5">
          {open.map((w) => {
            const due = w.followUpDate !== null && w.followUpDate <= data.today;
            return (
              <li key={w.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[15px] leading-snug">
                    <span className="font-medium">{w.personName}</span> <span className="text-ink-2">— {w.expectedItem}</span>
                  </p>
                  {due ? <Badge tone="warn">Seguimiento</Badge> : null}
                </div>
                <p className="mt-1 text-[12.5px] text-ink-3">
                  {[w.expectedDate ? `Prometido: ${formatRelative(w.expectedDate, data.today).toLowerCase()}` : null, w.followUpDate ? `Seguimiento: ${formatRelative(w.followUpDate, data.today).toLowerCase()}` : null, w.projectTitle].filter(Boolean).join(" · ")}
                </p>
                <WaitingActions id={w.id} />
              </li>
            );
          })}
        </ul>
      )}
      {closed.length > 0 ? (
        <details className="card p-4">
          <summary className="cursor-pointer text-sm text-ink-2">Cerrados recientemente ({closed.length})</summary>
          <ul className="mt-3 space-y-2 text-[13.5px] text-ink-3">
            {closed.map((w) => <li key={w.id}>{w.status === "RECEIVED" ? "✓" : "✕"} {w.personName} — {w.expectedItem}</li>)}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
