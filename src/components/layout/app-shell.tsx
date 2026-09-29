"use client";

import { useState, type ReactNode } from "react";
import { QuickCapture } from "@/components/features/quick-capture";
import { Sheet } from "@/components/ui/sheet";
import { CommandPalette } from "./command-palette";
import { BottomNav, MobileTopActions, Sidebar } from "./nav";
import { OfflineBanner } from "./offline-banner";

export function AppShell({ children }: { children: ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  return (
    <div className="min-h-dvh">
      <Sidebar onOpenPalette={() => setPaletteOpen(true)} />
      <MobileTopActions onOpenPalette={() => setPaletteOpen(true)} onCapture={() => setCaptureOpen(true)} />
      <OfflineBanner />
      <main className="px-4 pt-[max(env(safe-area-inset-top),16px)] pb-32 lg:pb-16 lg:pl-64">
        <div className="mx-auto w-full max-w-2xl pt-12 lg:max-w-3xl lg:px-8 lg:pt-10">{children}</div>
      </main>
      <BottomNav />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} onCapture={() => setCaptureOpen(true)} />
      <Sheet open={captureOpen} onClose={() => setCaptureOpen(false)} title="Captura rápida">
        <p className="mb-3 text-sm text-ink-2">Escríbelo como lo dirías. LÍA lo estructura.</p>
        {captureOpen ? <QuickCapture autoFocus onDone={() => setCaptureOpen(false)} /> : null}
        <p className="mt-3 text-xs text-ink-3">Ej.: “mañana llamar a Pedro por el contrato de Diana” · “dormí 6 horas” · “gasté 40 mil en almuerzo”.</p>
      </Sheet>
    </div>
  );
}
