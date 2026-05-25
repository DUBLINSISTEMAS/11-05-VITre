/**
 * Sprint 5F — index `/admin/relatorios`.
 *
 * Cards de navegação rápida pros relatórios A4 dedicados (Sprint 5).
 * Renderiza ACIMA do dashboard agregado existente (ReportView), pra
 * dar ao lojista atalhos diretos pros papéis que vai imprimir/enviar
 * pro contador.
 *
 * Server component — sem state, só links.
 */
import {
  AlertTriangleIcon,
  CalculatorIcon,
  ChevronRightIcon,
  ClockIcon,
  HandCoinsIcon,
  type LucideIcon,
  ReceiptIcon,
  StoreIcon,
  TrendingUpIcon,
  TruckIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";

interface ReportCard {
  k: string;
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
  /** PP10 (handoff 2026-05-25) — cards stub mostram pill "em breve". */
  soon?: boolean;
}

const REPORTS: ReportCard[] = [
  {
    k: "vendas",
    label: "Vendas por período",
    href: "/admin/relatorios/vendas",
    icon: ReceiptIcon,
    description:
      "Lista venda-a-venda com cliente, canal e método. Total + ticket médio.",
  },
  {
    k: "vendas-canal",
    label: "Vendas por canal",
    href: "/admin/relatorios/vendas-canal",
    icon: StoreIcon,
    description: "Balcão (PDV) vs. loja online (WhatsApp). Compara volume e ticket.",
    soon: true,
  },
  {
    k: "top",
    label: "Top produtos",
    href: "/admin/relatorios/top",
    icon: TrendingUpIcon,
    description: "O que mais vendeu, por faturamento ou quantidade.",
  },
  {
    k: "top-clientes",
    label: "Top clientes",
    href: "/admin/relatorios/top-clientes",
    icon: UsersIcon,
    description: "Ranking por receita gerada + frequência de compra.",
    soon: true,
  },
  {
    k: "margem",
    label: "Margem por produto",
    href: "/admin/relatorios/margem",
    icon: CalculatorIcon,
    description: "Lucro absoluto e % de cada produto vendido.",
  },
  {
    k: "estoque-baixo",
    label: "Estoque baixo",
    href: "/admin/estoque/relatorio",
    icon: AlertTriangleIcon,
    description: "Produtos com saldo no limite ou esgotados.",
  },
  {
    k: "fiados",
    label: "Fiados pendentes",
    href: "/admin/financeiro/receber/relatorio",
    icon: HandCoinsIcon,
    description: "Lista pra cobrança com saldo restante e vencimento.",
  },
  {
    k: "compras-fornecedor",
    label: "Compras por fornecedor",
    href: "/admin/relatorios/compras-fornecedor",
    icon: TruckIcon,
    description: "Volume e custo médio agrupado por fornecedor (CMV detalhado).",
    soon: true,
  },
  {
    k: "dre",
    label: "DRE simplificado",
    href: "/admin/relatorios/dre",
    icon: ClockIcon,
    description: "Receita − CMV = lucro bruto. Sem despesas operacionais.",
  },
];

export function RelatoriosIndexCards() {
  return (
    <div className="space-y-2">
      <div className="text-ink-4 text-[11px] font-bold uppercase tracking-[0.06em]">
        Relatórios imprimíveis (A4)
      </div>
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
        {REPORTS.map((r) => {
          const Icon = r.icon;
          return (
            <Link
              key={r.k}
              href={r.href}
              prefetch={!r.soon}
              className="b3-card b3-card-pad group flex flex-col gap-3 transition hover:border-mangos-green-700/40 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div
                  className="text-mangos-green-800 inline-flex size-9 items-center justify-center rounded-[10px]"
                  style={{ background: "var(--mangos-yellow-soft)" }}
                  aria-hidden
                >
                  <Icon size={18} />
                </div>
                {r.soon ? (
                  <span
                    className="rounded px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide"
                    style={{
                      background: "var(--mangos-yellow-soft)",
                      color: "var(--mangos-yellow-deep)",
                    }}
                  >
                    Em breve
                  </span>
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-ink-1 text-[14px] font-semibold tracking-tight">
                  {r.label}
                </p>
                <p className="text-ink-4 mt-1 text-[12.5px] leading-snug">
                  {r.description}
                </p>
              </div>
              <p className="text-mangos-green-800 mt-auto inline-flex items-center gap-0.5 text-[12px] font-semibold">
                {r.soon ? "Ver detalhes" : "Abrir relatório"}
                <ChevronRightIcon size={13} aria-hidden />
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
