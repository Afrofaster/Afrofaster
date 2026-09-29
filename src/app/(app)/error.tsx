"use client";

import { useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(JSON.stringify({ event: "ui.error", digest: error.digest, name: error.name }));
  }, [error]);
  return (
    <div className="card mx-auto mt-10 max-w-md p-8 text-center">
      <p className="display text-2xl">No pude cargar esta vista</p>
      <p className="mt-2 text-sm text-ink-2">Tu información sigue intacta. Puede ser un problema de conexión o del servidor.</p>
      <Button className="mt-6" onClick={reset}>
        <RotateCcw className="h-4 w-4" /> Reintentar
      </Button>
    </div>
  );
}
