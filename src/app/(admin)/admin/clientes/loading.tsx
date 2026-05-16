import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Carregando clientes"
      className="space-y-4 sm:space-y-6"
    >
      <header className="flex items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-8 w-32 sm:h-9 sm:w-40" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-10 w-10 sm:w-32" />
      </header>

      <Skeleton className="h-10 w-full sm:max-w-sm" />

      <ul className="divide-border divide-y overflow-hidden rounded-xl border bg-card">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i} className="flex items-center gap-2.5 px-3 py-2.5">
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
