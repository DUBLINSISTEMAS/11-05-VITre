"use client";

/**
 * Sprint 5B — Wrapper client de /admin/relatorios/top.
 */

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import type { TopProductRow } from "@/actions/reports/types";
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

interface TopProductsReportClientProps {
  storeInfo: ReportStoreInfo;
  rows: TopProductRow[];
  totals: {
    totalQuantitySold: number;
    totalRevenueInCents: number;
    distinctProducts: number;
  };
  period: string;
  filters: Record<string, string | undefined>;
  orderBy: "quantity" | "revenue";
  /** Sprint 4.8 — operador no rodapé. */
  operatorName?: string | null;
}

export function TopProductsReportClient({
  storeInfo,
  rows,
  totals,
  period,
  filters,
  orderBy,
  operatorName,
}: TopProductsReportClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateParam = (key: string, value: string | null) => {
    const usp = new URLSearchParams(searchParams.toString());
    if (value === null) usp.delete(key);
    else usp.set(key, value);
    router.replace(`?${usp.toString()}`);
  };

  const columns: ReportColumn<TopProductRow & { rank: number }>[] = [
    {
      key: "rank",
      label: "#",
      align: "right",
      width: "40px",
      render: (r) => <span className="tabular-nums">{r.rank}</span>,
      exportValue: (r) => r.rank,
    },
    {
      key: "name",
      label: "Produto",
      align: "left",
      render: (r) => r.productName,
      exportValue: (r) => r.productName,
    },
    {
      key: "qty",
      label: "Qtd vendida",
      align: "right",
      width: "110px",
      render: (r) => (
        <div className="flex flex-col items-end gap-0.5 tabular-nums">
          <span>{r.quantitySold.toLocaleString("pt-BR")}</span>
          {r.returnedQuantity > 0 ? (
            <span className="text-destructive text-[10.5px]">
              −{r.returnedQuantity} devolvido
            </span>
          ) : null}
        </div>
      ),
      // Export usa qty líquida (vendido - devolvido) — bate com o que
      // o contador espera ver na coluna "qtd vendida" pro mês.
      exportValue: (r) => r.netQuantity,
    },
    {
      key: "revenue",
      label: "Faturamento",
      align: "right",
      width: "130px",
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
      exportValue: (r) => (r.netRevenueInCents / 100).toFixed(2),
    },
  ];

  const ranked = rows.map((r, i) => ({ ...r, rank: i + 1 }));

  const totalsFooter: ReportTotal[] = [
    {
      label: "Produtos distintos",
      value: totals.distinctProducts.toLocaleString("pt-BR"),
    },
    {
      label: "Total vendido",
      value: totals.totalQuantitySold.toLocaleString("pt-BR"),
    },
    {
      label: "Faturamento",
      value: formatBRL(totals.totalRevenueInCents),
      emphasis: true,
    },
  ];

  const currentPeriodo = filters.periodo ?? "30";

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
              Ordenar por
            </span>
            <div className="flex">
              <button
                type="button"
                onClick={() => updateParam("orderBy", "revenue")}
                className={`border-line rounded-l-md border px-2 py-1 text-[11px] ${
                  orderBy === "revenue"
                    ? "bg-brand text-white border-brand"
                    : "bg-surface text-ink-2 hover:bg-bg-app"
                }`}
              >
                Faturamento
              </button>
              <button
                type="button"
                onClick={() => updateParam("orderBy", "quantity")}
                className={`border-line rounded-r-md border border-l-0 px-2 py-1 text-[11px] ${
                  orderBy === "quantity"
                    ? "bg-brand text-white border-brand"
                    : "bg-surface text-ink-2 hover:bg-bg-app"
                }`}
              >
                Quantidade
              </button>
            </div>
          </div>
        </div>
      </div>

      <ReportLayout
        title={
          orderBy === "quantity"
            ? "Top produtos — por quantidade"
            : "Top produtos — por faturamento"
        }
        period={period}
        storeInfo={storeInfo}
        columns={columns}
        rows={ranked}
        totals={totalsFooter}
        csvFileName={`mangospay-top-${orderBy}`}
        emptyMessage="Nenhuma venda no período selecionado."
        operatorName={operatorName}
      />
    </>
  );
}
