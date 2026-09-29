import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { UserFacingError } from "@/application/context";
import { getDecision } from "@/application/decisions";
import { addDecisionOptionAction, decideAction, updateDecisionAction } from "@/app/actions/life";
import { AnalyzeDecisionButton } from "@/components/features/analyze-button";
import { ActionForm } from "@/components/features/forms";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/fields";
import { Badge, Card, SectionTitle } from "@/components/ui/primitives";
import { formatLong } from "@/domain/dates";
import { DECISION_STATUS_LABEL } from "@/domain/enums";
import { listAttachments } from "@/application/attachments";
import { AttachmentsPanel } from "@/components/features/attachments-panel";
import { loadAsUser } from "@/server/action";

export const metadata: Metadata = { title: "Decisión" };

export default async function DecisionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadAsUser(async (ctx) => {
    try {
      return { d: await getDecision(ctx, id), files: await listAttachments(ctx, "decision", id), today: ctx.today };
    } catch (err) {
      if (err instanceof UserFacingError) return null;
      throw err;
    }
  });
  if (!data) notFound();
  const { d } = data;
  const a = d.analysis;
  const lists: Array<[string, string[] | undefined]> = a ? [["Alternativas", a.alternatives], ["Beneficios", a.benefits], ["Costos", a.costs], ["Riesgos", a.risks], ["Información faltante", a.missingInformation], ["Preguntas clave", a.questions]] : [];

  return (
    <div className="space-y-6">
      <Link href="/decisions" className="-ml-1 inline-flex items-center gap-1 text-[13px] text-ink-3 hover:text-ink"><ChevronLeft className="h-4 w-4" /> Decisiones</Link>
      <header className="animate-fade-up">
        <Badge tone={d.status === "OPEN" ? "warn" : "accent"}>{DECISION_STATUS_LABEL[d.status]}</Badge>
        <h1 className="display mt-2 text-[1.9rem] leading-tight">{d.question}</h1>
        {d.deadline ? <p className="mt-1 text-[13px] text-ink-3">Decidir antes del {formatLong(d.deadline).toLowerCase()}</p> : null}
      </header>

      <section>
        <SectionTitle title="Opciones" />
        <Card as="div" className="divide-y divide-line">
          {d.options.map((o) => (
            <div key={o.id} className="px-4 py-3">
              <p className="text-[15px]">{o.isChosen ? "✓ " : ""}{o.label}</p>
              {o.pros || o.cons ? <p className="mt-1 text-[12.5px] text-ink-3">{o.pros ? `+ ${o.pros}` : ""} {o.cons ? `− ${o.cons}` : ""}</p> : null}
            </div>
          ))}
          <ActionForm action={addDecisionOptionAction.bind(null, d.id)} className="flex gap-2 p-3">
            <Input name="label" required placeholder="Añadir opción…" className="h-10 flex-1" />
            <Button type="submit" size="sm" variant="secondary" className="h-10">Añadir</Button>
          </ActionForm>
        </Card>
      </section>

      <section>
        <SectionTitle title="Análisis" action={<AnalyzeDecisionButton id={d.id} hasAnalysis={Boolean(a)} />} />
        {a ? (
          <Card className="space-y-4 p-4">
            {lists.filter(([, v]) => v && v.length).map(([title, items]) => (
              <div key={title}>
                <p className="eyebrow mb-1.5">{title}</p>
                <ul className="list-disc space-y-1 pl-5 text-[14px] text-ink-2">{items!.map((x, i) => <li key={i}>{x}</li>)}</ul>
              </div>
            ))}
            {a.reversibility ? <div><p className="eyebrow mb-1">Reversibilidad</p><p className="text-[14px] text-ink-2">{a.reversibility}</p></div> : null}
            {a.opportunityCost ? <div><p className="eyebrow mb-1">Costo de oportunidad</p><p className="text-[14px] text-ink-2">{a.opportunityCost}</p></div> : null}
            <p className="border-t border-line pt-3 text-[12.5px] text-ink-3">LÍA estructura; la decisión es tuya.</p>
          </Card>
        ) : (
          <Card className="p-4 text-sm text-ink-2">LÍA puede analizar alternativas, costos, riesgos, reversibilidad y lo que falta saber, considerando tu capacidad actual.</Card>
        )}
      </section>

      <section>
        <SectionTitle title="Documentos" />
        <AttachmentsPanel entityType="decision" entityId={d.id} items={data.files} />
      </section>

      <section>
        <SectionTitle title="Contexto y supuestos" />
        <ActionForm action={updateDecisionAction.bind(null, d.id)} resetOnSuccess={false} className="card space-y-3 p-4">
          <Field label="Contexto" htmlFor="dc"><Textarea id="dc" name="context" defaultValue={d.context ?? ""} rows={3} /></Field>
          <Field label="Supuestos" htmlFor="da"><Textarea id="da" name="assumptions" defaultValue={d.assumptions ?? ""} rows={2} /></Field>
          <Field label="Riesgos" htmlFor="dr"><Textarea id="dr" name="risks" defaultValue={d.risks ?? ""} rows={2} /></Field>
          {d.status !== "OPEN" ? (
            <>
              <Field label="Resultado posterior (¿cómo salió?)" htmlFor="do"><Textarea id="do" name="outcome" defaultValue={d.outcome ?? ""} rows={2} /></Field>
              <Field label="Calificación del resultado (1–5)" htmlFor="dor"><Input id="dor" name="outcomeRating" type="number" min={1} max={5} defaultValue={d.outcomeRating ?? ""} /></Field>
            </>
          ) : null}
          <Button type="submit" variant="secondary">Guardar</Button>
        </ActionForm>
      </section>

      {d.status === "OPEN" ? (
        <section>
          <SectionTitle title="Decidir" />
          <ActionForm action={decideAction.bind(null, d.id)} className="card space-y-3 p-4">
            {d.options.length ? (
              <Field label="Opción elegida" htmlFor="dopt">
                <Select id="dopt" name="optionId" defaultValue=""><option value="">—</option>{d.options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</Select>
              </Field>
            ) : null}
            <Field label="Decisión" htmlFor="ddec"><Input id="ddec" name="decision" required placeholder="Acepto con alcance reducido" /></Field>
            <Field label="Por qué" htmlFor="drat"><Textarea id="drat" name="rationale" rows={2} /></Field>
            <Field label="Revisar el resultado el" htmlFor="drev"><Input id="drev" name="reviewDate" type="date" /></Field>
            <Button type="submit" className="w-full">Registrar decisión</Button>
          </ActionForm>
        </section>
      ) : (
        <Card className="p-4">
          <p className="eyebrow mb-1">Decidiste</p>
          <p className="text-[15px]">{d.decision}</p>
          {d.rationale ? <p className="mt-1 text-sm text-ink-2">{d.rationale}</p> : null}
          {d.reviewDate ? <p className="mt-2 text-[12.5px] text-ink-3">Revisión: {formatLong(d.reviewDate)}</p> : null}
        </Card>
      )}
    </div>
  );
}
