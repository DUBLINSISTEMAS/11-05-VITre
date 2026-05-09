"use client";

/**
 * Header do storefront redesenhado - estilo app de moda premium.
 *
 * Estado expandido (topo da página):
 *   ┌──────────────────────────────────┐
 *   │ (avatar) Hey, Alex ▼    [sacola] │
 *   │ [🔍 Explore Fashion...]  [filtro]│
 *   └──────────────────────────────────┘
 *
 * Estado colapsado (após scroll):
 *   ┌──────────────────────────────────┐
 *   │ logo+nome  [busca] [sacola]      │
 *   └──────────────────────────────────┘
 *
 * Destaques:
 * - Saudação personalizada com avatar/inicial
 * - Barra de busca com placeholder elegante
 * - Botão de filtro neutro (cinza) ao lado da busca
 * - Badge da sacola com cor da loja (--brand-store, ADR-0011)
 */
import { motion } from "framer-motion";
import { ChevronDown, Search, ShoppingBag, SlidersHorizontal } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useCategoriesSidebarTrigger } from "@/components/storefront/categories-sidebar";
import { useSacolaDrawerTrigger } from "@/components/storefront/sacola-drawer";
import { Button } from "@/components/ui/button";
import type { Store } from "@/db/schema";
import { useCart } from "@/hooks/use-cart";
import { cn } from "@/lib/utils";

const COLLAPSE_THRESHOLD = 80;

export interface StoreHeaderProps {
  store: Store;
}

export function StoreHeader({ store }: StoreHeaderProps) {
  const router = useRouter();
  const { open: openCategories } = useCategoriesSidebarTrigger();
  const { open: openSacola } = useSacolaDrawerTrigger();
  const { count: cartCount, isHydrated } = useCart();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const baseHref = `/${store.slug}`;
  const showBadge = isHydrated && cartCount > 0;

  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY;
      setIsScrolled(y > 8);
      setIsCollapsed(y > COLLAPSE_THRESHOLD);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleSearchNavigate = () => {
    router.push(`${baseHref}/buscar`);
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-30 bg-background transition-shadow duration-200",
        isScrolled && "shadow-sm",
      )}
    >
      <div className="mx-auto w-full max-w-screen-xl px-4 py-3">
        {/* Collapsed header - simple logo + search + cart */}
        <div
          className={cn(
            "flex items-center justify-between gap-3 transition-all duration-300",
            isCollapsed ? "opacity-100" : "absolute opacity-0 pointer-events-none"
          )}
          aria-hidden={!isCollapsed}
        >
          <Link
            href={baseHref}
            prefetch
            className="flex min-w-0 items-center gap-2.5 rounded-lg px-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Início — ${store.name}`}
            tabIndex={isCollapsed ? 0 : -1}
          >
            {store.logoUrl ? (
              <div className="size-8 shrink-0 overflow-hidden rounded-full ring-1 ring-border">
                <Image
                  src={store.logoUrl}
                  alt=""
                  width={32}
                  height={32}
                  priority
                  className="size-full object-cover"
                />
              </div>
            ) : (
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground">
                <span className="text-sm font-bold text-background">
                  {store.name.charAt(0)}
                </span>
              </div>
            )}
            <span className="truncate text-base font-semibold tracking-tight">
              {store.name}
            </span>
          </Link>

          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-10 rounded-full hover:bg-muted"
              aria-label="Buscar produtos"
              onClick={handleSearchNavigate}
              tabIndex={isCollapsed ? 0 : -1}
            >
              <Search className="size-5" />
            </Button>

            <CartButton
              showBadge={showBadge}
              cartCount={cartCount}
              onClick={openSacola}
              tabIndex={isCollapsed ? 0 : -1}
            />
          </div>
        </div>

        {/* Expanded header - greeting + search bar */}
        <div
          className={cn(
            "transition-all duration-300",
            isCollapsed ? "opacity-0 pointer-events-none h-0 overflow-hidden" : "opacity-100"
          )}
          aria-hidden={isCollapsed}
        >
          {/* Top row: greeting + cart */}
          <div className="flex items-center justify-between mb-3">
            <Link
              href={baseHref}
              className="flex items-center gap-2 group outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full pr-2"
              tabIndex={isCollapsed ? -1 : 0}
            >
              {/* Avatar */}
              {store.logoUrl ? (
                <div className="size-10 shrink-0 overflow-hidden rounded-full ring-2 ring-border">
                  <Image
                    src={store.logoUrl}
                    alt=""
                    width={40}
                    height={40}
                    priority
                    className="size-full object-cover"
                  />
                </div>
              ) : (
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-foreground">
                  <span className="text-sm font-bold text-background">
                    {store.name.charAt(0)}
                  </span>
                </div>
              )}
              
              {/* Greeting */}
              <div className="flex items-center gap-1">
                <span className="text-sm font-medium text-foreground">
                  Hey, <span className="font-semibold">{store.name.split(" ")[0]}</span>
                </span>
                <ChevronDown className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
            </Link>

            <CartButton
              showBadge={showBadge}
              cartCount={cartCount}
              onClick={openSacola}
              tabIndex={isCollapsed ? -1 : 0}
            />
          </div>

          {/* Search bar row */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSearchNavigate}
              className="group flex h-12 flex-1 items-center gap-3 rounded-xl bg-gray-100 px-4 text-left outline-none transition-colors hover:bg-gray-200/80 focus-visible:ring-2 focus-visible:ring-ring"
              tabIndex={isCollapsed ? -1 : 0}
            >
              <Search className="size-5 text-muted-foreground group-hover:text-foreground transition-colors" />
              <span className="text-muted-foreground text-sm">
                Buscar produtos...
              </span>
            </button>

            {/* Filter button - neutral (cinza) */}
            <motion.button
              type="button"
              onClick={openCategories}
              className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground outline-none transition-colors transition-transform hover:bg-gray-200 hover:text-foreground hover:scale-105 active:scale-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label="Filtrar categorias"
              tabIndex={isCollapsed ? -1 : 0}
              whileTap={{ scale: 0.95 }}
            >
              <SlidersHorizontal className="size-5" />
            </motion.button>
          </div>
        </div>
      </div>
    </header>
  );
}

interface CartButtonProps {
  showBadge: boolean;
  cartCount: number;
  onClick: () => void;
  tabIndex?: number;
}

function CartButton({ showBadge, cartCount, onClick, tabIndex = 0 }: CartButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="relative size-10 rounded-full hover:bg-muted"
      aria-label={
        showBadge
          ? `Sacola (${cartCount} ${cartCount === 1 ? "item" : "itens"})`
          : "Sacola vazia"
      }
      onClick={onClick}
      tabIndex={tabIndex}
    >
      <ShoppingBag className="size-5 text-foreground" />
      {showBadge && (
        <span
          aria-hidden
          className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 animate-in zoom-in-50 place-items-center rounded-full bg-brand-store px-1.5 text-[10px] font-bold tabular-nums text-brand-store-foreground shadow-sm duration-200"
        >
          {cartCount > 99 ? "99+" : cartCount}
        </span>
      )}
    </Button>
  );
}
