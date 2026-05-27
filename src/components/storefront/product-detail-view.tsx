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
  /**
   * "Você pode gostar também" — recebida como ReactNode pra que o
   * mobile renderize ANTES da CTA sticky (rola junto com o conteúdo,
   * vira parte do funil de descoberta sem cliente precisar passar
   * por baixo da CTA) e o desktop renderize abaixo do bloco principal
   * em largura inteira. Mesma section renderizada em dois lugares
   * controlados por `lg:hidden` / `hidden lg:block`.
   */
  relatedSection?: React.ReactNode;
}

export function ProductDetailView({
  product,
  store,
  relatedSection,
}: ProductDetailViewProps) {
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

  // Resolve qual imagem destacar com base na variante selecionada.
  // Se a variante não tem `featuredImageId` (ou nenhuma variante selecionada),
  // retorna null e a gallery mantém a foto atual.
  const activeFeaturedImageId = useMemo(() => {
    if (!selectedVariantId) return null;
    const v = product.variants.find((x) => x.id === selectedVariantId);
    return v?.featuredImageId ?? null;
  }, [selectedVariantId, product.variants]);

  // Pagamento (Fase 2 — ADR-0013): subset usado pelo panel renderizar
  // a label de parcelamento. Derivado do `store` carregado pelo loader.
  const storePayment = useMemo(
    () => ({
      acceptsCard: store.acceptsCard,
      cardMaxInstallments: store.cardMaxInstallments,
      installmentBasePrice: store.installmentBasePrice,
      showInstallmentsOnPDP: store.showInstallmentsOnPDP,
    }),
    [
      store.acceptsCard,
      store.cardMaxInstallments,
      store.installmentBasePrice,
      store.showInstallmentsOnPDP,
    ],
  );

  return (
    // PDP é full-bleed (sem padding do shell desde 2026-05-26 — ver
    // shell-content.tsx hasOwnLayout). Não precisa de `-mx-*` pra
    // compensar; o `<article>` é o próprio container da página.
    <article>
      {/* Mobile layout. `pb-28` (112px) reserva safe-zone abaixo do
          conteúdo pra que a CTA sticky `fixed bottom-0` (~88px com
          safe-area-inset-bottom no iPhone) não cubra o último item
          visível. Substitui o `pb-24` que ficava no panel + `pb-32`
          que ficava no wrapper relatedSection — antes os dois somavam
          com o `mt-10` da section gerando ~150px de espaço branco. */}
      <div className="flex flex-col pb-28 lg:hidden lg:pb-0">
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
          storePayment={storePayment}
          cashDiscountBps={store.cashDiscountBps}
          paymentMethodsNote={store.paymentMethodsNote}
          selectedVariantId={selectedVariantId}
          onSelectVariant={setSelectedVariantId}
          whatsappNumber={store.whatsappNumber}
          storeName={store.name}
        />

        {/* Mobile: "Você pode gostar também" entra DENTRO do flex-col
            do PDP, antes da CTA sticky. A section interna controla
            o próprio mt-4 + border-t + pt-5 (16+20px de respiro
            apertado estilo loja online). Safe-zone pra CTA mora no
            flex-col pai (pb-28) — sem dupla margem. */}
        {relatedSection}
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
            storePayment={storePayment}
            cashDiscountBps={store.cashDiscountBps}
            paymentMethodsNote={store.paymentMethodsNote}
            selectedVariantId={selectedVariantId}
            onSelectVariant={setSelectedVariantId}
            whatsappNumber={store.whatsappNumber}
            storeName={store.name}
          />
        </div>
      </div>

      {/* Desktop: "Você pode gostar também" abaixo do bloco principal,
          largura inteira (max-w-screen-xl da própria section). */}
      {relatedSection ? (
        <div className="hidden lg:block">{relatedSection}</div>
      ) : null}
    </article>
  );
}
