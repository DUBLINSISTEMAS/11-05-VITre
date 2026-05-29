"use client";

/**
 * FinanceiroOverview — Onda L2 (2026-05-29), repaginado em R5 (2026-05-29),
 * unificado com a linguagem visual do dashboard em M5 (2026-05-29).
 *
 * Header centralizado da tela `/admin/financeiro`:
 *   - Eyebrow "Operação" + H1 "Financeiro" + sub-titulo
 *   - 2 CTAs verbais: "Lancar fiado" / "Lancar despesa"
 *   - KPI grid com 4 tiles consistentes com Dashboard/Vendas/Produtos
 *
 * Saldo do mes mantem destaque pelo accent "highlight" (cream + border
 * yellow + hover shadow yellow). Vocabulario PT-BR varejo.
 */

import {
  ArrowDownCircleIcon,
  ArrowUpCircleIcon,
  ClockIcon,
  PlusIcon,
  ScaleIcon,
} from "lucide-react";

import type { FinanceiroOverview as Overview } from "@/actions/financeiro/load-overview";
import { KpiTile } from "@/components/admin/dashboard/kpi-tile";
import { formatBRL } from "@/lib/pricing";

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
      {/* Header — Onda M5: eyebrow + titulo maior + 2 CTAs verbais. */}
      <div className="b3-dashboard-hd">
        <div className="b3-page-title-wrap">
          <span className="b3-page-eyebrow">Operação</span>
          <h1 className="b3-page-title">Financeiro</h1>
          <p className="b3-page-sub">
            Tudo que entra e sai num lugar só. {overview.mesLabel}.
          </p>
        </div>

        <div className="b3-dashboard-hd-actions">
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

      {/* KPI grid consistente com Dashboard/Vendas/Produtos. Saldo do mes
          ganha accent="highlight" (cream + yellow border) — hierarquia
          por container, nao por tamanho. */}
      <section
        className="b3-kpi-grid"
        aria-label="Resumo financeiro do mês"
      >
        <KpiTile
          label="Recebido"
          Icon={ArrowUpCircleIcon}
          accent="green"
          value={formatBRL(overview.recebidoMesInCents)}
          empty={overview.recebidoMesInCents === 0}
          hint="entradas confirmadas"
        />
        <KpiTile
          label="Pago"
          Icon={ArrowDownCircleIcon}
          accent="rose"
          value={formatBRL(overview.pagoMesInCents)}
          empty={overview.pagoMesInCents === 0}
          hint="saídas confirmadas"
        />
        <KpiTile
          label="Saldo do mês"
          Icon={ScaleIcon}
          accent="highlight"
          value={formatBRL(overview.saldoMesInCents)}
          empty={overview.saldoMesInCents === 0}
          hint={
            saldoNegativo
              ? "Saiu mais do que entrou"
              : "Entrou mais do que saiu"
          }
        />
        <KpiTile
          label="Em aberto"
          Icon={ClockIcon}
          accent="cream"
          value={formatBRL(emAbertoNet)}
          empty={emAbertoNet === 0}
          hint={`Receber ${formatBRL(overview.pendenteReceberInCents)} · Pagar ${formatBRL(overview.pendentePagarInCents)}`}
        />
      </section>
    </header>
  );
}
