"use client";

/**
 * ProductCard — fiel ao canvas-referencia (canvas-v1).
 *
 * Dois eixos ortogonais:
 *
 *   `layout` (decisão de página — onde o card aparece)
 *     - "overlay" (default) — sem borda, foto em aspect-3/4 com radius 10,
 *       texto abaixo, densidade alta para grids editoriais.
 *     - "card" — bordered, foto em aspect-3/4, texto em container
 *       interno padded.
 *
 *   `variant` (decisão de tema — densidade visual escolhida pelo lojista)
 *     - "standard" (default) — canvas-v1 atual.
 *     - "minimal"  — fontes menores, SEM tag de badge. Pegada
 *                    premium discreta. Casa com preset Boutique.
 *     - "bold"     — fontes maiores, nome em semibold, ring extra no
 *                    card, tag sempre invertida (foreground/background).
 *                    Pegada vibrante. Casa com preset Bazar.
 *
 * Sizes do canvas (mantidos pixel a pixel em "standard"):
 *   - Nome: 12px font-medium leading 1.25 tracking -0.2
 *   - Preço: 13px font-mono tabular-nums semibold
 *   - Was (línea cortada): 10.5px gray-400
 *
 * Tokens: bg-foreground/text-background, gray-100, gray-400.
 */
import Image from "next/image";
import Link from "next/link";

import { FavoriteButton } from "@/components/storefront/favorite-button";
import { formatBRL, getEffectivePrice, hasActivePromo } from "@/lib/pricing";
import type { ProductCardData } from "@/lib/storefront/_shared";
import { t } from "@/lib/storefront/i18n";
import type { ProductCardVariant } from "@/lib/storefront/themes";
import { cn } from "@/lib/utils";

export interface ProductCardProps {
  product: ProductCardData;
  storeSlug: string;
  priority?: boolean;
  className?: string;
  /** Layout (decisão de página): "overlay" (sem borda) ou "card" (bordered). */
  layout?: "overlay" | "card";
  /** Variant (decisão de tema): "standard" | "minimal" | "bold". */
  variant?: ProductCardVariant;
}

const CARD_IMAGE_SIZES =
  "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw";

interface VariantTokens {
  showTag: boolean;
  tagInverted: boolean;
  nameClass: string;
  nameClassCard: string;
  priceSize: "sm" | "md";
  cardRingClass: string;
  overlayRingClass: string;
}

const VARIANT_TOKENS: Record<ProductCardVariant, VariantTokens> = {
  standard: {
    showTag: true,
    tagInverted: false,
    nameClass:
      "text-[12px] font-medium leading-[1.25] tracking-[-0.2px] text-foreground",
    nameClassCard: "text-[11.5px] font-medium leading-[1.25] text-foreground",
    priceSize: "md",
    cardRingClass: "border border-border",
    overlayRingClass: "",
  },
  minimal: {
    showTag: false,
    tagInverted: false,
    nameClass: "text-[11px] font-medium leading-[1.3] text-foreground",
    nameClassCard: "text-[11px] font-medium leading-[1.25] text-foreground",
    priceSize: "sm",
    cardRingClass: "border border-border/50",
    overlayRingClass: "",
  },
  bold: {
    showTag: true,
    tagInverted: true,
    nameClass:
      "text-[13px] font-semibold leading-[1.2] tracking-[-0.2px] text-foreground",
    nameClassCard:
      "text-[12.5px] font-semibold leading-[1.2] text-foreground",
    priceSize: "md",
    cardRingClass: "border-2 border-foreground/15",
    overlayRingClass: "ring-1 ring-foreground/10",
  },
};

export function ProductCard({
  product,
  storeSlug,
  priority = false,
  className,
  layout = "overlay",
  variant = "standard",
}: ProductCardProps) {
  const now = new Date();
  const isOnPromo = hasActivePromo(product, now);
  const effectivePrice = getEffectivePrice(product, now);
  const isOutOfStock =
    product.trackStock &&
    (product.stockQuantity === null || product.stockQuantity <= 0);

  const tokens = VARIANT_TOKENS[variant];

  // Tag canvas: PROMO se em promoção; NOVO se isFeatured e não promo.
  const rawTag = isOnPromo
    ? "PROMO"
    : product.isFeatured && !isOnPromo
      ? "NOVO"
      : null;
  const tag = tokens.showTag ? rawTag : null;

  const favoriteInput = {
    productId: product.id,
    productSlug: product.slug,
    productName: product.name,
    imageUrl: product.primaryImageUrl,
    priceCents: effectivePrice,
  };

  if (layout === "card") {
    return (
      <article
        className={cn(
          "group relative flex flex-col overflow-hidden rounded-xl bg-background transition-transform duration-150 active:scale-[0.98] lg:active:scale-100",
          tokens.cardRingClass,
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
            <TagBadge
              label={tag}
              inverted={tokens.tagInverted}
              defaultInverted // card layout: tag default já é invertida (bg-foreground)
            />
          )}
        </Link>

        <Link
          href={`/${storeSlug}/produto/${product.slug}`}
          prefetch={false}
          className="flex flex-col gap-1 p-2.5 outline-none"
        >
          <h3 className={cn("line-clamp-2", tokens.nameClassCard)}>
            {product.name}
          </h3>
          <PriceBlock
            effectivePrice={effectivePrice}
            basePrice={product.basePriceInCents}
            isOnPromo={isOnPromo}
            size={tokens.priceSize}
          />
        </Link>

        <FavoriteButton
          product={favoriteInput}
          className="absolute right-2 top-2"
          size="sm"
        />
      </article>
    );
  }

  // overlay (default canvas)
  // Onda 5 (2026-05-27): adiciona feedback de tap mobile (active:scale-[0.98])
  // + transição suave. Hover desktop continua via group-hover scale-105 na
  // ImageBox (movido pra lg: pra não disparar em touch puro — mobile hybrid
  // como iPad com Magic Keyboard dispara hover sem precisão de mouse).
  return (
    <article
      className={cn(
        "group relative flex flex-col gap-1.5 transition-transform duration-150 active:scale-[0.98] lg:active:scale-100",
        tokens.overlayRingClass &&
          cn("rounded-[10px] p-1", tokens.overlayRingClass),
        className,
      )}
    >
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
          <TagBadge
            label={tag}
            inverted={tokens.tagInverted}
            defaultInverted={false} // overlay layout: tag default é branca com texto carvão
          />
        )}
      </Link>

      <Link
        href={`/${storeSlug}/produto/${product.slug}`}
        prefetch={false}
        className="block outline-none"
      >
        <h3 className={cn("line-clamp-2", tokens.nameClass)}>{product.name}</h3>
      </Link>
      <PriceBlock
        effectivePrice={effectivePrice}
        basePrice={product.basePriceInCents}
        isOnPromo={isOnPromo}
        size={tokens.priceSize}
      />

      <FavoriteButton
        product={favoriteInput}
        className="absolute right-2 top-2"
        size="sm"
      />
    </article>
  );
}

function TagBadge({
  label,
  inverted,
  defaultInverted,
}: {
  label: string;
  inverted: boolean;
  defaultInverted: boolean;
}) {
  // Onda 4 (2026-05-27): tag sobe de 9px (ilegível em mobile) pra 10.5px
  // com peso semibold. Em variant não-invertida (overlay light) adiciona
  // backdrop-blur sutil + bg semi-opaco pra preservar legibilidade sobre
  // qualquer foto (antes bg-background sólido podia ficar invisível em
  // fotos brancas como joalheria com fundo claro). Mantém font-mono +
  // tracking pra continuar com cara de "label técnico" sem competir com
  // o nome do produto.
  const isInverted = inverted || defaultInverted;
  return (
    <span
      className={cn(
        "absolute left-2 top-2 rounded-[4px] px-1.5 py-[3px] font-mono text-[10.5px] font-semibold tracking-wide",
        isInverted
          ? "bg-foreground text-background"
          : "bg-background/95 text-foreground backdrop-blur-sm shadow-[0_1px_2px_rgba(0,0,0,0.08)]",
      )}
    >
      {label}
    </span>
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
          quality={85}
          // object-cover mantido aqui (não contain como na galeria PDP):
          // cards pequenos em grid precisam preencher o aspect-3/4 pra
          // grid ficar uniforme. Lojista é orientado a subir fotos com
          // enquadramento adequado pra card. PDP usa contain pra
          // preservar enquadramento original (decisão diferente por
          // contexto).
          // Onda 5 (2026-05-27): hover scale apenas em lg: — touch puro
          // (mobile/tablet sem mouse) não dispara hover; o feedback de
          // tap fica por conta do active:scale-[0.98] no <article> pai.
          className="object-cover transition-transform duration-500 ease-out lg:group-hover:scale-105"
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
  // Onda 3 (2026-05-27): preço sai do font-mono (cara de planilha) pra
  // sans-serif com tabular-nums. Padrão Zara/Aritzia/COS.
  return (
    <div className="flex items-baseline gap-1.5">
      <span
        className={cn(
          "font-semibold tabular-nums text-foreground",
          size === "md" ? "text-[13px]" : "text-[12.5px]",
        )}
      >
        {formatBRL(effectivePrice)}
      </span>
      {isOnPromo && (
        <span className="text-[10.5px] tabular-nums text-gray-400 line-through">
          {formatBRL(basePrice)}
        </span>
      )}
    </div>
  );
}
