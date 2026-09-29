"use client";

import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";

/** Clears cached private pages from this device before ending the session. */
export function LogoutButton() {
  return (
    <form
      action={logoutAction}
      onSubmit={() => {
        navigator.serviceWorker?.controller?.postMessage("CLEAR_PRIVATE");
      }}
    >
      <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm text-ink-3 hover:text-bad">
        <LogOut className="h-4 w-4" /> Cerrar sesión
      </button>
    </form>
  );
}
