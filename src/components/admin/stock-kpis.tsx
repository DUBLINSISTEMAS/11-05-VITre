import {
  ArrowDownIcon,
  ArrowUpIcon,
  ScaleIcon,
  WarehouseIcon,
} from "lucide-react";

import type { StockKpis } from "@/actions/stock/types";
import { formatBRL } from "@/lib/pricing";
import { cn } from "@/lib/utils";

interface StockKpiCardsProps {
  kpis: StockKpis;
}

/**
 * Grid de 4 cards no topo de /admin/estoque.
 *
 * Audit 2026-05-26: o KPI principal "Saldo atual" virou VALOR EM R$
 * (custo + venda) em vez de soma de unidades agregadas. Lojista de joia
 * com peças de R$ 80 e R$ 4.500 NÃO consegue tomar decisão olhando
 * "487 unidades" — quer ver "R$ 84.500 em custo / R$ 156.200 em venda".
 *
 * Card "Compras no mês" (era "Entradas") filtra agora SÓ manual_in —
 * devoluções e ajustes não inflavam o número.
 *
 * Server component — recebe `kpis` já calculado pelo page.tsx.
 */
export function StockKpiCards({ kpis }: StockKpiCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {/* Card principal: valor em R$ — duplo (custo + venda) numa linha
          maior. Tone default. Hint mostra unidades como contexto. */}
      <div className="b3-stat">
        <div className="flex items-start justify-between gap-2">
          <span className="b3-stat-label">Estoque (valor)</span>
          <div className="bg-bg-app text-ink-4 flex size-7 items-center justify-center rounded-md">
            <WarehouseIcon className="size-3.5" />
          </div>
        </div>
        <div className="mt-2 space-y-0.5">
          <div className="b3-stat-value text-[18px]">
            {formatBRL(kpis.currentCostInCents)}
          </div>
          <div className="text-ink-3 text-[11.5px] tabular-nums">
            <span className="font-semibold">
              {formatBRL(kpis.currentSaleInCents)}
            </span>{" "}
            <span className="text-ink-4">a preço de venda</span>
          </div>
        </div>
        <p className="text-ink-4 mt-1 text-xs">
          A custo · {kpis.currentUnits.toLocaleString("pt-BR")} un.
        </p>
      </div>

      <KpiCard
        label="Compras no mês"
        value={kpis.monthPurchases.toLocaleString("pt-BR")}
        hint="Entradas lançadas como compra. Devoluções e ajustes não contam."
        Icon={ArrowUpIcon}
        tone="positive"
      />
      <KpiCard
        label="Saídas no mês"
        value={kpis.monthOut.toLocaleString("pt-BR")}
        hint="Vendas, perdas e ajustes negativos."
        Icon={ArrowDownIcon}
        tone="negative"
      />
      <KpiCard
        label="Ajustes no mês"
        value={kpis.monthAdjustments.toLocaleString("pt-BR")}
        hint={
          kpis.monthAdjustmentsAbsTotal > 0
            ? `${kpis.monthAdjustmentsAbsTotal.toLocaleString("pt-BR")} ${kpis.monthAdjustmentsAbsTotal === 1 ? "peça" : "peças"} movimentada${kpis.monthAdjustmentsAbsTotal === 1 ? "" : "s"} em correções (contagem física, perdas).`
            : "Lançamentos de correção (contagem física, etc)."
        }
        Icon={ScaleIcon}
        tone="default"
      />
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  Icon,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  Icon: typeof WarehouseIcon;
  tone: "positive" | "negative" | "default";
}) {
  return (
    <div className="b3-stat">
      <div className="flex items-start justify-between gap-2">
        <span className="b3-stat-label">{label}</span>
        <div
          className={cn(
            "flex size-7 items-center justify-center rounded-md",
            tone === "positive" && "bg-ok-wash text-ok",
            tone === "negative" && "bg-danger-wash text-danger",
            tone === "default" && "bg-bg-app text-ink-4",
          )}
        >
          <Icon className="size-3.5" />
        </div>
      </div>
      <div className="b3-stat-value mt-2">{value}</div>
      <p className="text-ink-4 mt-1 text-xs">{hint}</p>
    </div>
  );
}
