import {
  ArrowDownIcon,
  ArrowUpIcon,
  ScaleIcon,
  WarehouseIcon,
} from "lucide-react";

import type { StockKpis } from "@/actions/stock/load";
import { cn } from "@/lib/utils";

interface StockKpiCardsProps {
  kpis: StockKpis;
}

/**
 * Grid de 4 cards no topo de /admin/estoque (follow-up Fase 4 — ADR-0015).
 * Mostra saldo atual + entradas/saídas/ajustes do mês corrente.
 *
 * Server component — recebe `kpis` já calculado pelo page.tsx.
 */
export function StockKpiCards({ kpis }: StockKpiCardsProps) {
  const cards = [
    {
      label: "Saldo atual",
      value: kpis.currentTotal,
      hint: "Soma de todos os produtos com controle de estoque.",
      Icon: WarehouseIcon,
      tone: "default" as const,
    },
    {
      label: "Entradas no mês",
      value: kpis.monthIn,
      hint: "Compras, devoluções e ajustes positivos.",
      Icon: ArrowUpIcon,
      tone: "positive" as const,
    },
    {
      label: "Saídas no mês",
      value: kpis.monthOut,
      hint: "Vendas, perdas e ajustes negativos.",
      Icon: ArrowDownIcon,
      tone: "negative" as const,
    },
    {
      label: "Ajustes no mês",
      value: kpis.monthAdjustments,
      hint: "Quantidade de inventários/correções.",
      Icon: ScaleIcon,
      tone: "default" as const,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="b3-stat">
          <div className="flex items-start justify-between gap-2">
            <span className="b3-stat-label">{c.label}</span>
            <div
              className={cn(
                "flex size-7 items-center justify-center rounded-md",
                c.tone === "positive" && "bg-ok-wash text-ok",
                c.tone === "negative" && "bg-danger-wash text-danger",
                c.tone === "default" && "bg-bg-app text-ink-4",
              )}
            >
              <c.Icon className="size-3.5" />
            </div>
          </div>
          <div className="b3-stat-value mt-2">
            {c.value.toLocaleString("pt-BR")}
          </div>
          <p className="text-ink-4 mt-1 text-xs">{c.hint}</p>
        </div>
      ))}
    </div>
  );
}
