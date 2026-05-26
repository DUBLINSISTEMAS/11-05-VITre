/**
 * /admin/relatorios/vendedoras — S3.1 do Plano de Endurecimento.
 *
 * Total vendido por vendedora + ticket médio + comissão devida no
 * período. Lojista com 2+ vendedoras consegue pagar comissão certa.
 *
 * Comissão usa product.defaultCommissionBps — produto sem comissão
 * cadastrada não conta.
 */
import { loadSellersReport } from "@/actions/reports/load-sellers";
import { requireSession } from "@/lib/auth-server";
import { formatBRL } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export default async function VendedorasReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireSession();
  const params = await searchParams;
  const data = await loadSellersReport(params);

  if (!data) {
    return (
      <div className="b3-card p-8 text-center">
        <p className="text-ink-3 text-sm">Sessão expirada.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="b3-page-title">Vendas por vendedora</h1>
        <p className="b3-page-sub">
          Total vendido + ticket médio + comissão devida no período.
          Comissão baseada em &quot;% padrão&quot; de cada produto.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="b3-card p-4">
          <p className="text-ink-3 text-xs">Receita do período</p>
          <p className="text-ink-1 mt-1 text-2xl font-semibold">
            {formatBRL(data.totals.totalRevenueInCents)}
          </p>
        </div>
        <div className="b3-card p-4">
          <p className="text-ink-3 text-xs">Vendas</p>
          <p className="text-ink-1 mt-1 text-2xl font-semibold">
            {data.totals.saleCount}
          </p>
        </div>
        <div className="b3-card p-4">
          <p className="text-ink-3 text-xs">Comissão devida</p>
          <p className="text-ink-1 mt-1 text-2xl font-semibold">
            {formatBRL(data.totals.commissionInCents)}
          </p>
          <p className="text-ink-4 mt-1 text-[11px]">
            Soma % padrão de cada produto vendido
          </p>
        </div>
      </div>

      {/* Tabela */}
      {data.rows.length === 0 ? (
        <div className="b3-card p-8 text-center">
          <p className="text-ink-3 text-sm">
            Nenhuma venda atribuída a vendedora no período.
          </p>
          <p className="text-ink-4 mt-1 text-xs">
            No PDV, marque a vendedora antes de finalizar a venda.
          </p>
        </div>
      ) : (
        <div className="b3-card overflow-x-auto">
          <table className="b3-table w-full">
            <thead>
              <tr>
                <th className="text-left">Vendedora</th>
                <th className="text-right">Vendas</th>
                <th className="text-right">Total vendido</th>
                <th className="text-right">Ticket médio</th>
                <th className="text-right">Comissão</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.sellerId}>
                  <td className="text-ink-1 text-sm">{r.sellerName}</td>
                  <td className="text-ink-2 mono text-right text-sm">
                    {r.saleCount}
                  </td>
                  <td className="text-ink-1 mono text-right text-sm font-medium">
                    {formatBRL(r.totalRevenueInCents)}
                  </td>
                  <td className="text-ink-2 mono text-right text-sm">
                    {formatBRL(r.averageTicketInCents)}
                  </td>
                  <td className="text-ink-1 mono text-right text-sm font-semibold">
                    {formatBRL(r.commissionInCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
