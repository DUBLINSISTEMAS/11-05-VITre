/**
 * Loading skeleton — /contato. Onda 10 (2026-05-27).
 *
 * Form de 3 campos (nome, WhatsApp, mensagem) + CTA. Skeleton bate.
 */
import { Skeleton } from "@/components/storefront/skeletons";

export default function ContatoLoading() {
  return (
    <article className="mx-auto max-w-md space-y-6">
      <header className="space-y-2">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-4 w-full" />
      </header>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-11 w-full rounded-md" />
        </div>
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-11 w-full rounded-md" />
        </div>
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-32 w-full rounded-md" />
        </div>
        <Skeleton className="h-11 w-full rounded-md" />
      </div>
    </article>
  );
}
