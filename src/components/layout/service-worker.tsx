"use client";

import { useEffect } from "react";
import { flushOfflineQueue } from "@/lib/offline-queue";

/** Registers the service worker and syncs captures made offline. */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => undefined);
    }
    const sync = () => void flushOfflineQueue();
    sync();
    window.addEventListener("online", sync);
    return () => window.removeEventListener("online", sync);
  }, []);
  return null;
}
