/**
 * PDP — página de detalhe do produto.
 *
 * Layout redesign estilo app de moda premium: imagem grande,
 * thumbnails circulares, seletor de tamanho em pills, botão
 * Add To Cart verde limão.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProductCard } from "@/components/storefront/product-card";
import { ProductDetailView } from "@/components/storefront/product-detail-view";
import { env } from "@/lib/env";
import { getEffectivePrice } from "@/lib/pricing";
import { getProductBySlug } from "@/lib/storefront/products-loader";
import { getRelatedProducts } from "@/lib/storefront/related-products-loader";
import { getStoreBySlug } from "@/lib/storefront/store-loader";
import type { ProductCardVariant } from "@/lib/storefront/themes";

interface PageParams {
  storeSlug: string;
  productSlug: string;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const { storeSlug, productSlug } = await params;
  const store = await getStoreBySlug(storeSlug);
  if (!store) return { title: "Não encontrado" };

  const product = await getProductBySlug(store.id, store.slug, productSlug);
  if (!product) return { title: "Produto não encontrado" };

  const description =
    product.description?.slice(0, 160) ||
    `${product.name} disponível em ${store.name}. Compre via WhatsApp.`;

  const ogImage = product.images[0]?.url;

  // Sprint flash 2026-05-24 — adiciona width/height/type/alt no OG image
  // pra WhatsApp/Facebook conseguirem renderizar preview rico (antes
  // mandávamos só url, e o scraper do WhatsApp ficava sem preview ou
  // cortava a foto). Imagens do storefront já são processadas pra 800×800
  // WebP (sharp em upload — convenção #5 do CLAUDE.md).
  return {
    title: product.name,
    description,
    openGraph: {
      title: product.name,
      description,
      images: ogImage
        ? [
            {
              url: ogImage,
              width: 800,
              height: 800,
              type: "image/webp",
              alt: product.name,
            },
          ]
        : undefined,
      type: "website",
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<PageParams>;
}) {
  const { storeSlug, productSlug } = await params;
  const store = await getStoreBySlug(storeSlug);
  if (!store) notFound();

  const product = await getProductBySlug(store.id, store.slug, productSlug);
  if (!product) notFound();

  const now = new Date();
  const effectivePriceCents = getEffectivePrice(product, now);
  const isOutOfStock =
    product.trackStock &&
    (product.stockQuantity === null || product.stockQuantity <= 0);

  const jsonLd = {
    "@context": "https://schema.org/",
    "@type": "Product",
    name: product.name,
    description: product.description || undefined,
    image: product.images.map((i) => i.url),
    productID: product.id,
    brand: {
      "@type": "Brand",
      name: store.name,
    },
    offers: {
      "@type": "Offer",
      price: (effectivePriceCents / 100).toFixed(2),
      priceCurrency: "BRL",
      // Availability é SOBRE estoque, não sobre promoção. Bug anterior
      // marcava produto esgotado EM PROMOÇÃO como InStock no Google.
      availability: isOutOfStock
        ? "https://schema.org/OutOfStock"
        : "https://schema.org/InStock",
      url: `${env.NEXT_PUBLIC_APP_URL}/${store.slug}/produto/${product.slug}`,
    },
  };

  const jsonLdString = JSON.stringify(jsonLd).replace(
    /<\/script/gi,
    "<\\/script",
  );

  const related = await getRelatedProducts(
    store.id,
    store.slug,
    product.id,
    product.categoryId,
    6,
  );

  const relatedSection =
    related.length > 0 ? (
      // Estrutura premium estilo loja online (Zara/Aritzia):
      // - `border-t` sutil separa visualmente do bloco do produto sem
      //   precisar de espaço grande em branco (hierarquia tipográfica
      //   + linha fina já comunica "seção nova").
      // - Mobile: `mt-4 pt-5` (16px + 20px) — apertado, sinaliza que
      //   tem mais conteúdo na próxima dobra logo após o CTA.
      // - Desktop: `lg:mt-14 lg:pt-10` — respiração generosa,
      //   "ar" entre as seções.
      // - Título com tracking ajustado pra parecer editorial.
      <section className="mx-auto mt-4 w-full max-w-screen-xl border-t border-border/70 px-4 pt-5 pb-10 lg:mt-14 lg:px-0 lg:pt-10">
        <h2 className="text-[15px] font-semibold tracking-[-0.3px] text-foreground lg:text-[20px] lg:tracking-[-0.5px]">
          Você pode gostar também
        </h2>
        {/* Mobile: scroll horizontal denso (gap-2.5) — cards aparecem
            parcialmente cortados no edge direito sinalizando "tem mais".
            Desktop: grid responsivo. */}
        <div className="-mx-4 mt-3 flex gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:mx-0 lg:mt-5 lg:grid lg:grid-cols-3 lg:gap-5 lg:overflow-visible lg:px-0 lg:pb-0 xl:grid-cols-6">
          {related.map((p) => (
            <div key={p.id} className="w-[148px] shrink-0 lg:w-auto">
              <ProductCard
                product={p}
                storeSlug={store.slug}
                layout="overlay"
                variant={store.productCardStyle as ProductCardVariant}
              />
            </div>
          ))}
        </div>
      </section>
    ) : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString }}
      />
      <ProductDetailView
        product={product}
        store={store}
        relatedSection={relatedSection}
      />
    </>
  );
}
