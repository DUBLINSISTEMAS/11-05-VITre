/**
 * ProductGrid — fiel ao canvas-referencia (canvas-v1).
 *
 * Header inline em uma linha:
 *   - Título display em `text-sm font-semibold tracking-[-0.3]`
 *   - Direita opcional: count mono OU link "Ver todos →" cor da loja
 *
 * Grid mobile-first canvas:
 *   - 2 colunas
 *   - Column gap 14px, row gap 18px
 *
 * Desktop scaling (não está no canvas, mas mantém consistência):
 *   - 3 col tablet (sm) com gap maior, 4 col desktop (lg)
 *
 * Server-component-friendly (sem "use client").
 */
import Link from "next/link";

import { ProductCard } from "@/components/storefront/product-card";
import type { ProductCardData } from "@/lib/storefront/_shared";
import { cn } from "@/lib/utils";

export interface ProductGridProps {
  storeSlug: string;
  products: ProductCardData[];
  /** Título display do header. */
  sectionTitle?: string;
  /** Link "Ver todos →" na cor da loja. */
  seeAllHref?: string;
  /** Count mono à direita (alternativa a seeAllHref). Ex: "06". */
  count?: string | number;
  /** Aplica `priority` nos primeiros N cards (above-the-fold). */
  priorityFirst?: boolean;
  priorityCount?: number;
  /** Layout dos cards. */
  variant?: "overlay" | "card";
  className?: string;
}

export function ProductGrid({
  storeSlug,
  products,
  sectionTitle,
  seeAllHref,
  count,
  priorityFirst = false,
  priorityCount = 1,
  variant = "overlay",
  className,
}: ProductGridProps) {
  if (products.length === 0) return null;

  const showHeader = sectionTitle || seeAllHref || count !== undefined;

  return (
    <section className={cn("space-y-3", className)}>
      {showHeader && (
        <header className="flex items-baseline justify-between gap-3">
          {sectionTitle && (
            <h2 className="text-sm font-semibold tracking-[-0.3px] text-foreground">
              {sectionTitle}
            </h2>
          )}
          {seeAllHref ? (
            <Link
              href={seeAllHref}
              prefetch={false}
              className="shrink-0 text-[11px] font-medium text-brand-store outline-none focus-visible:underline"
            >
              Ver todos →
            </Link>
          ) : count !== undefined ? (
            <span className="shrink-0 font-mono text-[9.5px] text-gray-500">
              {count}
            </span>
          ) : null}
        </header>
      )}

      <div
        className={cn(
          // canvas mobile: 2 cols, gap-x 14, gap-y 18
          "grid grid-cols-2 gap-x-[14px] gap-y-[18px]",
          // desktop scaling
          "sm:grid-cols-3 sm:gap-x-4 sm:gap-y-5",
          "lg:grid-cols-4 lg:gap-x-5 lg:gap-y-6",
        )}
      >
        {products.map((product, idx) => (
          <ProductCard
            key={product.id}
            product={product}
            storeSlug={storeSlug}
            priority={priorityFirst && idx < priorityCount}
            variant={variant}
          />
        ))}
      </div>
    </section>
  );
}
