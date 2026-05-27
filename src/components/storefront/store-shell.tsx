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
  // Inline style server-side com 2 camadas de tema:
  //
  // 1. `--primary` luminoso `#1B7A4F` SCOPADO ao storefront (ref Dribbble 1
  //    2026-05-27). Substitui o `--brand` escuro do admin pra CTAs do
  //    storefront ganharem presença premium (Add to cart, Finalizar pelo
  //    WhatsApp, bottom-nav active state). Admin continua com `--brand`
  //    `#174D44` original — apenas o subtree dentro deste wrapper recebe
  //    a versão mais vibrante.
  //
  // 2. `--brand-store` continua sendo a cor da MARCA da loja (ADR-0011).
  //    Escopo agora ainda mais reduzido: só o badge contador da sacola
  //    no bottom-nav — toque sutil de personalização sem dominar a UI.
  //    Bottom-nav active state foi migrado pra `--primary` pra dar
  //    identidade Mangos Pay consistente.
  //
  // shadcn Dialog/Sheet/Popover usam Portal — o conteúdo renderiza fora
  // deste div. Overlays que precisem da cor da loja devem re-injetar
  // `brandStyle` no SheetContent/PopoverContent.
  const brandStyle = {
    "--primary": "#1B7A4F",
    "--primary-foreground": "#FFFFFF",
    "--ring": "#1B7A4F",
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
