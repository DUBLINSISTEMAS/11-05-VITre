import {
  ImageIcon,
  type LucideIcon,
  PackageIcon,
  ReceiptIcon,
  SettingsIcon,
  SparklesIcon,
  TagIcon,
} from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

export interface DashboardStats {
  products: number;
  promo: number;
  pending: number;
  categories: number;
  banners: number;
}

interface DashboardQuickActionsProps {
  stats: DashboardStats;
}

interface QuickAction {
  href: string;
  icon: LucideIcon;
  label: string;
  count?: number;
  subtitle: string;
  highlight?: boolean;
}

/**
 * Cards de atalho do painel — duplo papel:
 *   1. Stats reais (contagem de produtos, promo ativa, pedidos pendentes)
 *   2. Acesso direto a Categorias / Banners no MOBILE (esses itens são
 *      desktopOnly no bottom nav por causa da regra de 4 itens fixos).
 *
 * `highlight` no card de pedidos pendentes quando count > 0 — chama a
 * atenção do lojista pra cliente esperando resposta.
 */
export function DashboardQuickActions({ stats }: DashboardQuickActionsProps) {
  const actions: QuickAction[] = [
    {
      href: "/admin/produtos",
      icon: PackageIcon,
      label: "Produtos",
      count: stats.products,
      subtitle:
        stats.products === 0
          ? "Cadastre o primeiro"
          : stats.products === 1
            ? "produto"
            : "produtos",
    },
    {
      href: "/admin/produtos?promo=1",
      icon: SparklesIcon,
      label: "Em promoção",
      count: stats.promo,
      subtitle:
        stats.promo === 0
          ? "Sem promo ativa"
          : stats.promo === 1
            ? "produto"
            : "produtos",
    },
    {
      href: "/admin/pedidos?status=awaiting_whatsapp",
      icon: ReceiptIcon,
      label: "Pedidos pendentes",
      count: stats.pending,
      subtitle:
        stats.pending === 0
          ? "Tudo em dia"
          : stats.pending === 1
            ? "aguardando"
            : "aguardando",
      highlight: stats.pending > 0,
    },
    {
      href: "/admin/categorias",
      icon: TagIcon,
      label: "Categorias",
      count: stats.categories,
      subtitle:
        stats.categories === 0
          ? "Crie a primeira"
          : stats.categories === 1
            ? "categoria"
            : "categorias",
    },
    {
      href: "/admin/banners",
      icon: ImageIcon,
      label: "Banners",
      count: stats.banners,
      subtitle:
        stats.banners === 0
          ? "Sem banners"
          : stats.banners === 1
            ? "banner"
            : "banners",
    },
    {
      href: "/admin/configuracoes",
      icon: SettingsIcon,
      label: "Configurações",
      subtitle: "Identidade, contato, endereço",
    },
  ];

  return (
    <section aria-label="Atalhos" className="space-y-3">
      <h2 className="text-sm font-semibold tracking-tight">Atalhos</h2>
      <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {actions.map((action) => (
          <li key={action.href}>
            <ActionCard action={action} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ActionCard({ action }: { action: QuickAction }) {
  const Icon = action.icon;
  return (
    <Link
      href={action.href}
      prefetch
      className={cn(
        "bg-surface hocus:border-line-2 group flex items-center gap-3 rounded-xl border border-line p-3.5 outline-none transition focus-visible:ring-2 focus-visible:ring-ring/50 sm:p-4",
        action.highlight && "ring-brand/30 bg-brand-wash ring-1",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors",
          action.highlight
            ? "bg-brand text-white"
            : "bg-brand-wash text-brand",
        )}
      >
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="truncate text-sm font-medium text-ink-1 sm:text-[15px]">
          {action.label}
        </p>
        <p className="text-ink-4 truncate text-xs">
          {action.count !== undefined ? (
            <>
              <span className="text-ink-1 font-semibold">
                {action.count}
              </span>{" "}
              {action.subtitle}
            </>
          ) : (
            action.subtitle
          )}
        </p>
      </div>
    </Link>
  );
}
