/**
 * Preview live do tema — usado em iframe pelo ThemeSelector.
 *
 * Renderiza uma versão mockada da vitrine (Hero + Categorias + Produtos +
 * BottomNav simulada) com o preset aplicado. Não usa DB — dados estáticos
 * inline pra isolar do ambiente de produção (cache, RLS, etc).
 *
 * Onda 7 (2026-05-12) do pacote master.
 */
import { notFound } from "next/navigation";

import { CategoryStrip } from "@/components/storefront/category-strip";
import { HeroCard } from "@/components/storefront/hero-card";
import { ProductCard } from "@/components/storefront/product-card";
import type { Banner as ActiveBanner, Category } from "@/db/schema";
import type { ProductCardData } from "@/lib/storefront/_shared";
import type { CategoryNode } from "@/lib/storefront/categories-loader";
import {
  THEME_PRESETS,
  type ThemePresetId,
} from "@/lib/storefront/themes";

// IDs falsos só pra satisfazer os tipos. Nada disso chega no DB.
const STORE_ID = "preview-store";
const STORE_SLUG = "preview";
const STORE_NAME = "Sua Loja";

const NOW = new Date();
// HeroCard runtime aceita imageUrl vazia (cai no gradient). Tipo Banner
// exige string NOT NULL — passamos "" pra satisfazer o tipo sem render
// quebrar.
const MOCK_BANNER = {
  id: "preview-banner",
  storeId: STORE_ID,
  imageUrl: "",
  ctaText: "Ver coleção",
  ctaUrl: null,
  ctaCategoryId: null,
  title: "Nova coleção",
  subtitle: "Peças selecionadas pra você",
  kicker: "DESTAQUE",
  position: 0,
  isActive: true,
  createdAt: NOW,
  updatedAt: NOW,
} as unknown as ActiveBanner;

function mockCategory(name: string, position: number): CategoryNode {
  const base: Category = {
    id: `cat-${position}`,
    storeId: STORE_ID,
    parentId: null,
    name,
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    position,
    isActive: true,
    imageUrl: null,
    tracksBatch: false,
    createdAt: NOW,
  };
  return { ...base, children: [] };
}

const MOCK_CATEGORIES: CategoryNode[] = [
  mockCategory("Vestidos", 0),
  mockCategory("Conjuntos", 1),
  mockCategory("Blusas", 2),
  mockCategory("Acessórios", 3),
];

function mockProduct(
  id: string,
  name: string,
  basePriceInCents: number,
  promoPriceInCents: number | null = null,
  isFeatured = false,
): ProductCardData {
  return {
    id,
    slug: id,
    name,
    basePriceInCents,
    promoPriceInCents,
    promoStartsAt: promoPriceInCents ? new Date(NOW.getTime() - 1000) : null,
    promoEndsAt: promoPriceInCents
      ? new Date(NOW.getTime() + 86400 * 30 * 1000)
      : null,
    trackStock: false,
    stockQuantity: null,
    isFeatured,
    primaryImageUrl: null,
    primaryImageAlt: null,
  };
}

const MOCK_PRODUCTS: ProductCardData[] = [
  mockProduct("p1", "Vestido midi linho", 18900, 14900, true),
  mockProduct("p2", "Conjunto cropped + saia", 22900, null, true),
  mockProduct("p3", "Blusa manga longa", 12900),
  mockProduct("p4", "Vestido festa renda", 34900, 27900),
  mockProduct("p5", "Calça wide-leg", 19900),
  mockProduct("p6", "Sandália trançada", 16900),
];

interface PreviewPageProps {
  params: Promise<{ presetId: string }>;
}

// Sem auth check — rota /admin/* já é protegida por middleware/layout.
// Sem revalidate — sempre dinâmica (preview).
export default async function ThemePreviewPage({ params }: PreviewPageProps) {
  const { presetId } = await params;
  if (!(presetId in THEME_PRESETS)) notFound();
  const preset = THEME_PRESETS[presetId as ThemePresetId];

  return (
    // Storefront usa CSS var --brand-store setada por store-shell.tsx no
    // mundo real. Aqui setamos inline pro preview (azul do Mangos Pay default).
    <div
      className="min-h-svh bg-background"
      style={{ ["--brand-store" as string]: "#1E3FE6" } as React.CSSProperties}
    >
        {/* Topbar simulada */}
        <div className="border-b bg-card px-4 py-3">
          <p className="text-[15px] font-semibold tracking-tight">
            {STORE_NAME}
          </p>
        </div>

        {/* Hero */}
        <div className="px-4 pt-3">
          <HeroCard
            banner={MOCK_BANNER}
            storeSlug={STORE_SLUG}
            storeName={STORE_NAME}
            variant={preset.heroStyle}
            priority
          />
        </div>

        {/* Categorias */}
        <div className="mt-4">
          <header className="mb-2 px-4">
            <h2 className="text-[14px] font-semibold tracking-tight">
              Categorias
            </h2>
          </header>
          <CategoryStrip
            storeSlug={STORE_SLUG}
            categories={MOCK_CATEGORIES}
            shape={preset.categoryShape}
          />
        </div>

        {/* Em destaque (grid) */}
        <div className="mt-5 px-4">
          <header className="mb-2 flex items-baseline justify-between">
            <h2 className="text-[14px] font-semibold tracking-tight">
              Em destaque
            </h2>
            <span className="text-xs text-muted-foreground">Ver todos →</span>
          </header>
          <div className="grid grid-cols-2 gap-3">
            {MOCK_PRODUCTS.map((p, i) => (
              <ProductCard
                key={p.id}
                product={p}
                storeSlug={STORE_SLUG}
                priority={i < 2}
                variant={preset.productCardStyle}
              />
            ))}
          </div>
        </div>

        {/* Bottom nav simulada */}
        <div className="mt-8 border-t bg-card">
          <div className="grid grid-cols-4 px-2 py-2 text-[10px] text-muted-foreground">
            <div className="flex flex-col items-center gap-0.5 py-1">
              <span className="size-5 rounded bg-foreground/80" />
              <span>Início</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 py-1">
              <span className="size-5 rounded bg-muted" />
              <span>Categorias</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 py-1">
              <span className="size-5 rounded bg-muted" />
              <span>Buscar</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 py-1">
              <span className="size-5 rounded bg-muted" />
              <span>Sacola</span>
            </div>
          </div>
        </div>

        {/* Banner indicando que é preview */}
      <div className="pointer-events-none fixed left-1/2 top-3 z-50 -translate-x-1/2 rounded-full bg-foreground/90 px-3 py-1 text-[11px] font-medium text-background backdrop-blur">
        Preview · {preset.name}
      </div>
    </div>
  );
}
