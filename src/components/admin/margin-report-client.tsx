"use client";

/**
 * Sprint 5C — Wrapper client de /admin/relatorios/margem.
 */

import { InfoIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import type { MarginReportRow } from "@/actions/reports/types";
import {
  type ReportColumn,
  ReportLayout,
  type ReportStoreInfo,
  type ReportTotal,
} from "@/components/admin/report/report-layout";
import { formatBRL } from "@/lib/pricing";

const PERIODS: { value: string; label: string }[] = [
  { value: "7", label: "7 dias" },
  { value: "30", label: "30 dias" },
  { value: "90", label: "90 dias" },
];

function formatPct(n: number | null): string {
  if (n === null) return "—";
  return `${n.toFixed(1).replace(".", ",")}%`;
}

interface MarginReportClientProps {
  storeInfo: ReportStoreInfo;
  rows: MarginReportRow[];
  totals: {
    totalRevenueInCents: number;
    totalCostInCents: number;
    totalMarginInCents: number;
    overallMarginPercent: number | null;
    productsWithCost: number;
    productsTotal: number;
  };
  period: string;
  filters: Record<string, string | undefined>;
}

export function MarginReportClient({
  storeInfo,
  rows,
  totals,
  period,
  filters,
}: MarginReportClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateParam = (key: string, value: string | null) => {
    const usp = new URLSearchParams(searchParams.toString());
    if (value === null) usp.delete(key);
    else usp.set(key, value);
    router.replace(`?${usp.toString()}`);
  };

  const columns: ReportColumn<MarginReportRow>[] = [
    {
      key: "name",
      label: "Produto",
      align: "left",
      render: (r) => (
        <div>
          <div className="text-ink-1">{r.productName}</div>
          {r.itemsWithCost < r.itemsTotal ? (
            <div className="text-warn text-[10px]">
              {r.itemsWithCost}/{r.itemsTotal} itens com custo cadastrado
            </div>
          ) : null}
        </div>
      ),
      exportValue: (r) => r.productName,
    },
    {
      key: "qty",
      label: "Qtd",
      align: "right",
      width: "70px",
      render: (r) => (
        <span className="tabular-nums">
          {r.quantitySold.toLocaleString("pt-BR")}
        </span>
      ),
      exportValue: (r) => r.quantitySold,
    },
    {
      key: "revenue",
      label: "Faturamento",
      align: "right",
      width: "110px",
      render: (r) => (
        <div className="flex flex-col items-end gap-0.5 tabular-nums">
          <span>{formatBRL(r.revenueInCents)}</span>
          {r.returnedRevenueInCents > 0 ? (
            <span className="text-destructive text-[10.5px]">
              −{formatBRL(r.returnedRevenueInCents)}
            </span>
          ) : null}
        </div>
      ),
      // Sprint 1.4: export usa receita LÍQUIDA — contador subtrai
      // devolução do faturamento na DRE também, então bate.
      exportValue: (r) =>
        ((r.revenueInCents - r.returnedRevenueInCents) / 100).toFixed(2),
    },
    {
      key: "cost",
      label: "Custo",
      align: "right",
      width: "110px",
      render: (r) => (
        <div className="flex flex-col items-end gap-0.5 tabular-nums">
          <span>
            {r.totalCostInCents === null ? "—" : formatBRL(r.totalCostInCents)}
          </span>
          {r.returnedCostInCents !== null && r.returnedCostInCents > 0 ? (
            <span className="text-destructive text-[10.5px]">
              −{formatBRL(r.returnedCostInCents)}
            </span>
          ) : null}
        </div>
      ),
      exportValue: (r) => {
        if (r.totalCostInCents === null) return "";
        const net = r.totalCostInCents - (r.returnedCostInCents ?? 0);
        return (net / 100).toFixed(2);
      },
    },
    {
      key: "margin",
      label: "Margem R$",
      align: "right",
      width: "110px",
      render: (r) => (
        <span
          className={`tabular-nums ${
            r.marginInCents === null
              ? "text-ink-4"
              : r.marginInCents < 0
              ? "text-danger"
              : "text-ink-1 font-medium"
          }`}
        >
          {r.marginInCents === null ? "—" : formatBRL(r.marginInCents)}
        </span>
      ),
      exportValue: (r) =>
        r.marginInCents === null ? "" : (r.marginInCents / 100).toFixed(2),
    },
    {
      key: "marginPct",
      label: "Margem %",
      align: "right",
      width: "80px",
      render: (r) => (
        <span
          className={`tabular-nums ${
            r.marginPercent === null
              ? "text-ink-4"
              : r.marginPercent < 0
              ? "text-danger"
              : "text-ink-1 font-medium"
          }`}
        >
          {formatPct(r.marginPercent)}
        </span>
      ),
      exportValue: (r) =>
        r.marginPercent === null ? "" : r.marginPercent.toFixed(2),
    },
  ];

  const totalsFooter: ReportTotal[] = [
    {
      label: "Faturamento",
      value: formatBRL(totals.totalRevenueInCents),
    },
    {
      label: "Custo",
      value: formatBRL(totals.totalCostInCents),
    },
    {
      label: "Margem",
      value: `${formatBRL(totals.totalMarginInCents)} (${formatPct(totals.overallMarginPercent)})`,
      emphasis: true,
    },
  ];

  const currentPeriodo = filters.periodo ?? "30";
  const coverage =
    totals.productsTotal === 0
      ? 100
      : Math.round((totals.productsWithCost / totals.productsTotal) * 100);

  return (
    <>
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
        </div>
      </div>

      {coverage < 100 ? (
        <div className="bg-warn-wash text-warn mb-4 flex items-start gap-2 rounded-md px-3 py-2 text-[11.5px] print:hidden">
          <InfoIcon size={14} className="mt-0.5 shrink-0" />
          <div>
            Apenas <strong>{totals.productsWithCost} de {totals.productsTotal}</strong>{" "}
            produtos vendidos têm custo cadastrado ({coverage}% de cobertura).
            Margem global e linhas com travessão indicam falta de custo —{" "}
            <Link
              href="/admin/produtos/custos"
              prefetch
              className="underline"
            >
              cadastrar custos em massa
            </Link>
            .
          </div>
        </div>
      ) : null}

      <ReportLayout
        title="Margem por produto"
        period={period}
        storeInfo={storeInfo}
        columns={columns}
        rows={rows}
        totals={totalsFooter}
        csvFileName="mangospay-margem"
        emptyMessage="Nenhuma venda no período selecionado."
        notes={
          coverage < 100
            ? `Cobertura de custo: ${coverage}% — margem global considera apenas linhas com custo cadastrado.`
            : undefined
        }
      />
    </>
  );
}
