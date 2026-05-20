/**
 * Resolução central de período pra relatórios (Sprint 5).
 *
 * Plain function (no "use server"). Pode ser importada em loaders e
 * páginas server-side sem `revalidate`. URL canônica:
 *   ?periodo=7|30|90|custom&start=YYYY-MM-DD&end=YYYY-MM-DD
 */
import { z } from "zod";

import type { ReportRange } from "./types";

const filterSchema = z.object({
  periodo: z.enum(["7", "30", "90", "custom"]).catch("30"),
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

function formatBR(d: Date): string {
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
