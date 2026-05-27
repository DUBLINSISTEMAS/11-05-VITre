/**
 * ProductGrid — fiel ao canvas-referencia (canvas-v1).
 *
 * Header inline em uma linha:
 *   - Título display em `text-sm font-semibold tracking-[-0.3]`
 *   - Direita opcional: count mono OU link "Ver todos →" cor da loja
 *
 * Grid mobile-first canvas:
 *   - 2 colunas, column gap 14px, row gap 18px
 * Desktop scaling: 3 col tablet, 4 col desktop, 5 col xl.
 *
 * Tematização (Onda C — Themes v1):
 *   - `layout` (decisão de página): "overlay" ou "card" — passado pra
 *     cada ProductCard. Antes esse prop chamava-se `variant`; o rename
 *     libera o nome `variant` pro eixo de tema.
 *   - `variant` (decisão de tema): "standard" | "minimal" | "bold" —
 *     vem de `store.productCardStyle`, propagado pra cada ProductCard.
 *
 * Server-component-friendly (sem "use client").
 */
import Link from "next/link";

import { ProductCard } from "@/components/storefront/product-card";
import type { ProductCardData } from "@/lib/storefront/_shared";
import type { ProductCardVariant } from "@/lib/storefront/themes";
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
  /** Layout dos cards (decisão de página). Default "overlay". */
  layout?: "overlay" | "card";
  /** Variant dos cards (decisão de tema). Default "standard". */
  variant?: ProductCardVariant;
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
  layout = "overlay",
  variant = "standard",
  className,
}: ProductGridProps) {
  if (products.length === 0) return null;

  const showHeader = sectionTitle || seeAllHref || count !== undefined;

  return (
    <section className={cn("space-y-3 lg:space-y-5", className)}>
      {showHeader && (
        <header className="flex items-baseline justify-between gap-3">
          {sectionTitle && (
            // Onda 7 (2026-05-27): tipografia alinhada às outras seções
            // da home (Categorias/Vitrines) — 17/20px semibold. Antes
            // 14/18px deixava "Em destaque" parecendo subtítulo das
            // demais; agora todas as seções da home têm o mesmo peso
            // visual, criando ritmo consistente.
            <h2 className="text-[17px] font-semibold tracking-[-0.4px] text-foreground lg:text-[20px] lg:tracking-[-0.5px]">
              {sectionTitle}
            </h2>
          )}
          {seeAllHref ? (
            <Link
              href={seeAllHref}
              prefetch={false}
              className="shrink-0 text-[11px] font-medium text-brand-store outline-none focus-visible:underline lg:text-[13px]"
            >
              Ver todos →
            </Link>
          ) : count !== undefined ? (
            <span className="shrink-0 font-mono text-[9.5px] text-gray-500 lg:text-[11px]">
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
          "lg:grid-cols-4 lg:gap-x-6 lg:gap-y-8",
          // wide desktop: 5 cols (Onda 6 — aproveita tela full HD+).
          // Gaps maiores em xl pra cards respirarem (sensação premium).
          "xl:grid-cols-5 xl:gap-x-8 xl:gap-y-10",
        )}
      >
        {products.map((product, idx) => (
          <ProductCard
            key={product.id}
            product={product}
            storeSlug={storeSlug}
            priority={priorityFirst && idx < priorityCount}
            layout={layout}
            variant={variant}
          />
        ))}
      </div>
    </section>
  );
}
