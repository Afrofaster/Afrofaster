"use client";

import { createTaskAction } from "@/app/actions/tasks";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/fields";
import { ActionForm, SheetButton } from "./forms";

type Option = { id: string; label: string };

export function NewTaskButton({ projects = [], areas = [], defaultProjectId, defaultDate, defaultOpen }: { projects?: Option[]; areas?: Option[]; defaultProjectId?: string; defaultDate?: string; defaultOpen?: boolean }) {
  return (
    <SheetButton label="Tarea" title="Nueva tarea" variant="primary" defaultOpen={defaultOpen}>
      {(close) => (
        <ActionForm action={createTaskAction} onSuccess={close} className="space-y-4">
          <Field label="¿Qué hay que hacer?" htmlFor="t-title">
            <Input id="t-title" name="title" required autoFocus placeholder="Llamar a Olga" maxLength={300} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Hacer el" htmlFor="t-sched">
              <Input id="t-sched" name="scheduledDate" type="date" defaultValue={defaultDate} />
            </Field>
            <Field label="Vence" htmlFor="t-due">
              <Input id="t-due" name="dueDate" type="date" />
            </Field>
            <Field label="Prioridad" htmlFor="t-prio">
              <Select id="t-prio" name="priority" defaultValue="MEDIUM">
                <option value="LOW">Baja</option>
                <option value="MEDIUM">Media</option>
                <option value="HIGH">Alta</option>
                <option value="CRITICAL">Crítica</option>
              </Select>
            </Field>
            <Field label="Minutos" htmlFor="t-min">
              <Input id="t-min" name="estimatedMinutes" type="number" min={5} max={1440} step={5} placeholder="30" inputMode="numeric" />
            </Field>
          </div>
          {projects.length > 0 ? (
            <Field label="Proyecto" htmlFor="t-proj">
              <Select id="t-proj" name="projectId" defaultValue={defaultProjectId ?? ""}>
                <option value="">Sin proyecto</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </Select>
            </Field>
          ) : defaultProjectId ? <input type="hidden" name="projectId" value={defaultProjectId} /> : null}
          {areas.length > 0 && !defaultProjectId ? (
            <Field label="Área de vida" htmlFor="t-area">
              <Select id="t-area" name="lifeAreaId" defaultValue="">
                <option value="">—</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>{a.label}</option>
                ))}
              </Select>
            </Field>
          ) : null}
          <Field label="Energía necesaria" htmlFor="t-energy">
            <Select id="t-energy" name="energy" defaultValue="">
              <option value="">—</option>
              <option value="LOW">Baja</option>
              <option value="MEDIUM">Media</option>
              <option value="HIGH">Alta (deep work)</option>
            </Select>
          </Field>
          <Button type="submit" size="lg" className="w-full">Crear tarea</Button>
        </ActionForm>
      )}
    </SheetButton>
  );
}
