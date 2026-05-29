"use client";

/**
 * Sprint 5A — Wrapper client de /admin/relatorios/vendas.
 *
 * Recebe rows + summary + storeInfo do server, monta colunas/totals e
 * renderiza <ReportLayout/>. Lista venda-a-venda do período + cards de
 * resumo por canal e método de pagamento.
 *
 * Toolbar de filtros (período + método de pagamento) NÃO vai pra
 * impressão — `print:hidden`.
 */

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import type { ReportFilterOptions } from "@/actions/reports/filter-options";
import type {
  SalesReportRow,
  SalesReportSummary,
} from "@/actions/reports/types";
import {
  type ReportColumn,
  ReportLayout,
  type ReportStoreInfo,
  type ReportTotal,
} from "@/components/admin/report/report-layout";
import { formatBRL } from "@/lib/pricing";

const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  balcao: "Balcão",
};

const METHOD_LABEL: Record<string, string> = {
  cash: "Dinheiro",
  pix: "PIX",
  debit: "Débito",
  credit: "Crédito",
  other: "Outro",
};

const STATUS_LABEL: Record<string, string> = {
  confirmed: "Confirmada",
  fulfilled: "Concluída",
  awaiting_whatsapp: "Aguardando WhatsApp",
  quote: "Orçamento",
};

const PERIODS: { value: string; label: string }[] = [
  { value: "7", label: "7 dias" },
  { value: "30", label: "30 dias" },
  { value: "90", label: "90 dias" },
];

const METHOD_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "cash", label: "Dinheiro" },
  { value: "pix", label: "PIX" },
  { value: "debit", label: "Débito" },
  { value: "credit", label: "Crédito" },
  { value: "other", label: "Outro" },
];

interface SalesReportClientProps {
  storeInfo: ReportStoreInfo;
  rows: SalesReportRow[];
  summary: SalesReportSummary;
  period: string;
  filters: Record<string, string | undefined>;
  /** Sprint 4.8 — operador no rodapé. */
  operatorName?: string | null;
  /** Sprint 4.2 — opções pros dropdowns de categoria/marca. */
  filterOptions: ReportFilterOptions;
}

export function SalesReportClient({
  storeInfo,
  rows,
  summary,
  period,
  filters,
  operatorName,
  filterOptions,
}: SalesReportClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateParam = (key: string, value: string | null) => {
    const usp = new URLSearchParams(searchParams.toString());
    if (value === null) usp.delete(key);
    else usp.set(key, value);
    router.replace(`?${usp.toString()}`);
  };

  const columns: ReportColumn<SalesReportRow>[] = [
    {
      key: "createdAt",
      label: "Data",
      align: "left",
      width: "80px",
      render: (r) =>
        r.createdAt.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "2-digit",
        }),
      exportValue: (r) =>
        r.createdAt.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }),
    },
    {
      key: "shortCode",
      label: "Código",
      align: "left",
      width: "80px",
      render: (r) => r.shortCode,
      exportValue: (r) => r.shortCode,
    },
    {
      key: "customer",
      label: "Cliente",
      align: "left",
      render: (r) => r.customerName,
      exportValue: (r) => r.customerName,
    },
    {
      key: "channel",
      label: "Canal",
      align: "left",
      width: "90px",
      render: (r) => CHANNEL_LABEL[r.channel] ?? r.channel,
      exportValue: (r) => CHANNEL_LABEL[r.channel] ?? r.channel,
    },
    {
      key: "payment",
      label: "Pagamento",
      align: "left",
      width: "100px",
      render: (r) =>
        r.paymentMethod ? METHOD_LABEL[r.paymentMethod] ?? r.paymentMethod : "—",
      exportValue: (r) =>
        r.paymentMethod ? METHOD_LABEL[r.paymentMethod] ?? r.paymentMethod : "",
    },
    {
      key: "status",
      label: "Status",
      align: "left",
      width: "100px",
      hideOnPrint: true,
      render: (r) => STATUS_LABEL[r.status] ?? r.status,
      exportValue: (r) => STATUS_LABEL[r.status] ?? r.status,
    },
    {
      key: "total",
      label: "Total",
      align: "right",
      width: "110px",
      render: (r) => (
        <div className="flex flex-col items-end gap-0.5 tabular-nums">
          <span>{formatBRL(r.totalInCents)}</span>
          {r.returnedInCents > 0 ? (
            // Sprint 1.4 — indica devolução vinculada à venda. Não esconde
            // o total bruto; mostra o desconto explícito embaixo.
            <span className="text-destructive text-[10.5px]">
              −{formatBRL(r.returnedInCents)} devolvido
            </span>
          ) : null}
        </div>
      ),
      exportValue: (r) =>
        ((r.totalInCents - r.returnedInCents) / 100).toFixed(2),
    },
  ];

  const totals: ReportTotal[] = [
    {
      label: "Vendas",
      value: summary.totalCount.toLocaleString("pt-BR"),
    },
    {
      label: "Ticket médio",
      value: formatBRL(summary.averageTicketInCents),
    },
    {
      label: "Faturamento bruto",
      value: formatBRL(summary.totalRevenueInCents),
    },
    // Sprint 1.4 — devoluções só aparecem quando > 0 (zero não polui).
    ...(summary.totalReturnedInCents > 0
      ? [
          {
            label: "Devoluções",
            value: `−${formatBRL(summary.totalReturnedInCents)}`,
          } satisfies ReportTotal,
          {
            label: "Faturamento líquido",
            value: formatBRL(summary.netRevenueInCents),
            emphasis: true,
          } satisfies ReportTotal,
        ]
      : [
          {
            label: "Faturamento",
            value: formatBRL(summary.totalRevenueInCents),
            emphasis: true,
          } satisfies ReportTotal,
        ]),
  ];

  const currentPeriodo = filters.periodo ?? "30";
  const currentMethod = filters.paymentMethod ?? "all";
  // Sprint 4.2 — single-select por enquanto (CSV no schema preserva
  // suporte futuro a multi). "all" significa sem filtro = limpa o param.
  const currentCategory = filters.categoryIds ?? "all";
  const currentBrand = filters.brandIds ?? "all";
  // Sprint 4.3 — agrupamento por dia.
  const groupByDay = filters.groupBy === "day";

  return (
    <>
      {/* Toolbar de filtros — não imprime */}
      <div className="mb-4 flex flex-wrap items-center gap-3 print:hidden">
        <Link
          href="/admin/relatorios"
          prefetch
          className="text-ink-4 hover:text-ink-1 text-[11px] uppercase tracking-wide"
        >
          ← Relatórios
        </Link>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="text-ink-4 text-[11px] uppercase tracking-wide">
              Período
            </span>
            <div className="flex">
              {PERIODS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => updateParam("periodo", p.value)}
                  className={`border-line border px-2 py-1 text-[11px] tabular-nums first:rounded-l-md last:rounded-r-md ${
                    currentPeriodo === p.value
                      ? "bg-brand text-white border-brand"
                      : "bg-surface text-ink-2 hover:bg-bg-app"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-ink-4 text-[11px] uppercase tracking-wide">
              Pagamento
            </span>
            <select
              value={currentMethod}
              onChange={(e) => updateParam("paymentMethod", e.target.value)}
              className="border-line h-7 rounded-md border bg-surface px-2 text-[12px]"
            >
              {METHOD_FILTERS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Sprint 4.2 — categoria + marca. Só renderiza se há opções
              cadastradas (loja nova sem categoria/marca esconde). */}
          {filterOptions.categories.length > 0 ? (
            <div className="flex items-center gap-1">
              <span className="text-ink-4 text-[11px] uppercase tracking-wide">
                Categoria
              </span>
              <select
                value={currentCategory}
                onChange={(e) =>
                  updateParam(
                    "categoryIds",
                    e.target.value === "all" ? null : e.target.value,
                  )
                }
                className="border-line h-7 rounded-md border bg-surface px-2 text-[12px]"
              >
                <option value="all">Todas</option>
                {filterOptions.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {filterOptions.brands.length > 0 ? (
            <div className="flex items-center gap-1">
              <span className="text-ink-4 text-[11px] uppercase tracking-wide">
                Marca
              </span>
              <select
                value={currentBrand}
                onChange={(e) =>
                  updateParam(
                    "brandIds",
                    e.target.value === "all" ? null : e.target.value,
                  )
                }
                className="border-line h-7 rounded-md border bg-surface px-2 text-[12px]"
              >
                <option value="all">Todas</option>
                {filterOptions.brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {/* Sprint 4.3 — toggle agrupar por dia. */}
          <button
            type="button"
            onClick={() =>
              updateParam("groupBy", groupByDay ? null : "day")
            }
            className={`border-line h-7 rounded-md border px-2 text-[12px] ${
              groupByDay
                ? "bg-brand text-white border-brand"
                : "bg-surface text-ink-2 hover:bg-bg-app"
            }`}
            aria-pressed={groupByDay}
            title="Agrupa as linhas por data com subtotal por dia"
          >
            Agrupar por dia
          </button>
        </div>
      </div>

      {/* Resumo por canal/método em cards (não imprime — cabe no totals) */}
      {summary.byChannel.length > 0 || summary.byPaymentMethod.length > 0 ? (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 print:hidden">
          <ResumeCard
            title="Por canal"
            entries={summary.byChannel.map((b) => ({
              label: CHANNEL_LABEL[b.channel] ?? b.channel,
              count: b.count,
              revenueInCents: b.revenueInCents,
            }))}
          />
          <ResumeCard
            title="Por forma de pagamento"
            entries={summary.byPaymentMethod.map((b) => ({
              label: b.method
                ? METHOD_LABEL[b.method] ?? b.method
                : "Sem método (fiado)",
              count: b.count,
              revenueInCents: b.revenueInCents,
            }))}
          />
        </div>
      ) : null}

      {/* Sprint 4.3 — agrupamento por dia: usa view custom em vez do
          ReportLayout. Quando off, mantém o ReportLayout normal. */}
      {groupByDay ? (
        <GroupedSalesReport
          rows={rows}
          period={period}
          storeInfo={storeInfo}
          operatorName={operatorName}
          summaryTotals={totals}
        />
      ) : (
        <ReportLayout
          title="Relatório de vendas"
          period={period}
          storeInfo={storeInfo}
          columns={columns}
          rows={rows}
          totals={totals}
          csvFileName="mangospay-relatorio-vendas"
          emptyMessage="Nenhuma venda no período selecionado."
          operatorName={operatorName}
          notes={
            rows.length === 5000
              ? "Limite de 5.000 linhas atingido — refine o período pra ver mais detalhe."
              : undefined
          }
        />
      )}
    </>
  );
}

// ===========================================================================
// Sprint 4.3 — view alternativa com agrupamento por dia.
// Mesma identidade visual do ReportLayout (mesma classe .report-print-root
// pra CSS @media print esconder o shell admin). Diferente: tabela por
// dia + linha de subtotal por dia.
// ===========================================================================

function GroupedSalesReport({
  rows,
  period,
  storeInfo,
  operatorName,
  summaryTotals,
}: {
  rows: SalesReportRow[];
  period: string;
  storeInfo: ReportStoreInfo;
  operatorName?: string | null;
  summaryTotals: ReportTotal[];
}) {
  // Agrupa rows por data (YYYY-MM-DD em local time). Ordena dias desc
  // pra "mais recente primeiro" — mesma convenção do listing flat.
  const groups = new Map<string, SalesReportRow[]>();
  for (const r of rows) {
    const key = r.createdAt.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const existing = groups.get(key);
    if (existing) existing.push(r);
    else groups.set(key, [r]);
  }

  return (
    <>
      <div className="report-toolbar mb-4 flex flex-wrap items-center justify-end gap-2 print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="border-line text-ink-1 hover:bg-bg-app inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-[12.5px]"
        >
          Imprimir
        </button>
      </div>

      <article className="report-print-root mx-auto max-w-[210mm] bg-white text-[11.5px] text-ink-1 shadow-sm print:max-w-full print:shadow-none">
        <header className="flex items-start justify-between gap-4 border-b border-ink-5 px-6 pb-3 pt-6 print:px-0">
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

        <div className="border-b border-ink-5 px-6 py-3 print:px-0">
          <h2 className="text-[16px] font-semibold tracking-tight">
            Relatório de vendas (por dia)
          </h2>
          <p className="text-[11px] text-ink-3">Período: {period}</p>
        </div>

        <div className="px-6 py-4 print:px-0">
          {groups.size === 0 ? (
            <p className="py-8 text-center text-[12px] text-ink-3">
              Nenhuma venda no período selecionado.
            </p>
          ) : (
            <div className="space-y-5">
              {[...groups.entries()].map(([date, dayRows]) => {
                const dayTotal = dayRows.reduce(
                  (s, r) => s + r.totalInCents - r.returnedInCents,
                  0,
                );
                return (
                  <section
                    key={date}
                    className="print:break-inside-avoid"
                  >
                    <div className="border-ink-2 mb-1 flex items-center justify-between border-b py-1 text-[11.5px]">
                      <span className="font-semibold">{date}</span>
                      <span className="text-ink-3">
                        {dayRows.length}{" "}
                        {dayRows.length === 1 ? "venda" : "vendas"} ·{" "}
                        <span className="text-ink-1 font-mono tabular-nums">
                          {formatBRL(dayTotal)}
                        </span>
                      </span>
                    </div>
                    <table className="w-full border-collapse text-[11.5px] tabular-nums">
                      <tbody>
                        {dayRows.map((r) => (
                          <tr
                            key={r.id}
                            className="border-b border-ink-5/40"
                          >
                            <td className="py-1 px-2 font-mono text-[10.5px]">
                              {r.shortCode}
                            </td>
                            <td className="py-1 px-2">
                              {r.customerName}
                            </td>
                            <td className="py-1 px-2 text-[10.5px] text-ink-3">
                              {r.paymentMethod
                                ? METHOD_LABEL[r.paymentMethod] ??
                                  r.paymentMethod
                                : "—"}
                            </td>
                            <td className="py-1 px-2 text-right">
                              {formatBRL(r.totalInCents)}
                              {r.returnedInCents > 0 ? (
                                <span className="text-destructive ml-1 text-[10px]">
                                  −{formatBRL(r.returnedInCents)}
                                </span>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>
                );
              })}
            </div>
          )}
        </div>

        {summaryTotals.length > 0 ? (
          <div className="border-t-2 border-ink-2 px-6 py-3 text-[11.5px] print:px-0">
            <div className="flex flex-wrap justify-end gap-x-8 gap-y-1">
              {summaryTotals.map((t) => (
                <div key={t.label} className="text-right">
                  <div className="text-[10px] uppercase tracking-wide text-ink-4">
                    {t.label}
                  </div>
                  <div
                    className={
                      t.emphasis
                        ? "text-[13px] font-semibold"
                        : "text-[11.5px] font-medium"
                    }
                  >
                    {t.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <footer className="border-t border-ink-5 px-6 py-3 text-[10px] text-ink-4 print:px-0">
          <p>
            Gerado em{" "}
            {new Date().toLocaleString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
            {operatorName ? ` por ${operatorName}` : ""}
            <span className="report-page-marker hidden print:inline">
              {" · Página "}
            </span>
          </p>
        </footer>
      </article>
    </>
  );
}

function ResumeCard({
  title,
  entries,
}: {
  title: string;
  entries: { label: string; count: number; revenueInCents: number }[];
}) {
  if (entries.length === 0) return null;
  return (
    <div className="b3-card b3-card-pad">
      <div className="text-ink-4 mb-2 text-[10.5px] font-bold uppercase tracking-[0.06em]">
        {title}
      </div>
      <ul className="space-y-1.5 text-[12.5px]">
        {entries.map((e) => (
          <li
            key={e.label}
            className="flex items-center justify-between gap-3"
          >
            <span className="text-ink-2">
              {e.label}
              <span className="text-ink-4 ml-1.5 text-[11px] tabular-nums">
                ({e.count})
              </span>
            </span>
            <span className="text-ink-1 font-medium tabular-nums">
              {formatBRL(e.revenueInCents)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
