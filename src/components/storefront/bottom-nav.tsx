"use client";

/**
 * Bottom navigation redesign inspirado no app de moda de referência.
 *
 * Features:
 * - 4 itens: Home, Shopping (abre sidebar de categorias), Favoritos, Perfil
 * - Pill ativa com fundo --brand-store (cor da loja, ADR-0011) + ícone/label em brand-store-foreground
 * - Animação spring com Framer Motion (pill desliza entre abas)
 * - Badge de carrinho no item Shopping (também em --brand-store)
 * - Design mobile-first com safe-area padding
 */
import { motion } from "framer-motion";
import { Heart, Home, ShoppingBag, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

import { useCart } from "@/hooks/use-cart";
import { useFavorites } from "@/hooks/use-favorites";
import { cn } from "@/lib/utils";

export interface BottomNavProps {
  storeSlug: string;
}

type TabId = "home" | "shop" | "favorites" | "profile";

interface TabConfig {
  id: TabId;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href?: string;
  action?: () => void;
}

export function BottomNav({ storeSlug }: BottomNavProps) {
  const { count: cartCount, isHydrated: cartHydrated } = useCart();
  const { count: favCount, isHydrated: favHydrated } = useFavorites();
  const pathname = usePathname();
  const baseHref = `/${storeSlug}`;

  const tabs: TabConfig[] = useMemo(
    () => [
      { id: "home", icon: Home, label: "Início", href: baseHref },
      { id: "shop", icon: ShoppingBag, label: "Explorar", href: `${baseHref}/buscar` },
      { id: "favorites", icon: Heart, label: "Favoritos", href: `${baseHref}/favoritos` },
      { id: "profile", icon: User, label: "Perfil", href: `${baseHref}/perfil` },
    ],
    [baseHref]
  );

  // Determina tab ativa baseado no pathname
  const activeTab = useMemo((): TabId => {
    if (pathname === baseHref || pathname === `${baseHref}/`) return "home";
    if (pathname.startsWith(`${baseHref}/favoritos`)) return "favorites";
    if (pathname.startsWith(`${baseHref}/perfil`)) return "profile";
    if (pathname.startsWith(`${baseHref}/buscar`) || pathname.startsWith(`${baseHref}/categoria`)) return "shop";
    // Default to home for other pages
    return "home";
  }, [pathname, baseHref]);

  const badgeQty = cartHydrated ? cartCount : 0;
  const favBadge = favHydrated ? favCount : 0;

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* Gradient fade at the top */}
      <div className="pointer-events-none absolute inset-x-0 -top-6 h-6 bg-gradient-to-t from-white/80 to-transparent" />

      {/* Navigation bar container */}
      <div className="mx-3 mb-2">
        <div className="rounded-2xl border border-gray-100 bg-white/95 px-2 py-1.5 shadow-lg backdrop-blur-xl">
          <ul className="flex items-center justify-around">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const badge = tab.id === "shop" ? badgeQty : tab.id === "favorites" ? favBadge : 0;

              return (
                <NavItem
                  key={tab.id}
                  tab={tab}
                  isActive={isActive}
                  badge={badge}
                />
              );
            })}
          </ul>
        </div>
      </div>
    </nav>
  );
}

interface NavItemProps {
  tab: TabConfig;
  isActive: boolean;
  badge: number;
}

function NavItem({ tab, isActive, badge }: NavItemProps) {
  const Icon = tab.icon;

  const content = (
    <div className="relative flex flex-col items-center justify-center gap-0.5 px-3 py-1.5">
      {/* Animated pill background — cor da loja (ADR-0011) */}
      {isActive && (
        <motion.div
          layoutId="nav-pill"
          className="absolute inset-0 rounded-xl bg-brand-store"
          transition={{
            type: "spring",
            stiffness: 500,
            damping: 35,
          }}
        />
      )}

      {/* Icon and label container */}
      <div className="relative z-10 flex items-center gap-1.5">
        <Icon
          className={cn(
            "size-5 transition-colors duration-200",
            isActive ? "text-brand-store-foreground" : "text-gray-400"
          )}
        />
        <span
          className={cn(
            "text-xs font-medium transition-colors duration-200",
            isActive ? "text-brand-store-foreground" : "hidden"
          )}
        >
          {tab.label}
        </span>
      </div>

      {/* Badge — cor da loja (ADR-0011) */}
      {badge > 0 && !isActive && (
        <span
          aria-hidden
          className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand-store px-1 text-[10px] font-bold tabular-nums text-brand-store-foreground"
        >
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </div>
  );

  const className = cn(
    "relative flex-1 outline-none transition-transform duration-200",
    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-xl",
    !isActive && "hover:scale-105 active:scale-95"
  );

  // Button for action-based tabs (Shopping opens sidebar)
  if (tab.action) {
    return (
      <li className="flex-1">
        <button
          type="button"
          onClick={tab.action}
          aria-current={isActive ? "page" : undefined}
          className={cn(className, "w-full")}
        >
          {content}
        </button>
      </li>
    );
  }

  // Link for href-based tabs
  return (
    <li className="flex-1">
      <Link
        href={tab.href!}
        prefetch
        aria-current={isActive ? "page" : undefined}
        className={className}
      >
        {content}
      </Link>
    </li>
  );
}
