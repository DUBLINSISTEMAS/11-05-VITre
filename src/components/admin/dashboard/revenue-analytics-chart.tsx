"use client";

// RevenueAnalyticsChart — gráfico de receita em barras-cápsula.
//
// Pivô 2026-05-27 sênior:
// - Série TEMPORAL REAL (dd/mm). Antes era dia-da-semana agregado, que
//   mostrava buckets vazios (Qua/Qui sem venda) e mentia visualmente.
// - margin.bottom: 28 — labels do XAxis ficavam sob as barras antes
//   (bottom: 0 não deixa espaço externo no Recharts).
// - Recharts decide quantos ticks mostrar com interval="preserveStartEnd"
//   pra não estourar em 30/90 dias.
// - Empty state honesto: zero vendas no período = mensagem clara,
//   sem barra fantasma.
//
// Cor da barra: var(--brand) — cor primária do projeto.
// Capsule effect via Bar shape custom (cantos arredondados em ambas pontas).

import { ChevronDownIcon } from "lucide-react";
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

export interface RevenuePoint {
  /** Label do eixo X (ex: "21/05"). */
  label: string;
  /** Valor em centavos. */
  value: number;
}

export interface RevenueAnalyticsChartProps {
  data: ReadonlyArray<RevenuePoint>;
  /** Texto do pill de período (cosmético; controle real fica no DateRangePill). */
  periodLabel: string;
}

export function RevenueAnalyticsChart({
  data,
  periodLabel,
}: RevenueAnalyticsChartProps) {
  const chartData = useMemo(
    () =>
      data.map((d) => ({
        label: d.label,
        // Recharts calcula escala em unidade humana (eixo Y em "5k", "10k"…)
        value: d.value / 100,
      })),
    [data],
  );

  const totalCents = useMemo(
    () => data.reduce((acc, d) => acc + d.value, 0),
    [data],
  );

  // Pra séries longas (>14 pontos) deixamos Recharts decidir os ticks pra
  // não sobrepor. Em até 14, mostra todos.
  const tickInterval: number | "preserveStartEnd" =
    chartData.length <= 14 ? 0 : "preserveStartEnd";

  return (
    <div className="b3-card b3-chart-card">
      <header className="b3-chart-card-hd">
        <h3 className="b3-chart-card-title">Receita do período</h3>
        <span className="b3-chart-period-pill">
          {periodLabel}
          <ChevronDownIcon size={13} aria-hidden />
        </span>
      </header>

      <div className="b3-chart-card-body">
        {totalCents === 0 ? (
          <EmptyChartState
            message="Sem vendas confirmadas neste período"
            hint="Quando você fechar uma venda no PDV ou um cliente confirmar pelo WhatsApp, ela aparece aqui."
          />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 16, right: 12, left: 0, bottom: 18 }}
              barCategoryGap="22%"
            >
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
                interval={tickInterval}
                tickMargin={8}
                minTickGap={8}
              />
              <YAxis
                width={44}
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
              <Tooltip
                cursor={{ fill: "transparent" }}
                content={<CustomTooltip />}
              />
              <Bar
                dataKey="value"
                fill="var(--brand)"
                shape={(props: unknown) => (
                  <CapsuleBar {...(props as CapsuleBarProps)} />
                )}
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

// ----- EMPTY STATE -----

function EmptyChartState({
  message,
  hint,
}: {
  message: string;
  hint?: string;
}) {
  return (
    <div className="b3-chart-empty">
      <div className="b3-chart-empty-icon" aria-hidden>
        {/* Bar chart neutro decorativo */}
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
          <path
            d="M4 19V11M10 19V5M16 19V13M22 19H2"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <p className="b3-chart-empty-msg">{message}</p>
      {hint ? <p className="b3-chart-empty-hint">{hint}</p> : null}
    </div>
  );
}

// ----- TOOLTIP -----

interface TooltipPayload {
  active?: boolean;
  payload?: Array<{ value?: number; payload?: { label?: string } }>;
}

function CustomTooltip({ active, payload }: TooltipPayload) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0]!;
  const cents = (item.value ?? 0) * 100;
  const label = item.payload?.label ?? "";

  return (
    <div className="b3-chart-tooltip">
      <div className="b3-chart-tooltip-label">{label}</div>
      <div className="b3-chart-tooltip-value">{formatBRL(cents)}</div>
    </div>
  );
}

// ----- CAPSULE BAR SHAPE -----

interface CapsuleBarProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
}

function CapsuleBar({ x, y, width, height, fill }: CapsuleBarProps) {
  if (
    x === undefined ||
    y === undefined ||
    width === undefined ||
    height === undefined ||
    width <= 0 ||
    height <= 0
  ) {
    return null;
  }

  const radius = Math.min(width / 2, height / 2);

  const path = `
    M ${x} ${y + radius}
    A ${radius} ${radius} 0 0 1 ${x + width} ${y + radius}
    L ${x + width} ${y + height - radius}
    A ${radius} ${radius} 0 0 1 ${x} ${y + height - radius}
    Z
  `;

  return <path d={path} fill={fill ?? "var(--brand)"} />;
}
