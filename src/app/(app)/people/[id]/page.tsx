import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ChevronLeft } from "lucide-react";
import { UserFacingError } from "@/application/context";
import { getPerson, listInteractions } from "@/application/people";
import { addInteractionAction, updatePersonAction } from "@/app/actions/life";
import { ActionForm } from "@/components/features/forms";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/fields";
import { Card, SectionTitle } from "@/components/ui/primitives";
import { formatRelative } from "@/domain/dates";
import { listAttachments } from "@/application/attachments";
import { AttachmentsPanel } from "@/components/features/attachments-panel";
import { loadAsUser } from "@/server/action";
import { tasks, waitingFor } from "@/server/db/schema";

export const metadata: Metadata = { title: "Persona" };

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadAsUser(async (ctx) => {
    try {
      const person = await getPerson(ctx, id);
      const [interactions, waits, relatedTasks] = await Promise.all([
        listInteractions(ctx, id),
        ctx.tx.select().from(waitingFor).where(and(eq(waitingFor.personId, id), eq(waitingFor.status, "OPEN"))),
        ctx.tx.select({ id: tasks.id, title: tasks.title, status: tasks.status }).from(tasks).where(eq(tasks.personId, id)),
      ]);
      return { person, interactions, waits, relatedTasks, files: await listAttachments(ctx, "person", id), today: ctx.today, tz: ctx.timezone };
    } catch (err) {
      if (err instanceof UserFacingError) return null;
      throw err;
    }
  });
  if (!data) notFound();
  const { person } = data;
  const fmt = new Intl.DateTimeFormat("es-CO", { timeZone: data.tz, day: "numeric", month: "short", year: "numeric" });
  return (
    <div className="space-y-6">
      <Link href="/people" className="-ml-1 inline-flex items-center gap-1 text-[13px] text-ink-3 hover:text-ink"><ChevronLeft className="h-4 w-4" /> Personas</Link>
      <header className="animate-fade-up">
        <h1 className="display text-[2rem]">{person.name}</h1>
        <p className="text-[14px] text-ink-2">{[person.relationship, person.role, person.company].filter(Boolean).join(" · ") || "Sin detalles"}</p>
        {person.birthday ? <p className="mt-1 text-[13px] text-ink-3">Cumpleaños: {fmt.format(new Date(`${person.birthday}T12:00:00Z`))}</p> : null}
      </header>
      {data.waits.length > 0 ? (
        <Card className="p-4">
          <p className="eyebrow mb-2">Te debe</p>
          {data.waits.map((w) => <p key={w.id} className="text-[14.5px]">{w.expectedItem}{w.expectedDate ? <span className="text-ink-3"> · {formatRelative(w.expectedDate, data.today).toLowerCase()}</span> : null}</p>)}
        </Card>
      ) : null}
      {data.relatedTasks.length > 0 ? (
        <Card className="p-4">
          <p className="eyebrow mb-2">Tareas relacionadas</p>
          {data.relatedTasks.map((t) => <p key={t.id} className={t.status === "DONE" ? "text-[14px] text-ink-3 line-through" : "text-[14px]"}>{t.title}</p>)}
        </Card>
      ) : null}
      <section>
        <SectionTitle title="Interacciones" />
        <ActionForm action={addInteractionAction.bind(null, person.id)} className="mb-3 flex gap-2">
          <Input name="summary" required placeholder="Hablamos sobre…" className="flex-1" />
          <Button type="submit" variant="secondary" className="h-12">Anotar</Button>
        </ActionForm>
        {data.interactions.length > 0 ? (
          <Card as="div" className="divide-y divide-line">
            {data.interactions.map((i) => <div key={i.id} className="px-4 py-3"><p className="text-[14.5px]">{i.summary}</p><p className="text-[12px] text-ink-3">{fmt.format(i.occurredAt)}</p></div>)}
          </Card>
        ) : <p className="px-1 text-sm text-ink-3">Sin interacciones registradas.</p>}
      </section>
      <section>
        <SectionTitle title="Documentos" />
        <AttachmentsPanel entityType="person" entityId={person.id} items={data.files} />
      </section>

      <section>
        <SectionTitle title="Detalles" />
        <ActionForm action={updatePersonAction.bind(null, person.id)} resetOnSuccess={false} className="card space-y-3 p-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Relación" htmlFor="pr"><Input id="pr" name="relationship" defaultValue={person.relationship ?? ""} /></Field>
            <Field label="Empresa" htmlFor="pc"><Input id="pc" name="company" defaultValue={person.company ?? ""} /></Field>
            <Field label="Rol" htmlFor="pro"><Input id="pro" name="role" defaultValue={person.role ?? ""} /></Field>
            <Field label="Cumpleaños" htmlFor="pb"><Input id="pb" name="birthday" type="date" defaultValue={person.birthday ?? ""} /></Field>
            <Field label="Próximo seguimiento" htmlFor="pf"><Input id="pf" name="nextFollowUp" type="date" defaultValue={person.nextFollowUp ?? ""} /></Field>
          </div>
          <Field label="Notas" htmlFor="pn"><Textarea id="pn" name="notes" defaultValue={person.notes ?? ""} /></Field>
          <Button type="submit" variant="secondary">Guardar</Button>
        </ActionForm>
      </section>
    </div>
  );
}
