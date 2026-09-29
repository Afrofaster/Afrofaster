import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { Download, Trash2 } from "lucide-react";
import { getCalendarConnection } from "@/application/calendar";
import { listCommitments } from "@/application/events";
import { CalendarCard } from "@/components/features/calendar-card";
import { PushToggle } from "@/components/features/push-toggle";
import { isGoogleCalendarConfigured } from "@/integrations/calendar";
import { vapidPublicKey } from "@/integrations/push";
import { changePasswordAction, deleteAccountAction, saveProfileAction, signOutEverywhereAction } from "@/app/actions/settings";
import { createCommitmentAction } from "@/app/actions/life";
import { ActionForm } from "@/components/features/forms";
import { NotificationBudget, PrivacySwitch, ThemePicker } from "@/components/features/settings-controls";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/fields";
import { Card, Divided, PageHeader, RowLink, SectionTitle } from "@/components/ui/primitives";
import { WEEKDAY_NAMES } from "@/domain/dates";
import { loadAsUser } from "@/server/action";
import { userProfiles } from "@/server/db/schema";
import { isAIConfiguredPublic } from "./ai-status";

export const metadata: Metadata = { title: "Ajustes" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ calendar?: string }> }) {
  const sp = await searchParams;
  const data = await loadAsUser(async (ctx) => ({
    profile: (await ctx.tx.query.userProfiles.findFirst({ where: eq(userProfiles.userId, ctx.userId) }))!,
    commitments: await listCommitments(ctx),
    calendar: (await getCalendarConnection(ctx)) ?? null,
  }));
  const p = data.profile;
  const prefs = p.preferences;
  const restDays = prefs.restDays ?? [0];
  const ai = isAIConfiguredPublic();

  return (
    <div className="space-y-7">
      <PageHeader title="Ajustes" />

      <section>
        <SectionTitle title="Perfil y ritmo" />
        <ActionForm action={saveProfileAction} resetOnSuccess={false} className="card space-y-4 p-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="¿Cómo te llamo?" htmlFor="s-name"><Input id="s-name" name="displayName" defaultValue={p.displayName} required /></Field>
            <Field label="Zona horaria" htmlFor="s-tz"><Input id="s-tz" name="timezone" defaultValue={p.timezone} required /></Field>
            <Field label="Empiezo el día" htmlFor="s-start"><Input id="s-start" name="dayStart" type="time" defaultValue={prefs.dayStart ?? "06:00"} /></Field>
            <Field label="Termino el día" htmlFor="s-end"><Input id="s-end" name="dayEnd" type="time" defaultValue={prefs.dayEnd ?? "21:00"} /></Field>
            <Field label="Bloque de deep work (min)" htmlFor="s-dw"><Input id="s-dw" name="deepWorkMinutes" type="number" min={15} max={240} defaultValue={prefs.deepWorkMinutes ?? 90} /></Field>
            <Field label="Meta de sueño (h)" htmlFor="s-sl"><Input id="s-sl" name="sleepTargetHours" type="number" step="0.5" min={4} max={12} defaultValue={prefs.sleepTargetHours ?? 7} /></Field>
          </div>
          <fieldset>
            <legend className="mb-2 px-1 text-[13px] font-medium text-ink-2">Días de descanso</legend>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAY_NAMES.map((d, i) => (
                <label key={d} className="cursor-pointer">
                  <input type="checkbox" name="restDays" value={i} defaultChecked={restDays.includes(i)} className="peer sr-only" />
                  <span className="block rounded-full border border-line px-3 py-1.5 text-[12.5px] capitalize text-ink-2 peer-checked:border-ink peer-checked:bg-ink peer-checked:text-bg peer-focus-visible:ring-2 peer-focus-visible:ring-accent">{d.slice(0, 3)}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <Button type="submit">Guardar</Button>
        </ActionForm>
      </section>

      <section>
        <SectionTitle title="Tema" />
        <ThemePicker />
      </section>

      <section>
        <SectionTitle title="Compromisos recurrentes" />
        <Card as="div" className="divide-y divide-line">
          {data.commitments.map((c) => (
            <p key={c.id} className="px-4 py-3 text-[14px]">{c.title} <span className="text-ink-3">· {c.weekdays.map((w) => WEEKDAY_NAMES[w].slice(0, 3)).join(", ")} {c.startTime?.slice(0, 5)}–{c.endTime?.slice(0, 5)}</span></p>
          ))}
          <ActionForm action={createCommitmentAction} className="space-y-3 p-4">
            <Input name="title" required placeholder="Ej.: Oficina, clase, gimnasio" />
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAY_NAMES.map((d, i) => (
                <label key={d} className="cursor-pointer"><input type="checkbox" name="weekdays" value={i} className="peer sr-only" /><span className="block rounded-full border border-line px-2.5 py-1 text-[12px] capitalize text-ink-2 peer-checked:border-ink peer-checked:bg-ink peer-checked:text-bg">{d.slice(0, 3)}</span></label>
              ))}
            </div>
            <div className="flex gap-2">
              <Input name="startTime" type="time" required aria-label="Inicio" />
              <Input name="endTime" type="time" required aria-label="Fin" />
              <Button type="submit" variant="secondary" className="h-12">Añadir</Button>
            </div>
          </ActionForm>
        </Card>
        <p className="mt-2 px-1 text-[12.5px] text-ink-3">El motor de capacidad descuenta estos bloques de tu tiempo disponible.</p>
      </section>

      <section>
        <SectionTitle title="LÍA e inteligencia artificial" />
        <Divided>
          <PrivacySwitch field="aiEnabled" value={p.aiEnabled} label="Usar modelos de IA" description={ai ? "Con esto activo, LÍA usa OpenAI para entender y redactar. Sin él, funciona con reglas locales." : "No hay OPENAI_API_KEY configurada: LÍA funciona con su motor local de reglas."} />
          <RowLink href="/settings/memory" title="Memoria de LÍA" subtitle="Qué recuerda LÍA de ti. Confirma u olvida." />
        </Divided>
      </section>

      <section>
        <SectionTitle title="Notificaciones" />
        <Divided>
          <NotificationBudget value={p.notificationBudget} />
          <PushToggle publicKey={vapidPublicKey()} />
          <RowLink href="/notifications" title="Centro de notificaciones" subtitle="Brief, vencimientos, seguimientos, revisiones y riesgos." />
        </Divided>
      </section>

      <section>
        <SectionTitle title="Calendario" />
        <CalendarCard
          configured={isGoogleCalendarConfigured()}
          connected={Boolean(data.calendar)}
          status={data.calendar?.status ?? null}
          email={data.calendar?.accountEmail ?? null}
          lastSynced={data.calendar?.lastSyncedAt ? new Intl.DateTimeFormat("es-CO", { timeZone: p.timezone, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(data.calendar.lastSyncedAt) : null}
          notice={sp.calendar ?? null}
        />
        <p className="mt-2 px-1 text-[12.5px] text-ink-3">También puedes decirle a LÍA tus citas (“mañana audiencia a las 9”) y definir compromisos recurrentes.</p>
      </section>

      <section>
        <SectionTitle title="Privacidad y datos" />
        <Divided>
          <PrivacySwitch field="analyticsEnabled" value={p.analyticsEnabled} label="Métricas de uso del producto" description="Solo eventos anónimos (captura creada, tarea completada, revisión hecha). Nunca contenido." />
          <a href="/api/export" className="flex items-center gap-3 px-4 py-3.5 text-[14.5px] hover:bg-surface-2"><Download className="h-4 w-4 text-ink-3" /> Exportar todos mis datos (JSON)</a>
        </Divided>
      </section>

      <section>
        <SectionTitle title="Seguridad" />
        <ActionForm action={changePasswordAction} className="card space-y-3 p-4">
          <Field label="Contraseña actual" htmlFor="pw-c"><Input id="pw-c" name="current" type="password" autoComplete="current-password" required /></Field>
          <Field label="Nueva contraseña" htmlFor="pw-n" hint="Mínimo 10 caracteres."><Input id="pw-n" name="next" type="password" autoComplete="new-password" minLength={10} required /></Field>
          <Button type="submit" variant="secondary">Cambiar contraseña</Button>
        </ActionForm>
        <form action={signOutEverywhereAction} className="mt-3"><Button type="submit" variant="ghost" size="sm">Cerrar sesión en todos los dispositivos</Button></form>
      </section>

      <section>
        <SectionTitle title="Zona de peligro" />
        <ActionForm action={deleteAccountAction} className="card space-y-3 border-bad/30 p-4">
          <p className="text-[14px] text-ink-2">Eliminar la cuenta borra permanentemente todos tus datos. Exporta antes si quieres conservarlos.</p>
          <Input name="confirm" placeholder="Escribe ELIMINAR" aria-label="Confirmación" required />
          <Button type="submit" variant="danger"><Trash2 className="h-4 w-4" /> Eliminar mi cuenta</Button>
        </ActionForm>
      </section>
    </div>
  );
}
