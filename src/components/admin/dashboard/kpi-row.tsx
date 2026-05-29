/**
 * DashboardKpiRow — 4 KPIs no topo do dashboard.
 *
 * Onda M5 (2026-05-29) revisada — agora consome o atomo KpiTile pra
 * casar com Vendas/Produtos/Financeiro. Mantem mesma logica: delta vs
 * periodo anterior, semaforo invertido em Devolucoes, accents Mangos.
 */

import {
  CornerUpLeftIcon,
  ReceiptIcon,
  UserPlusIcon,
  WalletIcon,
} from "lucide-react";

import type { DashboardKpis } from "@/actions/dashboard/load-kpis";
import { formatBRL } from "@/lib/pricing";

import { computeKpiDelta, KpiTile } from "./kpi-tile";

interface KpiRowProps {
  kpis: DashboardKpis;
  /** Label do período pra mostrar no "vs. 30 dias atrás". */
  compareLabel: string;
}

export function DashboardKpiRow({ kpis, compareLabel }: KpiRowProps) {
  return (
    <section
      className="b3-kpi-grid"
      aria-label="Indicadores principais do período"
    >
      <KpiTile
        label="Vendas"
        Icon={ReceiptIcon}
        accent="green"
        value={String(kpis.vendas.current)}
        empty={kpis.vendas.current === 0}
        delta={computeKpiDelta(kpis.vendas.current, kpis.vendas.previous)}
        compareLabel={compareLabel}
      />
      <KpiTile
        label="Faturamento"
        Icon={WalletIcon}
        accent="yellow"
        value={formatBRL(kpis.faturamento.current)}
        empty={kpis.faturamento.current === 0}
        delta={computeKpiDelta(
          kpis.faturamento.current,
          kpis.faturamento.previous,
        )}
        compareLabel={compareLabel}
      />
      <KpiTile
        label="Clientes novos"
        Icon={UserPlusIcon}
        accent="cream"
        value={String(kpis.clientesNovos.current)}
        empty={kpis.clientesNovos.current === 0}
        delta={computeKpiDelta(
          kpis.clientesNovos.current,
          kpis.clientesNovos.previous,
        )}
        compareLabel={compareLabel}
      />
      <KpiTile
        label="Devoluções"
        Icon={CornerUpLeftIcon}
        accent="rose"
        invertedTone
        value={String(kpis.devolucoes.current)}
        empty={kpis.devolucoes.current === 0}
        emptyLabel="Nenhuma"
        delta={computeKpiDelta(
          kpis.devolucoes.current,
          kpis.devolucoes.previous,
        )}
        compareLabel={compareLabel}
      />
    </section>
  );
}
