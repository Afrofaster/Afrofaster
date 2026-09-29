import type { Metadata } from "next";
import { Users } from "lucide-react";
import { listPeople } from "@/application/people";
import { createPersonAction } from "@/app/actions/life";
import { ActionForm, SheetButton } from "@/components/features/forms";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/fields";
import { Divided, EmptyState, PageHeader, RowLink } from "@/components/ui/primitives";
import { loadAsUser } from "@/server/action";

export const metadata: Metadata = { title: "Personas" };

export default async function PeoplePage() {
  const people = await loadAsUser(listPeople);
  return (
    <div className="space-y-5">
      <PageHeader
        title="Personas"
        subtitle="Contexto humano: quién es quién y qué hablaron."
        action={
          <SheetButton label="Persona" title="Nueva persona" variant="primary">
            <ActionForm action={createPersonAction} className="space-y-4">
              <Field label="Nombre" htmlFor="pe-n"><Input id="pe-n" name="name" required autoFocus /></Field>
              <Field label="Relación" htmlFor="pe-r"><Input id="pe-r" name="relationship" placeholder="Cliente, colega, familia…" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Empresa" htmlFor="pe-c"><Input id="pe-c" name="company" /></Field>
                <Field label="Rol" htmlFor="pe-ro"><Input id="pe-ro" name="role" /></Field>
              </div>
              <Button type="submit" size="lg" className="w-full">Guardar</Button>
            </ActionForm>
          </SheetButton>
        }
      />
      {people.length === 0 ? (
        <EmptyState icon={<Users className="h-5 w-5" />} title="Aún no hay personas" body="Se crean solas cuando dices “hablé con Olga…” o “Carlos quedó de enviarme…”." />
      ) : (
        <Divided>
          {people.map((p) => (
            <RowLink
              key={p.id}
              href={`/people/${p.id}`}
              icon={<span className="text-[13px] font-semibold">{p.name.replace(/^(Dr|Dra|Sr|Sra)\.?\s+/i, "").slice(0, 1).toUpperCase()}</span>}
              title={p.name}
              subtitle={[p.relationship, p.company].filter(Boolean).join(" · ") || "Sin detalles"}
            />
          ))}
        </Divided>
      )}
    </div>
  );
}
