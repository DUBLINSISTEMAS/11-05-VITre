// Stat card individual do dashboard admin (canvas-v1 admin Lote 3).
// Layout: eyebrow → hero number → row de delta chip + hint.
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface StatCardProps {
  /** Label uppercase mono pequeno (canvas linhas 138, 152, 166, 180). */
  label: string;
  /** Valor principal — string já formatada (ex: "R$ 1.240" ou "47"). */
  value: ReactNode;
  /** Chip de delta (use `formatStatDelta` + componente `<DeltaChip>`). */
  delta?: ReactNode;
  /** Hint à direita do delta (ex: "vs 7 dias anteriores"). */
  hint?: ReactNode;
}

export function StatCard({ label, value, delta, hint }: StatCardProps) {
  return (
    <div className="bg-card flex flex-col gap-3 rounded-xl border p-4 shadow-sm">
      <span className="text-eyebrow">{label}</span>
      <span className="text-hero-num text-foreground">{value}</span>
      {delta || hint ? (
        <div className="flex flex-wrap items-center gap-2">
          {delta}
          {hint ? (
            <span className="text-[11px] text-muted-foreground">{hint}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export interface DeltaChipProps {
  label: string;
  tone: "positive" | "negative" | "neutral";
}

export function DeltaChip({ label, tone }: DeltaChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[10.5px] font-semibold leading-none",
        tone === "positive" && "bg-success-soft text-success-foreground",
        tone === "negative" && "bg-destructive-soft text-destructive-foreground",
        tone === "neutral" && "bg-muted text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}
