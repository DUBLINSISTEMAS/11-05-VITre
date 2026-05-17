/**
 * Loading state da página de banners.
 * Skeleton aproxima slot de upload + lista de banners (formato 8:3).
 */
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Carregando banners"
      className="space-y-4"
    >
      <header className="space-y-2">
        <Skeleton className="h-8 w-32 sm:h-9 sm:w-40" />
        <Skeleton className="h-4 w-48" />
      </header>

      <Skeleton className="h-24 w-full rounded-xl" />

      <ul className="space-y-2.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <li
            key={i}
            className="border-line flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center"
          >
            <Skeleton className="aspect-[8/3] w-full rounded-lg sm:aspect-auto sm:h-20 sm:w-52 sm:shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <div className="flex gap-1">
              <Skeleton className="size-8 rounded-md" />
              <Skeleton className="size-8 rounded-md" />
              <Skeleton className="size-8 rounded-md" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
