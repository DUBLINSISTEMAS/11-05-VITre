/**
 * PromoStrip — fiel ao canvas-referencia (canvas-v1).
 *
 * Card faixa que sinaliza promoções ativas na home. Deve ser renderizada
 * APENAS quando há pelo menos 1 produto em promoção (`hasActivePromo`).
 *
 * Estrutura (canvas):
 *   - Container: bg-gray-50 border border-border rounded-xl, p 12/14
 *   - Spark badge à esquerda: 32×32 rounded-lg, bg-warning-soft text-warning
 *   - Texto: linha 1 "Em promoção · N peças" semibold 12px;
 *            linha 2 "Termina em X dias" gray-500 10.5px
 *   - Seta direita gray-500
 *
 * Link aponta para `/${storeSlug}/destaques?promo=1` (rota existente,
 * com filtro promo via param).
 *
 * Server Component.
 */
import { ArrowRight, Sparkle } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

export interface PromoStripProps {
  storeSlug: string;
  /** Nº de produtos em promoção ativa. Strip não renderiza se zero. */
  count: number;
  /** Data mais próxima de fim de promoção (`promoEndsAt`). Pode ser null. */
  nearestEndsAt?: Date | null;
  className?: string;
}

function formatTimeRemaining(endsAt: Date | null | undefined): string | null {
  if (!endsAt) return null;
  const now = Date.now();
  const ms = endsAt.getTime() - now;
  if (ms <= 0) return null;
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days === 0) return "Termina hoje";
  if (days === 1) return "Termina amanhã";
  return `Termina em ${days} dias`;
}

export function PromoStrip({
  storeSlug,
  count,
  nearestEndsAt,
  className,
}: PromoStripProps) {
  if (count <= 0) return null;
  const subtitle = formatTimeRemaining(nearestEndsAt);

  return (
    <Link
      href={`/${storeSlug}/destaques?promo=1`}
      prefetch={false}
      aria-label={`Em promoção · ${count} ${count === 1 ? "peça" : "peças"}`}
      className={cn(
        "flex items-center gap-2.5 rounded-xl border border-border bg-gray-50 px-3.5 py-3 outline-none",
        "transition-colors hover:bg-gray-100/60 focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-warning-soft text-warning">
        <Sparkle className="size-4" strokeWidth={1.6} fill="currentColor" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-semibold text-foreground">
          Em promoção · {count} {count === 1 ? "peça" : "peças"}
        </div>
        {subtitle && (
          <div className="mt-px text-[10.5px] text-gray-500">{subtitle}</div>
        )}
      </div>
      <ArrowRight className="size-3.5 shrink-0 text-gray-500" strokeWidth={1.8} />
    </Link>
  );
}
