/**
 * Home pública — fiel ao canvas-referencia (canvas-v1).
 *
 * Server Component. Owner-aware: lojista vê CTA pra cadastrar primeiro
 * produto na loja vazia; cliente vê copy de catálogo em construção.
 *
 * Estrutura canvas-v1 (em VTHome):
 *   1. <BannerCarousel>      — Hero card 16:9 com dots + auto-rotate
 *                              (rotationSec configurável por loja)
 *   2. <CollectionStrip>     — "Vitrines" h2 + cards coloridos com kicker
 *                              (bgColor do admin)
 *   3. <CategoryStrip>       — "Categorias" h2 + tiles 76×76 shape config
 *   4. <ProductGrid>         — "Em destaque" + "Ver todos →" link cor da
 *                              loja + 2-col overlay (featured)
 *   5. <PromoStrip>          — brand-store wash, só se houver promo ativa
 *   6. <ProductGrid>         — 2-col overlay sem header (more)
 *
 * S30 audit (handoff pixel-perfect 2026-05-25): verificado vs
 * `design_handoff_mangos_pay/app-storefront/home.jsx`. Estrutura, ordem,
 * dimensões e componentes batem o handoff. A diferença vs handoff é só
 * a fonte de dados (DB real vs mock) e business logic adicional
 * (owner-aware EmptyCatalog). Nenhum gap visual aberto.
 *
 * Componentes ports prévios já em pixel-perfect:
 *   - BannerCarousel + HeroCard: aspect-[16/9], rotação config, dots
 *   - CollectionStrip: PP5 (kicker + bgColor + cards 280×130 brand wash)
 *   - CategoryStrip: 76px tiles, shape rounded|square|circle
 *   - ProductGrid: header h2 + see-all link, 2-col gap-x 14 gap-y 18
 *   - PromoStrip: PP15 (brand-store wash + Sparkle icon + ArrowRight)
 *   - StoreHeader (home variant): avatar + name + handle + Search + Bag
 */
import { Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BannerCarousel } from "@/components/storefront/banner-carousel";
import { CategoryStrip } from "@/components/storefront/category-strip";
import { CollectionStrip } from "@/components/storefront/collection-strip";
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
  //
  // Sprint flash 2026-05-24 — gate de LCP: antes fazíamos `getSessionOrNull()`
  // em PARALELO com a home pra todo cliente anônimo (round-trip extra
  // serverless só pra decidir se mostra empty-state pro dono). No 4G
  // fraco isso atrasava LCP do storefront que veio do WhatsApp. Agora
  // só consultamos sessão quando o catálogo está REALMENTE vazio (raro,
  // só nos primeiros minutos da loja). Catálogo cheio → zero overhead.
  const homeData = await getHomePageData(store.id, store.slug);
  const { banners, categoryTree, collections, featured, recent } = homeData;

  const hasBanner = banners.length > 0;
  const isCatalogEmpty = featured.length === 0 && recent.length === 0;

  const session = isCatalogEmpty ? await getSessionOrNull() : null;
  const isOwner = session?.user?.id === store.ownerId;

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
    // Mobile: 18px entre seções (canvas-v1 denso).
    // Desktop ≥1024: 48px — telas grandes precisam de respiração entre
    // blocos visuais. 18px em desktop colava tudo e parecia "mobile
    // esticado". 48px é o sweet spot dos templates de moda premium
    // (Aritzia, ZARA, COS) — separação clara sem espaço vazio.
    <div className="space-y-[18px] lg:space-y-12">
      {hasBanner && (
        // 2026-05-27 (founder review): banner volta a respeitar o
        // container em mobile também, como na ref Dribbble 1 tela 1
        // ("card elegante com respiro lateral"). Full-bleed dava
        // sensação de site genérico, não app — perdia a sensação de
        // "card editorial" que define a hierarquia.
        // HeroCard agora aplica rounded+shadow em todas as breakpoints.
        <BannerCarousel
          banners={banners}
          storeSlug={store.slug}
          storeName={store.name}
          rotationSec={store.bannerRotationSec}
          heroVariant={store.heroStyle as HeroVariant}
        />
      )}

      {/* Sprint 5.3 — vitrines (coleções) entre banner e categorias.
          Aparece SE o lojista criou coleção(s) com showInHome=true e
          que tenham ao menos 1 produto. */}
      {collections.length > 0 && (
        <section className="space-y-2">
          <header>
            <h2 className="text-[17px] font-semibold tracking-[-0.4px] text-foreground lg:text-[20px] lg:tracking-[-0.5px]">
              Vitrines
            </h2>
          </header>
          <CollectionStrip storeSlug={store.slug} collections={collections} />
        </section>
      )}

      {categoryTree.length > 0 && (
        <section className="space-y-2">
          <header>
            <h2 className="text-[17px] font-semibold tracking-[-0.4px] text-foreground lg:text-[20px] lg:tracking-[-0.5px]">
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
          <Link href="/admin/produtos/novo" prefetch>
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
