"use client";

/**
 * Página de favoritos do storefront.
 *
 * Exibe os produtos favoritados pelo usuário (armazenados em localStorage).
 * Estado vazio com ilustração e CTA para explorar produtos.
 */
import { Heart, ShoppingBag } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";

import { FavoriteButton } from "@/components/storefront/favorite-button";
import { ProductCardSkeleton } from "@/components/storefront/skeletons";
import { Button } from "@/components/ui/button";
import { useFavorites } from "@/hooks/use-favorites";
import { formatBRL } from "@/lib/pricing";
import { plural, t } from "@/lib/storefront/i18n";

export default function FavoritosPage() {
  const params = useParams();
  const storeSlug = params.storeSlug as string;
  const { items, isHydrated, count } = useFavorites();

  // Skeleton while hydrating
  if (!isHydrated) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-7 w-32 animate-pulse rounded-lg bg-gray-100" />
          <div className="h-5 w-16 animate-pulse rounded-lg bg-gray-100" />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (items.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-6 flex size-24 items-center justify-center rounded-full bg-gray-100">
          <Heart className="size-12 text-gray-400" />
        </div>
        <h1 className="mb-2 text-xl font-bold text-foreground">
          {t.favorites.empty}
        </h1>
        <p className="mb-8 max-w-xs text-sm text-muted-foreground">
          {t.favorites.emptyDescription}
        </p>
        <Button asChild size="lg" className="gap-2 rounded-full bg-foreground text-background hover:brightness-110 shadow-lg">
          <Link href={`/${storeSlug}`}>
            <ShoppingBag className="size-4" />
            {t.nav.explore}
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">
          {t.favorites.title}
        </h1>
        <span className="text-sm text-muted-foreground">
          {count} {plural(count, t.cart.item, t.cart.items)}
        </span>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => (
          <FavoriteProductCard
            key={item.productId}
            item={item}
            storeSlug={storeSlug}
          />
        ))}
      </div>
    </div>
  );
}

interface FavoriteProductCardProps {
  item: {
    productId: string;
    productSlug: string;
    productName: string;
    imageUrl: string | null;
    priceCents: number;
  };
  storeSlug: string;
}

function FavoriteProductCard({ item, storeSlug }: FavoriteProductCardProps) {
  return (
    <div className="group relative">
      <Link
        href={`/${storeSlug}/produto/${item.productSlug}`}
        className="flex flex-col gap-3 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-2xl"
      >
        {/* Image */}
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-gray-100">
          {item.imageUrl ? (
            <Image
              src={item.imageUrl}
              alt={item.productName}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground/60 text-xs">
              {t.product.noPhoto}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col gap-0.5 px-0.5">
          <p className="truncate text-sm font-medium text-foreground">
            {item.productName}
          </p>
          <p className="text-sm font-semibold tabular-nums text-foreground">
            {formatBRL(item.priceCents)}
          </p>
        </div>
      </Link>

      {/* Favorite button */}
      <FavoriteButton
        product={{
          productId: item.productId,
          productSlug: item.productSlug,
          productName: item.productName,
          imageUrl: item.imageUrl,
          priceCents: item.priceCents,
        }}
        className="absolute right-2 top-2"
        size="sm"
      />
    </div>
  );
}
