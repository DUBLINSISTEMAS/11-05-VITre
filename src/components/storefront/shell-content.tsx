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
import { DesktopHeader } from "@/components/storefront/desktop-header";
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

  // Footer informativo (nome loja + WhatsApp + Instagram + endereço + sobre +
  // contato). Aparece em todas as páginas EXCETO:
  //   - produto: PDP tem CTA sticky "Comprar pelo WhatsApp" + bloco "Tire
  //     dúvidas no WhatsApp", footer seria ruído competindo com a conversão.
  //   - sacola / sucesso: telas fullscreen focadas (canvas-v1).
  // Resto (home, busca, categoria, coleção, destaques, favoritos, sobre,
  // contato) ganha o footer pra fechar a navegação com identidade da loja
  // e canal de contato sempre visível.
  const hideFooter = isProductPage || isSacolaPage || isSucessoPage;

  // Padding do main: páginas com layout próprio (sacola/sucesso/categoria/produto)
  // não precisam do padding genérico do shell — elas controlam o próprio.
  //
  // PDP entra aqui (2026-05-26): a galeria full-bleed precisa encostar no
  // topo do viewport (sem `pt-4` criando margem branca acima da imagem) e
  // a CTA sticky controla o `pb-*` próprio. Antes, o `pt-4`/`lg:pt-6` do
  // shell deixava 16-24px de fundo entre o topo da tela e a foto do
  // produto, dando aspecto de "site genérico" em vez de app.
  //
  // PDP DESKTOP (Onda 6): em desktop existe DesktopHeader sticky, e o
  // layout 2-col da PDP precisa de respiração do topo — não pode encostar.
  // `lg:pt-8` (32px) volta a respiração desktop sem afetar mobile (que
  // segue full-bleed).
  const hasOwnLayout =
    isSacolaPage || isSucessoPage || isCategoriaPage || isProductPage;
  const mainClass = hasOwnLayout
    ? isProductPage
      ? "mx-auto w-full max-w-screen-xl flex-1 lg:pt-8"
      : "mx-auto w-full max-w-screen-xl flex-1"
    : "mx-auto w-full max-w-screen-xl flex-1 px-4 pb-24 pt-4 lg:pb-12 lg:pt-6";

  return (
    <CategoriesSidebar
      store={store}
      tree={categoryTree}
      brandStyle={brandStyle}
    >
      {/* Desktop header: sempre visível em ≥lg (Onda 6). */}
      <DesktopHeader store={store} categories={categoryTree} />

      {/* Mobile header: respeita logic de hideShellHeader original. */}
      <div className="lg:hidden">
        {!hideShellHeader && <StoreHeader store={store} />}
      </div>

      <main id="main" className={mainClass}>
        {children}
      </main>

      {/* Footer informativo da loja — global, ver hideFooter. */}
      {!hideFooter && <StoreFooter store={store} />}

      {/* Bottom nav: lg:hidden (desktop usa ícones no DesktopHeader). */}
      {!hideBottomNav && (
        <div className="lg:hidden">
          <BottomNav
            storeSlug={store.slug}
            variant={store.bottomNavStyle as BottomNavVariant}
          />
        </div>
      )}
    </CategoriesSidebar>
  );
}
