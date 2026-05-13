/**
 * Skeleton da página /admin/produtos/[id]. Aparece instantâneo enquanto
 * o server resolve produto + imagens + variantes + categorias.
 */
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Carregando produto"
      className="space-y-4 sm:space-y-6"
    >
      <div className="space-y-2">
        <Skeleton className="h-4 w-56" />
        <div className="flex items-end justify-between gap-3">
          <div className="space-y-1">
            <Skeleton className="h-7 w-64 sm:h-8 sm:w-80" />
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="size-9 rounded-md" />
          </div>
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-2xl" />
          ))}
        </div>
        <div className="space-y-4">
          <Skeleton className="h-56 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
