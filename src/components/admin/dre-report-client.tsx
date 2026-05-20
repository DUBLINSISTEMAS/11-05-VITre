"use client";

/**
 * Sprint 5D — Wrapper client de /admin/relatorios/dre.
 *
 * DRE não é lista — é resumo. Modelo a tabela de 2 colunas
 * (conta · valor) com linhas semânticas destacadas (Receita líquida e
 * Lucro bruto em bold).
 */

import { InfoIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import type { DreSimpleSummary } from "@/actions/reports/types";
import {
  type ReportColumn,
  ReportLayout,
  type ReportStoreInfo,
} from "@/components/admin/report/report-layout";
import { formatBRL } from "@/lib/pricing";

const PERIODS: { value: string; label: string }[] = [
  { value: "7", label: "7 dias" },
  { value: "30", label: "30 dias" },
  { value: "90", label: "90 dias" },
];

interface DreLine {
  /** "header" / "subtotal" / "total" / "minus" / "plus". */
  kind: "plus" | "minus" | "subtotal" | "total";
  label: string;
  value: number;
  isSimplification?: boolean;
}

interface DreReportClientProps {
  storeInfo: ReportStoreInfo;
  summary: DreSimpleSummary;
  period: string;
  filters: Record<string, string | undefined>;
}

export function DreReportClient({
  storeInfo,
  summary,
  period,
  filters,
}: DreReportClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateParam = (key: string, value: string | null) => {
    const usp = new URLSearchParams(searchParams.toString());
    if (value === null) usp.delete(key);
    else usp.set(key, value);
    router.replace(`?${usp.toString()}`);
  };

  const lines: DreLine[] = [
    {
      kind: "plus",
      label: "(+) Receita bruta de vendas",
      value: summary.grossRevenueInCents,
    },
    {
      kind: "minus",
      label: "(−) Descontos concedidos",
      value: summary.discountsInCents,
    },
    {
      kind: "plus",
      label: "(+) Acréscimos (taxas, frete, embalagem)",
      value: summary.surchargesInCents,
    },
    {
      kind: "subtotal",
      label: "(=) Receita líquida",
      value: summary.netRevenueInCents,
    },
    {
      kind: "minus",
      label: "(−) Custo da mercadoria vendida (CMV)",
      value: summary.cogsInCents,
      isSimplification: summary.cogsCoveragePercent < 100,
    },
    {
      kind: "total",
      label: "(=) Lucro bruto",
      value: summary.grossProfitInCents,
    },
  ];

  const columns: ReportColumn<DreLine>[] = [
    {
      key: "label",
      label: "Conta",
      align: "left",
      render: (l) => (
        <span
          className={`${
            l.kind === "total"
              ? "text-ink-1 text-[13px] font-bold"
              : l.kind === "subtotal"
              ? "text-ink-1 text-[12.5px] font-semibold"
              : "text-ink-2"
          }`}
        >
          {l.label}
          {l.isSimplification ? (
            <span className="text-warn ml-1 text-[10px]">
              · cobertura {summary.cogsCoveragePercent}%
            </span>
          ) : null}
        </span>
      ),
      exportValue: (l) => l.label,
    },
    {
      key: "value",
      label: "Valor",
      align: "right",
      width: "160px",
      render: (l) => (
        <span
          className={`tabular-nums ${
            l.kind === "total"
              ? "text-[14px] font-bold " +
                (l.value >= 0 ? "text-ok" : "text-danger")
              : l.kind === "subtotal"
              ? "text-ink-1 text-[12.5px] font-semibold"
              : l.kind === "minus"
              ? "text-ink-3"
              : "text-ink-2"
          }`}
        >
          {l.kind === "minus" ? "− " : ""}
          {formatBRL(Math.abs(l.value))}
        </span>
      ),
      exportValue: (l) =>
        ((l.kind === "minus" ? -1 : 1) * l.value / 100).toFixed(2),
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

      <div className="bg-warn-wash text-warn mb-4 flex items-start gap-2 rounded-md px-3 py-2 text-[11.5px] print:hidden">
        <InfoIcon size={14} className="mt-0.5 shrink-0" />
        <div>
          DRE <strong>simplificado</strong> — considera apenas vendas, sem
          despesas operacionais (aluguel, energia, salários). Pra DRE
          completa, registre as despesas (feature futura). Cobertura de
          custo: <strong>{summary.cogsCoveragePercent}%</strong> dos itens
          vendidos têm custo cadastrado.
        </div>
      </div>

      <ReportLayout
        title="DRE simplificado"
        period={period}
        storeInfo={storeInfo}
        columns={columns}
        rows={lines}
        csvFileName="vitre-dre"
        emptyMessage="Nenhuma venda no período selecionado."
        notes={`Baseado em ${summary.totalOrderCount} ${
          summary.totalOrderCount === 1 ? "venda" : "vendas"
        } no período. CMV considera ${summary.cogsCoveragePercent}% dos itens (com custo cadastrado).`}
      />
    </>
  );
}
