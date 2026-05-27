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
import { useEffect, useMemo, useState } from "react";

import { FavoriteButton } from "@/components/storefront/favorite-button";
import { ProductGallery } from "@/components/storefront/product-gallery";
import { ProductPurchasePanel } from "@/components/storefront/product-purchase-panel";
import { StoreHeader } from "@/components/storefront/store-header";
import type { Store } from "@/db/schema";
import { getEffectivePrice } from "@/lib/pricing";
import type { ProductDetail } from "@/lib/storefront/products-loader";

export interface BreadcrumbCrumb {
  slug: string;
  name: string;
}

export interface ProductDetailViewProps {
  product: ProductDetail;
  store: Store;
  /**
   * Trilha categoria-pai → categoria-folha. Onda 5 (2026-05-27) — renderizada
   * acima do título do produto pra orientação espacial ("estou em Joias →
   * Anéis"). Array vazio = sem categoria, breadcrumb não aparece.
   */
  breadcrumb?: BreadcrumbCrumb[];
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
  breadcrumb,
  relatedSection,
}: ProductDetailViewProps) {
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

  // Onda 10 (2026-05-27): scroll-to-top defensivo em navegação PDP→PDP via
  // "Você pode gostar". Next 15 App Router faz scroll automático em Link
  // entre rotas distintas, mas quando o cliente navega entre dois produtos
  // (mesma rota dinâmica /[productSlug], só param diferente), em alguns
  // browsers o scroll position é preservado — cliente cai no meio da
  // gallery do PDP novo. Effect com dep em product.id garante topo sempre.
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [product.id]);

  // Resolve qual imagem destacar com base na variante selecionada.
  // Se a variante não tem `featuredImageId` (ou nenhuma variante selecionada),
  // retorna null e a gallery mantém a foto atual.
  const activeFeaturedImageId = useMemo(() => {
    if (!selectedVariantId) return null;
    const v = product.variants.find((x) => x.id === selectedVariantId);
    return v?.featuredImageId ?? null;
  }, [selectedVariantId, product.variants]);

  // Onda 2 (2026-05-27): favoritar saiu do sticky CTA pra um overlay no
  // canto inferior direito da galeria. Heart no CTA dividia o alvo
  // principal (Fitts) — favoritar é microação rara. Pattern Zara/Aritzia:
  // botão flutuante sobre a foto, longe do fluxo de compra.
  const favoriteInput = useMemo(
    () => ({
      productId: product.id,
      productSlug: product.slug,
      productName: product.name,
      imageUrl: product.images[0]?.url ?? null,
      priceCents: getEffectivePrice(product, new Date()),
    }),
    [product],
  );

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
      {/* Mobile layout. Onda 8 (2026-05-27): pb-28 → pb-24 (96px) pq sticky
          CTA voltou a mono-botão h-12 (Onda 8) — ~80px total com safe-area.
          Antes pb-28 cobria 2 botões empilhados (Onda 2). */}
      <div className="flex flex-col pb-24 lg:hidden lg:pb-0">
        {/* Gallery + floating header + favorite overlay (Onda 2) */}
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
            shareInfo={{ title: product.name }}
          />
          <FavoriteButton
            product={favoriteInput}
            className="absolute bottom-3 right-3 z-20"
            size="md"
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
          breadcrumb={breadcrumb}
        />

        {/* Mobile: "Você pode gostar também" entra DENTRO do flex-col
            do PDP, antes da CTA sticky. A section interna controla
            o próprio mt-4 + border-t + pt-5 (16+20px de respiro
            apertado estilo loja online). Safe-zone pra CTA mora no
            flex-col pai (pb-24) — sem dupla margem. */}
        {relatedSection}
      </div>

      {/* Desktop layout */}
      <div className="mx-auto hidden max-w-screen-xl gap-10 px-4 lg:grid lg:grid-cols-2">
        <div className="sticky top-20 self-start">
          <div className="relative">
            <ProductGallery
              images={product.images}
              productName={product.name}
              activeFeaturedImageId={activeFeaturedImageId}
            />
            <FavoriteButton
              product={favoriteInput}
              className="absolute bottom-3 right-3 z-20"
              size="md"
            />
          </div>
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
