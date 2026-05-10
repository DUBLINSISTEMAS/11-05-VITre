/**
 * Loading state da página de configurações da loja.
 * Skeleton aproxima formulário único (imagens + campos texto + WhatsApp).
 */
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Carregando configurações"
      className="space-y-6"
    >
      <header className="space-y-2">
        <Skeleton className="h-8 w-44 sm:h-9 sm:w-52" />
        <Skeleton className="h-4 w-60" />
      </header>

      <div className="space-y-6">
        {/* Imagens (logo + ícone) */}
        <div className="border-border/60 space-y-4 rounded-xl border p-4">
          <Skeleton className="h-5 w-32" />
          <div className="flex gap-6">
            <Skeleton className="size-24 rounded-xl" />
            <Skeleton className="size-24 rounded-xl" />
          </div>
        </div>

        {/* Campos */}
        <div className="border-border/60 space-y-4 rounded-xl border p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>

        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  );
}
