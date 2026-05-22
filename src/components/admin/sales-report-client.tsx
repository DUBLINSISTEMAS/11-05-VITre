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
}

export function SalesReportClient({
  storeInfo,
  rows,
  summary,
  period,
  filters,
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
                      : "bg-bg-card text-ink-2 hover:bg-bg-app"
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
              className="border-line h-7 rounded-md border bg-bg-card px-2 text-[12px]"
            >
              {METHOD_FILTERS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
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

      <ReportLayout
        title="Relatório de vendas"
        period={period}
        storeInfo={storeInfo}
        columns={columns}
        rows={rows}
        totals={totals}
        csvFileName="mangospay-relatorio-vendas"
        emptyMessage="Nenhuma venda no período selecionado."
        notes={
          rows.length === 5000
            ? "Limite de 5.000 linhas atingido — refine o período pra ver mais detalhe."
            : undefined
        }
      />
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
