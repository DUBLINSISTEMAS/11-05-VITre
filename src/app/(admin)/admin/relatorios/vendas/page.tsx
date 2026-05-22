/**
 * /admin/relatorios/vendas — Sprint 5A.
 *
 * Relatório A4 imprimível com venda-a-venda do período. Filtros via URL:
 *   ?periodo=7|30|90|custom
 *   ?start=YYYY-MM-DD&end=YYYY-MM-DD   (custom)
 *   ?paymentMethod=cash|pix|debit|credit|other|all
 */
import { loadSalesReport } from "@/actions/reports/load-sales";
import { loadStoreInfoForReport } from "@/actions/reports/store-info";
import { SalesReportClient } from "@/components/admin/sales-report-client";
import { requireSession } from "@/lib/auth-server";

export const metadata = {
  title: "Relatório de Vendas — Mangos Pay",
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

export default async function VendasRelatorioPage({ searchParams }: SearchParams) {
  await requireSession();
  const flat = flatten(await searchParams);

  const [storeInfo, data] = await Promise.all([
    loadStoreInfoForReport(),
    loadSalesReport({ filters: flat }),
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
      <SalesReportClient
        storeInfo={storeInfo}
        rows={data.rows}
        summary={data.summary}
        period={data.range.periodLabel}
        filters={flat}
      />
    </div>
  );
}
