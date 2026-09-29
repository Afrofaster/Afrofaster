import { LiaOrb } from "@/components/layout/lia-orb";

export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <LiaOrb size={56} />
      <h1 className="display mt-6 text-3xl">Sin conexión</h1>
      <p className="mt-2 max-w-xs text-[15px] text-ink-2">Las páginas que abriste recientemente siguen disponibles. Lo que captures se guarda aquí y se sincroniza al volver.</p>
      <a href="/capture" className="mt-6 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-bg">Capturar algo</a>
    </main>
  );
}
