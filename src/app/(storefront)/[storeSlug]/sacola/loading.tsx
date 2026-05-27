/**
 * Loading skeleton — /sacola. Onda 10 (2026-05-27).
 *
 * Bate o layout da checkout-panel: header sticky-title + lista de itens
 * + totais + form curto + CTA sticky.
 */
import { Skeleton } from "@/components/storefront/skeletons";

export default function SacolaLoading() {
  return (
    <>
      <header className="bg-background sticky top-0 z-30 border-b border-border">
        <div className="mx-auto flex w-full max-w-screen-xl items-center gap-2.5 px-4 py-3">
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-3 w-12 shrink-0" />
        </div>
      </header>

      <div className="mx-auto w-full max-w-screen-xl space-y-5 px-4 pt-4 pb-32 lg:pb-12">
        {/* Itens */}
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex gap-3 rounded-xl border border-border p-3">
              <Skeleton className="size-20 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-7 w-24 rounded-full" />
              </div>
            </div>
          ))}
        </div>

        {/* Totais */}
        <div className="space-y-2 rounded-xl border border-border p-4">
          <div className="flex justify-between">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-14" />
          </div>
          <div className="flex justify-between">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>

        {/* Form */}
        <div className="space-y-3">
          <Skeleton className="h-11 w-full rounded-lg" />
          <Skeleton className="h-11 w-full rounded-lg" />
        </div>
      </div>
    </>
  );
}
