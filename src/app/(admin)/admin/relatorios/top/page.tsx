/**
 * /admin/relatorios/top — Sprint 5B.
 *
 * Top produtos vendidos no período. Default ordena por receita; lojista
 * troca pra "quantidade" via ?orderBy=quantity. Tabela com #, nome, qty,
 * faturamento. Útil pra decisão de compra (o que sai mais).
 */
import { loadTopProductsReport } from "@/actions/reports/load-top";
import { loadStoreInfoForReport } from "@/actions/reports/store-info";
import { TopProductsReportClient } from "@/components/admin/top-products-report-client";
import { requireSession } from "@/lib/auth-server";

export const metadata = {
  title: "Top Produtos — Vitrê",
};

interface SearchParams {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function flatten(
  params: Record<string, string | string[] | undefined>,
): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(params)) {
    out[k] = Array.isArray(v) ? v[0] : v;
  }
  return out;
}

export default async function TopProdutosRelatorioPage({ searchParams }: SearchParams) {
  await requireSession();
  const flat = flatten(await searchParams);

  const orderBy: "quantity" | "revenue" =
    flat.orderBy === "quantity" ? "quantity" : "revenue";

  const [storeInfo, data] = await Promise.all([
    loadStoreInfoForReport(),
    loadTopProductsReport({ filters: flat, orderBy }),
  ]);

  if (!storeInfo || !data) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <p className="text-ink-3 text-sm">Loja não encontrada.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] p-4 sm:p-6">
      <TopProductsReportClient
        storeInfo={storeInfo}
        rows={data.rows}
        totals={data.totals}
        period={data.range.periodLabel}
        filters={flat}
        orderBy={orderBy}
      />
    </div>
  );
}
