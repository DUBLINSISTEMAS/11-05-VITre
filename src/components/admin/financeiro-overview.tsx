"use client";

/**
 * FinanceiroOverview — Onda L2 (2026-05-29), repaginado em R5 (2026-05-29).
 *
 * Header centralizado da tela `/admin/financeiro`:
 *   - H1 "Financeiro" + sub-titulo
 *   - KPI strip horizontal Stripe-style: peso/cor, NAO splash
 *   - 2 CTAs verbais: "Lancar fiado" / "Lancar despesa"
 *
 * Onda R5 — sistema-minimalista. Saldo do mes SEGUE com cor pelo sinal
 * (verde >=0, vermelho <0) mas SEM splash 24px gigante. Hierarquia agora
 * vem de peso (700) + cor + container destacado, nao de tamanho.
 * Money component canonico.
 *
 * Vocabulario PT-BR varejo. Founder pediu "planilha financeira",
 * nao SaaS-EUA.
 */

import { PlusIcon } from "lucide-react";

import type { FinanceiroOverview as Overview } from "@/actions/financeiro/load-overview";
import { Money } from "@/components/ui/money";
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
  const emAbertoNet =
    overview.pendenteReceberInCents - overview.pendentePagarInCents;

  return (
    <header className="space-y-4">
      {/* Titulo + sub + CTAs */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="b3-page-title">Financeiro</h1>
          <p className="b3-page-sub">
            Tudo que entra e sai num lugar só. {overview.mesLabel}.
          </p>
        </div>

        {/* CTAs sticky em mobile (R5): garantem descoberta da acao.
            Lojista nao precisa procurar onde lancar despesa. */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={dispatchNewReceivable}
            className="b3-btn whitespace-nowrap"
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

      {/* KPI strip Stripe-style. Saldo do mes em container destacado
          (mangos-cream-soft + brand-line) — hierarquia por COR/CONTAINER,
          nao por tamanho. Money em size=lg (18px) consistente. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiStat
          label="Recebido"
          valueInCents={overview.recebidoMesInCents}
          tone="positive"
        />
        <KpiStat
          label="Pago"
          valueInCents={overview.pagoMesInCents}
          tone="negative"
        />
        <KpiStat
          label="Saldo do mês"
          valueInCents={overview.saldoMesInCents}
          tone={saldoNegativo ? "negative" : "positive"}
          highlight
          hint={
            saldoNegativo ? "Saiu mais do que entrou" : "Entrou mais do que saiu"
          }
        />
        <KpiStat
          label="Em aberto"
          valueInCents={emAbertoNet}
          tone="muted"
          hint={`Receber R$ ${(overview.pendenteReceberInCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} · Pagar R$ ${(overview.pendentePagarInCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
        />
      </div>
    </header>
  );
}

type KpiTone = "positive" | "negative" | "muted" | "neutral";

function KpiStat({
  label,
  valueInCents,
  tone = "neutral",
  highlight = false,
  hint,
}: {
  label: string;
  valueInCents: number;
  tone?: KpiTone;
  highlight?: boolean;
  hint?: string;
}) {
  return (
    <div
      className={cn(
        "b3-card p-3.5 transition-colors",
        highlight && "border-mangos-yellow-soft bg-mangos-cream-soft",
      )}
    >
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.05em] text-ink-4">
        {label}
      </p>
      <Money
        valueInCents={valueInCents}
        size="lg"
        tone={tone}
        className="mt-1.5 block"
      />
      {hint ? (
        <p className="mt-1 truncate text-[11px] text-ink-4">{hint}</p>
      ) : null}
    </div>
  );
}
