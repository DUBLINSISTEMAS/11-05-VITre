/**
 * /admin/estoque/parado — Aging report (S3.6 do Plano de Endurecimento).
 *
 * Mostra capital empatado em produto sem venda há 60/90/180 dias.
 * Métrica #1 pra lojista de joalheria decidir liquidação.
 */
import Link from "next/link";

import { loadStockAging } from "@/actions/stock/load-aging";
import { requireSession } from "@/lib/auth-server";
import { formatBRL } from "@/lib/pricing";

export const dynamic = "force-dynamic";

const COHORT_LABEL = {
  "60-90": "60 a 90 dias",
  "90-180": "90 a 180 dias",
  "180+": "Mais de 180 dias",
} as const;

export default async function EstoqueParadoPage() {
  await requireSession();
  const data = await loadStockAging();

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="b3-page-title">Estoque parado</h1>
        <p className="b3-page-sub">
          Produtos com estoque positivo que não vendem há 60+ dias. Capital
          empatado — candidatos a promoção ou liquidação.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="b3-card p-4">
          <p className="text-ink-3 text-xs">Total parado 60d+</p>
          <p className="text-ink-1 mt-1 text-2xl font-semibold">
            {formatBRL(data.kpi.parked60PlusInCents)}
          </p>
        </div>
        <div className="b3-card p-4">
          <p className="text-ink-3 text-xs">60 a 90 dias</p>
          <p className="text-ink-1 mt-1 text-2xl font-semibold">
            {formatBRL(data.kpi.parked60to90InCents)}
          </p>
        </div>
        <div className="b3-card p-4">
          <p className="text-ink-3 text-xs">90 a 180 dias</p>
          <p className="text-ink-1 mt-1 text-2xl font-semibold">
            {formatBRL(data.kpi.parked90to180InCents)}
          </p>
        </div>
        <div className="b3-card p-4">
          <p className="text-ink-3 text-xs">+ de 180 dias</p>
          <p className="text-ink-1 text-destructive mt-1 text-2xl font-semibold">
            {formatBRL(data.kpi.parked180PlusInCents)}
          </p>
        </div>
      </div>

      {/* Tabela */}
      {data.rows.length === 0 ? (
        <div className="b3-card p-8 text-center">
          <p className="text-ink-3 text-sm">
            Nenhum produto parado há 60+ dias.
          </p>
          <p className="text-ink-4 mt-1 text-xs">
            Significa que tudo que tem estoque está girando — ótimo sinal.
          </p>
        </div>
      ) : (
        <div className="b3-card overflow-x-auto">
          <table className="b3-table w-full">
            <thead>
              <tr>
                <th className="text-left">Produto</th>
                <th className="text-right">Estoque</th>
                <th className="text-right">Custo unit.</th>
                <th className="text-right">Capital parado</th>
                <th className="text-right">Última venda</th>
                <th className="text-left">Faixa</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.productId}>
                  <td>
                    <Link
                      href={`/admin/produtos/${r.productId}`}
                      className="text-ink-1 text-sm hover:underline"
                    >
                      {r.productName}
                    </Link>
                  </td>
                  <td className="text-ink-2 mono text-right text-sm">
                    {r.stockQuantity}
                  </td>
                  <td className="text-ink-2 mono text-right text-sm">
                    {r.unitCostInCents !== null
                      ? formatBRL(r.unitCostInCents)
                      : "—"}
                  </td>
                  <td className="text-ink-1 mono text-right text-sm font-semibold">
                    {r.parkedValueInCents !== null
                      ? formatBRL(r.parkedValueInCents)
                      : "—"}
                  </td>
                  <td className="text-ink-3 text-right text-sm">
                    {r.daysSinceLastSale === null
                      ? "nunca"
                      : `${r.daysSinceLastSale}d atrás`}
                  </td>
                  <td>
                    <span
                      className={`b3-pill ${
                        r.cohort === "180+"
                          ? "b3-pill--danger"
                          : r.cohort === "90-180"
                            ? "b3-pill--warn"
                            : "b3-pill--brand"
                      } inline-flex items-center`}
                    >
                      {COHORT_LABEL[r.cohort]}
                    </span>
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
