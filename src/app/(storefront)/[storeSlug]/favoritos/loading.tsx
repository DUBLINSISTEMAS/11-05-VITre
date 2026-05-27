/**
 * Loading skeleton — /favoritos. Onda 10 (2026-05-27).
 *
 * Bate o layout de FavoritesView: header sticky-title + grid 2/3/4 cols.
 * Onda 7 trocou a página de "use client" puro pra Server Component +
 * client view, então loading.tsx faz sentido aqui.
 */
import {
  ProductGridSkeleton,
  Skeleton,
} from "@/components/storefront/skeletons";

export default function FavoritosLoading() {
  return (
    <>
      {/* Header sticky-title */}
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

      <div className="mx-auto w-full max-w-screen-xl px-4 pt-4 pb-24 lg:pt-6 lg:pb-12">
        <div className="space-y-5">
          <div className="flex justify-end">
            <Skeleton className="h-7 w-28 rounded-md" />
          </div>
          <ProductGridSkeleton count={6} />
        </div>
      </div>
    </>
  );
}
