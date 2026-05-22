/**
 * /admin/financeiro/receber/relatorio — Sprint 5E.
 *
 * A4 imprimível dos fiados pendentes. Lojista usa pra cobrança ou pra
 * mostrar ao contador. Reusa loadPendingReceivables (já considera
 * pagamentos parciais via SUM(receivable_payment)).
 *
 * Filtro via URL:
 *   ?status=all       (default) — todos pendentes
 *   ?status=overdue   — apenas vencidos
 */
import { loadPendingReceivables } from "@/actions/receivable/load-pending";
import { loadStoreInfoForReport } from "@/actions/reports/store-info";
import { ReceivablesReportClient } from "@/components/admin/receivables-report-client";
import { requireSession } from "@/lib/auth-server";

export const metadata = {
  title: "Relatório de Fiados — Mangos Pay",
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

export default async function ReceivablesRelatorioPage({
  searchParams,
}: SearchParams) {
  await requireSession();
  const flat = flatten(await searchParams);
  const statusFilter = flat.status === "overdue" ? "overdue" : "all";

  const [storeInfo, data] = await Promise.all([
    loadStoreInfoForReport(),
    loadPendingReceivables(),
  ]);

  if (!storeInfo) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <p className="text-ink-3 text-sm">Loja não encontrada.</p>
      </div>
    );
  }

  const filteredRows =
    statusFilter === "overdue"
      ? data.rows.filter((r) => r.isOverdue)
      : data.rows;

  return (
    <div className="mx-auto max-w-[1200px] p-4 sm:p-6">
      <ReceivablesReportClient
        storeInfo={storeInfo}
        rows={filteredRows}
        totals={{
          pendingSum: filteredRows.reduce((acc, r) => acc + r.remainingInCents, 0),
          overdueSum: filteredRows.reduce(
            (acc, r) => (r.isOverdue ? acc + r.remainingInCents : acc),
            0,
          ),
          overdueCount: filteredRows.filter((r) => r.isOverdue).length,
          pendingCount: filteredRows.length,
        }}
        statusFilter={statusFilter}
      />
    </div>
  );
}
