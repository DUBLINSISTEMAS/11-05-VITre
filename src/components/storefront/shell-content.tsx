"use client";

/**
 * Shell content wrapper - detecta rota atual e controla visibilidade
 * do header e footer baseado na página.
 *
 * - Página de produto: esconde header (usa header próprio) e footer
 * - Outras páginas: mostra header e footer normalmente
 *
 * ─────────────────────────────────────────────────────────────────────
 * Tabela canônica de safe-zones (Onda 5 — 2026-05-27 análise sênior):
 *
 * Cada contexto reserva `pb-*` mobile baseado no que existe FIXED bottom.
 * Estas são as referências autoritativas pra não voltar a aparecer
 * "último item coberto pelo CTA" em revisões futuras.
 *
 *   pb-24 (96px)  = bottom-nav (~76) + safe-area inset (~14-20)
 *                   Aplicado em: páginas de listagem sem mini-cart.
 *
 *   pb-44 (176px) = mini-cart (h-14 + gap) + bottom-nav + safe-area
 *                   Aplicado em: páginas de listagem COM mini-cart
 *                   (categoria, /buscar, /destaques, /colecao/*).
 *                   Sem isso, último card fica coberto pelo overlay duplo.
 *
 *   pb-28 (112px) = sticky CTA h-11 + 2nd CTA h-10 + gap + safe-area
 *                   Aplicado em: PDP (product-detail-view.tsx mobile).
 *                   Não tem bottom-nav (PDP esconde via hideBottomNav).
 *
 *   pb-32 (128px) = sticky CTA h-12 + safe-area
 *                   Aplicado em: /sacola (checkout-panel.tsx form).
 *                   Bottom-nav escondido (canvas-v1).
 *
 *   pb-32 (128px) = SuccessCtas (h-46 + h-46 + gap) + safe-area
 *                   Aplicado em: /sucesso. Sem bottom-nav.
 *
 * Cleanup pra CSS var --sf-bottom-pb (cleanup arquitetural) deferred —
 * envolve refator de 5+ páginas com risco vs benefício ruim (não-user-facing).
 * Documentado aqui ao invés de centralizado.
 * ─────────────────────────────────────────────────────────────────────
 */
import { usePathname } from "next/navigation";
import type { CSSProperties } from "react";

import { BottomNav, type BottomNavVariant } from "@/components/storefront/bottom-nav";
import { CategoriesSidebar } from "@/components/storefront/categories-sidebar";
import { DesktopHeader } from "@/components/storefront/desktop-header";
import { MiniCartBar } from "@/components/storefront/mini-cart-bar";
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

  // Mini-cart bar — atalho "modo compra" em páginas de listagem. Aparece
  // SÓ quando o cliente tem 1+ item na sacola (controle interno do
  // componente via useCart.count). Mobile only. Ref Dribbble 1.
  const isListingPage =
    isCategoriaPage ||
    isSearchPage ||
    pathname.endsWith("/destaques") ||
    pathname.includes("/colecao/");
  const showMiniCart = isListingPage && !hideBottomNav;

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
  // Páginas de listagem com mini-cart visível precisam de pb extra pra
  // o último card não ficar embaixo do mini-cart (h-14) empilhado
  // ACIMA do bottom-nav (~76px). pb-44 (176px) cobre os dois com folga.
  // Quando carrinho vazio, mini-cart some — mas mantém pb-44 pra evitar
  // jank visual no momento de adicionar item (layout não pula).
  const listingPbClass = showMiniCart ? "pb-44 lg:pb-12" : "pb-24 lg:pb-12";
  const mainClass = hasOwnLayout
    ? isProductPage
      ? "mx-auto w-full max-w-screen-xl flex-1 lg:pt-8"
      : "mx-auto w-full max-w-screen-xl flex-1"
    : `mx-auto w-full max-w-screen-xl flex-1 px-4 pt-4 lg:pt-6 ${listingPbClass}`;

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

      {/* Mini-cart bar (modo compra): renderiza ACIMA do bottom-nav.
          Componente decide se mostra baseado em useCart().count > 0. */}
      {showMiniCart && <MiniCartBar storeSlug={store.slug} />}

      {/* Bottom nav: lg:hidden (desktop usa ícones no DesktopHeader). */}
      {!hideBottomNav && (
        <div className="lg:hidden">
          <BottomNav
            store={store}
            variant={store.bottomNavStyle as BottomNavVariant}
          />
        </div>
      )}
    </CategoriesSidebar>
  );
}
