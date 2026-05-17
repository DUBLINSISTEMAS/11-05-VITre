// Stat card individual do dashboard admin (port Dublin v3, Onda 5a).
// Layout: eyebrow → hero number → row de delta chip + hint.
//
// Container adota `b3-stat` (padding 16/18, border line, radius 10).
// DeltaChip migrou pra paleta ok/danger Dublin.
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
    <div className="b3-stat flex flex-col gap-3">
      <span className="text-eyebrow">{label}</span>
      <span className="text-hero-num text-ink-1">{value}</span>
      {delta || hint ? (
        <div className="flex flex-wrap items-center gap-2">
          {delta}
          {hint ? (
            <span className="text-[11px] text-ink-4">{hint}</span>
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
        tone === "positive" && "bg-ok-wash text-ok",
        tone === "negative" && "bg-danger-wash text-danger",
        tone === "neutral" && "bg-bg-app text-ink-4",
      )}
    >
      {label}
    </span>
  );
}
