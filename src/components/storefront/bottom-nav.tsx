"use client";

/**
 * BottomNav — fiel ao canvas-referencia (canvas-v1).
 *
 * 3 variants espelham VTBottomNav do canvas:
 *
 *   "pill" (default) — pill atrás do ícone da aba ativa, capsule
 *   56×26px com `bg: color-mix(--brand-store 30%, white)`. Label
 *   embaixo. Sem shadow heavy, sem capsule outer — full-width na
 *   borda inferior.
 *
 *   "rule" — barra full-width com indicador top de 2px na cor da
 *   loja. Ícone fica em `text-brand-store` quando ativo. Label
 *   semibold quando ativo.
 *
 *   "glass" — capsule flutuante centralizada, bg-foreground com
 *   ícones em background. 5 ícones lado-a-lado com hit-area 44px.
 *   Item ativo recebe pill `bg-brand-store`.
 *
 * Tabs alinhadas ao ADR-0008: Início · Categorias · Favoritos · Buscar · Sacola.
 * Badge da sacola é o `cartCount` do useCart.
 *
 * Sem Framer Motion — canvas usa CSS transitions puras (.2s).
 */
import { Grid2x2, Heart, Home, Search, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useCategoriesSidebarTrigger } from "@/components/storefront/categories-sidebar";
import { useCart } from "@/hooks/use-cart";
import { cn } from "@/lib/utils";

export type BottomNavVariant = "pill" | "rule" | "glass";

export interface BottomNavProps {
  storeSlug: string;
  variant?: BottomNavVariant;
}

type TabId = "home" | "cat" | "fav" | "srch" | "bag";

/**
 * Discriminated union: aba ou navega via Link ("link") ou dispara uma ação
 * client-side ("action"). Categorias usa "action" pra abrir a sidebar
 * (não há rota `/categoria` raiz — drilldown vive no drawer).
 */
type TabConfig =
  | {
      id: TabId;
      kind: "link";
      icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
      label: string;
      href: string;
    }
  | {
      id: TabId;
      kind: "action";
      icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
      label: string;
      onClick: () => void;
    };

export function BottomNav({ storeSlug, variant = "pill" }: BottomNavProps) {
  const { count: cartCount, isHydrated } = useCart();
  const { open: openCategoriesSidebar } = useCategoriesSidebarTrigger();
  const pathname = usePathname();
  const baseHref = `/${storeSlug}`;

  // Badge pulsante quando produto é adicionado à sacola. Incrementa
  // `pulseSeed` a cada evento `Mangos Pay:cart-added` — usar como `key` no
  // span do badge remonta o nó e dispara `animate-in zoom-in-50` (CSS,
  // tw-animate-css). Esse é o feedback visual que substitui o drawer
  // auto-open (Onda 2 2026-05-26).
  const [pulseSeed, setPulseSeed] = useState(0);
  useEffect(() => {
    function handler() {
      setPulseSeed((s) => s + 1);
    }
    window.addEventListener("Mangos Pay:cart-added", handler);
    return () => window.removeEventListener("Mangos Pay:cart-added", handler);
  }, []);

  const tabs: TabConfig[] = useMemo(
    () => [
      { id: "home", kind: "link", icon: Home, label: "Início", href: baseHref },
      {
        id: "cat",
        kind: "action",
        icon: Grid2x2,
        label: "Categorias",
        onClick: openCategoriesSidebar,
      },
      {
        id: "fav",
        kind: "link",
        icon: Heart,
        label: "Favoritos",
        href: `${baseHref}/favoritos`,
      },
      {
        id: "srch",
        kind: "link",
        icon: Search,
        label: "Buscar",
        href: `${baseHref}/buscar`,
      },
      {
        id: "bag",
        kind: "link",
        icon: ShoppingBag,
        label: "Sacola",
        href: `${baseHref}/sacola`,
      },
    ],
    [baseHref, openCategoriesSidebar],
  );

  const activeTab = useMemo((): TabId => {
    if (pathname === baseHref || pathname === `${baseHref}/`) return "home";
    if (pathname.startsWith(`${baseHref}/sacola`)) return "bag";
    if (pathname.startsWith(`${baseHref}/favoritos`)) return "fav";
    if (pathname.startsWith(`${baseHref}/buscar`)) return "srch";
    // Quando dentro de `/categoria/<slug>`, mantém o destaque de "Categorias"
    // — o usuário acabou de selecionar via drawer e está navegando dentro.
    if (pathname.startsWith(`${baseHref}/categoria/`)) return "cat";
    return "home";
  }, [pathname, baseHref]);

  const cartBadge = isHydrated ? cartCount : 0;

  if (variant === "rule")
    return (
      <RuleNav
        tabs={tabs}
        activeTab={activeTab}
        cartBadge={cartBadge}
        pulseSeed={pulseSeed}
      />
    );
  if (variant === "glass")
    return (
      <GlassNav
        tabs={tabs}
        activeTab={activeTab}
        cartBadge={cartBadge}
        pulseSeed={pulseSeed}
      />
    );
  return (
    <PillNav
      tabs={tabs}
      activeTab={activeTab}
      cartBadge={cartBadge}
      pulseSeed={pulseSeed}
    />
  );
}

interface VariantProps {
  tabs: TabConfig[];
  activeTab: TabId;
  cartBadge: number;
  /** Muda a cada add-to-cart — usar como key no badge pra disparar
   *  animação CSS de pulse. */
  pulseSeed: number;
}

/* ─── pill (canvas default) ───────────────────────────────────────────
   Borda superior, bg-background, padding-top 6, padding-bottom 18 +
   safe-area. Item ativo = capsule 56×26 com brand-store em color-mix
   30% white por trás do ícone, label foreground semibold. Inativo =
   ícone gray-500, label gray-500 medium.
*/
function PillNav({ tabs, activeTab, cartBadge, pulseSeed }: VariantProps) {
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-border bg-background pt-1.5 lg:hidden"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 18px)" }}
    >
      {tabs.map((tab) => (
        <PillItem
          key={tab.id}
          tab={tab}
          isActive={activeTab === tab.id}
          badge={tab.id === "bag" ? cartBadge : 0}
          pulseSeed={tab.id === "bag" ? pulseSeed : 0}
        />
      ))}
    </nav>
  );
}

function PillItem({
  tab,
  isActive,
  badge,
  pulseSeed,
}: {
  tab: TabConfig;
  isActive: boolean;
  badge: number;
  pulseSeed: number;
}) {
  const Icon = tab.icon;
  const itemClassName =
    "flex flex-col items-center gap-0.5 rounded-md px-2.5 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring";

  const content = (
    <>
      <span
        className={cn(
          "relative inline-flex h-[26px] w-14 items-center justify-center rounded-full transition-colors duration-200",
          isActive
            ? "bg-[color-mix(in_oklch,var(--brand-store)_30%,white)] text-brand-store"
            : "text-gray-500",
        )}
      >
        <Icon className="size-5" strokeWidth={1.6} />
        {badge > 0 && (
          <span
            key={pulseSeed}
            aria-hidden
            className="absolute -top-0.5 right-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-store px-1 text-[10px] font-semibold text-brand-store-foreground animate-in zoom-in-50 duration-300"
          >
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </span>
      <span
        className={cn(
          "text-[10.5px] tracking-[-0.1px]",
          isActive ? "font-semibold text-foreground" : "font-medium text-gray-500",
        )}
      >
        {tab.label}
      </span>
    </>
  );

  if (tab.kind === "action") {
    return (
      <button
        type="button"
        onClick={tab.onClick}
        aria-current={isActive ? "page" : undefined}
        aria-label={tab.label}
        className={itemClassName}
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      href={tab.href}
      prefetch={false}
      aria-current={isActive ? "page" : undefined}
      aria-label={tab.label}
      className={itemClassName}
    >
      {content}
    </Link>
  );
}

/* ─── rule (canvas) ───────────────────────────────────────────────────
   Indicador top: rule 28×2px na cor da loja (escala de 0 → 28 quando
   ativa). Ícone + label embaixo. Padding 8px top / 4px bottom.
*/
function RuleNav({ tabs, activeTab, cartBadge, pulseSeed }: VariantProps) {
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-border bg-background pt-2 pb-1 lg:hidden"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 4px)" }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        const badge = tab.id === "bag" ? cartBadge : 0;
        const seed = tab.id === "bag" ? pulseSeed : 0;
        const itemClass =
          "relative flex flex-1 flex-col items-center justify-center gap-1 px-2.5 outline-none focus-visible:bg-accent";
        const inner = (
          <>
            <span
              aria-hidden
              className={cn(
                "absolute top-0 left-1/2 h-0.5 -translate-x-1/2 rounded-full bg-brand-store transition-all duration-200",
                isActive ? "w-7" : "w-0",
              )}
            />
            <span
              className={cn(
                "relative",
                isActive ? "text-brand-store" : "text-gray-500",
              )}
            >
              <Icon className="size-5" strokeWidth={1.6} />
              {badge > 0 && (
                <span
                  key={seed}
                  aria-hidden
                  className="absolute -top-[3px] -right-[7px] inline-flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-brand-store px-[3px] text-[9.5px] font-semibold text-brand-store-foreground animate-in zoom-in-50 duration-300"
                >
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </span>
            <span
              className={cn(
                "text-[10px]",
                isActive ? "font-semibold text-foreground" : "font-medium text-gray-500",
              )}
            >
              {tab.label}
            </span>
          </>
        );

        if (tab.kind === "action") {
          return (
            <button
              key={tab.id}
              type="button"
              onClick={tab.onClick}
              aria-current={isActive ? "page" : undefined}
              aria-label={tab.label}
              className={itemClass}
            >
              {inner}
            </button>
          );
        }

        return (
          <Link
            key={tab.id}
            href={tab.href}
            prefetch={false}
            aria-current={isActive ? "page" : undefined}
            aria-label={tab.label}
            className={itemClass}
          >
            {inner}
          </Link>
        );
      })}
    </nav>
  );
}

/* ─── glass (canvas) ──────────────────────────────────────────────────
   Capsule flutuante autônoma centralizada, bg-foreground, 5 ícones em
   background. Aba ativa = pill bg-brand-store sobre o ícone. Sem
   labels (só ícones). Hit-area 44px.
*/
function GlassNav({ tabs, activeTab, cartBadge, pulseSeed }: VariantProps) {
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center lg:hidden"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
    >
      <div className="flex items-center gap-1 rounded-full bg-foreground px-2 py-2 shadow-xl">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          const badge = tab.id === "bag" ? cartBadge : 0;
          const seed = tab.id === "bag" ? pulseSeed : 0;
          const itemClass = cn(
            "relative grid size-11 place-items-center rounded-full outline-none transition-colors",
            "focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-foreground",
            isActive ? "bg-brand-store" : "hover:bg-white/10",
          );
          const inner = (
            <>
              <Icon
                className={cn(
                  "size-5",
                  isActive ? "text-brand-store-foreground" : "text-background",
                )}
                strokeWidth={1.6}
              />
              {badge > 0 && !isActive && (
                <span
                  key={seed}
                  aria-hidden
                  className="absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-store px-1 text-[10px] font-semibold text-brand-store-foreground ring-2 ring-foreground animate-in zoom-in-50 duration-300"
                >
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </>
          );

          if (tab.kind === "action") {
            return (
              <button
                key={tab.id}
                type="button"
                onClick={tab.onClick}
                aria-current={isActive ? "page" : undefined}
                aria-label={tab.label}
                className={itemClass}
              >
                {inner}
              </button>
            );
          }

          return (
            <Link
              key={tab.id}
              href={tab.href}
              prefetch={false}
              aria-current={isActive ? "page" : undefined}
              aria-label={tab.label}
              className={itemClass}
            >
              {inner}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
