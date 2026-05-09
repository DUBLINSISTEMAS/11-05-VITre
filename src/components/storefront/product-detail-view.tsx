"use client";

/**
 * Product detail view - wrapper component.
 *
 * Renders the product detail page with header navigation,
 * image gallery, and purchase panel.
 */
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { FavoriteButton } from "@/components/storefront/favorite-button";
import { ProductGallery } from "@/components/storefront/product-gallery";
import { ProductPurchasePanel } from "@/components/storefront/product-purchase-panel";
import { Button } from "@/components/ui/button";
import { getEffectivePrice } from "@/lib/pricing";
import type { ProductDetail } from "@/lib/storefront/products-loader";

export interface ProductDetailViewProps {
  product: ProductDetail;
  storeSlug: string;
}

export function ProductDetailView({
  product,
  storeSlug,
}: ProductDetailViewProps) {
  const effectivePrice = getEffectivePrice(product, new Date());

  const favoriteInput = {
    productId: product.id,
    productSlug: product.slug,
    productName: product.name,
    imageUrl: product.images[0]?.url ?? null,
    priceCents: effectivePrice,
  };

  return (
    <article className="-mx-4 lg:mx-0">
      {/* Mobile layout */}
      <div className="flex flex-col lg:hidden">
        {/* Header with back and favorite */}
        <div className="sticky top-0 z-20 flex items-center justify-between bg-background/95 px-4 py-3 backdrop-blur-lg">
          <Link href={`/${storeSlug}`}>
            <Button
              variant="ghost"
              size="icon"
              className="size-10 rounded-full"
            >
              <ArrowLeft className="size-5" />
              <span className="sr-only">Voltar</span>
            </Button>
          </Link>
          <h1 className="text-base font-semibold">Details</h1>
          <FavoriteButton product={favoriteInput} size="md" />
        </div>

        {/* Gallery - padding horizontal para não colar nas bordas */}
        <div className="px-4">
          <ProductGallery images={product.images} productName={product.name} />
        </div>

        {/* Purchase panel */}
        <div className="relative mt-4">
          <ProductPurchasePanel product={product} storeSlug={storeSlug} />
        </div>
      </div>

      {/* Desktop layout */}
      <div className="mx-auto hidden max-w-screen-xl gap-10 px-4 lg:grid lg:grid-cols-2">
        <div className="sticky top-20 self-start">
          <ProductGallery images={product.images} productName={product.name} />
        </div>

        <div className="relative flex flex-col py-4">
          {/* Favorite button desktop */}
          <div className="absolute right-0 top-4">
            <FavoriteButton product={favoriteInput} size="md" />
          </div>

          <ProductPurchasePanel product={product} storeSlug={storeSlug} />
        </div>
      </div>
    </article>
  );
}
