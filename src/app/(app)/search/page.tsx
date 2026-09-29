import type { Metadata } from "next";
import { Search } from "lucide-react";
import { globalSearch } from "@/application/search";
import { Input } from "@/components/ui/fields";
import { Badge, Divided, EmptyState, PageHeader, RowLink } from "@/components/ui/primitives";
import { loadAsUser } from "@/server/action";

export const metadata: Metadata = { title: "Buscar" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").slice(0, 100);
  const hits = q.trim().length >= 2 ? await loadAsUser((ctx) => globalSearch(ctx, q, 15)) : [];
  return (
    <div className="space-y-5">
      <PageHeader title="Buscar" />
      <form action="/search" role="search">
        <Input name="q" defaultValue={q} autoFocus placeholder="Tareas, proyectos, objetivos, personas, decisiones, notas…" aria-label="Buscar" />
      </form>
      {q.trim().length < 2 ? null : hits.length === 0 ? (
        <EmptyState icon={<Search className="h-5 w-5" />} title={`Nada para “${q}”`} body="Prueba con otra palabra." />
      ) : (
        <Divided>
          {hits.map((h) => <RowLink key={`${h.type}-${h.id}`} href={h.href} title={h.title} trailing={<Badge>{h.subtitle}</Badge>} />)}
        </Divided>
      )}
    </div>
  );
}
