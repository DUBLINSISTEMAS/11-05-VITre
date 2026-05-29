/**
 * /admin/relatorios/comparativo — Onda Relatórios A4 (2026-05-29).
 *
 * Matriz mês-a-mês dos N últimos meses civis. Pra cada mês: receita,
 * CMV, despesas, comissão, lucro operacional, margem %. Lojista
 * compara visualmente "Janeiro vs Fevereiro vs Março" sem mexer
 * em filtros toda hora.
 *
 * Filtros URL:
 *   ?months=3|6|12   (default 6)
 */
import { loadComparativeReport } from "@/actions/reports/load-comparative-report";
import {
  loadReportOperatorName,
  loadStoreInfoForReport,
} from "@/actions/reports/store-info";
import { ComparativeReportClient } from "@/components/admin/comparative-report-client";
import { requireSession } from "@/lib/auth-server";

export const metadata = {
  title: "Relatório Comparativo — Mangos Pay",
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

export default async function ComparativoRelatorioPage({
  searchParams,
}: SearchParams) {
  await requireSession();
  const flat = flatten(await searchParams);

  const [storeInfo, data, operatorName] = await Promise.all([
    loadStoreInfoForReport(),
    loadComparativeReport({ filters: flat }),
    loadReportOperatorName(),
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
      <ComparativeReportClient
        storeInfo={storeInfo}
        buckets={data.buckets}
        monthsCount={data.monthsCount}
        rangeLabel={data.rangeLabel}
        operatorName={operatorName}
      />
    </div>
  );
}
