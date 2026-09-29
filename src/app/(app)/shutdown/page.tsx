import type { Metadata } from "next";
import { buildShutdown } from "@/application/reviews";
import { ShutdownFlow } from "@/components/features/shutdown-flow";
import { PageHeader } from "@/components/ui/primitives";
import { loadAsUser } from "@/server/action";

export const metadata: Metadata = { title: "Cierre del día" };

export default async function ShutdownPage() {
  const data = await loadAsUser(buildShutdown);
  return (
    <div>
      <PageHeader eyebrow="Daily shutdown" title="Cerremos el día" subtitle="Cinco minutos para soltar la cabeza." />
      <ShutdownFlow done={data.done} pending={data.pending.map((p) => ({ id: p.id, title: p.title, suggestion: p.suggestion, score: p.score }))} />
    </div>
  );
}
