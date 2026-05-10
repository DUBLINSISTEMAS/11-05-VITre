/**
 * Loading state do detalhe de pedido.
 * Skeleton aproxima header + timeline + itens + cliente.
 */
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Carregando pedido"
      className="space-y-6"
    >
      <header className="space-y-2">
        <Skeleton className="h-8 w-48 sm:h-9 sm:w-56" />
        <Skeleton className="h-4 w-60" />
      </header>

      {/* Timeline */}
      <div className="border-border/60 rounded-xl border p-4">
        <Skeleton className="mb-4 h-5 w-32" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Itens */}
      <div className="border-border/60 space-y-3 rounded-xl border p-4">
        <Skeleton className="h-5 w-24" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-14 shrink-0 rounded-md" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>

      {/* Cliente */}
      <Skeleton className="h-32 w-full rounded-xl" />
    </div>
  );
}
