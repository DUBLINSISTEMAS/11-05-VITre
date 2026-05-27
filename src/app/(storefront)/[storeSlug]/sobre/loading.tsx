/**
 * Loading skeleton — /sobre. Onda 10 (2026-05-27).
 *
 * Página tem h1 + descrição + seções de contato e endereço. Skeleton
 * compacto que segue mesmo ritmo visual.
 */
import { Skeleton } from "@/components/storefront/skeletons";

export default function SobreLoading() {
  return (
    <article className="mx-auto max-w-2xl space-y-8">
      <header className="space-y-3">
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </header>

      {Array.from({ length: 2 }).map((_, i) => (
        <section key={i} className="space-y-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-10 w-48 rounded-md" />
        </section>
      ))}
    </article>
  );
}
