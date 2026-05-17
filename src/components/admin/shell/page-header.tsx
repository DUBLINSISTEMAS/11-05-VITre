import { ChevronRightIcon, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Header padrão de página do admin (port Dublin v3, ADR-0019).
 *
 * - Breadcrumb opcional com ícones (ex: 🏠 Início / 📦 Produtos)
 * - Title 22px peso 600 ls -0.4 (`tracking-tight`)
 * - Subtitle 12.5px peso 500 muted-foreground
 * - Slot `actions` à direita (botões, dropdowns, links — alinhados a `end`)
 *
 * Usado em todas as pages do admin pra padronizar a chamada visual e
 * abrir slot consistente pras CTAs primárias.
 */

export interface BreadcrumbItem {
  /** Texto exibido. */
  label: string;
  /** Ícone Lucide à esquerda do label. */
  icon?: LucideIcon;
  /** Link clicável (se omitido, item é só texto — terminal). */
  href?: string;
}

export interface AdminPageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** Breadcrumb opcional. Renderizado acima do title. */
  breadcrumb?: BreadcrumbItem[];
}

export function AdminPageHeader({
  title,
  subtitle,
  actions,
  breadcrumb,
}: AdminPageHeaderProps) {
  return (
    <div className="space-y-2">
      {breadcrumb && breadcrumb.length > 0 ? (
        <Breadcrumbs items={breadcrumb} />
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="text-[22px] font-semibold tracking-tight text-foreground sm:text-2xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="text-[12.5px] font-medium text-muted-foreground sm:text-sm">
              {subtitle}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}

function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1 text-[12.5px] font-medium text-muted-foreground">
        {items.map((item, idx) => {
          const Icon = item.icon;
          const isLast = idx === items.length - 1;
          const content = (
            <>
              {Icon ? <Icon className="size-3.5 shrink-0" aria-hidden /> : null}
              <span className="truncate">{item.label}</span>
            </>
          );
          return (
            <li key={`${item.label}-${idx}`} className="flex items-center gap-1">
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="flex items-center gap-1 rounded-sm outline-none transition-colors hocus:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  {content}
                </Link>
              ) : (
                <span
                  className={`flex items-center gap-1 ${isLast ? "text-foreground" : ""}`}
                  aria-current={isLast ? "page" : undefined}
                >
                  {content}
                </span>
              )}
              {!isLast ? (
                <ChevronRightIcon
                  className="size-3 shrink-0 text-muted-foreground/60"
                  aria-hidden
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
