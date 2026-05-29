/**
 * KpiTile — átomo reutilizável da nova linguagem visual (Onda M5, 2026-05-29).
 *
 * Substitui shapes inline `<div className="b3-card p-3.5">` espalhados por
 * /admin. Variantes:
 *   - delta:    "↑12% vs. 30d atrás"  (Dashboard)
 *   - hint:     "Saiu mais do que entrou" (Financeiro)
 *   - subtle:   só valor + label (sem 3a linha)
 *
 * Accents: green | yellow | cream | rose | highlight (cream com border-yellow,
 * pro Saldo do mes no Financeiro).
 *
 * Pure presentational. Sem state. Server-component friendly.
 */

import {
  ArrowDownIcon,
  ArrowUpIcon,
  type LucideIcon,
} from "lucide-react";

export type KpiAccent = "green" | "yellow" | "cream" | "rose" | "highlight";

interface KpiTileProps {
  label: string;
  Icon?: LucideIcon;
  accent?: KpiAccent;
  /** Valor pre-formatado (string). Use formatBRL/formatNumber antes de passar. */
  value: string;
  /** Quando true, troca value pelo emptyLabel cinza italic. */
  empty?: boolean;
  emptyLabel?: string;
  /** Modo 1: delta pill + compare string ("vs. 30d atrás"). */
  delta?: number | null;
  compareLabel?: string;
  /** Inverte semáforo — crescer é RUIM (devoluções, custo incompleto). */
  invertedTone?: boolean;
  /** Modo 2: hint string abaixo do valor. */
  hint?: string;
}

export function KpiTile({
  label,
  Icon,
  accent = "cream",
  value,
  empty = false,
  emptyLabel,
  delta,
  compareLabel,
  invertedTone = false,
  hint,
}: KpiTileProps) {
  const showDelta = delta !== undefined;
  return (
    <article className="b3-kpi-tile" data-accent={accent}>
      <header className="b3-kpi-tile-hd">
        <span className="b3-kpi-tile-label">{label}</span>
        {Icon ? (
          <span aria-hidden className="b3-kpi-tile-icon">
            <Icon size={14} />
          </span>
        ) : null}
      </header>

      <p className="b3-kpi-tile-value">
        {empty ? (
          <span className="b3-kpi-tile-empty">{emptyLabel ?? "0"}</span>
        ) : (
          value
        )}
      </p>

      {showDelta ? (
        <p className="b3-kpi-tile-delta">
          {delta === null ? (
            <span className="b3-kpi-tile-delta-none">sem comparação</span>
          ) : (
            <>
              <DeltaPill pct={delta} invertedTone={invertedTone} />
              {compareLabel ? (
                <span className="b3-kpi-tile-compare">vs. {compareLabel}</span>
              ) : null}
            </>
          )}
        </p>
      ) : hint ? (
        <p className="b3-kpi-tile-hint">{hint}</p>
      ) : null}
    </article>
  );
}

function DeltaPill({
  pct,
  invertedTone,
}: {
  pct: number;
  invertedTone: boolean;
}) {
  const flat = Math.abs(pct) < 0.5;
  const positive = pct > 0;
  const good = invertedTone ? !positive : positive;
  const tone = flat ? "flat" : good ? "good" : "bad";
  const Icon = positive ? ArrowUpIcon : ArrowDownIcon;

  return (
    <span className="b3-kpi-tile-pill" data-tone={tone}>
      {!flat ? <Icon size={11} aria-hidden /> : null}
      {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

/** Helper de delta — útil pra páginas que computam current/previous direto. */
export function computeKpiDelta(
  current: number,
  previous: number,
): number | null {
  if (previous === 0) {
    if (current === 0) return 0;
    return null;
  }
  return ((current - previous) / Math.abs(previous)) * 100;
}
