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
  TrendingUpIcon,
} from "lucide-react";
import Link from "next/link";

interface ReportCard {
  k: string;
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
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
    k: "top",
    label: "Top produtos",
    href: "/admin/relatorios/top",
    icon: TrendingUpIcon,
    description: "O que mais vendeu, por faturamento ou quantidade.",
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
              prefetch
              className="b3-card b3-card-pad group flex flex-col gap-3 transition hover:border-mangos-green-700/40 hover:shadow-md"
            >
              <div
                className="text-mangos-green-800 inline-flex size-9 items-center justify-center rounded-[10px]"
                style={{ background: "var(--mangos-yellow-soft)" }}
                aria-hidden
              >
                <Icon size={18} />
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
                Abrir relatório
                <ChevronRightIcon size={13} aria-hidden />
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
