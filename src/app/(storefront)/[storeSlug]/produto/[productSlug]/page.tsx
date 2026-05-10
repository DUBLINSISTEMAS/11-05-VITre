/**
 * PDP — página de detalhe do produto.
 *
 * Layout redesign estilo app de moda premium: imagem grande,
 * thumbnails circulares, seletor de tamanho em pills, botão
 * Add To Cart verde limão.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProductDetailView } from "@/components/storefront/product-detail-view";
import { env } from "@/lib/env";
import { getEffectivePrice } from "@/lib/pricing";
import { getProductBySlug } from "@/lib/storefront/products-loader";
import { getStoreBySlug } from "@/lib/storefront/store-loader";

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

  return {
    title: product.name,
    description,
    openGraph: {
      title: product.name,
      description,
      images: ogImage ? [{ url: ogImage }] : undefined,
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

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString }}
      />
      <ProductDetailView product={product} store={store} />
    </>
  );
}
