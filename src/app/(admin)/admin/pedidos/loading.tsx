/**
 * Loading state da lista de pedidos.
 * Skeleton aproxima filtros + tabela de pedidos.
 */
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Carregando vendas"
      className="space-y-4 sm:space-y-6"
    >
      <header className="space-y-2">
        <Skeleton className="h-8 w-32 sm:h-9 sm:w-40" />
        <Skeleton className="h-4 w-40" />
      </header>

      <Skeleton className="h-10 w-full rounded-md" />

      <ul className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <li
            key={i}
            className="border-line flex items-center gap-3 rounded-xl border p-3"
          >
            <Skeleton className="h-4 w-20 font-mono" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </li>
        ))}
      </ul>
    </div>
  );
}
