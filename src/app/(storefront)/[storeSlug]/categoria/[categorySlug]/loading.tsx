/**
 * Loading skeleton — categoria. Onda 10 (2026-05-27).
 *
 * StoreHeader category (kicker + título + contador) + chips de filtro +
 * grid de produtos. Bate o layout de page.tsx pra evitar CLS quando o
 * conteúdo real chega.
 */
import {
  ProductGridSkeleton,
  Skeleton,
} from "@/components/storefront/skeletons";

export default function CategoryLoading() {
  return (
    <>
      {/* Header sticky bate StoreHeader variant=category */}
      <header className="bg-background sticky top-0 z-30 border-b border-border">
        <div className="mx-auto flex w-full max-w-screen-xl items-center gap-2.5 px-4 pt-3 pb-2.5">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1">
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="h-5 w-40" />
          </div>
          <Skeleton className="h-3 w-14 shrink-0" />
        </div>
      </header>

      {/* Chips de filtro */}
      <div className="flex gap-2 overflow-hidden px-4 py-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 shrink-0 rounded-full" />
        ))}
      </div>

      {/* Grid de produtos — same pb-44 da categoria real pra mini-cart */}
      <div className="px-4 pb-44 pt-1 lg:pb-12">
        <ProductGridSkeleton count={8} />
      </div>
    </>
  );
}
