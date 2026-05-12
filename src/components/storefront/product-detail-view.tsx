"use client";

/**
 * Product detail view — fiel ao canvas-v1 (`_vitre-storefront.jsx:241-358`).
 *
 * Mobile layout (canvas):
 *   ┌─────────────────────────────┐
 *   │ [←]                    [🔍] │  StoreHeader pdp-floating
 *   │  ┌───────────────────────┐  │
 *   │  │       gallery         │  │
 *   │  │                       │  │
 *   │  │      ●  ⬤ ⬤ ⬤         │  ProductGallery dots
 *   │  └───────────────────────┘  │
 *   │ SKU                          │
 *   │ Nome                         │
 *   │ R$ ...  −25%                 │  ProductPurchasePanel
 *   │ ...                          │
 *   │ [♥] Adicionar à sacola      │  sticky CTA bottom
 *   └─────────────────────────────┘
 *
 * Desktop layout (extensão fora do canvas — canvas é mobile-only):
 *   gallery sticky à esquerda + purchase-panel scrollável à direita.
 *   Header pdp-floating não aparece em desktop (decisão de não regredir
 *   layout existente).
 *
 * Estado compartilhado (Onda 4 — variantes com foto destacada):
 *   `selectedVariantId` vive aqui pra que o purchase-panel e a gallery
 *   coordenem. Quando o cliente seleciona uma variante com
 *   `featuredImageId`, a gallery rola pra essa foto.
 */
import { useMemo, useState } from "react";

import { ProductGallery } from "@/components/storefront/product-gallery";
import { ProductPurchasePanel } from "@/components/storefront/product-purchase-panel";
import { StoreHeader } from "@/components/storefront/store-header";
import type { Store } from "@/db/schema";
import type { ProductDetail } from "@/lib/storefront/products-loader";

export interface ProductDetailViewProps {
  product: ProductDetail;
  store: Store;
}

export function ProductDetailView({ product, store }: ProductDetailViewProps) {
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

  // Resolve qual imagem destacar com base na variante selecionada.
  // Se a variante não tem `featuredImageId` (ou nenhuma variante selecionada),
  // retorna null e a gallery mantém a foto atual.
  const activeFeaturedImageId = useMemo(() => {
    if (!selectedVariantId) return null;
    const v = product.variants.find((x) => x.id === selectedVariantId);
    return v?.featuredImageId ?? null;
  }, [selectedVariantId, product.variants]);

  return (
    <article className="-mx-4 lg:mx-0">
      {/* Mobile layout */}
      <div className="flex flex-col lg:hidden">
        {/* Gallery + floating header */}
        <div className="relative">
          <ProductGallery
            images={product.images}
            productName={product.name}
            activeFeaturedImageId={activeFeaturedImageId}
          />
          <StoreHeader
            variant="pdp-floating"
            store={store}
            backHref={`/${store.slug}`}
          />
        </div>

        <ProductPurchasePanel
          product={product}
          storeSlug={store.slug}
          selectedVariantId={selectedVariantId}
          onSelectVariant={setSelectedVariantId}
        />
      </div>

      {/* Desktop layout */}
      <div className="mx-auto hidden max-w-screen-xl gap-10 px-4 lg:grid lg:grid-cols-2">
        <div className="sticky top-20 self-start">
          <ProductGallery
            images={product.images}
            productName={product.name}
            activeFeaturedImageId={activeFeaturedImageId}
          />
        </div>
        <div className="relative flex flex-col py-4">
          <ProductPurchasePanel
            product={product}
            storeSlug={store.slug}
            selectedVariantId={selectedVariantId}
            onSelectVariant={setSelectedVariantId}
          />
        </div>
      </div>
    </article>
  );
}
