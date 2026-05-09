/**
 * Home pública de uma loja.
 *
 * Server Component. Owner-aware: se o lojista visita a própria loja
 * vazia, mostra CTA pra cadastrar primeiro produto. Cliente comum vê
 * copy de "loja sendo preparada".
 */
import { Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BannerCarousel } from "@/components/storefront/banner-carousel";
import { CategoryPills } from "@/components/storefront/category-pills";
import { ProductGrid } from "@/components/storefront/product-grid";
import { Button } from "@/components/ui/button";
import { getSessionOrNull } from "@/lib/auth-server";
import { getActiveBanners } from "@/lib/storefront/banners-loader";
import { getCategoryTree } from "@/lib/storefront/categories-loader";
import {
  getFeaturedProducts,
  getRecentProducts,
} from "@/lib/storefront/products-loader";
import { getStoreBySlug } from "@/lib/storefront/store-loader";

export default async function StoreHomePage({
  params,
}: {
  params: Promise<{ storeSlug: string }>;
}) {
  const { storeSlug } = await params;
  const store = await getStoreBySlug(storeSlug);
  if (!store) notFound();

  const [banners, categoryTree, featured, recent, session] = await Promise.all([
    getActiveBanners(store.id, store.slug),
    getCategoryTree(store.id, store.slug),
    getFeaturedProducts(store.id, store.slug, 8),
    getRecentProducts(store.id, store.slug, 8),
    getSessionOrNull(),
  ]);

  const isOwner = session?.user?.id === store.ownerId;
  const showFeaturedSection = featured.length > 0;
  const featuredLcpEligible = banners.length === 0;
  const recentLcpEligible = !showFeaturedSection && banners.length === 0;
  const isCatalogEmpty = !showFeaturedSection && recent.length === 0;

  return (
    <div className="space-y-6">
      {banners.length > 0 && (
        <section aria-label="Promoções">
          <BannerCarousel banners={banners} />
        </section>
      )}

      <CategoryPills storeSlug={store.slug} categories={categoryTree} />

      {showFeaturedSection && (
        <ProductGrid
          storeSlug={store.slug}
          products={featured}
          priorityFirst={featuredLcpEligible}
          priorityCount={2}
          sectionTitle="Especial Para Você"
          seeAllHref={`/${store.slug}/destaques`}
        />
      )}

      {recent.length > 0 && (
        <ProductGrid
          storeSlug={store.slug}
          products={recent}
          priorityFirst={recentLcpEligible}
          priorityCount={2}
          sectionTitle="Novidades"
          seeAllHref={`/${store.slug}/novidades`}
        />
      )}

      {isCatalogEmpty && (
        <EmptyCatalog isOwner={isOwner} storeName={store.name} />
      )}
    </div>
  );
}

function EmptyCatalog({
  isOwner,
  storeName,
}: {
  isOwner: boolean;
  storeName: string;
}) {
  if (isOwner) {
    return (
      <div className="px-6 py-16 text-center">
        <div className="bg-primary/10 mx-auto mb-5 flex size-20 items-center justify-center rounded-full">
          <Sparkles className="text-primary size-10" />
        </div>
        <h2 className="text-foreground mb-1.5 text-lg font-semibold">
          Sua loja está pronta
        </h2>
        <p className="text-muted-foreground mx-auto max-w-xs text-sm leading-relaxed">
          Cadastre o primeiro produto para que seus clientes possam ver o
          catálogo da {storeName}.
        </p>
        <Button asChild className="mt-6 gap-2">
          <Link href="/admin/produtos/novo">
            <Plus className="size-4" />
            Cadastrar primeiro produto
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="px-6 py-20 text-center">
      <div className="bg-muted mx-auto mb-5 flex size-20 items-center justify-center rounded-full">
        <Sparkles className="text-muted-foreground size-10" />
      </div>
      <h2 className="text-foreground mb-1.5 text-lg font-semibold">
        Catálogo em construção
      </h2>
      <p className="text-muted-foreground mx-auto max-w-xs text-sm leading-relaxed">
        Em breve você verá os produtos da {storeName} aqui.
      </p>
    </div>
  );
}
