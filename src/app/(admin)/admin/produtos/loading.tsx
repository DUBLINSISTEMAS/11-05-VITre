/**
 * Loading state da lista de produtos. Renderizado pelo Next 15 enquanto
 * o server component da página resolve as queries do Drizzle.
 *
 * 6 skeletons de card combinam com a grade `sm:grid-cols-2 lg:grid-cols-3`.
 * Lojista vê estrutura imediatamente em vez de tela branca, mesmo em 4G ruim.
 */
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Carregando produtos"
      className="space-y-4 sm:space-y-6"
    >
      <header className="flex items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-8 w-32 sm:h-9 sm:w-40" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-10 w-10 sm:w-32" />
      </header>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <li
            key={i}
            className="border-line flex items-center gap-3 rounded-xl border p-3"
          >
            <Skeleton className="size-16 shrink-0 rounded-lg sm:size-20" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-4 w-16 rounded-full" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
