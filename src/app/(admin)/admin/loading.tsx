/**
 * Loading state do dashboard admin (/admin home).
 * Skeleton de 6 quick-action cards + welcome card no topo.
 */
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Carregando painel"
      className="space-y-6"
    >
      <Skeleton className="h-32 w-full rounded-2xl" />

      <div>
        <Skeleton className="mb-3 h-5 w-24" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
