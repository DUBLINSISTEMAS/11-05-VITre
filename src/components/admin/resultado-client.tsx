"use client";

/**
 * Tela `/admin/relatorios/resultado` — Bloco E da ressignificação.
 *
 * UI focada em INSIGHT (não tabela). Hero gigante com lucro líquido
 * + comparação período anterior + equação visual + atalhos pra DRE
 * detalhado e impressão.
 *
 * Vocabulário do varejista BR ("Faturei", "Sobrou", "Custo dos
 * produtos") — sem "DRE", sem "Operational profit", sem "EBITDA".
 *
 * Sem decoração SaaS-US: zero gradient/glassmorphism, denso, tabular-nums.
 */
import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  FileSpreadsheetIcon,
  MinusIcon,
  PrinterIcon,
  ScrollTextIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useTransition } from "react";

import type { DreSimpleSummary } from "@/actions/reports/types";
import type { ReportStoreInfo } from "@/components/admin/report/report-layout";
import { Button } from "@/components/ui/button";
import { downloadCsv, escapeCsvCell } from "@/lib/csv";
import { formatBRL } from "@/lib/pricing";

interface ResultadoClientProps {
  storeInfo: ReportStoreInfo;
  current: DreSimpleSummary;
  previous: DreSimpleSummary | null;
  period: string;
  filters: Record<string, string | undefined>;
  operatorName: string | null;
  compareMode: "prev" | "yoy";
}

// Presets temporais — pedido founder 2026-05-28. Períodos civis (mes/ano)
// no topo porque é o que o varejista BR pergunta toda segunda. "30 dias"
// fica como rolante pra dashboards de marketing.
const PERIOD_OPTIONS = [
  { value: "hoje", label: "Hoje" },
  { value: "semana", label: "Esta semana" },
  { value: "mes", label: "Este mês" },
  { value: "trimestre", label: "Trimestre" },
  { value: "ano", label: "Este ano" },
  { value: "30", label: "30 dias" },
] as const;

const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  rent: "Aluguel",
  payroll: "Salários e comissões",
  utilities: "Água, luz, internet",
  supplies: "Material e suprimentos",
  marketing: "Marketing e mídia",
  tax: "Impostos",
  card_fees: "Taxa real do cartão",
  other: "Outros",
};

function deltaPct(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

export function ResultadoClient({
  storeInfo,
  current,
  previous,
  period,
  filters,
  operatorName,
  compareMode,
}: ResultadoClientProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const currentPeriodo = filters.periodo ?? "mes";

  const setPeriodo = useCallback(
    (value: string) => {
      const next = new URLSearchParams(params?.toString() ?? "");
      next.set("periodo", value);
      next.delete("start");
      next.delete("end");
      startTransition(() => {
        router.push(`?${next.toString()}`);
      });
    },
    [params, router],
  );

  const toggleCompareMode = useCallback(() => {
    const next = new URLSearchParams(params?.toString() ?? "");
    if (compareMode === "yoy") {
      next.delete("compare");
    } else {
      next.set("compare", "yoy");
    }
    startTransition(() => {
      router.push(`?${next.toString()}`);
    });
  }, [params, router, compareMode]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const summaryNumbers = useMemo(() => {
    const cardFeesLine = current.operatingExpensesByCategory.find(
      (e) => e.category === "card_fees",
    );
    const cardFeesInCents = cardFeesLine?.amountInCents ?? 0;
    const nonCardExpenses = current.operatingExpensesByCategory.filter(
      (e) => e.category !== "card_fees",
    );
    const nonCardTotal = nonCardExpenses.reduce(
      (s, e) => s + e.amountInCents,
      0,
    );
    return {
      cardFeesInCents,
      nonCardExpenses,
      nonCardTotal,
    };
  }, [current]);

  const profitDelta =
    previous !== null
      ? deltaPct(current.operationalProfitInCents, previous.operationalProfitInCents)
      : null;

  const handleExportCsv = useCallback(() => {
    const rows: [string, number][] = [
      ["Faturamento bruto", current.grossRevenueInCents],
      ["(-) Descontos", -current.discountsInCents],
      ["(+) Acréscimos", current.surchargesInCents],
      ["(-) Devoluções (receita)", -current.returnedRevenueInCents],
      ["(=) Receita líquida", current.netRevenueInCents],
      ["(-) Custo dos produtos (CMV)", -current.cogsInCents],
      ["(=) Lucro bruto", current.grossProfitInCents],
      ["(-) Taxa real cartão", -summaryNumbers.cardFeesInCents],
      ...(current.sellerCommissionInCents > 0
        ? ([
            ["(-) Comissão de vendedoras", -current.sellerCommissionInCents],
          ] as [string, number][])
        : []),
      ...summaryNumbers.nonCardExpenses.map(
        (e): [string, number] => [
          `(-) ${EXPENSE_CATEGORY_LABELS[e.category] ?? e.category}`,
          -e.amountInCents,
        ],
      ),
      ["(=) LUCRO LÍQUIDO", current.operationalProfitInCents],
    ];
    const csv = [
      `Loja;${escapeCsvCell(storeInfo.name)}`,
      `Período;${escapeCsvCell(period)}`,
      `Gerado em;${escapeCsvCell(new Date().toLocaleString("pt-BR"))}`,
      ``,
      `Linha;Valor (R$)`,
      ...rows.map(
        ([label, cents]) =>
          `${escapeCsvCell(label)};${(cents / 100).toFixed(2).replace(".", ",")}`,
      ),
    ].join("\n");
    downloadCsv(`resultado-${period.replace(/\s+/g, "-")}`, csv);
  }, [current, summaryNumbers, storeInfo.name, period]);

  return (
    <div className="space-y-6">
      {/* Header + ações --------------------------------------------- */}
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h1 className="b3-page-title">Resultado</h1>
          <p className="b3-page-sub">
            Quanto sobrou pra você depois de tudo. Faturamento − custos − taxas
            − despesas = lucro líquido REAL.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={handleExportCsv}>
            <FileSpreadsheetIcon className="size-3.5" /> Exportar CSV
          </Button>
          <Button type="button" size="sm" onClick={handlePrint}>
            <PrinterIcon className="size-3.5" /> Imprimir
          </Button>
        </div>
      </div>

      {/* Toggles de período ----------------------------------------- */}
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <span className="text-ink-4 text-[11px] font-bold uppercase tracking-[0.06em]">
          Período
        </span>
        {PERIOD_OPTIONS.map((opt) => {
          const active = currentPeriodo === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              disabled={pending}
              onClick={() => setPeriodo(opt.value)}
              className={
                active
                  ? "b3-btn b3-btn--sm bg-ink-1 text-bg-1"
                  : "b3-btn b3-btn--sm bg-bg-2"
              }
            >
              {opt.label}
            </button>
          );
        })}
        <Link
          href="/admin/relatorios/dre"
          className="b3-btn b3-btn--sm ml-auto"
          prefetch
        >
          <ScrollTextIcon className="size-3.5" /> DRE detalhada
        </Link>
      </div>

      {/* Toggle de comparação --------------------------------------- */}
      {/* "vs período anterior" (default) ou "vs mesmo período no ano passado".
          YoY é o que joalheiro/perfumaria pergunta — sazonalidade pesa
          mais que tendência mês-a-mês. */}
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <span className="text-ink-4 text-[11px] font-bold uppercase tracking-[0.06em]">
          Comparar com
        </span>
        <button
          type="button"
          disabled={pending}
          onClick={() => compareMode !== "prev" && toggleCompareMode()}
          className={
            compareMode === "prev"
              ? "b3-btn b3-btn--sm bg-ink-1 text-bg-1"
              : "b3-btn b3-btn--sm bg-bg-2"
          }
        >
          Período anterior
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => compareMode !== "yoy" && toggleCompareMode()}
          className={
            compareMode === "yoy"
              ? "b3-btn b3-btn--sm bg-ink-1 text-bg-1"
              : "b3-btn b3-btn--sm bg-bg-2"
          }
        >
          Mesmo período no ano passado
        </button>
      </div>

      {/* Bloco D UX (2026-05-28) — sem vendas no período: hero gigante de
          "R$ 0,00" assustava sem orientar. Agora escondemos a equação
          detalhada e mostramos próximo passo claro. */}
      {current.totalOrderCount === 0 ? (
        <article
          className="b3-card relative overflow-hidden p-6 sm:p-8"
          aria-label="Sem vendas no período"
        >
          <p className="text-ink-4 text-[11px] font-bold uppercase tracking-[0.08em]">
            Resultado — {period}
          </p>
          <h2 className="text-ink-1 mt-2 text-[24px] font-semibold leading-tight sm:text-[28px]">
            Nenhuma venda nesse período ainda.
          </h2>
          <p className="text-ink-3 mt-2 max-w-xl text-[13px] leading-snug">
            O Resultado aparece aqui automaticamente assim que você fecha a
            primeira venda. Já descontamos tudo (custo dos produtos, taxa
            real do cartão, comissão de vendedora e despesas operacionais)
            pra você ver o lucro líquido REAL.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/admin/pedidos"
              className="b3-btn b3-btn--cta"
              prefetch
            >
              Abrir Vendas
            </Link>
            <Link
              href="/admin/financeiro/pagar"
              className="b3-btn"
              prefetch
            >
              Cadastrar despesa fixa
            </Link>
          </div>
        </article>
      ) : (
        <article
          className="b3-card relative overflow-hidden p-6 sm:p-8"
          aria-label="Lucro líquido do período"
        >
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
            <div>
              <p className="text-ink-4 text-[11px] font-bold uppercase tracking-[0.08em]">
                Lucro líquido — {period}
              </p>
              <p
                className={
                  "mt-1 text-[40px] font-bold leading-none tabular-nums tracking-tight sm:text-[56px]" +
                  (current.operationalProfitInCents < 0
                    ? " text-rose-600"
                    : "")
                }
              >
                {formatBRL(current.operationalProfitInCents)}
              </p>
              <p className="text-ink-3 mt-2 text-[13px]">
                É o que sobrou pra você esse período. Já descontei TUDO:
                custo dos produtos, taxa real do cartão e despesas
                operacionais.
              </p>
            </div>

            {/* Delta vs período de comparação selecionado */}
            {previous !== null ? (
              <DeltaPill
                currentInCents={current.operationalProfitInCents}
                previousInCents={previous.operationalProfitInCents}
                previousLabel={
                  compareMode === "yoy"
                    ? "vs mesmo período ano passado"
                    : "vs período anterior"
                }
                previousPct={profitDelta}
              />
            ) : null}
          </div>
        </article>
      )}

      {/* Aviso CMV cobertura -------------------------------------- */}
      {current.cogsCoveragePercent < 100 ? (
        <div className="b3-card p-3 text-[12px] text-ink-3 print:hidden">
          <strong>Atenção:</strong> apenas{" "}
          {current.cogsCoveragePercent}% dos produtos vendidos têm custo
          cadastrado. Preencha custos em{" "}
          <Link
            href="/admin/produtos/custos"
            className="font-semibold underline"
            prefetch
          >
            /admin/produtos/custos
          </Link>{" "}
          pra esse número ficar 100% honesto.
        </div>
      ) : null}

      {/* Equação visual: como cheguei nesse número ----------------
          Bloco D UX (2026-05-28): só renderiza quando há vendas. Loja
          zerada veria todas as linhas em R$ 0,00, o que confunde. O hero
          acima já conta a história "ainda sem vendas, comece aqui". */}
      {current.totalOrderCount > 0 ? (
      <section
        className="b3-card overflow-hidden"
        aria-label="Detalhamento do cálculo"
      >
        <header className="border-b border-line bg-bg-2/40 px-4 py-3">
          <h2 className="text-ink-1 text-[13px] font-semibold">
            Como cheguei nesse número
          </h2>
          <p className="text-ink-4 text-[11.5px]">
            Linha por linha, em ordem de cálculo.
          </p>
        </header>

        <ul className="divide-y divide-line">
          <EquationRow
            label="Faturei (vendas brutas)"
            inCents={current.grossRevenueInCents}
            sign="positive"
            note={`${current.totalOrderCount} ${current.totalOrderCount === 1 ? "venda" : "vendas"}`}
          />
          {current.discountsInCents > 0 ? (
            <EquationRow
              label="Descontos concedidos"
              inCents={-current.discountsInCents}
              sign="negative"
            />
          ) : null}
          {current.surchargesInCents > 0 ? (
            <EquationRow
              label="Acréscimos cobrados"
              inCents={current.surchargesInCents}
              sign="positive"
            />
          ) : null}
          {current.returnedRevenueInCents > 0 ? (
            <EquationRow
              label="Devoluções"
              inCents={-current.returnedRevenueInCents}
              sign="negative"
              note="vendas que voltaram"
            />
          ) : null}
          <EquationRow
            label="Receita líquida"
            inCents={current.netRevenueInCents}
            sign="subtotal"
          />
          <EquationRow
            label="Custo dos produtos vendidos (CMV)"
            inCents={-current.cogsInCents}
            sign="negative"
            note={
              current.cogsCoveragePercent === 100
                ? undefined
                : `cobertura ${current.cogsCoveragePercent}%`
            }
          />
          <EquationRow
            label="Lucro bruto"
            inCents={current.grossProfitInCents}
            sign="subtotal"
          />
          {summaryNumbers.cardFeesInCents > 0 ? (
            <EquationRow
              label="Taxa real do cartão"
              inCents={-summaryNumbers.cardFeesInCents}
              sign="negative"
              note="calculada por bandeira × parcelas"
            />
          ) : null}
          {/* Onda 2 (2026-05-28) — comissão de vendedoras vem de
              order_item.commission_snapshot_in_cents (snapshot por linha,
              fixa mesmo se lojista mudar % depois). Só aparece quando
              algum produto tem default_commission_bps cadastrado. */}
          {current.sellerCommissionInCents > 0 ? (
            <EquationRow
              label="Comissão de vendedoras"
              inCents={-current.sellerCommissionInCents}
              sign="negative"
              note="snapshot na venda — % do produto"
            />
          ) : null}
          {summaryNumbers.nonCardExpenses.map((e) => (
            <EquationRow
              key={e.category}
              label={EXPENSE_CATEGORY_LABELS[e.category] ?? e.category}
              inCents={-e.amountInCents}
              sign="negative"
            />
          ))}
          {current.operatingExpensesInCents === 0 ? (
            <li className="px-4 py-3 text-[12px] text-ink-4 print:hidden">
              <em>
                Você ainda não cadastrou despesas (aluguel, salário, contas).
                Sem isso, esse &ldquo;lucro&rdquo; é otimista.{" "}
              </em>
              <Link
                href="/admin/financeiro/pagar"
                className="font-semibold underline"
                prefetch
              >
                Cadastrar despesa
              </Link>
            </li>
          ) : null}
          <EquationRow
            label="LUCRO LÍQUIDO"
            inCents={current.operationalProfitInCents}
            sign="final"
          />
        </ul>
      </section>
      ) : null}

      {/* Rodapé universal pra impressão ----------------------------- */}
      <footer className="text-ink-4 text-[10.5px] print:mt-4">
        {storeInfo.name}
        {storeInfo.document ? ` · CNPJ/CPF ${storeInfo.document}` : ""} · Gerado
        em{" "}
        {new Date().toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
        {operatorName ? ` por ${operatorName}` : ""}
      </footer>
    </div>
  );
}

// =====================================================================
// Sub-componentes
// =====================================================================

interface EquationRowProps {
  label: string;
  inCents: number;
  sign: "positive" | "negative" | "subtotal" | "final";
  note?: string;
}

function EquationRow({ label, inCents, sign, note }: EquationRowProps) {
  const isSubtotal = sign === "subtotal";
  const isFinal = sign === "final";
  const labelClass =
    isFinal
      ? "text-ink-1 text-[15px] font-bold uppercase tracking-[0.04em]"
      : isSubtotal
        ? "text-ink-1 text-[13px] font-semibold"
        : "text-ink-2 text-[13px]";
  const valueClass =
    isFinal
      ? "text-ink-1 text-[24px] font-bold tabular-nums"
      : isSubtotal
        ? "text-ink-1 text-[15px] font-semibold tabular-nums"
        : sign === "negative"
          ? "text-ink-2 text-[14px] tabular-nums"
          : "text-ink-2 text-[14px] tabular-nums";
  const rowBg = isFinal
    ? "bg-bg-2"
    : isSubtotal
      ? "bg-bg-2/60"
      : "";
  return (
    <li
      className={`flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5 ${rowBg}`}
    >
      <div className="min-w-0">
        <span className={labelClass}>{label}</span>
        {note ? (
          <span className="text-ink-4 ml-2 text-[11px]">· {note}</span>
        ) : null}
      </div>
      <span className={valueClass}>
        {inCents < 0 && !isFinal && !isSubtotal ? "−" : ""}
        {formatBRL(Math.abs(inCents))}
      </span>
    </li>
  );
}

interface DeltaPillProps {
  currentInCents: number;
  previousInCents: number;
  previousPct: number | null;
  previousLabel: string;
}

function DeltaPill({
  currentInCents,
  previousInCents,
  previousPct,
  previousLabel,
}: DeltaPillProps) {
  if (previousPct === null) {
    // Período anterior teve resultado zero/negativo — comparação % sem sentido.
    return (
      <div className="text-ink-3 text-[12px]">
        <span className="font-mono">{previousLabel}:</span>{" "}
        {formatBRL(previousInCents)} (sem base de comparação)
      </div>
    );
  }
  const positive = currentInCents > previousInCents;
  const flat = Math.abs(previousPct) < 0.5;
  const Icon = flat
    ? MinusIcon
    : positive
      ? ArrowUpRightIcon
      : ArrowDownRightIcon;
  const colorClass = flat
    ? "text-ink-3"
    : positive
      ? "text-emerald-700"
      : "text-rose-600";
  return (
    <div className={`flex items-center gap-2 ${colorClass}`}>
      <Icon className="size-5" />
      <div>
        <div className="text-[16px] font-semibold tabular-nums">
          {previousPct > 0 ? "+" : ""}
          {previousPct.toFixed(1)}%
        </div>
        <div className="text-ink-3 text-[11.5px]">
          {previousLabel}: {formatBRL(previousInCents)}
        </div>
      </div>
    </div>
  );
}
