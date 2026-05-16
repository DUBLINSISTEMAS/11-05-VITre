import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Carregando movimentações"
      className="space-y-4 sm:space-y-6"
    >
      <header className="space-y-2">
        <Skeleton className="h-8 w-32 sm:h-9 sm:w-40" />
        <Skeleton className="h-4 w-64" />
      </header>

      <div className="flex gap-2">
        <Skeleton className="h-10 flex-1 sm:max-w-sm" />
        <Skeleton className="h-10 w-44" />
      </div>

      <ul className="divide-border divide-y overflow-hidden rounded-xl border bg-card">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i} className="flex items-center gap-2.5 px-3 py-2.5">
            <Skeleton className="size-9 shrink-0 rounded-md" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-3 w-2/5" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
