/**
 * Shell do storefront: header + main + bottom-nav + footer.
 *
 * Server Component (RSC). Controla a "moldura" da loja inteira e injeta
 * a cor da loja como `--brand-store` no wrapping div via inline style
 * (ADR-0011). Escopo restrito: bottom-nav (pill ativa, ícone, label,
 * badge) + badge contador da sacola no header. Tudo o mais (CTAs, promo,
 * focus rings, links, skip link) usa `--primary` Mangos Pay fixo.
 *
 * Por que CSS var server-side e não BrandProvider client?
 *   - Zero hydration mismatch (cor pintada já no HTML inicial).
 *   - Lighthouse-friendly: sem JS de tema rodando no client.
 *   - Não polui o admin (brand stays scoped a este wrapper).
 *
 * Sidebar de categorias: provider client envolve header + bottom-nav
 * pra que ambos compartilhem o mesmo Sheet (estado único). Trigger é
 * via hook `useCategoriesSidebar()`.
 */
import type { CSSProperties } from "react";

import { SacolaDrawer } from "@/components/storefront/sacola-drawer";
import { ShellContent } from "@/components/storefront/shell-content";
import { ToastProvider } from "@/components/storefront/toast";
import type { Store } from "@/db/schema";
import { CartProvider } from "@/hooks/use-cart";
import { FavoritesProvider } from "@/hooks/use-favorites";
import type { CategoryNode } from "@/lib/storefront/categories-loader";

export interface StoreShellProps {
  store: Store;
  categoryTree: CategoryNode[];
  children: React.ReactNode;
}

export function StoreShell({ store, categoryTree, children }: StoreShellProps) {
  // Inline style server-side: injeta a cor da loja como `--brand-store`
  // no escopo deste wrapper. Escopo restrito a bottom-nav e badge da
  // sacola (ADR-0011) — não afeta CTAs, promo, focus rings nem links.
  //
  // IMPORTANTE: shadcn Dialog/Sheet/Popover usam Portal — o conteúdo é
  // renderizado em document.body, FORA deste div. Componentes que abrem
  // overlays e precisam da cor da loja devem re-injetar `brandStyle` no
  // SheetContent/PopoverContent. Hoje os overlays não consomem brand —
  // mantemos o style propagado preventivamente.
  const brandStyle = {
    "--brand-store": store.primaryColor,
  } as CSSProperties;

  return (
    <div
      className="bg-background text-foreground relative flex min-h-dvh flex-col"
      style={brandStyle}
    >
      {/* Skip link WCAG 2.4.1 — visível só ao focar via teclado. */}
      <a
        href="#main"
        className="bg-primary text-primary-foreground sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-md focus:px-3 focus:py-2 focus:text-sm focus:font-medium"
      >
        Pular para o conteúdo
      </a>

      <CartProvider storeSlug={store.slug}>
        <FavoritesProvider storeSlug={store.slug}>
          <ToastProvider>
            <SacolaDrawer storeSlug={store.slug} brandStyle={brandStyle}>
              <ShellContent
                store={store}
                categoryTree={categoryTree}
                brandStyle={brandStyle}
              >
                {children}
              </ShellContent>
            </SacolaDrawer>
          </ToastProvider>
        </FavoritesProvider>
      </CartProvider>
    </div>
  );
}
