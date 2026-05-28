/**
 * Resolução central de período pra relatórios (Sprint 5).
 *
 * Plain function (no "use server"). Pode ser importada em loaders e
 * páginas server-side sem `revalidate`. URL canônica:
 *   ?periodo=7|30|90|custom&start=YYYY-MM-DD&end=YYYY-MM-DD
 */
import { z } from "zod";

import type { ReportRange } from "./types";

// Presets temporais — pedido do founder 2026-05-28:
// "Ver lucro semanal, mensal, trimestral, anual + comparar ano contra ano".
// Os legados "7"/"30"/"90" são dias rolantes. Os novos presets (hoje/semana/
// mes/trimestre/ano) são períodos CIVIS — "este mês" = dia 1 → hoje,
// "este ano" = 1/jan → hoje. Faz sentido pra DRE de varejista BR que
// fecha por mês/ano fiscal.
const filterSchema = z.object({
  periodo: z
    .enum(["hoje", "semana", "mes", "trimestre", "ano", "7", "30", "90", "custom"])
    .catch("mes"),
  start: z.string().nullish(),
  end: z.string().nullish(),
});

export function resolveReportRange(
  rawFilters: Record<string, string | undefined>,
): ReportRange {
  const parsed = filterSchema.parse(rawFilters);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  if (parsed.periodo === "custom" && parsed.start && parsed.end) {
    const start = new Date(parsed.start);
    start.setHours(0, 0, 0, 0);
    const customEnd = new Date(parsed.end);
    customEnd.setHours(23, 59, 59, 999);
    return {
      start,
      end: customEnd,
      periodLabel: `${formatBR(start)} a ${formatBR(customEnd)}`,
    };
  }

  // Períodos CIVIS — fecham no calendário, não rolam dias.
  if (parsed.periodo === "hoje") {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return { start, end, periodLabel: "hoje" };
  }
  if (parsed.periodo === "semana") {
    // Semana civil BR: começa na segunda-feira.
    const start = new Date();
    const dow = start.getDay(); // 0 = dom, 1 = seg, …
    const daysFromMonday = dow === 0 ? 6 : dow - 1;
    start.setDate(start.getDate() - daysFromMonday);
    start.setHours(0, 0, 0, 0);
    return { start, end, periodLabel: "esta semana" };
  }
  if (parsed.periodo === "mes") {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    return { start, end, periodLabel: `${MONTH_PT[now.getMonth()]} de ${now.getFullYear()}` };
  }
  if (parsed.periodo === "trimestre") {
    const now = new Date();
    const quarter = Math.floor(now.getMonth() / 3); // 0..3
    const start = new Date(now.getFullYear(), quarter * 3, 1, 0, 0, 0, 0);
    return { start, end, periodLabel: `${quarter + 1}º trimestre de ${now.getFullYear()}` };
  }
  if (parsed.periodo === "ano") {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    return { start, end, periodLabel: `${now.getFullYear()}` };
  }

  // Períodos ROLANTES (legados, ainda usados em outras telas).
  const days =
    parsed.periodo === "7" ? 7 : parsed.periodo === "90" ? 90 : 30;
  const start = new Date();
  start.setDate(start.getDate() - days + 1);
  start.setHours(0, 0, 0, 0);
  return {
    start,
    end,
    periodLabel: `últimos ${days} dias`,
  };
}

/**
 * Deriva filtros do período de COMPARAÇÃO a partir de um range já resolvido.
 *
 * - mode="prev": mesmo length, deslocado imediatamente pra trás. Pra
 *   "este mês" compara com mês passado (1/N até dia X do mês anterior).
 * - mode="yoy": exatamente -1 ano em start e end. Pra "este mês" compara
 *   com o mesmo mês do ano passado. Útil pra varejista que tem sazonalidade
 *   forte (Natal, Dia das Mães) — comparar com mês anterior mente.
 */
export function derivePreviousFilters(
  range: ReportRange,
  mode: "prev" | "yoy",
): Record<string, string | undefined> {
  if (mode === "yoy") {
    const start = new Date(range.start);
    start.setFullYear(start.getFullYear() - 1);
    const end = new Date(range.end);
    end.setFullYear(end.getFullYear() - 1);
    return {
      periodo: "custom",
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    };
  }
  // prev: range de mesmo length, terminando um dia antes do start atual.
  const lengthMs = range.end.getTime() - range.start.getTime();
  const newEnd = new Date(range.start.getTime() - 24 * 60 * 60 * 1000);
  const newStart = new Date(newEnd.getTime() - lengthMs);
  return {
    periodo: "custom",
    start: newStart.toISOString().slice(0, 10),
    end: newEnd.toISOString().slice(0, 10),
  };
}

const MONTH_PT = [
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

function formatBR(d: Date): string {
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
