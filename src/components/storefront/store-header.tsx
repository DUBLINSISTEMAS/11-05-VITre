"use client";

/**
 * StoreHeader — fiel ao canvas-referencia (VTAppBar).
 *
 * 4 variants pixel-a-pixel ao canvas-extracted/_vitre-storefront.jsx:
 *
 *   home          — VTHome (linha ~95-115).      Avatar + nome + handle + buscar.
 *   pdp-floating  — VTPDP (linha ~249-252).      Absolute sobre galeria, 36×36 round + blur.
 *   sticky-title  — VTSacola (linha ~374-378).   Sticky bg-bg + back + title + counter.
 *   category      — VTCategoria (linha ~524-532). Sticky bg-bg + back 32 + kicker/title + counter.
 *
 * Padding-top 54px do canvas é compensação de status-bar iOS — no web
 * usamos valores menores direto. Botões "voltar" usam router.back() com
 * fallback opcional via prop `backHref` (SSR-safe pra cold-loads).
 */
import { ArrowLeft, Search, ShoppingBag, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useCategoriesSidebarTrigger } from "@/components/storefront/categories-sidebar";
import { useSacolaDrawerTrigger } from "@/components/storefront/sacola-drawer";
import type { Store } from "@/db/schema";
import { useCart } from "@/hooks/use-cart";

type HomeProps = {
  variant?: "home";
  store: Store;
};

type PdpFloatingProps = {
  variant: "pdp-floating";
  store: Store;
  /** Fallback se window.history vazio. Default: /{storeSlug}. */
  backHref?: string;
};

type StickyTitleProps = {
  variant: "sticky-title";
  store: Store;
  title: string;
  /**
   * Subtítulo opcional em 11.5px gray abaixo do título. Onda 1 — usado em
   * /sacola pra preservar identidade da loja ("Sua sacola · Joias Dublin")
   * sem comer espaço horizontal. Quando ausente, o título mantém presença
   * sozinho (caso /sucesso "Resumo do pedido").
   */
  subtitle?: string;
  /** Ex: "2 ITENS". */
  counter?: string;
  backHref?: string;
};

type CategoryProps = {
  variant: "category";
  store: Store;
  /** Ex: "CATEGORIA". */
  kicker?: string;
  title: string;
  /** Ex: "14 PEÇAS". */
  counter?: string;
  backHref?: string;
};

export type StoreHeaderProps =
  | HomeProps
  | PdpFloatingProps
  | StickyTitleProps
  | CategoryProps;

export function StoreHeader(props: StoreHeaderProps) {
  const variant = props.variant ?? "home";
  if (variant === "home") return <HomeVariant store={props.store} />;
  if (variant === "pdp-floating") return <PdpFloatingVariant {...(props as PdpFloatingProps)} />;
  if (variant === "sticky-title") return <StickyTitleVariant {...(props as StickyTitleProps)} />;
  return <CategoryVariant {...(props as CategoryProps)} />;
}

/* ─────────────────────────── home ───────────────────────────
   Redesenho 2026-05-27: linha única — marca Mangos Pay (manga) +
   barra de busca (flex-1) + carrinho. Sem saudação, sem logo da
   loja (storefront é a vitrine; quem assina o produto é a Mangos
   Pay). Layout caber em viewport 360px sem quebra.
*/

function HomeVariant({ store }: { store: Store }) {
  const baseHref = `/${store.slug}`;

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-screen-xl items-center gap-2.5 px-4 py-3">
        <CategoriesButton />

        {/* Barra de busca — trigger visual (renderiza como Link, não
            input, pra evitar duplicação com /buscar). flex-1 + min-w-0
            garante encolhimento até caber em 360px sem empurrar o cart. */}
        <Link
          href={`${baseHref}/buscar`}
          prefetch={false}
          aria-label="Buscar produtos"
          className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full bg-muted/80 px-3.5 text-muted-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Search className="size-[17px] shrink-0" strokeWidth={1.8} aria-hidden />
          <span className="truncate text-[13px] font-medium tracking-[-0.1px]">
            Buscar produtos
          </span>
        </Link>

        <SacolaButton variant="solid" />
      </div>
    </header>
  );
}

/**
 * Botão "categorias" no slot esquerdo do header. Abre o Sheet
 * `CategoriesSidebar` que envolve o ShellContent (provider já está
 * acima na árvore via StoreShell). Usa o mesmo ícone que aparece ao
 * lado da busca em /buscar (SlidersHorizontal) pra consistência visual.
 */
function CategoriesButton() {
  const sidebar = useCategoriesSidebarTrigger();
  return (
    <button
      type="button"
      onClick={sidebar.open}
      aria-label="Abrir categorias"
      className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground outline-none transition-colors hover:bg-gray-200 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <SlidersHorizontal className="size-5" strokeWidth={1.8} aria-hidden />
    </button>
  );
}

/**
 * Botão sticky de sacola no header — atalho rápido sem precisar rolar
 * até o bottom-nav. Funciona em mobile e desktop. Click abre o drawer
 * de preview da sacola.
 *
 * Onda 2 (2026-05-27): `variant` controla o estilo visual.
 *   - "solid" (default): bg-muted opaco dentro de header sólido (home).
 *   - "floating": bg-white/85 backdrop-blur pra sobrepor imagem da
 *     galeria no PDP (consistente com BackButton floating + Search).
 *
 * Justificativa: cliente no PDP que adiciona e perde o toast (2s) tinha
 * que voltar pra home pra ver bottom-nav e acessar sacola. Agora a sacola
 * é alcançável de qualquer ponto do PDP em 1 toque.
 */
function SacolaButton({ variant = "solid" }: { variant?: "solid" | "floating" }) {
  const drawer = useSacolaDrawerTrigger();
  const { count, isHydrated } = useCart();

  const visualClass =
    variant === "floating"
      ? "bg-white/85 text-foreground backdrop-blur-md hover:bg-white"
      : "bg-muted text-foreground hover:bg-gray-200";

  return (
    <button
      type="button"
      onClick={drawer.open}
      aria-label={
        count > 0 ? `Sacola com ${count} ${count === 1 ? "item" : "itens"}` : "Sacola"
      }
      className={`relative inline-flex size-9 shrink-0 items-center justify-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${visualClass}`}
    >
      <ShoppingBag className="size-5" strokeWidth={1.6} />
      {isHydrated && count > 0 ? (
        <span
          aria-hidden
          className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 font-mono text-[9px] font-semibold leading-none text-background"
        >
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </button>
  );
}

/* ───────────────────── pdp-floating ─────────────────────
   Onda 2 (2026-05-27): além de Back + Search, ganha SacolaButton
   floating. Justificativa: cliente que adiciona produto e perde
   o toast (2s) precisa de caminho de 1 toque pra sacola sem voltar
   pra home. Toast some, sacola fica acessível.
*/

function PdpFloatingVariant({ store, backHref }: PdpFloatingProps) {
  const fallback = backHref ?? `/${store.slug}`;

  return (
    <div className="pointer-events-none absolute inset-x-3 top-3 z-30 flex items-center">
      <BackButton size={36} fallback={fallback} className="pointer-events-auto" floating />
      <div className="pointer-events-auto ml-auto flex items-center gap-2">
        <Link
          href={`/${store.slug}/buscar`}
          prefetch={false}
          aria-label="Buscar produtos"
          className="inline-flex size-9 items-center justify-center rounded-full border-0 bg-white/85 text-foreground backdrop-blur-md outline-none transition-colors hover:bg-white focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Search className="size-5" strokeWidth={1.6} />
        </Link>
        <SacolaButton variant="floating" />
      </div>
    </div>
  );
}

/* ───────────────────── sticky-title ───────────────────── */

function StickyTitleVariant({ store, title, subtitle, counter, backHref }: StickyTitleProps) {
  const fallback = backHref ?? `/${store.slug}`;

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background">
      <div className="mx-auto flex w-full max-w-screen-xl items-center gap-2.5 px-4 py-3">
        <BackButton size={36} fallback={fallback} />
        <div className="min-w-0 flex-1">
          {/* Onda 1 (2026-05-27): título cai de 18px pra 17px pra abrir
              espaço pro subtítulo opcional logo abaixo. Sem subtítulo,
              a diferença de 1px é imperceptível (caso /sucesso "Resumo
              do pedido"). Com subtítulo, hierarquia clara: título forte
              + contexto da loja em cinza fininho. */}
          <span className="block truncate text-[17px] font-semibold leading-[1.15] tracking-[-0.4px] text-foreground">
            {title}
          </span>
          {subtitle ? (
            <span className="mt-px block truncate text-[11.5px] font-medium text-muted-foreground">
              {subtitle}
            </span>
          ) : null}
        </div>
        {counter ? (
          <span className="ml-auto shrink-0 font-mono text-[10px] uppercase tracking-[0.5px] text-gray-500">
            {counter}
          </span>
        ) : null}
      </div>
    </header>
  );
}

/* ─────────────────────── category ─────────────────────── */

function CategoryVariant({ store, kicker, title, counter, backHref }: CategoryProps) {
  const fallback = backHref ?? `/${store.slug}`;

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background">
      <div className="mx-auto flex w-full max-w-screen-xl items-center gap-2.5 px-4 pt-3 pb-2.5">
        <BackButton size={32} fallback={fallback} />
        <span className="min-w-0 flex-1">
          {kicker ? (
            <span className="block font-mono text-[9.5px] uppercase leading-none tracking-[0.5px] text-gray-500">
              {kicker}
            </span>
          ) : null}
          <span className="mt-1 block truncate text-[18px] font-semibold leading-[1.1] tracking-[-0.4px] text-foreground">
            {title}
          </span>
        </span>
        {counter ? (
          <span className="ml-auto shrink-0 font-mono text-[10px] uppercase tracking-[0.5px] text-gray-500">
            {counter}
          </span>
        ) : null}
      </div>
    </header>
  );
}

/* ─────────────────────── back button ─────────────────────── */

function BackButton({
  size,
  fallback,
  className = "",
  floating = false,
}: {
  size: 32 | 36;
  fallback: string;
  className?: string;
  floating?: boolean;
}) {
  const router = useRouter();
  const sizeClass = size === 36 ? "size-9" : "size-8";

  // Floating variant (PDP): white blur background sobre imagem.
  // Default: sólido bg-muted dentro de header opaco.
  const visualClass = floating
    ? "bg-white/85 text-foreground backdrop-blur-md hover:bg-white"
    : "bg-muted text-foreground hover:bg-gray-200";

  function onClick() {
    // Tenta voltar; cai no fallback se não houver histórico (cold-load,
    // share link). `window.history.length > 1` não é 100% confiável (sempre
    // ≥1) mas Next mantém referrer interno suficiente pra UX comum.
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(fallback);
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Voltar"
      className={`inline-flex ${sizeClass} shrink-0 items-center justify-center rounded-full border-0 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${visualClass} ${className}`}
    >
      <ArrowLeft className={size === 36 ? "size-5" : "size-4"} strokeWidth={1.8} />
    </button>
  );
}
