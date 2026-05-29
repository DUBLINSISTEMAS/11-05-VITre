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
  HandCoinsIcon,
  LineChartIcon,
  type LucideIcon,
  ReceiptIcon,
  TrendingUpIcon,
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
  // Bloco E da ressignificação (2026-05-27) — primeiro card porque responde
  // a pergunta-mãe #1 do lojista: "Quanto sobrou esse mês?".
  {
    k: "resultado",
    label: "Resultado",
    href: "/admin/relatorios/resultado",
    icon: LineChartIcon,
    description:
      "Lucro líquido REAL do período: faturamento − custos − taxas − despesas. Comparação com período anterior.",
  },
  {
    k: "vendas",
    label: "Vendas por período",
    href: "/admin/relatorios/vendas",
    icon: ReceiptIcon,
    description:
      "Lista venda-a-venda com cliente, canal e método. Total + ticket médio.",
  },
  // S4.8 (2026-05-26) — card "Vendas por canal" removido (regua funciona-ou-esconde).
  // Rota /admin/relatorios/vendas-canal segue como stub via URL; quando virar feature
  // real (Sprint 5+), reintroduzir aqui sem `soon`.
  {
    k: "top",
    label: "Top produtos",
    href: "/admin/relatorios/top",
    icon: TrendingUpIcon,
    description: "O que mais vendeu, por faturamento ou quantidade.",
  },
  // S4.8 — "Top clientes" removido. Loader existe (loadFullReport.customers.topCustomers)
  // mas precisa de rota dedicada — implementar em Sprint 5 + reintroduzir.
  {
    k: "margem",
    label: "Margem por produto",
    href: "/admin/relatorios/margem",
    icon: CalculatorIcon,
    description:
      "Visão complementar ao Resultado: lucro absoluto e % linha-a-linha por SKU.",
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
  // S4.8 — "Compras por fornecedor" removido. Implementação real requer
  // agregado JOIN purchase+supplier+purchase_item — Sprint 5.
  {
    k: "vendedoras",
    label: "Vendas por vendedora",
    href: "/admin/relatorios/vendedoras",
    icon: UsersIcon,
    description:
      "Total vendido + ticket médio + comissão devida no período. Por sellerId.",
  },
  // Faxina 2026-05-28: "DRE simplificado" removido do índice. Quem precisa do
  // breakdown técnico (receita bruta − descontos − devoluções − CMV − despesas)
  // acessa via link "DRE detalhada" dentro da tela Resultado, que é o caminho
  // canônico. Manter como card autônomo criava sobreposição: 2 lugares
  // respondendo "quanto sobrou?" com nomes diferentes. Rota /admin/relatorios/dre
  // segue viva por URL.
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
