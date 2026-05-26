"use client";

// Editor de Aparência da loja — handoff PP4 (2026-05-25).
//
// Sidebar 260px com 8 sections + edit panel à direita + StorefrontLivePreview
// embaixo. Cada section renderiza um sub-componente local. Sections com
// schema real (Identidade, Banners, Featured) são funcionais; sections sem
// schema (Layout, Typography, About) mostram mock UI com pill "Em breve"
// — flexibilização explícita da régua "funciona-ou-esconde" durante o
// redesign pixel-perfect (decisão documentada em memory:
// pixel-perfect-redesign-decisao-2026-05-25.md).
//
// URL-driven via `?section=identity|banners|categories|featured|layout|
// typography|about|seo`. Default "identity".

import {
  Building2Icon,
  ChevronRightIcon,
  ExternalLinkIcon,
  FolderIcon,
  ImageIcon,
  LayoutGridIcon,
  PaletteIcon,
  StarIcon,
  TagIcon,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { AppearanceForm } from "@/components/admin/appearance-form";
import { StorefrontLivePreview } from "@/components/admin/storefront-live-preview";
import { ThemeSelector } from "@/components/admin/theme-selector";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { k: "identity", label: "Identidade", icon: PaletteIcon, mock: false },
  { k: "banners", label: "Banners", icon: ImageIcon, mock: false },
  { k: "categories", label: "Categorias da home", icon: FolderIcon, mock: true },
  { k: "featured", label: "Produtos em destaque", icon: StarIcon, mock: true },
  { k: "layout", label: "Layout & grade", icon: LayoutGridIcon, mock: true },
  { k: "typography", label: "Tipografia", icon: TagIcon, mock: true },
  { k: "about", label: "Sobre & contato", icon: Building2Icon, mock: true },
  { k: "seo", label: "URL & SEO", icon: ExternalLinkIcon, mock: false },
] as const;

type SectionKey = (typeof SECTIONS)[number]["k"];

export interface AparenciaEditorProps {
  storeSlug: string;
  store: {
    name: string;
    slug: string;
    primaryColor: string;
    logoUrl: string | null;
    bannerRotationSec: number;
    categoryShape: string;
    productCardStyle: string;
    heroStyle: string;
    bottomNavStyle: string;
  };
  /** Counts vindos do server pra exibir nos cards. */
  counts: {
    activeBanners: number;
    totalCategories: number;
    featuredProducts: number;
  };
}

export function AparenciaEditor({
  storeSlug,
  store,
  counts,
}: AparenciaEditorProps) {
  const searchParams = useSearchParams();
  const activeSection = (searchParams.get("section") as SectionKey) || "identity";

  const hrefFor = (k: SectionKey) => {
    const usp = new URLSearchParams(searchParams.toString());
    if (k === "identity") usp.delete("section");
    else usp.set("section", k);
    const qs = usp.toString();
    return qs ? `?${qs}` : "?";
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start lg:gap-6">
      {/* Sidebar de sections — sticky no desktop */}
      <nav
        aria-label="Seções de aparência"
        className="b3-card lg:sticky lg:top-4 p-1.5 flex flex-row flex-wrap gap-1 lg:flex-col lg:flex-nowrap"
      >
        {SECTIONS.map((s) => {
          const isActive = activeSection === s.k;
          const Icon = s.icon;
          return (
            <Link
              key={s.k}
              href={hrefFor(s.k)}
              replace
              scroll={false}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-[8px] px-3 py-2.5 text-left text-[13px] font-medium transition outline-none",
                isActive
                  ? "bg-mangos-cream-soft text-mangos-green-900 font-semibold shadow-sm"
                  : "text-ink-2 hover:bg-bg-app hover:text-ink-1",
                "focus-visible:ring-2 focus-visible:ring-mangos-yellow/45",
              )}
            >
              <Icon
                size={15}
                className={cn(
                  isActive ? "text-mangos-yellow-hover" : "text-ink-4",
                )}
                aria-hidden
              />
              <span className="flex-1 truncate">{s.label}</span>
              {s.mock ? (
                <span className="b3-pill text-[9.5px]">soon</span>
              ) : (
                <ChevronRightIcon
                  size={13}
                  className="text-ink-4 hidden lg:inline"
                  aria-hidden
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Edit panel + preview embaixo */}
      <div className="space-y-6">
        <div className="b3-card p-4 sm:p-5">
          {activeSection === "identity" ? (
            <IdentitySection store={store} />
          ) : activeSection === "banners" ? (
            <BannersSection rotationSec={store.bannerRotationSec} activeBanners={counts.activeBanners} />
          ) : activeSection === "categories" ? (
            <CategoriesSection totalCategories={counts.totalCategories} />
          ) : activeSection === "featured" ? (
            <FeaturedSection featuredCount={counts.featuredProducts} />
          ) : activeSection === "layout" ? (
            <LayoutSection />
          ) : activeSection === "typography" ? (
            <TypographySection />
          ) : activeSection === "about" ? (
            <AboutSection />
          ) : activeSection === "seo" ? (
            <SeoSection storeSlug={store.slug} />
          ) : null}
        </div>

        <StorefrontLivePreview storeSlug={storeSlug} />
      </div>
    </div>
  );
}

// ---------- Section: Identidade ----------

function IdentitySection({ store }: { store: AparenciaEditorProps["store"] }) {
  return (
    <div className="space-y-4">
      <SectionHeader
        title="Identidade"
        description="Logo, nome, cor primária e modelo da vitrine — define como a loja aparece pro cliente."
      />

      <div className="space-y-3">
        <div>
          <p className="text-ink-4 text-[11px] font-bold uppercase tracking-[0.06em]">
            Modelo da vitrine
          </p>
          <p className="text-ink-4 mt-0.5 text-xs leading-relaxed">
            Cada modelo muda forma das categorias, estilo dos cards, hero e barra inferior.
          </p>
        </div>
        <ThemeSelector
          currentTheme={{
            categoryShape: store.categoryShape,
            productCardStyle: store.productCardStyle,
            heroStyle: store.heroStyle,
            bottomNavStyle: store.bottomNavStyle,
          }}
        />
      </div>

      <hr className="border-line" />

      <AppearanceForm
        initialData={{
          primaryColor: store.primaryColor,
          bannerRotationSec: store.bannerRotationSec,
          logoUrl: store.logoUrl,
        }}
      />
    </div>
  );
}

// ---------- Section: Banners ----------

function BannersSection({
  rotationSec,
  activeBanners,
}: {
  rotationSec: number;
  activeBanners: number;
}) {
  return (
    <div className="space-y-4">
      <SectionHeader
        title="Banners da vitrine"
        description="Aparecem no topo da loja em rotação automática. Dois ou três banners convertem melhor que cinco."
      />

      <div
        className="rounded-[10px] p-4"
        style={{
          background: "var(--mangos-cream-soft)",
          border: "1px solid var(--brand-line)",
        }}
      >
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <p className="text-ink-1 text-[18px] font-bold tabular-nums">
              {activeBanners}{" "}
              <span className="text-ink-4 text-[12px] font-normal">
                {activeBanners === 1 ? "banner ativo" : "banners ativos"}
              </span>
            </p>
            <p className="text-ink-3 mt-1 text-[12.5px]">
              Rotação atual: {rotationSec}s
            </p>
          </div>
          <Link
            href="/admin/banners"
            prefetch
            className="b3-btn b3-btn--sm b3-btn--primary"
          >
            Gerenciar banners <ChevronRightIcon size={13} aria-hidden />
          </Link>
        </div>
      </div>

      <p className="text-ink-4 text-[12px]">
        Pra ajustar o tempo de rotação, edite{" "}
        <Link
          href="?section=identity"
          replace
          scroll={false}
          className="text-mangos-green-800 underline"
        >
          Identidade
        </Link>
        .
      </p>
    </div>
  );
}

// ---------- Section: Categorias da home (mock — visibilidade não tem schema) ----------

function CategoriesSection({ totalCategories }: { totalCategories: number }) {
  return (
    <div className="space-y-4">
      <SectionHeader
        title="Categorias da home"
        description="Carrossel circular abaixo dos banners."
        soon
      />

      <div className="rounded-[10px] border border-dashed border-line bg-bg-app p-4">
        <p className="text-ink-3 text-[13px]">
          {totalCategories === 0
            ? "Você ainda não tem categorias cadastradas."
            : `${totalCategories} ${totalCategories === 1 ? "categoria cadastrada" : "categorias cadastradas"}.`}
        </p>
        <p className="text-ink-4 mt-1 text-[12px]">
          Hoje todas aparecem na home pela ordem cadastrada. Toggle de
          visibilidade individual + reorder drag-and-drop entra quando o
          schema tiver `category.featured_on_home` + `category.home_position`.
        </p>
        <Link
          href="/admin/categorias"
          prefetch
          className="b3-btn b3-btn--sm mt-3"
        >
          Editar categorias <ChevronRightIcon size={13} aria-hidden />
        </Link>
      </div>
    </div>
  );
}

// ---------- Section: Produtos em destaque (mock-link — usa product.isFeatured) ----------

function FeaturedSection({ featuredCount }: { featuredCount: number }) {
  return (
    <div className="space-y-4">
      <SectionHeader
        title="Produtos em destaque"
        description={`Até 8 produtos aparecem em "Mais procurados" antes da listagem geral.`}
        soon
      />

      <div
        className="rounded-[10px] p-4"
        style={{
          background:
            featuredCount === 0 ? "var(--bg-app)" : "var(--mangos-cream-soft)",
          border: `1px ${featuredCount === 0 ? "dashed" : "solid"} ${
            featuredCount === 0 ? "var(--line)" : "var(--brand-line)"
          }`,
        }}
      >
        <p className="text-ink-1 text-[18px] font-bold tabular-nums">
          {featuredCount}{" "}
          <span className="text-ink-4 text-[12px] font-normal">
            {featuredCount === 1 ? "produto em destaque" : "produtos em destaque"}
          </span>
        </p>
        <p className="text-ink-4 mt-2 text-[12px] leading-relaxed">
          Marque/desmarque um produto como destaque editando-o em{" "}
          <Link
            href="/admin/produtos"
            prefetch
            className="text-mangos-green-800 underline"
          >
            Produtos
          </Link>{" "}
          → aba &quot;Loja online&quot; → toggle &quot;Produto em destaque&quot;. Multi-select
          aqui na Aparência entra com PP6 (Atributos) ou em onda dedicada.
        </p>
      </div>
    </div>
  );
}

// ---------- Section: Layout & grade (mock — sem schema) ----------

function LayoutSection() {
  return (
    <div className="space-y-4">
      <SectionHeader
        title="Layout & grade"
        description="Densidade dos cards, espaçamento, número de colunas no grid de produtos."
        soon
      />
      <MockSectionBody>
        <MockField label="Densidade do grid" placeholder="Confortável (default) · Compacta · Espaçada" />
        <MockField label="Colunas no mobile" placeholder="2 (default) · 1" />
        <MockField label="Colunas no desktop" placeholder="4 (default) · 3 · 5" />
        <MockField label="Espaçamento entre seções" placeholder="Médio (default) · Justo · Generoso" />
      </MockSectionBody>
    </div>
  );
}

// ---------- Section: Tipografia (mock — sem schema) ----------

function TypographySection() {
  return (
    <div className="space-y-4">
      <SectionHeader
        title="Tipografia"
        description="Família tipográfica dos títulos, body e preços."
        soon
      />
      <MockSectionBody>
        <MockField label="Fonte dos títulos" placeholder="Geist (default) · Instrument Serif · Inter" />
        <MockField label="Fonte do body" placeholder="Geist (default) · System" />
        <MockField label="Fonte dos preços/SKUs" placeholder="Geist Mono (default) · JetBrains Mono" />
        <MockField label="Escala base" placeholder="15px (default) · 14 · 16" />
      </MockSectionBody>
    </div>
  );
}

// ---------- Section: Sobre & contato (mock — sem schema "about" + endereço já em /admin/configuracoes) ----------

function AboutSection() {
  return (
    <div className="space-y-4">
      <SectionHeader
        title="Sobre & contato"
        description="Texto da página /sobre + dados de contato exibidos no footer da loja."
        soon
      />

      <div className="rounded-[10px] border border-dashed border-line bg-bg-app p-4">
        <p className="text-ink-3 text-[13px]">
          Endereço, WhatsApp, horário e CNPJ já moram em{" "}
          <Link
            href="/admin/configuracoes"
            prefetch
            className="text-mangos-green-800 underline"
          >
            Dados da loja
          </Link>
          .
        </p>
        <p className="text-ink-4 mt-1 text-[12px]">
          Texto livre da página &quot;Sobre&quot; entra com PP-x quando schema tiver
          `store.about_html` ou tabela `store_page`.
        </p>
      </div>

      <MockSectionBody>
        <MockField label="Texto da página /sobre" placeholder="Conte a história da sua loja, valores, atendimento…" textarea />
        <MockField label="Instagram da loja" placeholder="@minhaloja" />
        <MockField label="Facebook da loja" placeholder="facebook.com/minhaloja" />
      </MockSectionBody>
    </div>
  );
}

// ---------- Section: URL & SEO ----------

function SeoSection({ storeSlug }: { storeSlug: string }) {
  return (
    <div className="space-y-4">
      <SectionHeader
        title="URL & SEO"
        description="Slug da loja e metadados que aparecem em buscas e compartilhamento."
      />

      <div className="space-y-3">
        <div>
          <p className="text-ink-2 text-[12.5px] font-semibold">URL da loja</p>
          <div className="border-line bg-bg-app mt-1.5 flex items-center overflow-hidden rounded-md border">
            <span className="text-ink-4 border-line border-r px-3 py-2 font-mono text-[12px]">
              vitre.site/
            </span>
            <span className="text-ink-1 flex-1 px-3 py-2 font-mono text-[13px]">
              {storeSlug}
            </span>
          </div>
          <p className="text-ink-4 mt-1 text-[11.5px]">
            Pra trocar o slug, abra{" "}
            <Link
              href="/admin/configuracoes"
              prefetch
              className="text-mangos-green-800 underline"
            >
              Dados da loja
            </Link>
            . Atenção: troca quebra links antigos.
          </p>
        </div>
      </div>

      <MockSectionBody soon>
        <MockField label="Título no Google" placeholder="(usa o nome da loja se vazio)" />
        <MockField label="Descrição no Google" placeholder="160 caracteres ideais. Aparece nos resultados de busca." textarea />
        <MockField label="Imagem de compartilhamento (OG)" placeholder="1200×630 — aparece em WhatsApp / Facebook quando compartilham a loja" />
      </MockSectionBody>
    </div>
  );
}

// ---------- Helpers ----------

function SectionHeader({
  title,
  description,
  soon,
}: {
  title: string;
  description: string;
  soon?: boolean;
}) {
  return (
    <header className="flex items-start justify-between gap-3">
      <div>
        <h2 className="text-ink-1 text-[15px] font-bold tracking-tight">
          {title}
        </h2>
        <p className="text-ink-4 mt-1 text-[12.5px] leading-relaxed">
          {description}
        </p>
      </div>
      {soon ? (
        <span
          className="shrink-0 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
          style={{
            background: "var(--mangos-yellow-soft)",
            color: "var(--mangos-yellow-deep)",
          }}
        >
          Em breve
        </span>
      ) : null}
    </header>
  );
}

function MockSectionBody({
  children,
  soon,
}: {
  children: React.ReactNode;
  soon?: boolean;
}) {
  return (
    <div
      className={cn(
        "space-y-3 rounded-[10px] border border-dashed border-line p-4",
        "bg-bg-app",
      )}
      aria-disabled="true"
    >
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-ink-4">
        Pré-visualização do form
        {soon ? (
          <span className="b3-pill text-[9.5px]">backend pendente</span>
        ) : null}
      </div>
      <div className="space-y-3 opacity-65 pointer-events-none">{children}</div>
    </div>
  );
}

function MockField({
  label,
  placeholder,
  textarea,
}: {
  label: string;
  placeholder: string;
  textarea?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-ink-2 text-[12px] font-medium">{label}</label>
      {textarea ? (
        <textarea
          className="border-line bg-surface w-full rounded-md border px-3 py-2 text-[13px] text-ink-1 outline-none"
          placeholder={placeholder}
          rows={3}
          disabled
        />
      ) : (
        <input
          type="text"
          className="border-line bg-surface w-full rounded-md border px-3 py-2 text-[13px] text-ink-1 outline-none"
          placeholder={placeholder}
          disabled
        />
      )}
    </div>
  );
}
