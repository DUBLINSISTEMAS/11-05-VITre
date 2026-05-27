/**
 * Loading skeleton — /sucesso. Onda 10 (2026-05-27).
 *
 * Card resumo de pedido + 2 CTAs no rodapé.
 */
import { Skeleton } from "@/components/storefront/skeletons";

export default function SucessoLoading() {
  return (
    <div className="mx-auto max-w-xl space-y-6 px-4 pt-6 pb-32">
      <div className="space-y-3 text-center">
        <Skeleton className="mx-auto size-16 rounded-full" />
        <Skeleton className="mx-auto h-6 w-48" />
        <Skeleton className="mx-auto h-4 w-64" />
      </div>

      <div className="space-y-4 rounded-xl border border-border p-4">
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>

      <div className="space-y-2">
        <Skeleton className="h-11 w-full rounded-xl" />
        <Skeleton className="h-11 w-full rounded-xl" />
      </div>
    </div>
  );
}
