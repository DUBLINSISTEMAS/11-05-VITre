"use client";

/**
 * ExpensesReportClient — Onda Relatórios A4 (2026-05-29).
 *
 * Wrapper client de /admin/relatorios/despesas. Renderiza:
 *   1. Toolbar de filtros (período / categoria / status / recorrente)
 *      — print:hidden
 *   2. Resumo por categoria (cards densos) — print:visible
 *   3. ReportLayout com tabela densa + totals
 *
 * Estilo Stripe minimalista: tipografia compacta, hierarquia por
 * peso + cor, números tabulares. Nada de splash.
 */

import { useRouter, useSearchParams } from "next/navigation";

import type {
  ExpensesByCategoryRow,
  ExpensesReportRow,
  ExpensesReportSummary,
} from "@/actions/reports/load-expenses-report";
import {
  type ReportColumn,
  ReportLayout,
  type ReportStoreInfo,
  type ReportTotal,
} from "@/components/admin/report/report-layout";
import { Money } from "@/components/ui/money";
import { formatBRL } from "@/lib/pricing";
import { cn } from "@/lib/utils";

const PERIODS: { value: string; label: string }[] = [
  { value: "mes", label: "Este mês" },
  { value: "trimestre", label: "Trimestre" },
  { value: "ano", label: "Ano" },
  { value: "30", label: "30 dias" },
  { value: "90", label: "90 dias" },
];

const CATEGORY_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Todas categorias" },
  { value: "rent", label: "Aluguel" },
  { value: "payroll", label: "Salário/comissão" },
  { value: "utilities", label: "Luz/água/internet" },
  { value: "supplies", label: "Materiais" },
  { value: "marketing", label: "Marketing/ads" },
  { value: "tax", label: "Impostos" },
  { value: "card_fees", label: "Taxas maquineta" },
  { value: "other", label: "Outro" },
];

const PAID_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "paid", label: "Pago" },
  { value: "pending", label: "Em aberto" },
];

const RECURRING_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "yes", label: "Recorrentes" },
  { value: "no", label: "Avulsas" },
];

interface ExpensesReportClientProps {
  storeInfo: ReportStoreInfo;
  rows: ExpensesReportRow[];
  summary: ExpensesReportSummary;
  period: string;
  filters: Record<string, string | undefined>;
  operatorName?: string | null;
}

function formatDateBR(iso: string | null): string {
  if (!iso) return "—";
  // Postgres DATE chega como "YYYY-MM-DD". Sem timezone, sem ambiguidade.
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function ExpensesReportClient({
  storeInfo,
  rows,
  summary,
  period,
  filters,
  operatorName,
}: ExpensesReportClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateParam = (key: string, value: string | null) => {
    const usp = new URLSearchParams(searchParams.toString());
    if (value === null || value === "") usp.delete(key);
    else usp.set(key, value);
    router.replace(`?${usp.toString()}`);
  };

  const columns: ReportColumn<ExpensesReportRow>[] = [
    {
      key: "date",
      label: "Data",
      align: "left",
      width: "90px",
      render: (r) => formatDateBR(r.paidAt ?? r.dueDate),
      exportValue: (r) => formatDateBR(r.paidAt ?? r.dueDate),
    },
    {
      key: "category",
      label: "Categoria",
      align: "left",
      width: "150px",
      render: (r) => (
        <span className="inline-flex items-center gap-1.5">
          {r.categoryLabel}
          {r.recurring ? (
            <span
              className="rounded px-1 py-px text-[9px] font-semibold uppercase tracking-wide"
              style={{
                background: "var(--mangos-cream-soft)",
                color: "var(--mangos-yellow-deep)",
              }}
              title="Despesa recorrente (mensal)"
            >
              Mensal
            </span>
          ) : null}
        </span>
      ),
      exportValue: (r) =>
        `${r.categoryLabel}${r.recurring ? " (mensal)" : ""}`,
    },
    {
      key: "supplier",
      label: "Fornecedor",
      align: "left",
      render: (r) => r.supplierName ?? "—",
      exportValue: (r) => r.supplierName ?? "",
    },
    {
      key: "notes",
      label: "Descrição",
      align: "left",
      render: (r) => (
        <span className="text-ink-2">{r.notes ?? "—"}</span>
      ),
      exportValue: (r) => r.notes ?? "",
    },
    {
      key: "status",
      label: "Status",
      align: "left",
      width: "90px",
      render: (r) =>
        r.paidAt ? (
          <span className="text-emerald-700">Pago</span>
        ) : (
          <span className="text-amber-700">Em aberto</span>
        ),
      exportValue: (r) => (r.paidAt ? "Pago" : "Em aberto"),
    },
    {
      key: "value",
      label: "Valor",
      align: "right",
      width: "110px",
      render: (r) => (
        <span className="font-medium">{formatBRL(r.amountInCents)}</span>
      ),
      exportValue: (r) => (r.amountInCents / 100).toFixed(2).replace(".", ","),
    },
  ];

  const totals: ReportTotal[] = [
    {
      label: "Pago",
      value: formatBRL(summary.totalPaidInCents),
    },
    {
      label: "Em aberto",
      value: formatBRL(summary.totalPendingInCents),
    },
    {
      label: "Total",
      value: formatBRL(summary.totalAllInCents),
      emphasis: true,
    },
  ];

  const currentPeriod = filters.periodo ?? "mes";
  const currentCategory = filters.category ?? "";
  const currentPaid = filters.paid ?? "all";
  const currentRecurring = filters.recurring ?? "all";

  return (
    <div className="space-y-4">
      {/* Toolbar — não vai pra impressão */}
      <div className="b3-card b3-card-pad space-y-3 print:hidden">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px]">
          <FilterGroup label="Período">
            {PERIODS.map((p) => (
              <FilterChip
                key={p.value}
                active={currentPeriod === p.value}
                onClick={() => updateParam("periodo", p.value)}
              >
                {p.label}
              </FilterChip>
            ))}
          </FilterGroup>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px]">
          <FilterGroup label="Categoria">
            {CATEGORY_FILTERS.map((c) => (
              <FilterChip
                key={c.value || "all"}
                active={currentCategory === c.value}
                onClick={() => updateParam("category", c.value || null)}
              >
                {c.label}
              </FilterChip>
            ))}
          </FilterGroup>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px]">
          <FilterGroup label="Status">
            {PAID_FILTERS.map((p) => (
              <FilterChip
                key={p.value}
                active={currentPaid === p.value}
                onClick={() =>
                  updateParam("paid", p.value === "all" ? null : p.value)
                }
              >
                {p.label}
              </FilterChip>
            ))}
          </FilterGroup>
          <FilterGroup label="Tipo">
            {RECURRING_FILTERS.map((r) => (
              <FilterChip
                key={r.value}
                active={currentRecurring === r.value}
                onClick={() =>
                  updateParam("recurring", r.value === "all" ? null : r.value)
                }
              >
                {r.label}
              </FilterChip>
            ))}
          </FilterGroup>
        </div>
      </div>

      {/* Resumo por categoria — entra na impressão como pré-tabela.
          Densidade compacta, cor sutil pela barra de proporção. */}
      {summary.byCategory.length > 0 ? (
        <section
          className="b3-card b3-card-pad print:border-0 print:p-0 print:shadow-none"
          aria-label="Resumo por categoria"
        >
          <h3 className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.05em] text-ink-4">
            Por categoria
          </h3>
          <ul className="space-y-1.5">
            {summary.byCategory.map((c) => (
              <CategoryRow key={c.category} row={c} />
            ))}
          </ul>
          {summary.recurringCount > 0 ? (
            <p className="mt-3 border-t border-line pt-2 text-[11px] text-ink-3">
              <span className="font-medium">
                {summary.recurringCount} despesa
                {summary.recurringCount === 1 ? "" : "s"} recorrente
                {summary.recurringCount === 1 ? "" : "s"}
              </span>{" "}
              somam <Money valueInCents={summary.recurringSumInCents} size="sm" />
              {" "}no período — fixos que se repetem todo mês.
            </p>
          ) : null}
        </section>
      ) : null}

      {/* ReportLayout — header A4 + tabela + footer com data/operador */}
      <ReportLayout<ExpensesReportRow>
        title="Despesas do período"
        period={period}
        storeInfo={storeInfo}
        columns={columns}
        rows={rows}
        totals={totals}
        csvFileName={`despesas-${new Date().toISOString().slice(0, 10)}`}
        emptyMessage="Nenhuma despesa lançada nesse período."
        operatorName={operatorName}
      />
    </div>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.05em] text-ink-4">
        {label}:
      </span>
      {children}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors",
        active
          ? "border-mangos-green-800 bg-mangos-green-800 text-white"
          : "border-line bg-bg-app text-ink-2 hover:border-ink-3 hover:text-ink-1",
      )}
    >
      {children}
    </button>
  );
}

function CategoryRow({ row }: { row: ExpensesByCategoryRow }) {
  const pct = row.sharePct ?? 0;
  return (
    <li className="flex items-center justify-between gap-3 text-[12px]">
      <span className="min-w-0 flex-1 truncate">
        <span className="font-medium text-ink-1">{row.label}</span>
        <span className="ml-2 text-ink-4">
          {row.count} lançamento{row.count === 1 ? "" : "s"}
        </span>
      </span>
      <span className="inline-flex items-baseline gap-2">
        <span
          className="hidden h-1 w-16 overflow-hidden rounded-full bg-bg-app sm:inline-block print:inline-block"
          aria-hidden
        >
          <span
            className="block h-full bg-mangos-green-700"
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </span>
        <span className="text-[11px] tabular-nums text-ink-4">
          {row.sharePct === null ? "—" : `${row.sharePct.toFixed(1)}%`}
        </span>
        <Money valueInCents={row.sumInCents} size="sm" />
      </span>
    </li>
  );
}
