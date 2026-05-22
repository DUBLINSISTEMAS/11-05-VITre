"use client";

// Breadcrumb da rota atual — renderizado no canto superior esquerdo do
// topbar admin (ref Abacate Pay 2026-05-21). Mostra hierarquia
// "ícone + Seção / ícone + Item" ou só "ícone + Início" pra /admin.
import { LayoutDashboardIcon, LifeBuoyIcon, type LucideIcon } from "lucide-react";
import { Fragment } from "react";

import { ADMIN_NAV_HOME, ADMIN_NAV_SECTIONS } from "./nav-items";

export interface BreadcrumbCrumb {
  icon?: LucideIcon;
  label: string;
}

/**
 * Resolve o pathname atual em uma lista de crumbs.
 * Regras:
 * - /admin → [Início]
 * - /admin/suporte → [Suporte] (link discreto, fora dos grupos)
 * - /admin/{seção}/... → [Seção, Item] (procura na ADMIN_NAV_SECTIONS)
 * - fallback → [Início] (não ocorre em rotas válidas)
 */
export function getBreadcrumb(pathname: string): BreadcrumbCrumb[] {
  if (pathname === "/admin" || pathname === "/admin/") {
    return [{ icon: ADMIN_NAV_HOME.icon, label: ADMIN_NAV_HOME.label }];
  }
  if (pathname === "/admin/suporte" || pathname.startsWith("/admin/suporte/")) {
    return [{ icon: LifeBuoyIcon, label: "Suporte" }];
  }

  for (const section of ADMIN_NAV_SECTIONS) {
    for (const item of section.items) {
      if (!item.href) continue;
      const match = item.exact
        ? pathname === item.href
        : pathname === item.href || pathname.startsWith(item.href + "/");
      if (match) {
        return [
          { icon: section.icon, label: section.label },
          { icon: item.icon, label: item.label },
        ];
      }
    }
  }

  return [{ icon: LayoutDashboardIcon, label: "Admin" }];
}

export interface BreadcrumbProps {
  pathname: string;
}

export function Breadcrumb({ pathname }: BreadcrumbProps) {
  const crumbs = getBreadcrumb(pathname);
  return (
    <nav className="b3-breadcrumb min-w-0" aria-label="Rota atual">
      {crumbs.map((crumb, i) => {
        const Icon = crumb.icon;
        const isLast = i === crumbs.length - 1;
        return (
          <Fragment key={`${i}-${crumb.label}`}>
            {i > 0 ? (
              <span aria-hidden className="b3-breadcrumb-sep">
                /
              </span>
            ) : null}
            <span
              className="b3-breadcrumb-item"
              data-current={isLast ? "true" : undefined}
            >
              {Icon ? <Icon size={16} aria-hidden /> : null}
              <span>{crumb.label}</span>
            </span>
          </Fragment>
        );
      })}
    </nav>
  );
}
