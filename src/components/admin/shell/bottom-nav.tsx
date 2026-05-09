"use client";

// Bottom nav mobile/tablet (oculto em lg+). Estilo Fly.io: fundo escuro
// `bg-navy-950/95` com backdrop-blur, items horizontais com ícone + label
// pequeno, ativo destacado pela cor primary do brand. Funciona com
// qualquer cor primary (Vitrê padrão azul, ou cor configurada por loja
// no futuro override do admin).
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

import { ADMIN_NAV_ITEMS } from "./nav-items";

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Atalhos"
      className="bg-navy-950/95 fixed inset-x-0 bottom-0 z-40 backdrop-blur-md lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-md items-stretch gap-0.5 px-2 py-1.5">
        {ADMIN_NAV_ITEMS.filter((i) => !i.desktopOnly).map((item) => {
          const Icon = item.icon;
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                prefetch
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium leading-none outline-none transition-colors focus-visible:ring-2 focus-visible:ring-white/40",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-white/70 hocus:bg-white/10 hocus:text-white",
                )}
              >
                <Icon className="size-5 shrink-0" aria-hidden />
                <span className="truncate">
                  {item.shortLabel ?? item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
