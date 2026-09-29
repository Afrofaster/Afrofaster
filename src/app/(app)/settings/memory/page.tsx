import type { Metadata } from "next";
import { Brain } from "lucide-react";
import { listMemories } from "@/application/memory";
import { MemoryRow } from "@/components/features/memory-row";
import { EmptyState, PageHeader } from "@/components/ui/primitives";
import { loadAsUser } from "@/server/action";

export const metadata: Metadata = { title: "Memoria" };

export default async function MemoryPage() {
  const items = await loadAsUser((ctx) => listMemories(ctx, { includeUnconfirmed: true }));
  return (
    <div className="space-y-5">
      <PageHeader title="Memoria de LÍA" subtitle="Nada se guarda como verdad permanente sin tu confirmación." />
      {items.length === 0 ? (
        <EmptyState icon={<Brain className="h-5 w-5" />} title="LÍA aún no recuerda preferencias" body='Escribe algo como “prefiero entrenar temprano” y aparecerá aquí para confirmar.' />
      ) : (
        <ul className="card divide-y divide-line overflow-hidden">{items.map((m) => <MemoryRow key={m.id} id={m.id} content={m.content} confirmed={m.confirmed} />)}</ul>
      )}
    </div>
  );
}
