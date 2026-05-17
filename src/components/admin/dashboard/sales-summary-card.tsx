"use client";

// Card "Total de vendas" do dashboard — port Dublin v3 (ADR-0019, Onda A.5).
// Replica `bagy-extra.jsx` linhas 57-98:
// - Header: h3 "Total de vendas" + select período 7/30/90 + hide-values toggle
// - Body grid 1fr 260px (mobile: 1fr empilhado):
//   - Esquerda: <Sparkline> SVG inline
//   - Direita: coluna de 5 stats com b3-stat-circle colored borders
//
// Client component porque o select período usa router.replace pra mudar
// ?periodo na URL + hide-values lê context.
//
// Stats coloridas (cor = state, percent = share do total):
//   TOTAL DE PEDIDOS  → --ink-3 (neutro), ícone Archive em vez de pct
//   APROVADOS         → --ok    (verde)
//   PENDENTES         → --warn  (amarelo/laranja)
//   CANCELADOS        → --danger (vermelho)
//   EXPIRADOS         → --ink-4 (cinza)

import { ArchiveIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { formatBRL } from "@/lib/pricing";

import {
  HiddenValue,
  HideValuesProvider,
  HideValuesToggle,
} from "./hide-values-toggle";
import { Sparkline } from "./sparkline";

export interface SalesBucket {
  /** Contagem de pedidos. */
  count: number;
  /** Soma em cents. */
  totalInCents: number;
}

export interface SalesSummary {
  total: SalesBucket;
  aprovados: SalesBucket;
  pendentes: SalesBucket;
  cancelados: SalesBucket;
  expirados: SalesBucket;
}

export interface SalesSummaryCardProps {
  /** Período atual selecionado (em dias). */
  periodo: 7 | 30 | 90;
  /** Série diária de receita já filtrada pro período. */
  series: number[];
  /** Stats agregados pro período. */
  summary: SalesSummary;
}

export function SalesSummaryCard(props: SalesSummaryCardProps) {
  return (
    <HideValuesProvider>
      <SalesSummaryInner {...props} />
    </HideValuesProvider>
  );
}

function SalesSummaryInner({ periodo, series, summary }: SalesSummaryCardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const handlePeriodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value;
    const params = new URLSearchParams(searchParams.toString());
    if (next === "30") {
      params.delete("periodo");
    } else {
      params.set("periodo", next);
    }
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `/admin?${qs}` : "/admin");
    });
  };

  // Computa pct cada bucket vs total (count-based)
  const totalCount = summary.total.count;
  const pct = (n: number) =>
    totalCount === 0 ? 0 : Math.round((n / totalCount) * 100);

  return (
    <div className="b3-card mb-4 overflow-hidden">
      <div className="b3-card-hd">
        <h3>Total de vendas</h3>
        <div className="flex items-center gap-2">
          <HideValuesToggle />
          <select
            className="b3-select"
            value={String(periodo)}
            onChange={handlePeriodChange}
            disabled={isPending}
            style={{ width: 160, height: 32, fontSize: 12.5 }}
            aria-label="Período"
          >
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
          </select>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_260px]">
        <div className="p-5">
          <Sparkline data={series} />
        </div>
        <div className="flex flex-col gap-4 border-t border-line p-5 lg:border-l lg:border-t-0">
          <StatRow
            label="TOTAL DE PEDIDOS"
            count={summary.total.count}
            cents={summary.total.totalInCents}
            color="var(--ink-3)"
            pctLabel={null}
          />
          <StatRow
            label="APROVADOS"
            count={summary.aprovados.count}
            cents={summary.aprovados.totalInCents}
            color="var(--ok)"
            pctLabel={`${pct(summary.aprovados.count)}%`}
          />
          <StatRow
            label="PENDENTES"
            count={summary.pendentes.count}
            cents={summary.pendentes.totalInCents}
            color="var(--warn)"
            pctLabel={`${pct(summary.pendentes.count)}%`}
          />
          <StatRow
            label="CANCELADOS"
            count={summary.cancelados.count}
            cents={summary.cancelados.totalInCents}
            color="var(--danger)"
            pctLabel={`${pct(summary.cancelados.count)}%`}
          />
          <StatRow
            label="EXPIRADOS"
            count={summary.expirados.count}
            cents={summary.expirados.totalInCents}
            color="var(--ink-4)"
            pctLabel={`${pct(summary.expirados.count)}%`}
          />
        </div>
      </div>
    </div>
  );
}

interface StatRowProps {
  label: string;
  count: number;
  cents: number;
  color: string;
  /** null = renderiza ícone Archive (usado em TOTAL); string = pct % */
  pctLabel: string | null;
}

function StatRow({ label, count, cents, color, pctLabel }: StatRowProps) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="b3-stat-circle"
        style={{ color, borderColor: color }}
        aria-hidden
      >
        {pctLabel ?? <ArchiveIcon size={12} />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-ink-4">
          {label}
        </div>
        <div className="mono text-[13px] font-semibold">
          <HiddenValue>
            {count} · {formatBRL(cents)}
          </HiddenValue>
        </div>
      </div>
    </div>
  );
}
