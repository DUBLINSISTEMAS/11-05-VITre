"use client";

// TotalIncomeChart — Receita vs Despesa em barras agrupadas (8 meses).
//
// Pivô 2026-05-27 sênior:
// - margin.bottom: 24 (antes 0 — labels colidiam com barras)
// - Empty state honesto quando série inteira está zerada
// - Height controlado por wrapper (.b3-chart-card-body) pra responsivo

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatBRL, formatBRLShort } from "@/lib/pricing";

export interface IncomePoint {
  label: string;
  /** Receita em centavos. */
  profit: number;
  /** Despesa em centavos. */
  loss: number;
}

export interface TotalIncomeChartProps {
  data: ReadonlyArray<IncomePoint>;
}

const PATTERN_ID = "b3-income-hatched-brand";

export function TotalIncomeChart({ data }: TotalIncomeChartProps) {
  const chartData = useMemo(
    () =>
      data.map((d) => ({
        label: d.label,
        profit: d.profit / 100,
        loss: d.loss / 100,
      })),
    [data],
  );

  const hasAnyValue = useMemo(
    () => data.some((d) => d.profit > 0 || d.loss > 0),
    [data],
  );

  return (
    <div className="b3-card b3-chart-card">
      <header className="b3-chart-card-hd b3-chart-card-hd--income">
        <div>
          <h3 className="b3-chart-card-title">Receita vs despesa</h3>
          <p className="b3-chart-card-sub">Últimos 8 meses</p>
        </div>
      </header>

      <div className="b3-chart-legend">
        <span className="b3-chart-legend-item">
          <span
            aria-hidden
            className="b3-chart-legend-swatch b3-chart-legend-swatch--profit"
          />
          Receita
        </span>
        <span className="b3-chart-legend-item">
          <span
            aria-hidden
            className="b3-chart-legend-swatch b3-chart-legend-swatch--loss"
          />
          Despesa
        </span>
      </div>

      <div className="b3-chart-card-body">
        {!hasAnyValue ? (
          <div className="b3-chart-empty">
            <div className="b3-chart-empty-icon" aria-hidden>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 19V11M10 19V5M16 19V13M22 19H2"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <p className="b3-chart-empty-msg">Sem receita ou despesa registrada</p>
            <p className="b3-chart-empty-hint">
              Lance despesas em A pagar e vendas no PDV para ver a comparação aqui.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 12, right: 8, left: 0, bottom: 18 }}
              barCategoryGap="22%"
              barGap={3}
            >
              <defs>
                <pattern
                  id={PATTERN_ID}
                  patternUnits="userSpaceOnUse"
                  width={6}
                  height={6}
                  patternTransform="rotate(45)"
                >
                  <rect width={6} height={6} fill="var(--brand)" />
                  <line
                    x1={0}
                    y1={0}
                    x2={0}
                    y2={6}
                    stroke="white"
                    strokeWidth={2}
                    strokeOpacity={0.45}
                  />
                </pattern>
              </defs>
              <CartesianGrid
                stroke="var(--line)"
                strokeDasharray="3 4"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{
                  fill: "var(--ink-4)",
                  fontSize: 11,
                  fontFamily:
                    "var(--font-mono, 'Geist Mono', ui-monospace, monospace)",
                }}
                axisLine={false}
                tickLine={false}
                tickMargin={8}
              />
              <YAxis
                width={40}
                tick={{
                  fill: "var(--ink-4)",
                  fontSize: 10.5,
                  fontFamily:
                    "var(--font-mono, 'Geist Mono', ui-monospace, monospace)",
                }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => formatBRLShort(v * 100)}
              />
              <Tooltip cursor={{ fill: "transparent" }} content={<IncomeTooltip />} />
              <Bar
                dataKey="profit"
                fill={`url(#${PATTERN_ID})`}
                radius={[4, 4, 0, 0]}
                isAnimationActive
                animationDuration={400}
              />
              <Bar
                dataKey="loss"
                fill="#111827"
                radius={[4, 4, 0, 0]}
                isAnimationActive
                animationDuration={400}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

// ----- TOOLTIP -----

interface IncomeTooltipPayload {
  active?: boolean;
  payload?: Array<{
    name?: string;
    value?: number;
    dataKey?: string;
    payload?: { label?: string };
  }>;
}

function IncomeTooltip({ active, payload }: IncomeTooltipPayload) {
  if (!active || !payload || payload.length === 0) return null;
  const label = payload[0]!.payload?.label ?? "";

  return (
    <div className="b3-chart-tooltip">
      <div className="b3-chart-tooltip-label">{label}</div>
      {payload.map((p) => {
        const cents = (p.value ?? 0) * 100;
        const seriesLabel = p.dataKey === "profit" ? "Receita" : "Despesa";
        return (
          <div key={p.dataKey} className="b3-chart-tooltip-row">
            <span className="b3-chart-tooltip-row-label">{seriesLabel}</span>
            <span className="b3-chart-tooltip-row-value">{formatBRL(cents)}</span>
          </div>
        );
      })}
    </div>
  );
}
