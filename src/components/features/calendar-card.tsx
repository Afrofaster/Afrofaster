"use client";

import { useTransition } from "react";
import { CalendarDays, RefreshCw } from "lucide-react";
import { disconnectCalendarAction, syncCalendarAction } from "@/app/actions/calendar";
import { Button, buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

type Props = { configured: boolean; connected: boolean; status: string | null; email: string | null; lastSynced: string | null; notice: string | null };

const NOTICES: Record<string, string> = {
  connected: "Google Calendar conectado (solo lectura).",
  denied: "Cancelaste el permiso en Google.",
  invalid_state: "La conexión expiró o no era válida. Intenta de nuevo.",
  error: "No pude conectar Google Calendar. Intenta de nuevo.",
  not_configured: "Falta configurar GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET y TOKEN_ENCRYPTION_KEY en el servidor.",
};

export function CalendarCard({ configured, connected, status, email, lastSynced, notice }: Props) {
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent"><CalendarDays className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[14.5px] font-medium">Google Calendar</p>
          <p className="text-[12.5px] leading-snug text-ink-3">
            {connected
              ? `${email ?? "Cuenta conectada"} · solo lectura${lastSynced ? ` · sincronizado ${lastSynced}` : ""}${status === "ERROR" ? " · error en la última sincronización" : ""}`
              : configured
                ? "Conecta tu calendario para que LÍA planee con tu agenda real. LÍA solo lee; nunca crea ni mueve citas sin tu confirmación."
                : "La integración aún no está configurada en el servidor."}
          </p>
        </div>
      </div>
      {notice && NOTICES[notice] ? <p className="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-[13px] text-ink-2">{NOTICES[notice]}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {connected ? (
          <>
            <Button size="sm" variant="secondary" loading={pending} onClick={() => start(async () => { const r = await syncCalendarAction(); toast.show(r.ok ? { message: `Sincronizado: ${r.data.synced} eventos.` } : { message: r.error, tone: "error" }); })}>
              {!pending ? <RefreshCw className="h-3.5 w-3.5" /> : null} Sincronizar ahora
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => { const r = await disconnectCalendarAction(); toast.show(r.ok ? { message: r.message ?? "Desconectado." } : { message: r.error, tone: "error" }); })}>
              Desconectar
            </Button>
          </>
        ) : configured ? (
          <a href="/api/calendar/google/connect" className={buttonClass("primary", "sm")}>Conectar Google Calendar</a>
        ) : null}
      </div>
    </Card>
  );
}
