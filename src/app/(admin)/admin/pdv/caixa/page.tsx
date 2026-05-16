import {
  ArrowLeftIcon,
  BanknoteIcon,
  CreditCardIcon,
  HomeIcon,
  ShoppingBagIcon,
} from "lucide-react";
import Link from "next/link";

import {
  type DaySummary,
  loadBalcaoDaySummary,
  type PaymentMethodKey,
} from "@/actions/order/balcao/load-day-summary";
import { PrintButton } from "@/components/admin/pdv/print-button";
import { AdminPageHeader } from "@/components/admin/shell/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatBRL } from "@/lib/pricing";

export const dynamic = "force-dynamic";

interface CaixaPageProps {
  searchParams: Promise<{ data?: string }>;
}

const METHOD_LABEL: Record<PaymentMethodKey, string> = {
  cash: "Dinheiro",
  pix: "PIX",
  debit: "Débito",
  credit: "Crédito",
  other: "Outro",
  unknown: "Sem método",
};

const METHOD_ICON: Record<PaymentMethodKey, React.ComponentType<{ className?: string }>> = {
  cash: BanknoteIcon,
  pix: ShoppingBagIcon,
  debit: CreditCardIcon,
  credit: CreditCardIcon,
  other: ShoppingBagIcon,
  unknown: ShoppingBagIcon,
};

/**
 * Página "Fechar caixa" — resumo de vendas balcão do dia, agrupado por
 * método de pagamento. Follow-up Fase 5 / ADR-0016.
 *
 * Não fecha caixa de verdade (não muda estado nem trava operações) — é
 * uma view de conferência. "Fechar" = imprimir/anotar e bater o dinheiro
 * da gaveta com o total cash.
 */
export default async function CaixaPage({ searchParams }: CaixaPageProps) {
  const { data: dateParam } = await searchParams;
  const summary = await loadBalcaoDaySummary({ date: dateParam });

  return (
    <div className="space-y-4 sm:space-y-6 print:space-y-3">
      <AdminPageHeader
        title="Fechar caixa"
        subtitle="Resumo das vendas balcão do dia para conferência."
        breadcrumb={[
          { label: "Início", icon: HomeIcon, href: "/admin" },
          { label: "PDV", icon: ShoppingBagIcon, href: "/admin/pdv" },
          { label: "Caixa" },
        ]}
        actions={
          <div className="flex items-center gap-2 print:hidden">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/pdv">
                <ArrowLeftIcon />
                Voltar
              </Link>
            </Button>
            <PrintButton />
          </div>
        }
      />

      <form
        method="get"
        className="flex items-center gap-2 print:hidden"
        action="/admin/pdv/caixa"
      >
        <label htmlFor="caixa-date" className="text-muted-foreground text-sm">
          Dia:
        </label>
        <Input
          id="caixa-date"
          type="date"
          name="data"
          defaultValue={summary?.date}
          className="w-auto"
        />
        <Button type="submit" variant="outline" size="sm">
          Atualizar
        </Button>
      </form>

      {summary ? <SummaryView summary={summary} /> : <EmptyState />}
    </div>
  );
}

function SummaryView({ summary }: { summary: DaySummary }) {
  const [yyyy, mm, dd] = summary.date.split("-");
  const dateLabel = `${dd}/${mm}/${yyyy}`;

  return (
    <div className="space-y-4">
      <div className="border-border/60 bg-card rounded-xl border p-4">
        <span className="text-muted-foreground text-xs uppercase tracking-wider">
          {dateLabel}
        </span>
        <div className="mt-1 flex items-baseline gap-4">
          <div className="font-mono text-3xl font-semibold tabular-nums">
            {formatBRL(summary.totalCents)}
          </div>
          <div className="text-muted-foreground text-sm">
            {summary.totalCount}{" "}
            {summary.totalCount === 1 ? "venda" : "vendas"}
          </div>
        </div>
      </div>

      {summary.byMethod.length === 0 ? (
        <div className="border-border/60 text-muted-foreground rounded-xl border-2 border-dashed p-8 text-center text-sm">
          Sem vendas no balcão neste dia.
        </div>
      ) : (
        <div className="border-border/60 bg-card overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Método</th>
                <th className="px-4 py-2 text-right font-medium">Vendas</th>
                <th className="px-4 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {summary.byMethod.map((row) => {
                const Icon = METHOD_ICON[row.method];
                return (
                  <tr
                    key={row.method}
                    className="border-border/60 border-t last:border-b-0"
                  >
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2">
                        <Icon className="text-muted-foreground size-4" />
                        {METHOD_LABEL[row.method]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      {row.count}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      {formatBRL(row.total)}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-muted/30 border-border/60 border-t font-semibold">
                <td className="px-4 py-3">Total</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">
                  {summary.totalCount}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">
                  {formatBRL(summary.totalCents)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <p className="text-muted-foreground print:hidden text-xs">
        Confira o dinheiro da gaveta com o total {METHOD_LABEL.cash}. Outros
        métodos passam por POS/PIX do lojista.
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="border-border/60 text-muted-foreground rounded-xl border-2 border-dashed p-8 text-center text-sm">
      Loja não encontrada ou data inválida.
    </div>
  );
}
