"use client";

/**
 * ComparativeReportClient — Onda Relatórios A4 (2026-05-29).
 *
 * Matriz mês-a-mês: linhas = métricas (receita, CMV, despesas, lucro,
 * margem), colunas = N meses. NÃO usa ReportLayout porque ele assume
 * "1 row = 1 entidade" e aqui a tabela é transposta (1 row = 1
 * métrica × N meses). Mantém o mesmo padrão visual de header/footer
 * pra coerência de print.
 *
 * Cell de lucro operacional ganha cor semafórica via `profitTone`.
 * Variação mês a mês (delta %) na última coluna pra leitura rápida.
 */

import { DownloadIcon, PrinterIcon } from "lucide-react";
import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import type { ComparativeBucket } from "@/actions/reports/load-comparative-report";
import type { DreSimpleSummary } from "@/actions/reports/types";
import type { ReportStoreInfo } from "@/components/admin/report/report-layout";
import { Button } from "@/components/ui/button";
import { Money, profitTone } from "@/components/ui/money";
import { downloadCsv, escapeCsvCell } from "@/lib/csv";
import { cn } from "@/lib/utils";

const MONTH_OPTIONS: { value: string; label: string }[] = [
  { value: "3", label: "3 meses" },
  { value: "6", label: "6 meses" },
  { value: "12", label: "12 meses" },
];

interface ComparativeReportClientProps {
  storeInfo: ReportStoreInfo & {
    address?: string | null;
    whatsapp?: string | null;
    document?: string | null;
  };
  buckets: ComparativeBucket[];
  monthsCount: number;
  rangeLabel: string;
  operatorName?: string | null;
}

/** Cada métrica = 1 row na matriz. */
interface MetricRow {
  key: string;
  label: string;
  /** Extrai número do summary daquele mês. */
  pick: (s: DreSimpleSummary) => number;
  /** Renderiza célula. Custom pra usar Money component + cor. */
  render: (s: DreSimpleSummary) => React.ReactNode;
  /** Linha de destaque (lucro op / margem) — borda extra + peso. */
  emphasis?: boolean;
}

function marginPct(s: DreSimpleSummary): number {
  if (s.netRevenueInCents <= 0) return 0;
  return (s.operationalProfitInCents / s.netRevenueInCents) * 100;
}

function deltaPct(curr: number, prev: number): number | null {
  if (prev === 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

const METRICS: MetricRow[] = [
  {
    key: "orders",
    label: "Vendas",
    pick: (s) => s.totalOrderCount,
    render: (s) => (
      <span className="tabular-nums">{s.totalOrderCount}</span>
    ),
  },
  {
    key: "revenue",
    label: "Receita líquida",
    pick: (s) => s.netRevenueInCents,
    render: (s) => (
      <Money valueInCents={s.netRevenueInCents} size="sm" tone="neutral" />
    ),
  },
  {
    key: "cogs",
    label: "(−) CMV",
    pick: (s) => s.cogsInCents,
    render: (s) => (
      <Money valueInCents={s.cogsInCents} size="sm" tone="negative" />
    ),
  },
  {
    key: "expenses",
    label: "(−) Despesas",
    pick: (s) => s.operatingExpensesInCents,
    render: (s) => (
      <Money
        valueInCents={s.operatingExpensesInCents}
        size="sm"
        tone="negative"
      />
    ),
  },
  {
    key: "commission",
    label: "(−) Comissões",
    pick: (s) => s.sellerCommissionInCents,
    render: (s) => (
      <Money
        valueInCents={s.sellerCommissionInCents}
        size="sm"
        tone="negative"
      />
    ),
  },
  {
    key: "profit",
    label: "Lucro operacional",
    pick: (s) => s.operationalProfitInCents,
    emphasis: true,
    render: (s) => (
      <Money
        valueInCents={s.operationalProfitInCents}
        size="md"
        tone={profitTone(s.operationalProfitInCents, marginPct(s))}
      />
    ),
  },
  {
    key: "margin",
    label: "Margem %",
    pick: (s) => marginPct(s),
    render: (s) => {
      const m = marginPct(s);
      if (s.netRevenueInCents === 0) {
        return <span className="text-ink-4">—</span>;
      }
      return (
        <span
          className="tabular-nums text-[12px] font-semibold"
          style={{ color: m < 0 ? "var(--danger)" : "var(--ok)" }}
        >
          {m.toFixed(1).replace(".", ",")}%
        </span>
      );
    },
  },
];

export function ComparativeReportClient({
  storeInfo,
  buckets,
  monthsCount,
  rangeLabel,
  operatorName,
}: ComparativeReportClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateMonths = (value: string) => {
    const usp = new URLSearchParams(searchParams.toString());
    usp.set("months", value);
    router.replace(`?${usp.toString()}`);
  };

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleExportCsv = useCallback(() => {
    const header = ["Métrica", ...buckets.map((b) => b.shortLabel)]
      .map(escapeCsvCell)
      .join(";");
    const body = METRICS.map((m) =>
      [
        escapeCsvCell(m.label),
        ...buckets.map((b) => {
          const v = m.pick(b.summary);
          // Métricas monetárias = cents → divide. "Vendas" e "Margem %"
          // ja vem como número puro.
          if (m.key === "orders") return escapeCsvCell(v);
          if (m.key === "margin") {
            return escapeCsvCell(`${v.toFixed(2).replace(".", ",")}%`);
          }
          return escapeCsvCell(
            (v / 100).toFixed(2).replace(".", ","),
          );
        }),
      ].join(";"),
    ).join("\n");
    downloadCsv(
      `comparativo-${monthsCount}m-${new Date().toISOString().slice(0, 10)}`,
      `${header}\n${body}`,
    );
  }, [buckets, monthsCount]);

  return (
    <div className="space-y-4">
      {/* Toolbar — não vai pra impressão */}
      <div className="b3-card b3-card-pad print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.05em] text-ink-4">
              Janela:
            </span>
            {MONTH_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => updateMonths(opt.value)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors",
                  String(monthsCount) === opt.value
                    ? "border-mangos-green-800 bg-mangos-green-800 text-white"
                    : "border-line bg-bg-app text-ink-2 hover:border-ink-3 hover:text-ink-1",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleExportCsv}
            >
              <DownloadIcon className="size-3.5" /> Exportar CSV
            </Button>
            <Button type="button" size="sm" onClick={handlePrint}>
              <PrinterIcon className="size-3.5" /> Imprimir
            </Button>
          </div>
        </div>
      </div>

      {/* Página A4 imprimível — header + matriz + footer */}
      <article className="report-print-root mx-auto max-w-[210mm] bg-white text-[11.5px] text-ink-1 shadow-sm print:max-w-full print:shadow-none">
        {/* Header padrão dos relatórios (igual ReportLayout) */}
        <header className="flex items-start justify-between gap-4 border-b border-ink-5 px-6 pb-3 pt-6 print:px-0">
          <div className="flex items-center gap-3">
            {storeInfo.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- imagem nativa
              <img
                src={storeInfo.logoUrl}
                alt={storeInfo.name}
                className="size-12 rounded object-contain"
              />
            ) : null}
            <div>
              <h1 className="text-[14px] font-semibold tracking-tight">
                {storeInfo.name}
              </h1>
              {storeInfo.document ? (
                <p className="font-mono text-[10.5px] leading-tight text-ink-3">
                  CNPJ/CPF: {storeInfo.document}
                </p>
              ) : null}
              {storeInfo.address ? (
                <p className="text-[10.5px] leading-tight text-ink-3">
                  {storeInfo.address}
                </p>
              ) : null}
              {storeInfo.whatsapp ? (
                <p className="text-[10.5px] leading-tight text-ink-3">
                  WhatsApp: {storeInfo.whatsapp}
                </p>
              ) : null}
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10.5px] uppercase tracking-wide text-ink-4">
              Documento interno
            </p>
            <p className="text-[10px] text-ink-4">
              Este documento não tem valor fiscal.
            </p>
          </div>
        </header>

        {/* Title + period */}
        <div className="border-b border-ink-5 px-6 py-3 print:px-0">
          <h2 className="text-[16px] font-semibold tracking-tight">
            Comparativo mês a mês
          </h2>
          <p className="text-[11px] text-ink-3">Janela: {rangeLabel}</p>
        </div>

        {/* Matriz: linhas = métricas, colunas = meses.
            Em <640px o table-layout vira scroll horizontal pra preservar
            todas as colunas. Em A4 cabe direto. */}
        <div className="overflow-x-auto px-6 py-4 print:overflow-visible print:px-0">
          {buckets.length === 0 ? (
            <p className="py-8 text-center text-[12px] text-ink-3">
              Sem dados nos últimos {monthsCount} meses.
            </p>
          ) : (
            <table className="w-full border-collapse text-[11.5px] tabular-nums">
              <thead>
                <tr className="border-b border-ink-5">
                  <th className="py-2 px-2 text-left text-[10.5px] font-medium uppercase tracking-wide text-ink-3">
                    Métrica
                  </th>
                  {buckets.map((b) => (
                    <th
                      key={b.key}
                      className="py-2 px-2 text-right text-[10.5px] font-medium uppercase tracking-wide text-ink-3"
                    >
                      {b.shortLabel}
                    </th>
                  ))}
                  {buckets.length >= 2 ? (
                    <th
                      className="py-2 px-2 text-right text-[10.5px] font-medium uppercase tracking-wide text-ink-3"
                      title="Variação entre o primeiro e o último mês da janela"
                    >
                      Δ
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {METRICS.map((m) => {
                  const first = buckets[0];
                  const last = buckets[buckets.length - 1];
                  const firstV = first ? m.pick(first.summary) : 0;
                  const lastV = last ? m.pick(last.summary) : 0;
                  const delta = deltaPct(lastV, firstV);
                  return (
                    <tr
                      key={m.key}
                      className={cn(
                        "border-b border-ink-5/40 print:break-inside-avoid",
                        m.emphasis &&
                          "border-t border-t-ink-2 bg-bg-app/40 font-medium",
                      )}
                    >
                      <td
                        className={cn(
                          "py-1.5 px-2 align-top text-left",
                          m.emphasis && "font-semibold",
                        )}
                      >
                        {m.label}
                      </td>
                      {buckets.map((b) => (
                        <td key={b.key} className="py-1.5 px-2 align-top text-right">
                          {m.render(b.summary)}
                        </td>
                      ))}
                      {buckets.length >= 2 ? (
                        <td className="py-1.5 px-2 align-top text-right">
                          {delta === null ? (
                            <span className="text-ink-4">—</span>
                          ) : (
                            <span
                              className="text-[11px] font-semibold tabular-nums"
                              style={{
                                color:
                                  Math.abs(delta) < 0.5
                                    ? "var(--ink-4)"
                                    : delta > 0
                                      ? "var(--ok)"
                                      : "var(--danger)",
                              }}
                            >
                              {delta > 0 ? "+" : ""}
                              {delta.toFixed(0)}%
                            </span>
                          )}
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer padrão dos relatórios */}
        <footer className="border-t border-ink-5 px-6 py-3 text-[10px] text-ink-4 print:px-0">
          <p>
            Receita líquida = vendas confirmadas no período. Despesas
            inclui taxa de maquininha real (`expense.category=card_fees`)
            quando lojista cadastrou. Margem % = lucro operacional ÷
            receita líquida. Coluna Δ compara primeiro vs último mês da
            janela.
          </p>
          <p className="mt-1">
            Gerado em{" "}
            {new Date().toLocaleString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
            {operatorName ? ` por ${operatorName}` : ""}
          </p>
        </footer>
      </article>
    </div>
  );
}

