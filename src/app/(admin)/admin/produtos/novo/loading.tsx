/**
 * Loading state de "Novo produto" (cria draft + redireciona pra /editar).
 * Tela rápida — apenas spinner-like skeleton.
 */
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Preparando rascunho"
      className="space-y-4"
    >
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-64" />
      <div className="border-border/60 rounded-xl border p-4">
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  );
}
