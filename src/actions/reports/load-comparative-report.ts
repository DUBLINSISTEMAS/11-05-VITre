"use server";

/**
 * loadComparativeReport — Onda Relatórios A4 (2026-05-29).
 *
 * Matriz mês-a-mês dos N últimos meses civis. Pra cada mês, chama
 * `loadDreSimple` que devolve receita / CMV / despesas / comissão /
 * lucro operacional. UI renderiza tabela densa com 1 linha por
 * métrica + N colunas (uma por mês).
 *
 * Lojista usa pra:
 *   - "Janeiro vendi mais que Fevereiro?"
 *   - "Aluguel está pesando mais no inverno?"
 *   - "Margem caiu nos últimos 3 meses?"
 *
 * Filtros URL:
 *   ?months=3|6|12   (default 6)
 *
 * Performance: N chamadas paralelas a loadDreSimple. 6 meses = ~6
 * queries DRE em paralelo (~300ms total). Cap em 12 pra evitar abuso.
 */
import { loadDreSimple } from "./load-dre";
import type { DreSimpleSummary } from "./types";

export interface ComparativeBucket {
  /** "Janeiro/2026". */
  label: string;
  /** Curto: "Jan/26". UI usa quando espaço apertado. */
  shortLabel: string;
  /** YYYY-MM — chave única, ordenação cronológica. */
  key: string;
  summary: DreSimpleSummary;
}

export interface LoadComparativeReportOutput {
  /** Buckets ordenados do mais ANTIGO pro mais recente (esquerda → direita). */
  buckets: ComparativeBucket[];
  /** Quantidade de meses retornados (1..12). */
  monthsCount: number;
  /** Label legível do range completo. Ex: "Dez/25 a Mai/26". */
  rangeLabel: string;
}

const MONTH_PT_LONG = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const;

const MONTH_PT_SHORT = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
] as const;

function parseMonthsCount(raw: string | undefined): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 6;
  return Math.min(12, Math.max(1, Math.round(n)));
}

function formatMonthKey(year: number, monthIdx: number): string {
  const mm = String(monthIdx + 1).padStart(2, "0");
  return `${year}-${mm}`;
}

function formatShortLabel(year: number, monthIdx: number): string {
  return `${MONTH_PT_SHORT[monthIdx]}/${String(year).slice(-2)}`;
}

function formatLongLabel(year: number, monthIdx: number): string {
  return `${MONTH_PT_LONG[monthIdx]}/${year}`;
}

export async function loadComparativeReport(input: {
  filters: Record<string, string | undefined>;
}): Promise<LoadComparativeReportOutput | null> {
  const monthsCount = parseMonthsCount(input.filters.months);

  // Constroi a lista de meses do mais antigo (N-1 meses atrás) ao
  // corrente. Trabalha em ano civil/mês civil pra evitar drift de
  // fuso. Cada bucket = 1º dia do mês 00:00 → último dia 23:59.
  const now = new Date();
  const currYear = now.getFullYear();
  const currMonth = now.getMonth();

  const monthsAxis: { year: number; monthIdx: number }[] = [];
  for (let i = monthsCount - 1; i >= 0; i -= 1) {
    const d = new Date(currYear, currMonth - i, 1);
    monthsAxis.push({ year: d.getFullYear(), monthIdx: d.getMonth() });
  }

  // Carrega DRE de cada mês em paralelo. loadDreSimple aceita filtros
  // `custom` + start + end (YYYY-MM-DD) — vamos passar isso por bucket.
  const results = await Promise.all(
    monthsAxis.map(async ({ year, monthIdx }) => {
      const start = new Date(year, monthIdx, 1);
      // Último dia do mês corrente — `monthIdx + 1, 0` retorna dia 0 do
      // mês seguinte = último dia do mês corrente (Date arithmetic JS).
      const end = new Date(year, monthIdx + 1, 0);
      const dreResult = await loadDreSimple({
        filters: {
          periodo: "custom",
          start: start.toISOString().slice(0, 10),
          end: end.toISOString().slice(0, 10),
        },
      });
      return { year, monthIdx, dreResult };
    }),
  );

  // Se loadDreSimple retornou null pra QUALQUER bucket (sem sessão
  // ou sem loja), abortamos o relatório todo.
  if (results.some((r) => r.dreResult === null)) {
    return null;
  }

  const buckets: ComparativeBucket[] = results.map(
    ({ year, monthIdx, dreResult }) => ({
      key: formatMonthKey(year, monthIdx),
      label: formatLongLabel(year, monthIdx),
      shortLabel: formatShortLabel(year, monthIdx),
      summary: dreResult!.summary,
    }),
  );

  const first = buckets[0];
  const last = buckets[buckets.length - 1];
  const rangeLabel =
    first && last && first.shortLabel !== last.shortLabel
      ? `${first.shortLabel} a ${last.shortLabel}`
      : (first?.label ?? "");

  return {
    buckets,
    monthsCount,
    rangeLabel,
  };
}
