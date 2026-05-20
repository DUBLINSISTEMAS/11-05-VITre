/**
 * /admin/relatorios/margem — Sprint 5C.
 *
 * Margem por produto vendido no período. Produtos sem custo cadastrado
 * aparecem com aviso. Totais consideram só linhas 100% cobertas — pra
 * margem % global ser fiel à realidade.
 */
import { loadMarginReport } from "@/actions/reports/load-margin";
import { loadStoreInfoForReport } from "@/actions/reports/store-info";
import { MarginReportClient } from "@/components/admin/margin-report-client";
import { requireSession } from "@/lib/auth-server";

export const metadata = {
  title: "Margem por Produto — Vitrê",
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

export default async function MargemRelatorioPage({ searchParams }: SearchParams) {
  await requireSession();
  const flat = flatten(await searchParams);

  const [storeInfo, data] = await Promise.all([
    loadStoreInfoForReport(),
    loadMarginReport({ filters: flat }),
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
      <MarginReportClient
        storeInfo={storeInfo}
        rows={data.rows}
        totals={data.totals}
        period={data.range.periodLabel}
        filters={flat}
      />
    </div>
  );
}
