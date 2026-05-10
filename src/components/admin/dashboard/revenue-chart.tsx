"use client";

// Chart de receita diária no dashboard admin (canvas-v1 admin Lote 3).
// SVG inline hand-rolled — sem deps externas (~70KB do recharts evitado).
// Toggle de período 7d/14d/30d/90d state-only; server sempre traz 90 dias.
//
// Layout:
// - Header: título + toggle pill 4 opções
// - SVG path linha + área tingida + último data point destacado com badge
//   inline mostrando valor + label do dia em monospace
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
    <div className="bg-card flex flex-col gap-4 rounded-xl border p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="space-y-1">
          <span className="text-eyebrow">Receita</span>
          <p className="text-base font-semibold tracking-tight text-foreground">
            {formatBRL(total)}{" "}
            <span className="text-xs font-medium text-muted-foreground">
              · {period} dias
            </span>
          </p>
        </div>
        <div
          role="tablist"
          aria-label="Período do gráfico"
          className="bg-muted/60 flex shrink-0 items-center rounded-lg p-0.5"
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
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hocus:text-foreground",
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
// SVG renderer (puro, sem state). ViewBox 0..100 x 0..40 — escala automática.
// ---------------------------------------------------------------------------
function ChartSvg({
  points,
}: {
  points: ReadonlyArray<{ date: string; totalInCents: number }>;
}) {
  const width = 100;
  const height = 40;
  const padTop = 4;
  const padBottom = 4;

  const max = Math.max(1, ...points.map((p) => p.totalInCents));
  const n = points.length;

  if (n === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        Sem dados ainda.
      </div>
    );
  }

  // Coordenadas normalizadas. Quando n=1, x fica em 0 (única amostra).
  const xs = points.map((_, i) => (n === 1 ? 0 : (i / (n - 1)) * width));
  const ys = points.map(
    (p) =>
      height -
      padBottom -
      ((p.totalInCents / max) * (height - padTop - padBottom)),
  );

  // Path linha: M x0,y0 L x1,y1 L x2,y2 ...
  const linePath = xs
    .map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${ys[i]!.toFixed(2)}`)
    .join(" ");

  // Path área (linha fechada com baseline): linePath + L lastX,height L firstX,height Z
  const areaPath = `${linePath} L${xs[n - 1]!.toFixed(2)},${height} L${xs[0]!.toFixed(2)},${height} Z`;

  // Último ponto não-zero pra badge
  const lastNonZeroIdx = (() => {
    for (let i = n - 1; i >= 0; i--) {
      if (points[i]!.totalInCents > 0) return i;
    }
    return null;
  })();

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="block h-32 w-full"
        aria-hidden
      >
        <defs>
          <linearGradient id="revenue-area" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor="var(--primary)"
              stopOpacity="0.18"
            />
            <stop
              offset="100%"
              stopColor="var(--primary)"
              stopOpacity="0"
            />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#revenue-area)" />
        <path
          d={linePath}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="0.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {lastNonZeroIdx !== null ? (
          <circle
            cx={xs[lastNonZeroIdx]}
            cy={ys[lastNonZeroIdx]}
            r="0.9"
            fill="var(--primary)"
            stroke="var(--card)"
            strokeWidth="0.4"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </svg>
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
      className="bg-foreground text-background pointer-events-none absolute rounded-md px-2 py-1 text-[10.5px] font-medium shadow-sm"
      style={{ left, top }}
    >
      <span className="font-mono tabular-nums">
        {formatBRL(point.totalInCents)}
      </span>
      <span className="text-background/70 ml-1">· {dayLabel}</span>
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
