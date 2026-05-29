// HeroLucro — Bloco F.2.1 da ressignificação (2026-05-28).
//
// Topo do /admin: substitui os 4 MetricCards genéricos (Vendas count / Novos
// clientes / Devolvidas / Faturamento) por DOIS números que respondem o que
// a Sandra quer ver de manhã: "lucrou quanto ontem?" e "quanto essa semana?".
//
// Decisões do conselho (2026-05-28):
//   - Recorte canônico: ONTEM + SEMANA ATUAL (segunda-de-hoje até agora).
//   - Comparação HONESTA: ontem × mesmo dia da semana 7d atrás (sex×sex);
//     semana atual × mesma janela 7d atrás (não semana cheia).
//   - Gate de honestidade: cobertura CMV < 80% mostra warning amarelo
//     "X de Y vendas têm custo cadastrado". Sem custo = sem inventar.
//   - Vocabulário do balcão: "Você lucrou", "Faturou", "Custo dos produtos".
//     Sem "Net profit", "EBITDA", "Analytics".
//   - Empty state honesto: loja sem venda exibe atalho pro PDV,
//     não mostra "R$ 0,00 (+0%)" mentindo.
//
// Render: server component recebe DashboardLucroWindow já calculado.
// Sem `"use client"` — economia de bundle, hero é estático até o lojista
// trocar de página.

import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  MinusIcon,
} from "lucide-react";
import Link from "next/link";

import type { DashboardLucroWindow } from "@/actions/reports/load-dashboard-lucro";
import type { DreSimpleSummary } from "@/actions/reports/types";
import { formatBRL } from "@/lib/pricing";

interface HeroLucroProps {
  yesterday: DashboardLucroWindow;
  thisWeek: DashboardLucroWindow;
}

/**
 * Variação percentual entre dois valores. Retorna null quando previous=0
 * (não há base válida — evita Infinity e mensagens enganosas).
 * Trata negativo→positivo e positivo→negativo corretamente.
 */
function deltaPct(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/** Soma de taxa real do cartão no breakdown (campo card_fees). */
function cardFeesOf(summary: DreSimpleSummary): number {
  return (
    summary.operatingExpensesByCategory.find((e) => e.category === "card_fees")
      ?.amountInCents ?? 0
  );
}

/** Despesas operacionais EXCLUINDO taxa do cartão (renderizada separada). */
function nonCardExpensesOf(summary: DreSimpleSummary): number {
  return summary.operatingExpensesByCategory.reduce(
    (acc, e) => (e.category === "card_fees" ? acc : acc + e.amountInCents),
    0,
  );
}

export function HeroLucro({ yesterday, thisWeek }: HeroLucroProps) {
  // Sem nenhuma venda no período total → empty state convidando ao PDV.
  const hasAnyData =
    yesterday.current.totalOrderCount > 0 ||
    thisWeek.current.totalOrderCount > 0;

  if (!hasAnyData) {
    return <HeroLucroEmpty />;
  }

  return (
    <section className="b3-hero-lucro" aria-label="Resumo do lucro líquido">
      <div className="b3-hero-lucro-grid">
        <LucroBlock window={yesterday} variant="primary" />
        <LucroBlock window={thisWeek} variant="secondary" />
      </div>

      <HeroFooter yesterday={yesterday} thisWeek={thisWeek} />
    </section>
  );
}

// ============================================================================
// Bloco individual de lucro (ontem OU semana)
// ============================================================================

interface LucroBlockProps {
  window: DashboardLucroWindow;
  variant: "primary" | "secondary";
}

/**
 * Bloco E1 UX (2026-05-29) — gate de amostra pequena. Loja de joia
 * interior com 1 vs 2 vendas mostrava "+100%" sem significar nada.
 * Abaixo de 5 vendas no menor dos dois períodos, escondemos o
 * percentual e mostramos texto neutro "amostra pequena".
 */
const SMALL_SAMPLE_THRESHOLD = 5;

function LucroBlock({ window, variant }: LucroBlockProps) {
  const profit = window.current.operationalProfitInCents;
  const previousProfit = window.previous?.operationalProfitInCents ?? null;
  const delta = previousProfit !== null ? deltaPct(profit, previousProfit) : null;

  const netRevenue = window.current.netRevenueInCents;
  const cogs = window.current.cogsInCents;
  const cardFees = cardFeesOf(window.current);
  const otherExpenses = nonCardExpensesOf(window.current);
  const orderCount = window.current.totalOrderCount;
  const previousOrderCount = window.previous?.totalOrderCount ?? 0;

  const marginPct =
    netRevenue === 0 ? 0 : (profit / netRevenue) * 100;

  const scopeUpper =
    window.scopeLabel.charAt(0).toUpperCase() + window.scopeLabel.slice(1);

  const className =
    variant === "primary"
      ? "b3-hero-lucro-block b3-hero-lucro-block--primary"
      : "b3-hero-lucro-block";

  // Bloco E1 UX (2026-05-29) — quando NÃO houve venda no período, hero
  // mostrava "R$ 0,00 −100% vs sex passada" pra loja que vendeu sex
  // passada e zerou ontem. Soco no estômago de manhã. Agora bloco fica
  // compacto e honesto: zero, sem delta, sem breakdown vazio.
  if (orderCount === 0) {
    return (
      <div className={className}>
        <header className="b3-hero-lucro-eyebrow">
          <span>Você lucrou {window.scopeLabel}</span>
        </header>
        <div className="b3-hero-lucro-amount">
          <span className="b3-hero-lucro-amount-value">{formatBRL(0)}</span>
        </div>
        <footer className="b3-hero-lucro-footer-line">
          <span>Nenhuma venda confirmada {window.scopeLabel}.</span>
        </footer>
      </div>
    );
  }

  // Amostra pequena se algum dos dois períodos tem < 5 vendas. Quando
  // previous é null (sem dado histórico), também conta como amostra
  // insuficiente pra comparação.
  const smallSample =
    delta !== null &&
    (orderCount < SMALL_SAMPLE_THRESHOLD ||
      previousOrderCount < SMALL_SAMPLE_THRESHOLD);

  return (
    <div className={className}>
      <header className="b3-hero-lucro-eyebrow">
        <span>Você lucrou {window.scopeLabel}</span>
        {delta === null ? (
          <span
            className="b3-hero-lucro-no-compare"
            title={`Sem dado em ${window.compareLabel}`}
          >
            sem comparação
          </span>
        ) : smallSample ? (
          <span
            className="b3-hero-lucro-no-compare"
            title={`Amostra pequena (${orderCount} agora vs ${previousOrderCount} em ${window.compareLabel}) — comparação % não é confiável`}
          >
            amostra pequena
          </span>
        ) : (
          <DeltaPill pct={delta} compareLabel={window.compareLabel} />
        )}
      </header>

      <div className="b3-hero-lucro-amount">
        <span
          className={
            profit < 0
              ? "b3-hero-lucro-amount-value b3-hero-lucro-amount-value--negative"
              : "b3-hero-lucro-amount-value"
          }
        >
          {formatBRL(profit)}
        </span>
        <span className="b3-hero-lucro-amount-margin">
          {marginPct.toFixed(1).replace(".", ",")}% de margem
        </span>
      </div>

      {/* Breakdown inline — denso, vocabulário do varejo.
          Bloco E1 UX (2026-05-29): Taxa cartão e Despesas sempre
          renderizam, mesmo zeradas. Antes elas sumiam quando = 0 e
          lojista achava que "tinha sumido" a linha. */}
      <dl className="b3-hero-lucro-breakdown">
        <BreakdownItem label="Faturou" value={netRevenue} />
        <BreakdownItem label="Custo das peças" value={-cogs} dim />
        <BreakdownItem label="Taxa cartão" value={-cardFees} dim />
        <BreakdownItem label="Despesas" value={-otherExpenses} dim />
        <BreakdownItem
          label={`= ${scopeUpper}`}
          value={profit}
          highlight
        />
      </dl>

      <footer className="b3-hero-lucro-footer-line">
        <span>
          {orderCount} {orderCount === 1 ? "venda" : "vendas"} ·{" "}
          {window.dayCount === 1
            ? "1 dia"
            : `${window.dayCount} dias`}{" "}
          de janela
        </span>
      </footer>
    </div>
  );
}

// ============================================================================
// Helpers visuais
// ============================================================================

interface DeltaPillProps {
  pct: number;
  compareLabel: string;
}

function DeltaPill({ pct, compareLabel }: DeltaPillProps) {
  const flat = Math.abs(pct) < 0.5; // <0.5% = considera estável
  const up = pct > 0 && !flat;
  const down = pct < 0 && !flat;

  const Icon = up ? ArrowUpRightIcon : down ? ArrowDownRightIcon : MinusIcon;
  const cls = up
    ? "b3-hero-delta b3-hero-delta--up"
    : down
      ? "b3-hero-delta b3-hero-delta--down"
      : "b3-hero-delta b3-hero-delta--flat";

  return (
    <span
      className={cls}
      title={`Comparação: ${compareLabel}`}
      aria-label={`Variação de ${pct.toFixed(1).replace(".", ",")}% vs ${compareLabel}`}
    >
      <Icon size={12} aria-hidden />
      {Math.abs(pct).toFixed(1).replace(".", ",")}% vs {compareLabel}
    </span>
  );
}

interface BreakdownItemProps {
  label: string;
  value: number;
  dim?: boolean;
  highlight?: boolean;
}

function BreakdownItem({ label, value, dim, highlight }: BreakdownItemProps) {
  return (
    <div
      className={
        highlight
          ? "b3-hero-breakdown-row b3-hero-breakdown-row--highlight"
          : dim
            ? "b3-hero-breakdown-row b3-hero-breakdown-row--dim"
            : "b3-hero-breakdown-row"
      }
    >
      <dt>{label}</dt>
      <dd>
        {value < 0 ? "−" : ""}
        {formatBRL(Math.abs(value))}
      </dd>
    </div>
  );
}

// ============================================================================
// Footer global do hero (gate de honestidade)
// ============================================================================

interface HeroFooterProps {
  yesterday: DashboardLucroWindow;
  thisWeek: DashboardLucroWindow;
}

function HeroFooter({ yesterday, thisWeek }: HeroFooterProps) {
  // Cobertura mínima entre os 2 períodos — se pior caso for baixo,
  // warning aparece. Lojista preenche custo, número fica honesto.
  const coverage = Math.min(
    yesterday.current.cogsCoveragePercent,
    thisWeek.current.cogsCoveragePercent,
  );
  const showWarning = coverage < 80;

  if (showWarning) {
    return (
      <p className="b3-hero-lucro-warn">
        ⚠ Apenas <strong>{coverage}%</strong> dos itens vendidos têm custo
        cadastrado. Os números acima excluem peças sem custo — pra ficar
        ainda mais honesto,{" "}
        <Link href="/admin/produtos" className="underline font-medium">
          preencha o custo dos produtos
        </Link>
        .
      </p>
    );
  }

  return (
    <p className="b3-hero-lucro-honest">
      Cálculo a partir do snapshot de cada venda — taxa real do cartão,
      desconto aplicado e custo da peça no momento da transação.
    </p>
  );
}

// ============================================================================
// Empty state — loja sem venda ainda
// ============================================================================

function HeroLucroEmpty() {
  return (
    <section className="b3-hero-lucro b3-hero-lucro--empty">
      <div className="b3-hero-lucro-empty-inner">
        <p className="b3-hero-lucro-empty-title">
          Ainda sem venda registrada
        </p>
        <p className="b3-hero-lucro-empty-hint">
          Quando você fechar a primeira venda no PDV ou no WhatsApp, o
          lucro líquido aparece aqui — calculado com taxa real do cartão,
          custo da peça e desconto aplicado.
        </p>
        <Link
          href="/admin/pdv"
          className="b3-newsale-cta b3-hero-lucro-empty-cta"
          prefetch
        >
          Abrir PDV
        </Link>
      </div>
    </section>
  );
}
