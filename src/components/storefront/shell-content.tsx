"use client";

/**
 * Shell content wrapper - detecta rota atual e controla visibilidade
 * do header e footer baseado na página.
 *
 * - Página de produto: esconde header (usa header próprio) e footer
 * - Outras páginas: mostra header e footer normalmente
 */
import { usePathname } from "next/navigation";
import type { CSSProperties } from "react";

import { BottomNav, type BottomNavVariant } from "@/components/storefront/bottom-nav";
import { CategoriesSidebar } from "@/components/storefront/categories-sidebar";
import { StoreFooter } from "@/components/storefront/store-footer";
import { StoreHeader } from "@/components/storefront/store-header";
import type { Store } from "@/db/schema";
import type { CategoryNode } from "@/lib/storefront/categories-loader";

export interface ShellContentProps {
  store: Store;
  categoryTree: CategoryNode[];
  brandStyle: CSSProperties;
  children: React.ReactNode;
}

export function ShellContent({
  store,
  categoryTree,
  brandStyle,
  children,
}: ShellContentProps) {
  const pathname = usePathname();

  // Detecta se está na página de produto
  const isProductPage = pathname.includes("/produto/");

  // Detecta se está na página de busca
  const isSearchPage = pathname.endsWith("/buscar");

  // Detecta se está na página de "Sobre" — é onde mostra o footer informativo
  // da loja (substituiu /perfil, que violava ADR-0008 e linkava pra rotas
  // inexistentes — auditoria 2026-05-10).
  const isAboutPage = pathname.endsWith("/sobre");

  // Canvas-v1: sacola e sucesso são telas fullscreen com header próprio
  // (sticky-title) e SEM bottom-nav. Decisão team-memory 2026-05-09.
  const isSacolaPage = pathname.endsWith("/sacola");
  const isSucessoPage = pathname.endsWith("/sucesso");

  // Categoria também tem header próprio (variant="category") + chips strip
  // edge-to-edge — controla o próprio padding. Bottom-nav permanece (canvas).
  const isCategoriaPage = pathname.includes("/categoria/");

  // Header global do shell esconde em: produto (header próprio flutuante),
  // busca (header próprio com search bar), sacola (sticky-title da page),
  // sucesso (sem header, layout centralizado), categoria (variant="category").
  const hideShellHeader =
    isProductPage ||
    isSearchPage ||
    isSacolaPage ||
    isSucessoPage ||
    isCategoriaPage;

  // Bottom-nav esconde em: produto (PDP fullscreen exceto pelo CTA sticky
  // — canvas mantém, mas hoje shell já escondia), sacola (canvas omite),
  // sucesso (canvas omite — fullscreen com 2 CTAs no rodapé).
  const hideBottomNav = isProductPage || isSacolaPage || isSucessoPage;

  // Padding do main: páginas com layout próprio (sacola/sucesso/categoria)
  // não precisam do padding genérico do shell — elas controlam o próprio.
  const mainClass =
    isSacolaPage || isSucessoPage || isCategoriaPage
      ? "mx-auto w-full max-w-screen-xl flex-1"
      : "mx-auto w-full max-w-screen-xl flex-1 px-4 pb-24 pt-4 lg:pb-12 lg:pt-6";

  return (
    <CategoriesSidebar
      store={store}
      tree={categoryTree}
      brandStyle={brandStyle}
    >
      {!hideShellHeader && <StoreHeader store={store} />}

      <main id="main" className={mainClass}>
        {children}
      </main>

      {/* Footer informativo da loja — só na página /sobre. */}
      {isAboutPage && <StoreFooter store={store} />}

      {/* Bottom nav - variant lê do store (canvas-v1): pill | rule | glass. */}
      {!hideBottomNav && (
        <BottomNav
          storeSlug={store.slug}
          variant={store.bottomNavStyle as BottomNavVariant}
        />
      )}
    </CategoriesSidebar>
  );
}
