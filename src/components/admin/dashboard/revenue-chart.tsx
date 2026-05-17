"use client";

// Chart de receita diária no dashboard admin (port Dublin v3, Onda 5a).
// SVG inline hand-rolled — sem deps externas (~70KB do recharts evitado).
// Toggle de período 7d/14d/30d/90d state-only; server sempre traz 90 dias.
//
// Layout:
// - Header: título + toggle pill 4 opções (rail bg-app, pílula bg-surface)
// - SVG path linha + área tingida + último data point destacado com badge
//   inline mostrando valor + label do dia em monospace
//
// Container = `b3-card` (Onda 5a). Gridlines SVG usam --line (era --border).
import { useMemo, useState } from "react";

import { formatBRL } from "@/lib/pricing";
import { cn } from "@/lib/utils";

export interface RevenueChartProps {
  /**
   * Série diária ordenada ASC. `date` em ISO YYYY-MM-DD (UTC).
   * Server retorna sempre 90 dias com zeros pra dias sem receita.
   */
  series: ReadonlyArray<{ date: string; totalInCents: number }>;
}

type Period = 7 | 14 | 30 | 90;
const PERIODS: ReadonlyArray<Period> = [7, 14, 30, 90];

export function RevenueChart({ series }: RevenueChartProps) {
  const [period, setPeriod] = useState<Period>(14);

  const visible = useMemo(() => {
    return series.slice(-period);
  }, [series, period]);

  const total = useMemo(
    () => visible.reduce((s, p) => s + p.totalInCents, 0),
    [visible],
  );

  return (
    <div className="b3-card flex flex-col gap-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="space-y-1">
          <span className="text-eyebrow">Receita</span>
          <p className="text-ink-1 flex items-baseline gap-2 font-mono text-[22px] font-semibold tabular-nums leading-none tracking-[-0.02em]">
            {formatBRL(total)}
            <span className="text-ink-4 font-sans text-[11.5px] font-medium tracking-normal">
              · {period} dias
            </span>
          </p>
        </div>
        <div
          role="tablist"
          aria-label="Período do gráfico"
          className="bg-bg-app flex shrink-0 items-center rounded-lg p-0.5"
        >
          {PERIODS.map((p) => {
            const active = p === period;
            return (
              <button
                key={p}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => setPeriod(p)}
                className={cn(
                  "rounded-md px-2.5 py-1 font-mono text-[11px] font-medium transition-colors",
                  active
                    ? "bg-surface text-ink-1 shadow-sm"
                    : "text-ink-4 hocus:text-ink-1",
                )}
              >
                {p}d
              </button>
            );
          })}
        </div>
      </div>

      <ChartSvg points={visible} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// SVG renderer (puro, sem state). ViewBox 0..600 x 0..200 — escala automática
// horizontal via preserveAspectRatio="none". 4 gridlines dashed (y=20/70/120/170)
// + 6 labels mono no eixo X (canvas linhas 184-205).
// ---------------------------------------------------------------------------
function ChartSvg({
  points,
}: {
  points: ReadonlyArray<{ date: string; totalInCents: number }>;
}) {
  const width = 600;
  const height = 200;
  const padTop = 20;
  const padBottom = 30; // espaço pras labels do eixo X
  const innerH = height - padTop - padBottom; // 150

  const max = Math.max(1, ...points.map((p) => p.totalInCents));
  const n = points.length;

  if (n === 0) {
    return (
      <div className="text-ink-4 flex h-44 items-center justify-center text-sm">
        Sem dados ainda.
      </div>
    );
  }

  // Coordenadas normalizadas. Quando n=1, x fica em 0 (única amostra).
  const xs = points.map((_, i) => (n === 1 ? 0 : (i / (n - 1)) * width));
  const ys = points.map(
    (p) => padTop + innerH - (p.totalInCents / max) * innerH,
  );

  // Path linha: M x0,y0 L x1,y1 L x2,y2 ...
  const linePath = xs
    .map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${ys[i]!.toFixed(2)}`)
    .join(" ");

  // Path área (linha fechada com baseline): + L lastX,baseline L firstX,baseline Z
  const baseline = padTop + innerH;
  const areaPath = `${linePath} L${xs[n - 1]!.toFixed(2)},${baseline} L${xs[0]!.toFixed(2)},${baseline} Z`;

  // Último ponto não-zero pra badge
  const lastNonZeroIdx = (() => {
    for (let i = n - 1; i >= 0; i--) {
      if (points[i]!.totalInCents > 0) return i;
    }
    return null;
  })();

  // Gridlines em y=padTop, padTop+innerH/3, padTop+2*innerH/3, baseline
  const gridYs = [padTop, padTop + innerH / 3, padTop + (2 * innerH) / 3, baseline];

  // X-axis ticks: 6 labels distribuídas. Pra n<6 mostra todas; pra n>=6
  // pega ~6 indices uniformes, sempre incluindo primeiro e último.
  const tickCount = Math.min(6, n);
  const tickIdxs = tickCount <= 1
    ? [0]
    : Array.from({ length: tickCount }, (_, i) =>
        Math.round((i / (tickCount - 1)) * (n - 1)),
      );

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="block h-44 w-full"
        aria-hidden
      >
        <defs>
          <linearGradient id="revenue-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Gridlines dashed */}
        {gridYs.map((y, i) => (
          <line
            key={i}
            x1="0"
            y1={y}
            x2={width}
            y2={y}
            stroke="var(--line)"
            strokeWidth="1"
            strokeDasharray="3 4"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        <path d={areaPath} fill="url(#revenue-area)" />
        <path
          d={linePath}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {lastNonZeroIdx !== null ? (
          <circle
            cx={xs[lastNonZeroIdx]}
            cy={ys[lastNonZeroIdx]}
            r="3.5"
            fill="var(--primary)"
            stroke="var(--surface)"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </svg>

      {/* X-axis labels (HTML overlay pra evitar text scaling weirdo do SVG) */}
      <div className="text-ink-4 pointer-events-none absolute inset-x-0 -bottom-1 flex justify-between font-mono text-[10.5px] tabular-nums">
        {tickIdxs.map((idx) => (
          <span key={idx}>{formatTick(points[idx]!.date)}</span>
        ))}
      </div>

      {lastNonZeroIdx !== null ? (
        <LastPointBadge
          xRatio={xs[lastNonZeroIdx]! / width}
          yRatio={ys[lastNonZeroIdx]! / height}
          point={points[lastNonZeroIdx]!}
        />
      ) : null}
    </div>
  );
}

// "25/03" — DD/MM curto pra labels do eixo X.
function formatTick(isoDate: string): string {
  const d = new Date(isoDate + "T00:00:00Z");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

function LastPointBadge({
  xRatio,
  yRatio,
  point,
}: {
  xRatio: number;
  yRatio: number;
  point: { date: string; totalInCents: number };
}) {
  // Posição em % do container; clamp pra não sair do canvas
  const left = `${Math.min(85, Math.max(0, xRatio * 100 - 8))}%`;
  const top = `${Math.max(0, yRatio * 100 - 24)}%`;
  const dayLabel = formatDayShort(point.date);
  return (
    <div
      className="bg-ink-1 text-white pointer-events-none absolute rounded-md px-2 py-1 text-[10.5px] font-medium shadow-sm"
      style={{ left, top }}
    >
      <span className="font-mono tabular-nums">
        {formatBRL(point.totalInCents)}
      </span>
      <span className="text-white/70 ml-1">· {dayLabel}</span>
    </div>
  );
}

// "ter", "qua" — abrev curta pt-BR a partir do ISO date.
function formatDayShort(isoDate: string): string {
  // ISO YYYY-MM-DD interpretado como UTC midnight; usar getUTCDay pra evitar
  // off-by-one com timezone do server.
  const d = new Date(isoDate + "T00:00:00Z");
  return d
    .toLocaleDateString("pt-BR", { weekday: "short", timeZone: "UTC" })
    .replace(".", "")
    .toLowerCase();
}
