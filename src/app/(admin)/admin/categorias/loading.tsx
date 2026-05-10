/**
 * Loading state da lista de categorias.
 * Skeleton aproxima o tree de categorias (raiz + sub-itens).
 */
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Carregando categorias"
      className="space-y-4"
    >
      <header className="flex items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-8 w-36 sm:h-9 sm:w-44" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-10 w-10 sm:w-36" />
      </header>

      <ul className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <li
            key={i}
            className="border-border/60 flex items-center gap-3 rounded-xl border p-3"
          >
            <Skeleton className="size-12 shrink-0 rounded-full" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </li>
        ))}
      </ul>
    </div>
  );
}
