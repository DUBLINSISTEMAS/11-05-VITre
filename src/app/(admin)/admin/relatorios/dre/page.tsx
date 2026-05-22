/**
 * /admin/relatorios/dre — Sprint 5D.
 *
 * DRE simplificado: receita bruta − descontos + acréscimos = receita
 * líquida − CMV = lucro bruto. Sem despesas operacionais (sem schema).
 */
import { loadDreSimple } from "@/actions/reports/load-dre";
import {
  loadReportOperatorName,
  loadStoreInfoForReport,
} from "@/actions/reports/store-info";
import { DreReportClient } from "@/components/admin/dre-report-client";
import { requireSession } from "@/lib/auth-server";

export const metadata = {
  title: "DRE — Mangos Pay",
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

export default async function DreRelatorioPage({ searchParams }: SearchParams) {
  await requireSession();
  const flat = flatten(await searchParams);

  const [storeInfo, data, operatorName] = await Promise.all([
    loadStoreInfoForReport(),
    loadDreSimple({ filters: flat }),
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
      <DreReportClient
        storeInfo={storeInfo}
        summary={data.summary}
        period={data.range.periodLabel}
        filters={flat}
        operatorName={operatorName}
      />
    </div>
  );
}
