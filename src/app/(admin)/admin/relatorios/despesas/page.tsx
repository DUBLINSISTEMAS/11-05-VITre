/**
 * /admin/relatorios/despesas — Onda Relatórios A4 (2026-05-29).
 *
 * Relatório imprimível: despesa-a-despesa do período + agregação por
 * categoria + flag recorrente. Filtros via URL canônica:
 *   ?periodo=hoje|semana|mes|trimestre|ano|7|30|90|custom
 *   ?start=YYYY-MM-DD&end=YYYY-MM-DD   (custom)
 *   ?category=rent|payroll|utilities|supplies|marketing|tax|card_fees|other
 *   ?paid=all|paid|pending
 *   ?recurring=all|yes|no
 */
import { loadExpensesReport } from "@/actions/reports/load-expenses-report";
import {
  loadReportOperatorName,
  loadStoreInfoForReport,
} from "@/actions/reports/store-info";
import { ExpensesReportClient } from "@/components/admin/expenses-report-client";
import { requireSession } from "@/lib/auth-server";

export const metadata = {
  title: "Relatório de Despesas — Mangos Pay",
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

export default async function DespesasRelatorioPage({
  searchParams,
}: SearchParams) {
  await requireSession();
  const flat = flatten(await searchParams);

  const [storeInfo, data, operatorName] = await Promise.all([
    loadStoreInfoForReport(),
    loadExpensesReport({ filters: flat }),
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
      <ExpensesReportClient
        storeInfo={storeInfo}
        rows={data.rows}
        summary={data.summary}
        period={data.range.periodLabel}
        filters={flat}
        operatorName={operatorName}
      />
    </div>
  );
}
