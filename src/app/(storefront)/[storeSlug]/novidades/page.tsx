import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProductGrid } from "@/components/storefront/product-grid";
import { getRecentProducts } from "@/lib/storefront/products-loader";
import { getStoreBySlug } from "@/lib/storefront/store-loader";

export const metadata: Metadata = {
  title: "Novidades",
};

interface PageParams {
  storeSlug: string;
}

export default async function RecentProductsPage({
  params,
}: {
  params: Promise<PageParams>;
}) {
  const { storeSlug } = await params;
  const store = await getStoreBySlug(storeSlug);
  if (!store) notFound();

  const products = await getRecentProducts(store.id, store.slug, 48);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">
          Novidades
        </h1>
        <p className="text-muted-foreground text-sm">
          Últimos produtos adicionados pela {store.name}.
        </p>
      </header>

      {products.length === 0 ? (
        <div className="text-muted-foreground bg-muted/30 rounded-2xl px-6 py-12 text-center text-sm">
          Nenhum produto publicado no momento.
        </div>
      ) : (
        <ProductGrid
          storeSlug={store.slug}
          products={products}
          priorityFirst
          priorityCount={2}
        />
      )}
    </div>
  );
}
