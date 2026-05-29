/**
 * ProfitSummary — Onda R4 (2026-05-29).
 *
 * Substitui HeroLucro splash 2-blocos. Dashboard limpo Stripe-style:
 *
 *   ESSA SEMANA          R$ 1.234   ↑ 12% vs semana passada
 *   Faturou R$ 8.5k · Custo R$ 5.2k · Taxa R$ 180 · Despesas R$ 1.9k
 *
 *   Cobertura CMV 78% — 14 de 18 vendas com custo cadastrado
 *
 * Estilo: Linear/Stripe minimalista. Numero principal 22px peso 700 cor
 * por sinal. Breakdown DENSO inline. Sem cards, sem splash.
 *
 * Server component (sem "use client") — dados ja calculados em
 * loadDashboardLucro server-side.
 */

import { ArrowDownRightIcon, ArrowUpRightIcon } from "lucide-react";
import Link from "next/link";

import type { DashboardLucroWindow } from "@/actions/reports/load-dashboard-lucro";
import type { DreSimpleSummary } from "@/actions/reports/types";
import { Money, profitTone } from "@/components/ui/money";
import { formatBRL } from "@/lib/pricing";
import { cn } from "@/lib/utils";

interface ProfitSummaryProps {
  /** Janela primaria — geralmente "essa semana" (mais estavel que dia). */
  primary: DashboardLucroWindow;
  /** Janela secundaria — geralmente "ontem". Renderiza em linha menor. */
  secondary?: DashboardLucroWindow;
}

function cardFeesOf(s: DreSimpleSummary): number {
  return (
    s.operatingExpensesByCategory.find((e) => e.category === "card_fees")
      ?.amountInCents ?? 0
  );
}

function nonCardExpensesOf(s: DreSimpleSummary): number {
  return s.operatingExpensesByCategory.reduce(
    (acc, e) => (e.category === "card_fees" ? acc : acc + e.amountInCents),
    0,
  );
}

function deltaPct(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/**
 * Lucro real do periodo. `DreSimpleSummary` ja expoe
 * `operationalProfitInCents` (= grossProfit - despesas - comissao). Esse
 * eh o numero canonico do DRE, mesmo do /admin/relatorios/resultado.
 */
function profitOf(s: DreSimpleSummary): number {
  return s.operationalProfitInCents;
}

/**
 * Margem operacional derivada. `null` quando receita zero (sem venda)
 * pra evitar divisao por zero. UI renderiza "— margem" nesse caso.
 */
function marginPctOf(s: DreSimpleSummary): number | null {
  if (s.netRevenueInCents <= 0) return null;
  return (s.operationalProfitInCents / s.netRevenueInCents) * 100;
}

export function ProfitSummary({ primary, secondary }: ProfitSummaryProps) {
  const hasAnyData =
    primary.current.totalOrderCount > 0 ||
    (secondary?.current.totalOrderCount ?? 0) > 0;

  if (!hasAnyData) {
    return <ProfitSummaryEmpty />;
  }

  return (
    <section
      className="b3-card p-4 sm:p-5"
      aria-label="Resumo de lucro líquido"
    >
      <PrimaryBlock window={primary} />
      {secondary ? <SecondaryBlock window={secondary} /> : null}
    </section>
  );
}

function PrimaryBlock({ window }: { window: DashboardLucroWindow }) {
  const profit = profitOf(window.current);
  const margin = marginPctOf(window.current);
  const orderCount = window.current.totalOrderCount;
  const delta = window.previous
    ? deltaPct(profit, profitOf(window.previous))
    : null;
  const tone = profitTone(profit, margin);

  if (orderCount === 0) {
    return (
      <div>
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.05em] text-ink-4">
          Você lucrou {window.scopeLabel}
        </p>
        <div className="mt-1 flex items-baseline gap-3">
          <Money valueInCents={0} size="kpi" tone="muted" />
        </div>
        <p className="mt-1 text-[12px] text-ink-3">
          Nenhuma venda confirmada {window.scopeLabel}.
        </p>
      </div>
    );
  }

  const cardFees = cardFeesOf(window.current);
  const otherExpenses = nonCardExpensesOf(window.current);
  const cogs = window.current.cogsInCents;
  const netRevenue = window.current.netRevenueInCents;
  const cogsCoverage = window.current.cogsCoveragePercent;

  return (
    <div>
      {/* Linha 1: eyebrow + delta */}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.05em] text-ink-4">
          Você lucrou {window.scopeLabel}
        </p>
        {delta !== null ? (
          <DeltaPill pct={delta} compareLabel={window.compareLabel} />
        ) : (
          <span className="text-[11px] text-ink-4">sem comparação</span>
        )}
      </div>

      {/* Linha 2: numero principal + margem inline */}
      <div className="mt-1 flex items-baseline gap-3">
        <Money valueInCents={profit} size="kpi" tone={tone} />
        <span className="text-[12px] tabular-nums text-ink-3">
          {margin == null || Number.isNaN(margin)
            ? "— margem"
            : `${margin.toFixed(1).replace(".", ",")}% de margem`}
        </span>
      </div>

      {/* Linha 3: breakdown denso inline. Vocabulario varejo BR. */}
      <p className="mt-2 text-[12px] text-ink-3">
        <span>Faturou {formatBRL(netRevenue)}</span>
        <Sep />
        <span>Custo {formatBRL(cogs)}</span>
        <Sep />
        <span>Taxa {formatBRL(cardFees)}</span>
        <Sep />
        <span>Despesas {formatBRL(otherExpenses)}</span>
      </p>

      {/* Linha 4: warning cobertura CMV quando baixa */}
      {cogsCoverage < 80 && cogsCoverage > 0 ? (
        <p className="mt-2 text-[11.5px] text-amber-700 dark:text-amber-400">
          Cobertura de custo: {cogsCoverage}%.{" "}
          <Link
            href="/admin/produtos?status=no-cost"
            className="font-medium underline-offset-2 hover:underline"
          >
            Preencher custos
          </Link>{" "}
          deixa o número mais honesto.
        </p>
      ) : null}
    </div>
  );
}

function SecondaryBlock({ window }: { window: DashboardLucroWindow }) {
  const profit = profitOf(window.current);
  const orderCount = window.current.totalOrderCount;
  const delta = window.previous
    ? deltaPct(profit, profitOf(window.previous))
    : null;
  const tone = profitTone(profit, marginPctOf(window.current));

  return (
    <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 border-t border-line pt-3">
      <span className="text-[11.5px] text-ink-4">
        {window.scopeLabel === "ontem" ? "Ontem" : window.scopeLabel}:
      </span>
      <span className="inline-flex items-baseline gap-2">
        {orderCount === 0 ? (
          <span className="text-[13px] text-ink-3">Sem venda</span>
        ) : (
          <>
            <Money valueInCents={profit} size="md" tone={tone} />
            {delta !== null ? (
              <DeltaPill pct={delta} compareLabel={window.compareLabel} mini />
            ) : null}
          </>
        )}
      </span>
    </div>
  );
}

function DeltaPill({
  pct,
  compareLabel,
  mini = false,
}: {
  pct: number;
  compareLabel: string;
  mini?: boolean;
}) {
  const positive = pct > 0;
  const flat = Math.abs(pct) < 0.5;
  const tone = flat ? "muted" : positive ? "positive" : "negative";
  const Icon = positive ? ArrowUpRightIcon : ArrowDownRightIcon;
  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-0.5 tabular-nums",
        mini ? "text-[11px]" : "text-[11.5px]",
        tone === "positive" && "text-emerald-700 dark:text-emerald-400",
        tone === "negative" && "text-rose-700 dark:text-rose-400",
        tone === "muted" && "text-ink-4",
      )}
      title={`vs ${compareLabel}`}
    >
      {!flat ? <Icon size={11} aria-hidden /> : null}
      {Math.abs(pct).toFixed(0)}%{!mini ? ` vs ${compareLabel}` : null}
    </span>
  );
}

function Sep() {
  return <span aria-hidden className="mx-1.5 text-ink-5">·</span>;
}

function ProfitSummaryEmpty() {
  return (
    <section className="b3-card p-5 text-center" aria-label="Sem vendas ainda">
      <p className="text-[13px] text-ink-3">
        Sem vendas ainda. Abra a primeira venda do dia pelo{" "}
        <Link
          href="/admin/pedidos"
          className="font-medium text-mangos-green-800 underline-offset-2 hover:underline"
        >
          PDV
        </Link>
        .
      </p>
    </section>
  );
}
