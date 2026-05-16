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
        <div
          key={c.label}
          className="border-border/60 bg-card rounded-xl border p-4"
        >
          <div className="flex items-start justify-between gap-2">
            <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
              {c.label}
            </span>
            <div
              className={cn(
                "flex size-7 items-center justify-center rounded-md",
                c.tone === "positive" && "bg-emerald-100 text-emerald-700",
                c.tone === "negative" && "bg-rose-100 text-rose-700",
                c.tone === "default" && "bg-muted text-muted-foreground",
              )}
            >
              <c.Icon className="size-3.5" />
            </div>
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold tabular-nums">
            {c.value.toLocaleString("pt-BR")}
          </div>
          <p className="text-muted-foreground mt-1 text-xs">{c.hint}</p>
        </div>
      ))}
    </div>
  );
}
