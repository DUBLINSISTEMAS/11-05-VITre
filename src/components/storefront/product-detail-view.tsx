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
 */
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
  return (
    <article className="-mx-4 lg:mx-0">
      {/* Mobile layout */}
      <div className="flex flex-col lg:hidden">
        {/* Gallery + floating header */}
        <div className="relative">
          <ProductGallery images={product.images} productName={product.name} />
          <StoreHeader
            variant="pdp-floating"
            store={store}
            backHref={`/${store.slug}`}
          />
        </div>

        <ProductPurchasePanel product={product} />
      </div>

      {/* Desktop layout */}
      <div className="mx-auto hidden max-w-screen-xl gap-10 px-4 lg:grid lg:grid-cols-2">
        <div className="sticky top-20 self-start">
          <ProductGallery images={product.images} productName={product.name} />
        </div>
        <div className="relative flex flex-col py-4">
          <ProductPurchasePanel product={product} />
        </div>
      </div>
    </article>
  );
}
