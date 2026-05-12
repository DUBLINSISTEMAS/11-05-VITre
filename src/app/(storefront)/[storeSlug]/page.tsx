/**
 * Home pública — fiel ao canvas-referencia (canvas-v1).
 *
 * Server Component. Owner-aware: lojista vê CTA pra cadastrar primeiro
 * produto na loja vazia; cliente vê copy de catálogo em construção.
 *
 * Estrutura canvas-v1 (em VTHome):
 *   1. <HeroCard>            — kicker editorial + título + subtítulo + CTA
 *   2. Categorias header     — "Categorias" display + count mono
 *   3. <CategoryStrip>       — tiles quadrados horizontal
 *   4. "Em destaque" header  — title + "Ver todos →" cor da loja
 *   5. <ProductGrid (4)>     — 2-col overlay, primeiros 4 destaques
 *   6. <PromoStrip>          — só se houver promo ativa
 *   7. <ProductGrid (2)>     — 2-col overlay, sem header, mais 2 produtos
 */
import { Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BannerCarousel } from "@/components/storefront/banner-carousel";
import { CategoryStrip } from "@/components/storefront/category-strip";
import { ProductGrid } from "@/components/storefront/product-grid";
import { PromoStrip } from "@/components/storefront/promo-strip";
import { Button } from "@/components/ui/button";
import { getSessionOrNull } from "@/lib/auth-server";
import { hasActivePromo } from "@/lib/pricing";
import { getHomePageData } from "@/lib/storefront/home-loader";
import { getStoreBySlug } from "@/lib/storefront/store-loader";
import type {
  CategoryShape,
  HeroVariant,
  ProductCardVariant,
} from "@/lib/storefront/themes";

export default async function StoreHomePage({
  params,
}: {
  params: Promise<{ storeSlug: string }>;
}) {
  const { storeSlug } = await params;
  const store = await getStoreBySlug(storeSlug);
  if (!store) notFound();

  // Home consolida 4 queries (banners + categorias + featured + recent)
  // numa única transação `withTenant` — antes eram 4 transações paralelas
  // brigando por conexões do pool max=3.
  const [homeData, session] = await Promise.all([
    getHomePageData(store.id, store.slug),
    getSessionOrNull(),
  ]);
  const { banners, categoryTree, featured, recent } = homeData;

  const isOwner = session?.user?.id === store.ownerId;
  const hasBanner = banners.length > 0;
  const isCatalogEmpty = featured.length === 0 && recent.length === 0;

  // Bloco 1 (header "Em destaque"): primeiros 4 destaques
  const featuredBlock = featured.slice(0, 4);
  // Bloco 2 (sem header): mais 2 produtos. Preferência: do recent que
  // ainda não estão em featuredBlock.
  const featuredIds = new Set(featuredBlock.map((p) => p.id));
  const moreBlock = recent
    .filter((p) => !featuredIds.has(p.id))
    .slice(0, 2);

  // PromoStrip: deriva count + nearest promoEndsAt do que está carregado.
  const now = new Date();
  const allLoaded = [
    ...featuredBlock,
    ...moreBlock,
    ...featured.slice(4),
    ...recent,
  ];
  const promoSet = new Map<string, (typeof allLoaded)[number]>();
  for (const p of allLoaded) {
    if (!promoSet.has(p.id) && hasActivePromo(p, now)) promoSet.set(p.id, p);
  }
  const promoCount = promoSet.size;
  const promoEndDates = Array.from(promoSet.values())
    .map((p) => p.promoEndsAt)
    .filter((d): d is Date => d != null && d > now);
  const nearestEndsAt =
    promoEndDates.length > 0
      ? new Date(Math.min(...promoEndDates.map((d) => d.getTime())))
      : null;

  return (
    <div className="space-y-[18px]">
      {hasBanner && (
        <BannerCarousel
          banners={banners}
          storeSlug={store.slug}
          storeName={store.name}
          rotationSec={store.bannerRotationSec}
          heroVariant={store.heroStyle as HeroVariant}
        />
      )}

      {categoryTree.length > 0 && (
        <section className="space-y-2">
          <header>
            <h2 className="text-sm font-semibold tracking-[-0.3px] text-foreground">
              Categorias
            </h2>
          </header>
          <CategoryStrip
            storeSlug={store.slug}
            categories={categoryTree}
            shape={store.categoryShape as CategoryShape}
          />
        </section>
      )}

      {featuredBlock.length > 0 && (
        <ProductGrid
          storeSlug={store.slug}
          products={featuredBlock}
          sectionTitle="Em destaque"
          seeAllHref={`/${store.slug}/destaques`}
          priorityFirst={!hasBanner}
          priorityCount={2}
          layout="overlay"
          variant={store.productCardStyle as ProductCardVariant}
        />
      )}

      {promoCount > 0 && (
        <PromoStrip
          storeSlug={store.slug}
          count={promoCount}
          nearestEndsAt={nearestEndsAt}
        />
      )}

      {moreBlock.length > 0 && (
        <ProductGrid
          storeSlug={store.slug}
          products={moreBlock}
          layout="overlay"
          variant={store.productCardStyle as ProductCardVariant}
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
      <div className="rounded-2xl border border-border bg-card px-6 py-16 text-center">
        <div className="mx-auto mb-5 flex size-20 items-center justify-center rounded-full bg-foreground/5">
          <Sparkles className="size-9 text-foreground" />
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          PRIMEIRO PASSO
        </p>
        <h2 className="mt-1 text-lg font-semibold text-foreground">
          Sua vitrine está pronta
        </h2>
        <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
          Cadastre o primeiro produto para que seus clientes possam ver a
          vitrine da {storeName}.
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
    <div className="rounded-2xl border border-border bg-card px-6 py-20 text-center">
      <div className="mx-auto mb-5 flex size-20 items-center justify-center rounded-full bg-muted">
        <Sparkles className="size-9 text-muted-foreground" />
      </div>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        EM BREVE
      </p>
      <h2 className="mt-1 text-lg font-semibold text-foreground">
        Vitrine em construção
      </h2>
      <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
        Em breve você verá os produtos da {storeName} aqui.
      </p>
    </div>
  );
}
