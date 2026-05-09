"use client";

/**
 * ProductCard — redesign premium com hierarquia visual forte.
 *
 * Features:
 * - Sombra sutil no hover
 * - Imagem com rounded-2xl, aspect ratio flexível
 * - Botão de favorito animado
 * - Categoria + nome com tipografia hierárquica
 * - Preço em destaque com cor de acento
 * - Textos em PT-BR via i18n
 */
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

import { FavoriteButton } from "@/components/storefront/favorite-button";
import {
  getEffectivePrice,
  hasActivePromo,
} from "@/lib/pricing";
import type { ProductCardData } from "@/lib/storefront/_shared";
import { formatBRL,t } from "@/lib/storefront/i18n";
import { cn } from "@/lib/utils";

export interface ProductCardProps {
  product: ProductCardData;
  storeSlug: string;
  priority?: boolean;
  className?: string;
  /** Nome da categoria para exibir acima do nome do produto */
  categoryName?: string;
  /** Variante de layout: default ou featured (maior) */
  variant?: "default" | "featured";
}

const CARD_IMAGE_SIZES =
  "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw";

export function ProductCard({
  product,
  storeSlug,
  priority = false,
  className,
  categoryName,
  variant = "default",
}: ProductCardProps) {
  const now = new Date();
  const isOnPromo = hasActivePromo(product, now);
  const effectivePrice = getEffectivePrice(product, now);
  const isOutOfStock =
    product.trackStock &&
    (product.stockQuantity === null || product.stockQuantity <= 0);

  const promoPercent =
    isOnPromo && product.promoPriceInCents
      ? Math.round(
          ((product.basePriceInCents - product.promoPriceInCents) /
            product.basePriceInCents) *
            100,
        )
      : null;

  const favoriteInput = {
    productId: product.id,
    productSlug: product.slug,
    productName: product.name,
    imageUrl: product.primaryImageUrl,
    priceCents: effectivePrice,
  };

  const isFeatured = variant === "featured";

  return (
    <motion.article
      className={cn(
        "group relative rounded-2xl bg-white transition-shadow",
        "hover:shadow-lg",
        className
      )}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      <Link
        href={`/${storeSlug}/produto/${product.slug}`}
        prefetch={false}
        className="flex flex-col gap-3 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-2xl p-2"
      >
        {/* Image container */}
        <div 
          className={cn(
            "relative w-full overflow-hidden rounded-xl bg-gray-100",
            isFeatured ? "aspect-square" : "aspect-[3/4]"
          )}
        >
          {product.primaryImageUrl ? (
            <Image
              src={product.primaryImageUrl}
              alt={product.primaryImageAlt ?? product.name}
              fill
              sizes={CARD_IMAGE_SIZES}
              priority={priority}
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-110"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground/60 text-xs">
              {t.product.noPhoto}
            </div>
          )}

          {/* Promo badge - convenção e-commerce (vermelho/rose) */}
          {promoPercent !== null && promoPercent > 0 && (
            <span className="absolute left-2 top-2 rounded-full bg-rose-600 px-2.5 py-1 text-xs font-bold text-white shadow-md">
              -{promoPercent}%
            </span>
          )}

          {/* Out of stock overlay */}
          {isOutOfStock && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-[2px]">
              <span className="rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-foreground shadow-sm">
                {t.product.outOfStock}
              </span>
            </div>
          )}
        </div>

        {/* Product info - hierarquia visual melhorada */}
        <div className="flex flex-col gap-1 px-1 pb-1">
          {categoryName && (
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {categoryName}
            </p>
          )}
          <h3 className={cn(
            "font-semibold text-foreground line-clamp-2 leading-tight",
            isFeatured ? "text-base" : "text-sm"
          )}>
            {product.name}
          </h3>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span
              className={cn(
                "font-bold tabular-nums",
                isFeatured ? "text-lg" : "text-base",
                isOnPromo ? "text-rose-600" : "text-foreground"
              )}
            >
              {formatBRL(effectivePrice)}
            </span>
            {isOnPromo && (
              <span className="text-xs font-medium tabular-nums text-muted-foreground line-through">
                {formatBRL(product.basePriceInCents)}
              </span>
            )}
          </div>
        </div>
      </Link>

      {/* Favorite button - positioned outside the Link */}
      <FavoriteButton
        product={favoriteInput}
        className="absolute right-3 top-3"
        size={isFeatured ? "md" : "sm"}
        showParticles={true}
      />
    </motion.article>
  );
}
