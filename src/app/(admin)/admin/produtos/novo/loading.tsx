/**
 * Skeleton da página /admin/produtos/novo. Aparece instantâneo enquanto
 * o server resolve session/store/categorias.
 */
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Carregando novo produto"
      className="space-y-4 sm:space-y-6"
    >
      <div className="space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-7 w-56 sm:h-8 sm:w-64" />
        <Skeleton className="h-4 w-72" />
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
