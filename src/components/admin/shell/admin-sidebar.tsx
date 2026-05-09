"use client";

// Sidebar lateral fixa do admin (desktop only — `hidden lg:flex`).
// Estilo inspirado no painel do Fly.io (docs/painel-admin.md):
// - tile do ícone com gradient + ring + shadow brand-tinted no item ativo
// - logo + brand no topo, UserMenu no footer
// - hairline divisor com gradient de brand
// Mobile usa BottomNav escuro (componente separado).
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

import { ADMIN_NAV_ITEMS } from "./nav-items";
import { UserMenu, type UserMenuProps } from "./user-menu";

export type AdminSidebarProps = UserMenuProps;

export function AdminSidebar(props: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      aria-label="Navegação principal"
      className="surface-elevated sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r lg:flex"
    >
      {/* Topo: logo + nome */}
      <div className="px-4 py-4">
        <Link
          href="/admin"
          className="hocus:bg-accent flex items-center gap-2 rounded-lg px-2 py-1.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50"
          aria-label="Vitrê — ir para o início"
        >
          <Image
            src="/brand/logo-principal.webp"
            alt=""
            width={28}
            height={28}
            priority
            className="size-7 rounded-md"
          />
          <span className="text-foreground font-semibold tracking-tight">
            Vitrê
          </span>
        </Link>
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

      {/* Footer: UserMenu + ver loja */}
      <div className="flex items-center justify-between gap-2 px-3 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <UserMenu {...props} />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-xs font-medium text-foreground">
              {props.storeName}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {props.ownerEmail}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
