import type { Metadata } from "next";
import { Scale } from "lucide-react";
import { listDecisions } from "@/application/decisions";
import { createDecisionAction } from "@/app/actions/life";
import { ActionForm, SheetButton } from "@/components/features/forms";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/fields";
import { Badge, Divided, EmptyState, PageHeader, RowLink } from "@/components/ui/primitives";
import { formatRelative } from "@/domain/dates";
import { DECISION_STATUS_LABEL } from "@/domain/enums";
import { loadAsUser } from "@/server/action";

export const metadata: Metadata = { title: "Decisiones" };

export default async function DecisionsPage() {
  const data = await loadAsUser(async (ctx) => ({ items: await listDecisions(ctx), today: ctx.today }));
  return (
    <div className="space-y-5">
      <PageHeader
        title="Decisiones"
        subtitle="Registra cómo decides para decidir mejor la próxima vez."
        action={
          <SheetButton label="Decisión" title="Nueva decisión" variant="primary">
            {() => (
              <ActionForm action={createDecisionAction} className="space-y-4">
                <Field label="¿Qué tienes que decidir?" htmlFor="d-q"><Input id="d-q" name="question" required autoFocus placeholder="¿Acepto un nuevo cliente?" /></Field>
                <Field label="Contexto" htmlFor="d-c"><Textarea id="d-c" name="context" rows={3} /></Field>
                <Field label="Fecha límite" htmlFor="d-d"><Input id="d-d" name="deadline" type="date" /></Field>
                <Button type="submit" size="lg" className="w-full">Abrir decisión</Button>
              </ActionForm>
            )}
          </SheetButton>
        }
      />
      {data.items.length === 0 ? (
        <EmptyState icon={<Scale className="h-5 w-5" />} title="Sin decisiones registradas" body='Di “tengo que decidir si…” y LÍA abre la decisión.' />
      ) : (
        <Divided>
          {data.items.map((d) => (
            <RowLink key={d.id} href={`/decisions/${d.id}`} title={d.question} subtitle={[d.deadline ? `Decidir ${formatRelative(d.deadline, data.today).toLowerCase()}` : null, d.decision ? `Decidí: ${d.decision}` : null].filter(Boolean).join(" · ") || `${d.optionCount} opciones`} trailing={<Badge tone={d.status === "OPEN" ? "warn" : d.status === "DECIDED" ? "accent" : "neutral"}>{DECISION_STATUS_LABEL[d.status]}</Badge>} />
          ))}
        </Divided>
      )}
    </div>
  );
}
