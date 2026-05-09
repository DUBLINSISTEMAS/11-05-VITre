"use client";

/**
 * Grid responsivo de ProductCards com header de seção.
 *
 * Features:
 * - 2 colunas mobile, 3 tablet, 4 desktop
 * - Header com título e link "Ver todos"
 * - Textos em PT-BR via i18n
 * - Hierarquia visual forte
 */
import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { ProductCard } from "@/components/storefront/product-card";
import type { ProductCardData } from "@/lib/storefront/_shared";
import { t } from "@/lib/storefront/i18n";

export interface ProductGridProps {
  storeSlug: string;
  products: ProductCardData[];
  /** Aplica `priority` no primeiro card (use no grid above-the-fold). */
  priorityFirst?: boolean;
  /** Quantos cards above-the-fold ganham `priority`. Default 1. */
  priorityCount?: number;
  /** Título da seção (ex: "Especial Para Você") */
  sectionTitle?: string;
  /** Link "Ver todos" */
  seeAllHref?: string;
  /** Nome da categoria para exibir nos cards */
  categoryName?: string;
  /** Mostra o primeiro card em destaque (maior) */
  showFeaturedFirst?: boolean;
}

export function ProductGrid({
  storeSlug,
  products,
  priorityFirst = false,
  priorityCount = 1,
  sectionTitle,
  seeAllHref,
  categoryName,
  showFeaturedFirst = false,
}: ProductGridProps) {
  if (products.length === 0) return null;

  return (
    <section className="space-y-4">
      {/* Section header - hierarquia visual melhorada */}
      {sectionTitle && (
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">
            {sectionTitle}
          </h2>
          {seeAllHref && (
            <Link
              href={seeAllHref}
              prefetch={false}
              className="flex items-center gap-1 text-sm font-semibold text-foreground hover:underline underline-offset-2 transition-colors"
            >
              {t.nav.seeAll}
              <ArrowRight className="size-4" />
            </Link>
          )}
        </div>
      )}

      {/* Product grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((product, idx) => (
          <ProductCard
            key={product.id}
            product={product}
            storeSlug={storeSlug}
            priority={priorityFirst && idx < priorityCount}
            categoryName={categoryName}
            variant={showFeaturedFirst && idx === 0 ? "featured" : "default"}
          />
        ))}
      </div>
    </section>
  );
}
