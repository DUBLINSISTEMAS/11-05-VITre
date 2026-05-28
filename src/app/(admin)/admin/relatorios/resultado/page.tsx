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

/**
 * Deriva filtros do período ANTERIOR de mesma duração — sem repensar
 * `resolveReportRange`. Pra periodo=7/30/90 dias, o anterior são os N
 * dias antes do início do atual. Pra custom, espelha o range com
 * mesma length, deslocado.
 */
function shiftFiltersToPreviousPeriod(
  filters: Record<string, string | undefined>,
): Record<string, string | undefined> {
  const periodo = filters.periodo ?? "30";
  const days =
    periodo === "7" ? 7 : periodo === "90" ? 90 : periodo === "30" ? 30 : null;

  // Periodo padrão (7/30/90): calcula start = today − 2N, end = today − N.
  if (days !== null) {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const end = new Date(today);
    end.setDate(end.getDate() - days);
    const start = new Date(end);
    start.setDate(start.getDate() - days + 1);
    return {
      periodo: "custom",
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    };
  }

  // Custom: desloca o mesmo length pra trás.
  if (filters.start && filters.end) {
    const s = new Date(filters.start);
    const e = new Date(filters.end);
    const lengthMs = e.getTime() - s.getTime();
    const newEnd = new Date(s.getTime() - 24 * 60 * 60 * 1000);
    const newStart = new Date(newEnd.getTime() - lengthMs);
    return {
      periodo: "custom",
      start: newStart.toISOString().slice(0, 10),
      end: newEnd.toISOString().slice(0, 10),
    };
  }

  return { periodo: "30" };
}

export default async function ResultadoPage({ searchParams }: SearchParams) {
  await requireSession();
  const flat = flatten(await searchParams);
  const previousFilters = shiftFiltersToPreviousPeriod(flat);

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
      />
    </div>
  );
}
