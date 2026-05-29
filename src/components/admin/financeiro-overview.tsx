"use client";

/**
 * FinanceiroOverview — Onda L2 (2026-05-29).
 *
 * Header centralizado da tela `/admin/financeiro`:
 *   - H1 "Financeiro" + sub-titulo
 *   - KPI strip horizontal: Recebido / Pago / Saldo / Em aberto
 *   - 2 CTAs verbais grandes: "Lancar fiado" / "Lancar despesa"
 *
 * Saldo do mes recebe destaque visual (texto grande + cor pelo sinal):
 *   - verde se >= 0
 *   - vermelho se < 0 (gastou mais que recebeu)
 *
 * Vocabulario do balcao BR — nao usa "Receita / Despesa", "Inflow / Outflow",
 * etc. Usa "Recebido", "Pago", "Saldo", "Em aberto". Founder pediu planilha
 * financeira de papel, nao SaaS-EUA.
 */

import { HandCoinsIcon, MinusCircleIcon, PlusIcon } from "lucide-react";

import type { FinanceiroOverview as Overview } from "@/actions/financeiro/load-overview";
import { formatBRL } from "@/lib/pricing";
import { cn } from "@/lib/utils";

import {
  OPEN_NEW_EXPENSE_EVENT,
  OPEN_NEW_RECEIVABLE_EVENT,
} from "./financeiro-events";

interface FinanceiroOverviewProps {
  overview: Overview;
}

function dispatchNewReceivable() {
  window.dispatchEvent(new CustomEvent(OPEN_NEW_RECEIVABLE_EVENT));
}

function dispatchNewExpense() {
  window.dispatchEvent(new CustomEvent(OPEN_NEW_EXPENSE_EVENT));
}

export function FinanceiroOverview({ overview }: FinanceiroOverviewProps) {
  const saldoNegativo = overview.saldoMesInCents < 0;

  return (
    <header className="space-y-5">
      {/* Titulo + sub */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="b3-page-title">Financeiro</h1>
          <p className="b3-page-sub">
            Tudo que entra e sai num lugar só. Saldo do mês, fiados em aberto,
            despesas a pagar.
          </p>
        </div>

        {/* CTAs verbais — 2 acoes principais. Disparam custom event que os
            paineis abaixo escutam (cada um abre seu proprio dialog). */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={dispatchNewReceivable}
            className="b3-btn b3-btn--cta whitespace-nowrap"
            title="Empréstimo, adiantamento ou débito histórico sem venda Mangos Pay"
          >
            <PlusIcon size={14} aria-hidden />
            Lançar fiado
          </button>
          <button
            type="button"
            onClick={dispatchNewExpense}
            className="b3-btn b3-btn--cta whitespace-nowrap"
            title="Aluguel, luz, salário, taxa de máquina, etc."
          >
            <PlusIcon size={14} aria-hidden />
            Lançar despesa
          </button>
        </div>
      </div>

      {/* KPI strip — 4 cards horizontais com hierarquia visual.
          Saldo do mes recebe tamanho maior (24px) porque e a pergunta-mae. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Recebido este mês"
          value={formatBRL(overview.recebidoMesInCents)}
          tone="positive"
          hint={overview.mesLabel}
        />
        <KpiCard
          label="Pago este mês"
          value={formatBRL(overview.pagoMesInCents)}
          tone="negative"
          hint={overview.mesLabel}
        />
        <KpiCard
          label="Saldo do mês"
          value={formatBRL(overview.saldoMesInCents)}
          tone={saldoNegativo ? "negative-strong" : "positive-strong"}
          hint={
            saldoNegativo ? "Saiu mais do que entrou" : "Entrou mais do que saiu"
          }
          highlight
        />
        <KpiCard
          label="Em aberto"
          value={formatBRL(
            overview.pendenteReceberInCents - overview.pendentePagarInCents,
          )}
          tone="neutral"
          hint={`A receber ${formatBRL(overview.pendenteReceberInCents)} · A pagar ${formatBRL(overview.pendentePagarInCents)}`}
        />
      </div>
    </header>
  );
}

type KpiTone =
  | "positive"
  | "positive-strong"
  | "negative"
  | "negative-strong"
  | "neutral";

function KpiCard({
  label,
  value,
  hint,
  tone = "neutral",
  highlight = false,
}: {
  label: string;
  value: string;
  hint?: string | null;
  tone?: KpiTone;
  highlight?: boolean;
}) {
  const iconMap: Record<KpiTone, React.ReactNode | null> = {
    positive: null,
    "positive-strong": (
      <HandCoinsIcon className="text-emerald-700 size-4" aria-hidden />
    ),
    negative: null,
    "negative-strong": (
      <MinusCircleIcon className="text-rose-700 size-4" aria-hidden />
    ),
    neutral: null,
  };

  const valueClass = cn(
    "tabular-nums leading-none mt-1 font-bold",
    highlight ? "text-[24px]" : "text-[20px]",
    tone === "positive" && "text-emerald-700",
    tone === "positive-strong" && "text-emerald-700",
    tone === "negative" && "text-rose-700",
    tone === "negative-strong" && "text-rose-700",
    tone === "neutral" && "text-ink-1",
  );

  return (
    <div
      className={cn(
        "b3-card p-4 transition-colors",
        highlight && "border-mangos-yellow-soft bg-mangos-cream-soft",
      )}
    >
      <div className="flex items-center gap-1.5">
        <p className="text-ink-4 text-[10.5px] font-bold uppercase tracking-[0.06em]">
          {label}
        </p>
        {iconMap[tone]}
      </div>
      <p className={valueClass}>{value}</p>
      {hint ? (
        <p className="text-ink-4 mt-1 truncate text-[11px]">{hint}</p>
      ) : null}
    </div>
  );
}
