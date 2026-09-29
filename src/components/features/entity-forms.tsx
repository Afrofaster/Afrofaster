"use client";

import { createGoalAction, createProjectAction } from "@/app/actions/life";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/fields";
import { ActionForm, SheetButton } from "./forms";

type Option = { id: string; label: string };

export function NewProjectButton({ areas, goals, defaultOpen }: { areas: Option[]; goals: Option[]; defaultOpen?: boolean }) {
  return (
    <SheetButton label="Proyecto" title="Nuevo proyecto" variant="primary" defaultOpen={defaultOpen}>
      {(close) => (
        <ActionForm action={createProjectAction} onSuccess={close} className="space-y-4">
          <p className="text-sm text-ink-2">Un proyecto es un resultado que requiere varias acciones.</p>
          <Field label="Nombre" htmlFor="p-title"><Input id="p-title" name="title" required autoFocus placeholder="Proyecto Carmen" /></Field>
          <Field label="Resultado deseado" htmlFor="p-out" hint="¿Cómo sabrás que terminó?"><Input id="p-out" name="desiredOutcome" placeholder="Demanda radicada" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Área" htmlFor="p-area">
              <Select id="p-area" name="lifeAreaId" defaultValue=""><option value="">—</option>{areas.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</Select>
            </Field>
            <Field label="Objetivo" htmlFor="p-goal">
              <Select id="p-goal" name="goalId" defaultValue=""><option value="">—</option>{goals.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}</Select>
            </Field>
            <Field label="Prioridad" htmlFor="p-prio">
              <Select id="p-prio" name="priority" defaultValue="MEDIUM"><option value="LOW">Baja</option><option value="MEDIUM">Media</option><option value="HIGH">Alta</option><option value="CRITICAL">Crítica</option></Select>
            </Field>
            <Field label="Fecha objetivo" htmlFor="p-date"><Input id="p-date" name="targetDate" type="date" /></Field>
          </div>
          <details className="rounded-2xl border border-line p-4">
            <summary className="cursor-pointer text-sm font-medium text-ink-2">Datos jurídicos (opcional)</summary>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Field label="Cliente" htmlFor="p-client"><Input id="p-client" name="client" /></Field>
              <Field label="Radicado" htmlFor="p-case"><Input id="p-case" name="caseReference" /></Field>
              <Field label="Juzgado / entidad" htmlFor="p-court"><Input id="p-court" name="courtOrEntity" /></Field>
              <Field label="Término" htmlFor="p-legal"><Input id="p-legal" name="legalDeadline" type="date" /></Field>
            </div>
          </details>
          <Button type="submit" size="lg" className="w-full">Crear proyecto</Button>
        </ActionForm>
      )}
    </SheetButton>
  );
}

export function NewGoalButton({ areas, defaultOpen }: { areas: Option[]; defaultOpen?: boolean }) {
  return (
    <SheetButton label="Objetivo" title="Nuevo objetivo" variant="primary" defaultOpen={defaultOpen}>
      {(close) => (
        <ActionForm action={createGoalAction} onSuccess={close} className="space-y-4">
          <Field label="Objetivo" htmlFor="g-title"><Input id="g-title" name="title" required autoFocus placeholder="Terminar la maestría" /></Field>
          <Field label="Resultado" htmlFor="g-out"><Textarea id="g-out" name="outcome" rows={2} placeholder="Tesis sustentada y aprobada" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Métrica" htmlFor="g-metric"><Input id="g-metric" name="metric" placeholder="Capítulos" /></Field>
            <Field label="Unidad" htmlFor="g-unit"><Input id="g-unit" name="unit" placeholder="capítulos" /></Field>
            <Field label="Punto de partida" htmlFor="g-base"><Input id="g-base" name="baseline" type="number" step="any" inputMode="decimal" /></Field>
            <Field label="Meta" htmlFor="g-target"><Input id="g-target" name="target" type="number" step="any" inputMode="decimal" /></Field>
            <Field label="Fecha límite" htmlFor="g-dead"><Input id="g-dead" name="deadline" type="date" /></Field>
            <Field label="Horizonte" htmlFor="g-hor">
              <Select id="g-hor" name="horizon" defaultValue="QUARTER"><option value="QUARTER">90 días</option><option value="YEAR">Este año</option><option value="LONG_TERM">Largo plazo</option></Select>
            </Field>
          </div>
          <Field label="Área de vida" htmlFor="g-area">
            <Select id="g-area" name="lifeAreaId" defaultValue=""><option value="">—</option>{areas.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</Select>
          </Field>
          <Button type="submit" size="lg" className="w-full">Crear objetivo</Button>
        </ActionForm>
      )}
    </SheetButton>
  );
}
