import type { Metadata } from "next";
import { QuickCapture } from "@/components/features/quick-capture";
import { PageHeader } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Capturar" };

export default function CapturePage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Capturar" subtitle="Escríbelo como lo dirías. LÍA lo estructura." />
      <QuickCapture autoFocus />
      <ul className="space-y-1.5 px-1 text-[13px] text-ink-3">
        <li>“mañana llamar a Pedro por el contrato de Diana”</li>
        <li>“Carlos quedó de mandarme el contrato el viernes”</li>
        <li>“dormí 5 horas” · “gasté 85 mil en gasolina”</li>
        <li>“tengo que decidir si acepto un nuevo cliente”</li>
      </ul>
    </div>
  );
}
