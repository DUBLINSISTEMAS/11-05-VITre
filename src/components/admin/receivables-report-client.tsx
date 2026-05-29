"use client";

/**
 * Sprint 5E — Wrapper client de /admin/financeiro/receber/relatorio.
 *
 * A4 imprimível dos fiados pendentes. Lojista vai usar pra cobrança
 * (imprime, leva, mostra pro cliente) ou pra prestar contas ao contador.
 */

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import type { PendingReceivableRow } from "@/actions/receivable/load-pending";
import {
  type ReportColumn,
  ReportLayout,
  type ReportStoreInfo,
  type ReportTotal,
} from "@/components/admin/report/report-layout";
import { formatBRL } from "@/lib/pricing";

const STATUS_FILTERS: { value: "all" | "overdue"; label: string }[] = [
  { value: "all", label: "Todos pendentes" },
  { value: "overdue", label: "Apenas vencidos" },
];

interface ReceivablesReportClientProps {
  storeInfo: ReportStoreInfo;
  rows: PendingReceivableRow[];
  totals: {
    pendingSum: number;
    overdueSum: number;
    overdueCount: number;
    pendingCount: number;
  };
  statusFilter: "all" | "overdue";
  /** Sprint 4.8 — operador no rodapé. */
  operatorName?: string | null;
}

// Sprint 4.4 — aging buckets. Quando o fiado não tem `dueDate`, usamos
// `createdAt` como proxy (regra comum em contabilidade: idade conta a
// partir da criação se não houve vencimento pactuado).
type AgingBucket = "current" | "1-30" | "31-60" | "61+";
const AGING_LABELS: Record<AgingBucket, string> = {
  current: "Em dia",
  "1-30": "1-30 dias",
  "31-60": "31-60 dias",
  "61+": "61+ dias",
};

function bucketFromDays(days: number): AgingBucket {
  if (days <= 0) return "current";
  if (days <= 30) return "1-30";
  if (days <= 60) return "31-60";
  return "61+";
}

function daysSince(date: Date, now: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((now.getTime() - date.getTime()) / msPerDay);
}

export function ReceivablesReportClient({
  storeInfo,
  rows,
  totals,
  statusFilter,
  operatorName,
}: ReceivablesReportClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateParam = (key: string, value: string | null) => {
    const usp = new URLSearchParams(searchParams.toString());
    if (value === null) usp.delete(key);
    else usp.set(key, value);
    router.replace(`?${usp.toString()}`);
  };

  // Sprint 4.4 — enriquece rows com bucket de aging derivado de
  // dueDate (ou createdAt como fallback). Computado uma vez por render.
  const now = new Date();
  const rowsWithAging = rows.map((r) => {
    const referenceDate = r.dueDate ?? r.createdAt;
    const days = daysSince(referenceDate, now);
    return { ...r, daysOpen: Math.max(0, days), bucket: bucketFromDays(days) };
  });

  // Subtotais por bucket — soma de remainingInCents por categoria.
  // Inclui buckets vazios (mostra "R$ 0,00") pra contador ver as 4 faixas.
  const agingTotals: Record<AgingBucket, number> = {
    current: 0,
    "1-30": 0,
    "31-60": 0,
    "61+": 0,
  };
  for (const r of rowsWithAging) {
    agingTotals[r.bucket] += r.remainingInCents;
  }

  const columns: ReportColumn<(typeof rowsWithAging)[number]>[] = [
    {
      key: "due",
      label: "Vencimento",
      align: "left",
      width: "100px",
      render: (r) =>
        r.dueDate
          ? r.dueDate.toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })
          : "Sem prazo",
      exportValue: (r) =>
        r.dueDate
          ? r.dueDate.toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })
          : "",
    },
    {
      // Sprint 4.4 — aging por linha. Coluna estreita, render compacto.
      key: "aging",
      label: "Em aberto há",
      align: "right",
      width: "100px",
      render: (r) => (
        <div className="flex flex-col items-end gap-0 leading-tight tabular-nums">
          <span className="text-ink-1">
            {r.daysOpen === 0 ? "—" : `${r.daysOpen} dia${r.daysOpen === 1 ? "" : "s"}`}
          </span>
          <span className="text-ink-4 text-[10px]">
            {AGING_LABELS[r.bucket]}
          </span>
        </div>
      ),
      exportValue: (r) => `${r.daysOpen}`,
    },
    {
      key: "customer",
      label: "Cliente",
      align: "left",
      render: (r) => (
        <div>
          <div className="text-ink-1">{r.customerName}</div>
          {r.customerPhone ? (
            <div className="text-ink-4 mono text-[10px]">{r.customerPhone}</div>
          ) : null}
        </div>
      ),
      exportValue: (r) => `${r.customerName}${r.customerPhone ? ` (${r.customerPhone})` : ""}`,
    },
    {
      key: "amount",
      label: "Valor total",
      align: "right",
      width: "110px",
      render: (r) => (
        <span className="tabular-nums">{formatBRL(r.amountInCents)}</span>
      ),
      exportValue: (r) => (r.amountInCents / 100).toFixed(2),
    },
    {
      key: "paid",
      label: "Pago",
      align: "right",
      width: "100px",
      render: (r) => (
        <span className="tabular-nums">
          {r.paidInCents > 0 ? formatBRL(r.paidInCents) : "—"}
        </span>
      ),
      exportValue: (r) => (r.paidInCents > 0 ? (r.paidInCents / 100).toFixed(2) : ""),
    },
    {
      key: "remaining",
      label: "Saldo",
      align: "right",
      width: "110px",
      render: (r) => (
        <span
          className={`tabular-nums font-medium ${r.isOverdue ? "text-danger" : "text-ink-1"}`}
        >
          {formatBRL(r.remainingInCents)}
        </span>
      ),
      exportValue: (r) => (r.remainingInCents / 100).toFixed(2),
    },
    {
      key: "status",
      label: "Status",
      align: "left",
      width: "90px",
      render: (r) =>
        r.isOverdue ? (
          <span className="text-danger">Vencido</span>
        ) : r.paidInCents > 0 ? (
          <span className="text-brand">Parcial</span>
        ) : (
          <span className="text-warn">Aberto</span>
        ),
      exportValue: (r) =>
        r.isOverdue ? "Vencido" : r.paidInCents > 0 ? "Parcial" : "Aberto",
    },
  ];

  const totalsFooter: ReportTotal[] = [
    {
      label: "Lançamentos",
      value: totals.pendingCount.toLocaleString("pt-BR"),
    },
    {
      label: "Vencido",
      value: formatBRL(totals.overdueSum),
    },
    {
      label: "Saldo total",
      value: formatBRL(totals.pendingSum),
      emphasis: true,
    },
  ];

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3 print:hidden">
        <Link
          href="/admin/financeiro?tab=receber"
          prefetch
          className="text-ink-4 hover:text-ink-1 text-[11px] uppercase tracking-wide"
        >
          ← A receber
        </Link>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="text-ink-4 text-[11px] uppercase tracking-wide">
              Filtro
            </span>
            <div className="flex">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() =>
                    updateParam("status", f.value === "all" ? null : f.value)
                  }
                  className={`border-line border px-2 py-1 text-[11px] first:rounded-l-md last:rounded-r-md ${
                    statusFilter === f.value
                      ? "bg-brand text-white border-brand"
                      : "bg-surface text-ink-2 hover:bg-bg-app"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Sprint 4.4 — quadro de aging acima do A4. 4 cards com totais
          por bucket. Imprime junto com o relatório como bloco. */}
      <div className="b3-card mb-4 grid grid-cols-2 gap-2 p-3 sm:grid-cols-4 sm:p-4">
        {(Object.keys(AGING_LABELS) as AgingBucket[]).map((bucket) => {
          const amount = agingTotals[bucket];
          const danger = bucket === "61+" && amount > 0;
          const warning = bucket === "31-60" && amount > 0;
          return (
            <div
              key={bucket}
              className="bg-bg-app rounded-md p-2.5 text-[12px]"
            >
              <p className="text-ink-4 mb-0.5 text-[11px] uppercase tracking-wide">
                {AGING_LABELS[bucket]}
              </p>
              <p
                className={`font-mono text-[14.5px] font-semibold tabular-nums ${
                  danger
                    ? "text-danger"
                    : warning
                      ? "text-warn"
                      : "text-ink-1"
                }`}
              >
                {formatBRL(amount)}
              </p>
            </div>
          );
        })}
      </div>

      <ReportLayout
        title={
          statusFilter === "overdue"
            ? "Fiados vencidos"
            : "Fiados pendentes"
        }
        period={`Snapshot em ${new Date().toLocaleDateString("pt-BR")}`}
        storeInfo={storeInfo}
        columns={columns}
        rows={rowsWithAging}
        totals={totalsFooter}
        csvFileName={`mangospay-fiados-${statusFilter}`}
        operatorName={operatorName}
        emptyMessage={
          statusFilter === "overdue"
            ? "Nenhum fiado vencido. Bom trabalho."
            : "Nenhum fiado pendente."
        }
        notes={
          totals.overdueCount > 0
            ? `${totals.overdueCount} ${
                totals.overdueCount === 1 ? "fiado vencido" : "fiados vencidos"
              } — acionar cliente.`
            : undefined
        }
      />
    </>
  );
}
