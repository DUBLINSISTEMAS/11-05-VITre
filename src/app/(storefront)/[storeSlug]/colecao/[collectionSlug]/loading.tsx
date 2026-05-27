/**
 * Loading skeleton — /colecao/[slug]. Onda 10 (2026-05-27).
 *
 * Mesma estrutura de /categoria e /destaques (header próprio + grid).
 */
import {
  ProductGridSkeleton,
  Skeleton,
} from "@/components/storefront/skeletons";

export default function ColecaoLoading() {
  return (
    <>
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

      <div className="px-4 pb-44 pt-3 lg:pb-12">
        <ProductGridSkeleton count={8} />
      </div>
    </>
  );
}
