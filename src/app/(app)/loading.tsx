import { Skeleton } from "@/components/ui/primitives";

export default function Loading() {
  return (
    <div className="space-y-4" aria-busy aria-label="Cargando">
      <Skeleton className="h-9 w-2/3" />
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="mt-6 h-36 w-full rounded-[var(--radius-card)]" />
      <Skeleton className="h-44 w-full rounded-[var(--radius-card)]" />
      <Skeleton className="h-24 w-full rounded-[var(--radius-card)]" />
    </div>
  );
}
