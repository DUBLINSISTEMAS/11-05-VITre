"use client";

/**
 * ProductCard — fiel ao canvas-referencia (canvas-v1).
 *
 * Duas variants:
 *
 *   "overlay" (default) — sem borda, foto em aspect-3/4 com radius 10,
 *   abaixo: SKU mono → nome → preço. Densidade alta para grids
 *   editoriais. Tag PROMO/NOVO em badge mono branco com texto carvão.
 *
 *   "card" — bordered, foto em aspect-3/4 (sem padding), texto em
 *   container interno. Tag invertida (carvão com texto branco).
 *
 * Sizes do canvas (mantidos pixel a pixel):
 *   - SKU: 9px mono tracking 0.4 cor gray-400
 *   - Nome: 12px font-medium leading 1.25 tracking -0.2
 *   - Preço: 13px font-mono tabular-nums semibold
 *   - Was (línea cortada): 10.5px gray-400
 *
 * Tokens: bg-foreground/text-background, gray-100, gray-400.
 */
import Image from "next/image";
import Link from "next/link";

import { FavoriteButton } from "@/components/storefront/favorite-button";
import { getEffectivePrice, hasActivePromo } from "@/lib/pricing";
import type { ProductCardData } from "@/lib/storefront/_shared";
import { formatBRL, t } from "@/lib/storefront/i18n";
import { cn } from "@/lib/utils";

export interface ProductCardProps {
  product: ProductCardData;
  storeSlug: string;
  priority?: boolean;
  className?: string;
  /** Layout: "overlay" (sem borda) ou "card" (bordered). */
  variant?: "overlay" | "card";
}

const CARD_IMAGE_SIZES =
  "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw";

/** Deriva um identificador curto mono pra exibição (slot SKU do canvas). */
function deriveSku(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

export function ProductCard({
  product,
  storeSlug,
  priority = false,
  className,
  variant = "overlay",
}: ProductCardProps) {
  const now = new Date();
  const isOnPromo = hasActivePromo(product, now);
  const effectivePrice = getEffectivePrice(product, now);
  const isOutOfStock =
    product.trackStock &&
    (product.stockQuantity === null || product.stockQuantity <= 0);

  // Tag canvas: PROMO se em promoção; NOVO se isFeatured e não promo.
  const tag = isOnPromo
    ? "PROMO"
    : product.isFeatured && !isOnPromo
      ? "NOVO"
      : null;

  const sku = deriveSku(product.id);

  const favoriteInput = {
    productId: product.id,
    productSlug: product.slug,
    productName: product.name,
    imageUrl: product.primaryImageUrl,
    priceCents: effectivePrice,
  };

  if (variant === "card") {
    return (
      <article
        className={cn(
          "group relative flex flex-col overflow-hidden rounded-xl border border-border bg-background",
          className,
        )}
      >
        <Link
          href={`/${storeSlug}/produto/${product.slug}`}
          prefetch={false}
          aria-label={product.name}
          className="relative block outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ImageBox
            src={product.primaryImageUrl}
            alt={product.primaryImageAlt ?? product.name}
            priority={priority}
            isOutOfStock={!!isOutOfStock}
            radiusClass=""
          />
          {tag && (
            <span className="absolute top-2 left-2 rounded-[4px] bg-foreground px-1.5 py-[3px] font-mono text-[9px] font-semibold tracking-wide text-background">
              {tag}
            </span>
          )}
        </Link>

        <Link
          href={`/${storeSlug}/produto/${product.slug}`}
          prefetch={false}
          className="flex flex-col gap-1 p-2.5 outline-none"
        >
          <h3 className="line-clamp-2 text-[11.5px] font-medium leading-[1.25] text-foreground">
            {product.name}
          </h3>
          <PriceBlock
            effectivePrice={effectivePrice}
            basePrice={product.basePriceInCents}
            isOnPromo={isOnPromo}
            size="sm"
          />
        </Link>

        <FavoriteButton
          product={favoriteInput}
          className="absolute right-2 top-2"
          size="sm"
          showParticles
        />
      </article>
    );
  }

  // overlay (default canvas)
  return (
    <article className={cn("group relative flex flex-col gap-1.5", className)}>
      <Link
        href={`/${storeSlug}/produto/${product.slug}`}
        prefetch={false}
        aria-label={product.name}
        className="relative block outline-none focus-visible:rounded-[10px] focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ImageBox
          src={product.primaryImageUrl}
          alt={product.primaryImageAlt ?? product.name}
          priority={priority}
          isOutOfStock={!!isOutOfStock}
          radiusClass="rounded-[10px]"
        />
        {tag && (
          <span className="absolute top-2 left-2 rounded-[4px] bg-background px-1.5 py-[3px] font-mono text-[9px] font-semibold tracking-wide text-foreground">
            {tag}
          </span>
        )}
      </Link>

      <span className="font-mono text-[9px] tracking-[0.4px] text-gray-400">
        {sku}
      </span>
      <Link
        href={`/${storeSlug}/produto/${product.slug}`}
        prefetch={false}
        className="block outline-none"
      >
        <h3 className="line-clamp-2 text-[12px] font-medium leading-[1.25] tracking-[-0.2px] text-foreground">
          {product.name}
        </h3>
      </Link>
      <PriceBlock
        effectivePrice={effectivePrice}
        basePrice={product.basePriceInCents}
        isOnPromo={isOnPromo}
        size="md"
      />

      <FavoriteButton
        product={favoriteInput}
        className="absolute right-2 top-2"
        size="sm"
        showParticles
      />
    </article>
  );
}

function ImageBox({
  src,
  alt,
  priority,
  isOutOfStock,
  radiusClass,
}: {
  src: string | null;
  alt: string;
  priority: boolean;
  isOutOfStock: boolean;
  radiusClass: string;
}) {
  return (
    <div
      className={cn(
        "relative aspect-[3/4] w-full overflow-hidden bg-gray-100",
        radiusClass,
      )}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={CARD_IMAGE_SIZES}
          priority={priority}
          className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
        />
      ) : (
        <div className="flex h-full items-center justify-center text-xs text-muted-foreground/60">
          {t.product.noPhoto}
        </div>
      )}

      {isOutOfStock && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/85 backdrop-blur-[2px]">
          <span className="rounded-md border border-border bg-background px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-foreground shadow-xs">
            {t.product.outOfStock}
          </span>
        </div>
      )}
    </div>
  );
}

function PriceBlock({
  effectivePrice,
  basePrice,
  isOnPromo,
  size,
}: {
  effectivePrice: number;
  basePrice: number;
  isOnPromo: boolean;
  size: "sm" | "md";
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span
        className={cn(
          "font-mono font-semibold tabular-nums text-foreground",
          size === "md" ? "text-[13px]" : "text-[12.5px]",
        )}
      >
        {formatBRL(effectivePrice)}
      </span>
      {isOnPromo && (
        <span className="font-mono text-[10.5px] tabular-nums text-gray-400 line-through">
          {formatBRL(basePrice)}
        </span>
      )}
    </div>
  );
}
