import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Carregando produto"
      className="space-y-6"
    >
      <header className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Skeleton className="size-9 shrink-0" />
          <Skeleton className="h-7 w-48 sm:h-8 sm:w-64" />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Skeleton className="h-7 w-12" />
          <Skeleton className="size-9" />
        </div>
      </header>

      <div className="divide-border divide-y">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="grid gap-4 py-5 first:pt-0 last:pb-0 lg:grid-cols-[14rem_1fr] lg:gap-8 lg:py-6"
          >
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-40" />
            </div>
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
