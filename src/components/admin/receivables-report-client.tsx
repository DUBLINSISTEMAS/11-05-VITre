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
}

export function ReceivablesReportClient({
  storeInfo,
  rows,
  totals,
  statusFilter,
}: ReceivablesReportClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateParam = (key: string, value: string | null) => {
    const usp = new URLSearchParams(searchParams.toString());
    if (value === null) usp.delete(key);
    else usp.set(key, value);
    router.replace(`?${usp.toString()}`);
  };

  const columns: ReportColumn<PendingReceivableRow>[] = [
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
          href="/admin/financeiro/receber"
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
                      : "bg-bg-card text-ink-2 hover:bg-bg-app"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
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
        rows={rows}
        totals={totalsFooter}
        csvFileName={`vitre-fiados-${statusFilter}`}
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
