"use client";

import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type State = "unsupported" | "unconfigured" | "off" | "on" | "denied" | "loading";

/** Per-device opt-in for Web Push. On iOS it requires the app installed on the home screen. */
export function PushToggle({ publicKey }: { publicKey: string | null }) {
  const [state, setState] = useState<State>("loading");
  const toast = useToast();

  useEffect(() => {
    let cancelled = false;
    async function detect(): Promise<State> {
      if (!publicKey) return "unconfigured";
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
      if (Notification.permission === "denied") return "denied";
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      return sub ? "on" : "off";
    }
    void detect().then((s) => {
      if (!cancelled) setState(s);
    });
    return () => {
      cancelled = true;
    };
  }, [publicKey]);

  async function enable() {
    if (!publicKey) return;
    setState("loading");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
      const res = await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
      if (!res.ok) throw new Error("save");
      setState("on");
      toast.show({ message: "Notificaciones activadas en este dispositivo." });
    } catch {
      setState("off");
      toast.show({ message: "No pude activar las notificaciones. En iPhone, instala LÍA en la pantalla de inicio primero.", tone: "error" });
    }
  }

  async function disable() {
    setState("loading");
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => undefined);
      await sub.unsubscribe();
    }
    setState("off");
  }

  const text: Record<State, string> = {
    loading: "Comprobando…",
    unsupported: "Este navegador no soporta notificaciones push.",
    unconfigured: "Las notificaciones push aún no están configuradas en el servidor (claves VAPID).",
    denied: "Bloqueaste las notificaciones para LÍA en este navegador.",
    off: "Recibe el Morning Brief, vencimientos, seguimientos y revisiones en este dispositivo.",
    on: "Activadas en este dispositivo.",
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <BellRing className="h-4 w-4 shrink-0 text-ink-3" />
      <p className="flex-1 text-[13px] leading-snug text-ink-2">{text[state]}</p>
      {state === "off" ? <Button size="sm" onClick={() => void enable()}>Activar</Button> : null}
      {state === "on" ? <Button size="sm" variant="ghost" onClick={() => void disable()}>Desactivar</Button> : null}
    </div>
  );
}
