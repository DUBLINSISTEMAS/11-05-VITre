"use client";

/**
 * BottomNav — 5 tabs alinhadas à referência Dribbble 1 (2026-05-27):
 *
 *   Início · Buscar · Sacola · Favoritos · Mais
 *
 * "Mais" abre um bottom-sheet (MoreSheet) com Sobre, Contato e WhatsApp
 * direto da loja. Categorias saiu da bottom-nav: o CategoryStrip da
 * home + drilldown no header já cobrem (decisão founder review).
 *
 * Cores: active state usa `--primary` (verde Mangos Pay storefront —
 * scopado pelo StoreShell). Badge contador da sacola mantém
 * `--brand-store` (toque sutil de personalização por loja).
 *
 * 3 variants espelham VTBottomNav do canvas:
 *
 *   "pill" (default) — pill atrás do ícone da aba ativa, capsule
 *   56×26px. Label embaixo. Estilo ref Dribbble 1.
 *
 *   "rule" — barra full-width com indicador top de 2px. Ícone tinge
 *   em `text-primary` quando ativo.
 *
 *   "glass" — capsule flutuante centralizada, bg-foreground com
 *   ícones em background. Sem labels (só ícones).
 *
 * Sem Framer Motion — CSS transitions puras + tw-animate-css pra
 * o pulse do badge.
 */
import {
  Heart,
  Home,
  MoreHorizontal,
  Search,
  ShoppingBag,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { MoreSheet } from "@/components/storefront/more-sheet";
import type { Store } from "@/db/schema";
import { useCart } from "@/hooks/use-cart";
import { cn } from "@/lib/utils";

export type BottomNavVariant = "pill" | "rule" | "glass";

export interface BottomNavProps {
  store: Store;
  variant?: BottomNavVariant;
}

type TabId = "home" | "srch" | "bag" | "fav" | "more";

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

export function BottomNav({ store, variant = "pill" }: BottomNavProps) {
  const { count: cartCount, isHydrated } = useCart();
  const pathname = usePathname();
  const baseHref = `/${store.slug}`;

  // Bottom-sheet "Mais" — abre via tab.
  const [moreOpen, setMoreOpen] = useState(false);

  // Badge pulsante quando produto é adicionado à sacola. Incrementa
  // `pulseSeed` a cada `Mangos Pay:cart-added` — usar como `key` no span do
  // badge remonta o nó e dispara `animate-in zoom-in-50` (CSS).
  const [pulseSeed, setPulseSeed] = useState(0);
  useEffect(() => {
    function handler() {
      setPulseSeed((s) => s + 1);
    }
    window.addEventListener("Mangos Pay:cart-added", handler);
    return () => window.removeEventListener("Mangos Pay:cart-added", handler);
  }, []);

  // Ordem das tabs alinhada à ref Dribbble 1: Home / Search / Bag (centro
  // de gravidade) / Favs / More. Sacola no meio dá destaque ao item de
  // ação principal — heurística Fitts (alvo grande no caminho do polegar).
  const tabs: TabConfig[] = useMemo(
    () => [
      {
        id: "home",
        kind: "link",
        icon: Home,
        label: "Início",
        href: baseHref,
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
      {
        id: "fav",
        kind: "link",
        icon: Heart,
        label: "Favoritos",
        href: `${baseHref}/favoritos`,
      },
      {
        id: "more",
        kind: "action",
        icon: MoreHorizontal,
        label: "Mais",
        onClick: () => setMoreOpen(true),
      },
    ],
    [baseHref],
  );

  const activeTab = useMemo((): TabId => {
    if (pathname === baseHref || pathname === `${baseHref}/`) return "home";
    if (pathname.startsWith(`${baseHref}/sacola`)) return "bag";
    if (pathname.startsWith(`${baseHref}/favoritos`)) return "fav";
    if (pathname.startsWith(`${baseHref}/buscar`)) return "srch";
    return "home";
  }, [pathname, baseHref]);

  const cartBadge = isHydrated ? cartCount : 0;

  const variantProps: VariantProps = {
    tabs,
    activeTab,
    cartBadge,
    pulseSeed,
  };

  return (
    <>
      {variant === "rule" ? (
        <RuleNav {...variantProps} />
      ) : variant === "glass" ? (
        <GlassNav {...variantProps} />
      ) : (
        <PillNav {...variantProps} />
      )}
      <MoreSheet store={store} open={moreOpen} onOpenChange={setMoreOpen} />
    </>
  );
}

interface VariantProps {
  tabs: TabConfig[];
  activeTab: TabId;
  cartBadge: number;
  pulseSeed: number;
}

/* ─── pill (default — alinhado à ref Dribbble 1) ──────────────────────
   Pill 56×26px atrás do ícone ativo com `bg-primary/12` (verde
   diluído), ícone em `text-primary`. Label foreground semibold ativo.
   Inativo: ícone gray-500, label gray-500 medium.
*/
function PillNav({ tabs, activeTab, cartBadge, pulseSeed }: VariantProps) {
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-border bg-background pt-2 lg:hidden"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 14px)" }}
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
    "flex flex-1 flex-col items-center gap-0.5 rounded-md px-1.5 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring";

  const content = (
    <>
      <span
        className={cn(
          "relative inline-flex h-[28px] w-14 items-center justify-center rounded-full transition-colors duration-200",
          isActive
            ? "bg-[color-mix(in_oklch,var(--primary)_14%,white)] text-primary"
            : "text-gray-500",
        )}
      >
        <Icon
          className={cn("size-[19px]", isActive ? "stroke-[2]" : "stroke-[1.7]")}
          aria-hidden
        />
        {badge > 0 && (
          <span
            key={pulseSeed}
            aria-hidden
            className="absolute -top-0.5 right-1.5 inline-flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-brand-store px-1 text-[9.5px] font-semibold text-brand-store-foreground animate-in zoom-in-50 duration-300"
          >
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </span>
      <span
        className={cn(
          "mt-0.5 text-[10.5px] tracking-[-0.1px]",
          isActive
            ? "font-semibold text-foreground"
            : "font-medium text-gray-500",
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

/* ─── rule ────────────────────────────────────────────────────────────
   Indicador top 28×2px tinge `bg-primary`. Ícone + label embaixo.
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
                "absolute top-0 left-1/2 h-0.5 -translate-x-1/2 rounded-full bg-primary transition-all duration-200",
                isActive ? "w-7" : "w-0",
              )}
            />
            <span
              className={cn(
                "relative",
                isActive ? "text-primary" : "text-gray-500",
              )}
            >
              <Icon className="size-5" strokeWidth={1.7} aria-hidden />
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
                isActive
                  ? "font-semibold text-foreground"
                  : "font-medium text-gray-500",
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

/* ─── glass ───────────────────────────────────────────────────────────
   Capsule flutuante autônoma, bg-foreground, ícones em background.
   Aba ativa = pill `bg-primary`. Sem labels.
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
            isActive ? "bg-primary" : "hover:bg-white/10",
          );
          const inner = (
            <>
              <Icon
                className={cn(
                  "size-5",
                  isActive ? "text-primary-foreground" : "text-background",
                )}
                strokeWidth={1.7}
                aria-hidden
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
