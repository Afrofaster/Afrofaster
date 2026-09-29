import type { Metadata } from "next";
import { Wrench } from "lucide-react";
import { listFailures, systemShare } from "@/application/failures";
import { createFailureAction } from "@/app/actions/learning";
import { ActionForm, SheetButton } from "@/components/features/forms";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/fields";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { formatShort } from "@/domain/dates";
import { loadAsUser } from "@/server/action";

export const metadata: Metadata = { title: "Aprendizajes" };

export default async function FailuresPage() {
  const items = await loadAsUser(listFailures);
  const share = systemShare(items);
  return (
    <div className="space-y-5">
      <PageHeader
        title="Aprendizajes"
        subtitle="Registro de errores sin culpa: qué pasó, por qué y qué ajustamos."
        action={
          <SheetButton label="Registrar" title="¿Qué no salió como esperabas?" variant="primary">
            <ActionForm action={createFailureAction} className="space-y-4">
              <Field label="¿Qué pasó?" htmlFor="f-e"><Input id="f-e" name="event" required autoFocus placeholder="No envié la propuesta a tiempo" /></Field>
              <Field label="Causa inmediata" htmlFor="f-c"><Textarea id="f-c" name="cause" rows={2} /></Field>
              <Field label="Causa raíz (el sistema, no la persona)" htmlFor="f-r" hint="Pregúntate “¿por qué?” tres veces."><Textarea id="f-r" name="rootCause" rows={2} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="¿Era controlable?" htmlFor="f-ctl">
                  <Select id="f-ctl" name="controllable" defaultValue=""><option value="">No sé</option><option value="yes">Sí</option><option value="no">No</option></Select>
                </Field>
                <Field label="¿Falló el sistema?" htmlFor="f-sys">
                  <Select id="f-sys" name="systemFailure" defaultValue=""><option value="">No sé</option><option value="yes">Sí</option><option value="no">No</option></Select>
                </Field>
              </div>
              <Field label="Corrección" htmlFor="f-co"><Textarea id="f-co" name="correction" rows={2} placeholder="Bloquear 30 min el jueves para propuestas" /></Field>
              <Field label="Seguimiento" htmlFor="f-fu"><Input id="f-fu" name="followUp" /></Field>
              <Button type="submit" size="lg" className="w-full">Guardar aprendizaje</Button>
            </ActionForm>
          </SheetButton>
        }
      />
      {share !== null ? (
        <Card className="p-4 text-[14px] text-ink-2">
          <span className="display text-2xl text-ink">{share}%</span> de tus tropiezos registrados vienen del sistema (planeación, capacidad, herramientas), no de la fuerza de voluntad. Ahí está la palanca.
        </Card>
      ) : null}
      {items.length === 0 ? (
        <EmptyState icon={<Wrench className="h-5 w-5" />} title="Sin registros" body="Cuando algo no salga como esperabas, anótalo aquí. En la revisión semanal buscamos patrones." />
      ) : (
        <ul className="space-y-2.5">
          {items.map((f) => (
            <li key={f.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-[15px] font-medium leading-snug">{f.event}</p>
                <span className="shrink-0 text-[12px] text-ink-3">{formatShort(f.occurredAt)}</span>
              </div>
              {f.rootCause ? <p className="mt-1.5 text-[13.5px] text-ink-2"><span className="text-ink-3">Raíz: </span>{f.rootCause}</p> : f.cause ? <p className="mt-1.5 text-[13.5px] text-ink-2"><span className="text-ink-3">Causa: </span>{f.cause}</p> : null}
              {f.correction ? <p className="mt-1 text-[13.5px] text-ink-2"><span className="text-ink-3">Ajuste: </span>{f.correction}</p> : null}
              <div className="mt-2 flex gap-1.5">
                {f.systemFailure ? <Badge tone="accent">Sistema</Badge> : null}
                {f.controllable === false ? <Badge>Fuera de control</Badge> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
