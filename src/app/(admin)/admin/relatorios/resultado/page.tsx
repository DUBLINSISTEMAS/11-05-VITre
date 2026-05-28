/**
 * /admin/relatorios/resultado — Bloco E da ressignificação (2026-05-27).
 *
 * Responde a pergunta-mãe #1: "Quanto sobrou esse mês?".
 *
 * Tela amigável de DRE: reusa `loadDreSimple` (que já calcula faturamento,
 * CMV, taxa real cartão deduzida e despesas operacionais) e renderiza
 * com vocabulário do varejista BR + hero gigante + comparação com
 * período anterior. Pra detalhamento técnico (devoluções, breakdown
 * de receita líquida, cobertura de custo) o lojista clica em
 * "DRE detalhado" → `/admin/relatorios/dre`.
 */
import { loadDreSimple } from "@/actions/reports/load-dre";
import { derivePreviousFilters, resolveReportRange } from "@/actions/reports/range";
import {
  loadReportOperatorName,
  loadStoreInfoForReport,
} from "@/actions/reports/store-info";
import { ResultadoClient } from "@/components/admin/resultado-client";
import { requireSession } from "@/lib/auth-server";

export const metadata = {
  title: "Resultado — Mangos Pay",
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

export default async function ResultadoPage({ searchParams }: SearchParams) {
  await requireSession();
  const flat = flatten(await searchParams);
  // Modo de comparação — "prev" (período imediatamente anterior, default)
  // ou "yoy" (mesmo período do ano passado). YoY é o que o varejista
  // pede quando tem sazonalidade (joia em maio vs maio passado).
  const compareMode: "prev" | "yoy" = flat.compare === "yoy" ? "yoy" : "prev";
  const range = resolveReportRange(flat);
  const previousFilters = derivePreviousFilters(range, compareMode);

  const [storeInfo, current, previous, operatorName] = await Promise.all([
    loadStoreInfoForReport(),
    loadDreSimple({ filters: flat }),
    loadDreSimple({ filters: previousFilters }),
    loadReportOperatorName(),
  ]);

  if (!storeInfo || !current) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <p className="text-ink-3 text-sm">Loja não encontrada.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] p-4 sm:p-6">
      <ResultadoClient
        storeInfo={storeInfo}
        current={current.summary}
        previous={previous?.summary ?? null}
        period={current.range.periodLabel}
        filters={flat}
        operatorName={operatorName}
        compareMode={compareMode}
      />
    </div>
  );
}
