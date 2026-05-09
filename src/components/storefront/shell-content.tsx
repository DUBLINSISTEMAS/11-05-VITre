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

import { BottomNav } from "@/components/storefront/bottom-nav";
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
  
  // Detecta se está na página de perfil (única que deve mostrar footer)
  const isProfilePage = pathname.endsWith("/perfil");

  return (
    <CategoriesSidebar
      store={store}
      tree={categoryTree}
      brandStyle={brandStyle}
    >
      {/* Header - esconde na página de produto e busca */}
      {!isProductPage && !isSearchPage && <StoreHeader store={store} />}

      <main
        id="main"
        className="mx-auto w-full max-w-screen-xl flex-1 px-4 pb-24 pt-4 lg:pb-12 lg:pt-6"
      >
        {children}
      </main>

      {/* Footer - mostra apenas na página de perfil */}
      {isProfilePage && <StoreFooter store={store} />}

      {/* Bottom nav - esconde na página de produto */}
      {!isProductPage && <BottomNav storeSlug={store.slug} />}
    </CategoriesSidebar>
  );
}
