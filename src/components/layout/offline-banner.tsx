"use client";

import { useSyncExternalStore } from "react";
import { CloudOff } from "lucide-react";

function subscribe(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

export function OfflineBanner() {
  const offline = useSyncExternalStore(subscribe, () => !navigator.onLine, () => false);
  if (!offline) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-50 flex justify-center pt-[max(env(safe-area-inset-top),6px)]" role="status">
      <span className="glass flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-xs text-ink-2 shadow-sm">
        <CloudOff className="h-3.5 w-3.5" /> Sin conexión · tus capturas se guardan aquí
      </span>
    </div>
  );
}
