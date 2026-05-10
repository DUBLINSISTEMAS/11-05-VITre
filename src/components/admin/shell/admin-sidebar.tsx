"use client";

// Sidebar lateral fixa do admin (desktop only — `hidden lg:flex`).
// Canvas-v1 admin (Lote 3): largura 232px, StoreSwitcher no topo,
// StorefrontFooterCard + UserMenu no rodapé. Mantém o tile do ícone com
// gradient + ring + shadow brand-tinted no item ativo (Fly.io pattern).
// Mobile usa BottomNav escuro (componente separado).
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

import { ADMIN_NAV_ITEMS } from "./nav-items";
import { StoreSwitcher } from "./store-switcher";
import { StorefrontFooterCard } from "./storefront-footer-card";
import { UserMenu, type UserMenuProps } from "./user-menu";

export interface AdminSidebarProps extends UserMenuProps {
  /** Cor primária da loja (hex) — pinta o avatar do StoreSwitcher. */
  primaryColor: string;
}

export function AdminSidebar(props: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      aria-label="Navegação principal"
      className="surface-elevated sticky top-0 hidden h-dvh w-[232px] shrink-0 flex-col border-r lg:flex"
    >
      {/* Topo: store switcher (avatar tingido + nome + handle mono) */}
      <div className="px-3 py-3">
        <StoreSwitcher
          storeName={props.storeName}
          storeSlug={props.storeSlug}
          primaryColor={props.primaryColor}
        />
      </div>

      <hr className="from-primary/5 via-primary/20 to-primary/5 mx-4 h-px border-0 bg-gradient-to-r" />

      {/* Lista de itens */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <ul className="space-y-0.5">
          {ADMIN_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  prefetch
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-navy-700 hocus:bg-accent hocus:text-navy-900",
                  )}
                >
                  {/* Tile do ícone — gradient + ring + sombra (estilo Fly) */}
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-md transition-all",
                      isActive
                        ? "shadow-brand-sm ring-primary/20 bg-gradient-to-b from-white/90 to-white/60 ring-1"
                        : "ring-navy-200/0 group-hocus:ring-navy-200/60 bg-transparent ring-1 group-hocus:bg-white/60",
                    )}
                  >
                    <Icon
                      className={cn(
                        "size-3.5",
                        isActive ? "text-primary" : "text-navy-500",
                      )}
                      aria-hidden
                    />
                  </span>
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <hr className="from-primary/5 via-primary/20 to-primary/5 mx-4 h-px border-0 bg-gradient-to-r" />

      {/* Footer: card storefront + UserMenu inline */}
      <div className="flex flex-col gap-2 px-3 py-3">
        <StorefrontFooterCard storeSlug={props.storeSlug} />
        <div className="flex items-center justify-between gap-2 px-1">
          <p className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
            {props.ownerEmail}
          </p>
          <UserMenu {...props} />
        </div>
      </div>
    </aside>
  );
}
