"use client";

// Sparkline SVG inline interativo — handoff design 2026-05-25 (Passo 3 redesign
// dashboard), incrementado em 2026-05-26 com hover/tooltip.
//
// Replica `design_handoff_mangos_pay/app-oficial/dashboard.jsx` linhas 54-102:
// - viewBox 720x180 com padding pra y-axis labels (esquerda) + x-axis labels
//   (inferior)
// - 5 gridlines tracejadas horizontais com label R$ em escala (kk/MM)
// - 3 x-axis date labels (start, meio, hoje) em Geist Mono
// - Path stroke + area fill em brand verde Mangos (var(--brand))
// - Endpoint dot no último ponto, cor brand
// - Hover: guideline vertical + dot ampliado + tooltip flutuante com data +
//   valor BRL formatado. Hit-areas invisíveis (1 rect por dia) capturam o
//   mousemove; ponteiro `mouseleave` no svg limpa o hover.
//
// Client component (precisa de state pra hover). SVG puro, zero deps.

import { useState } from "react";

import { formatBRL as formatBRLFull, formatBRLShort } from "@/lib/pricing";

const VIEW_W = 720;
const VIEW_H = 180;
const PAD = { top: 12, right: 12, bottom: 28, left: 36 };
const INNER_W = VIEW_W - PAD.left - PAD.right;
const INNER_H = VIEW_H - PAD.top - PAD.bottom;
const TICKS = 4;

export interface SparklineProps {
  /** Série em CENTAVOS. Cada elemento = 1 dia (ordenado ASC). */
  data: number[];
  className?: string;
}

export function Sparkline({ data, className }: SparklineProps) {
  const safeData = data.length > 0 ? data : [0, 0];
  const max = Math.max(...safeData, 1);
  const lastIdx = safeData.length - 1 || 1;
  const dx = INNER_W / lastIdx;

  const points = safeData.map((v, i) => {
    const x = PAD.left + i * dx;
    const y = PAD.top + INNER_H - (v / max) * INNER_H;
    return { x, y };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");

  // Area-fill: linha + fecha pelo canto inferior direito + esquerdo.
  const areaPath =
    linePath +
    ` L ${(PAD.left + INNER_W).toFixed(2)} ${(PAD.top + INNER_H).toFixed(2)}` +
    ` L ${PAD.left.toFixed(2)} ${(PAD.top + INNER_H).toFixed(2)} Z`;

  // y-axis: 5 ticks (0/4, 1/4, 2/4, 3/4, 4/4) com valor em R$ short
  const yTicks = Array.from({ length: TICKS + 1 }, (_, i) => {
    const y = PAD.top + (INNER_H / TICKS) * i;
    const value = max - (max / TICKS) * i;
    return { y, label: formatBRLShort(value) };
  });

  // x-axis: 3 datas — primeiro dia da série, meio, hoje (último dia).
  const today = new Date();
  const xLabelIdx = [0, Math.floor(safeData.length / 2), safeData.length - 1];
  const xLabels = xLabelIdx.map((i, k) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (safeData.length - 1 - i));
    const align: "start" | "middle" | "end" =
      k === 0 ? "start" : k === xLabelIdx.length - 1 ? "end" : "middle";
    return {
      i,
      label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
      align,
    };
  });

  const lastPoint = points[points.length - 1]!;

  // ---- HOVER state (índice do dia ativo, ou null) ----
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  // Datas completas pra tooltip (1 entrada por ponto).
  const fullDates = safeData.map((_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (safeData.length - 1 - i));
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  });

  // Hit-area: largura = dx, mas no mínimo 4px pra séries longas; rect
  // estende verticalmente em todo o INNER_H pra captar mouse a qualquer altura.
  const hitW = Math.max(dx, 4);

  // Tooltip layout — calculado em SVG units (mesmo viewBox).
  // Anchora à direita do ponto por default; se ficar overflowing à direita,
  // espelha pra esquerda. Largura/altura calculadas com base no texto.
  const hoverPoint = hoverIdx !== null ? points[hoverIdx]! : null;
  const hoverValue = hoverIdx !== null ? safeData[hoverIdx]! : 0;
  const hoverDate = hoverIdx !== null ? fullDates[hoverIdx]! : "";
  const valueText = hoverIdx !== null ? formatBRLFull(hoverValue) : "";

  const TT_W = 132;
  const TT_H = 44;
  const TT_GAP = 10;
  const tooltipPos =
    hoverPoint === null
      ? null
      : (() => {
          let tx = hoverPoint.x + TT_GAP;
          const ty = Math.max(
            PAD.top,
            Math.min(hoverPoint.y - TT_H / 2, PAD.top + INNER_H - TT_H),
          );
          if (tx + TT_W > VIEW_W - PAD.right) {
            tx = hoverPoint.x - TT_GAP - TT_W;
          }
          return { x: tx, y: ty };
        })();

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      width="100%"
      role="img"
      aria-label="Tendência de receita no período"
      className={className}
      style={{ display: "block", maxWidth: "100%" }}
      onMouseLeave={() => setHoverIdx(null)}
    >
      {/* y gridlines tracejadas + label de valor à esquerda */}
      {yTicks.map((t, i) => (
        <g key={i}>
          <line
            x1={PAD.left}
            x2={VIEW_W - PAD.right}
            y1={t.y}
            y2={t.y}
            stroke="var(--line)"
            strokeDasharray="3 3"
            strokeWidth={1}
          />
          <text
            x={PAD.left - 6}
            y={t.y + 3}
            textAnchor="end"
            fontSize={10}
            fontFamily="var(--font-mono, 'Geist Mono', ui-monospace, monospace)"
            fill="var(--ink-4)"
          >
            {t.label}
          </text>
        </g>
      ))}

      {/* Area-fill (brand verde 8% opacity) */}
      <path
        d={areaPath}
        fill="var(--brand)"
        fillOpacity={0.08}
      />

      {/* Linha principal (brand verde, 2.5px round) */}
      <path
        d={linePath}
        stroke="var(--brand)"
        strokeWidth={2.5}
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Endpoint dot — último valor da série (escondido enquanto hover está
          ativo pra não competir com o dot do hover). */}
      {hoverIdx === null ? (
        <circle
          cx={lastPoint.x}
          cy={lastPoint.y}
          r={4}
          fill="var(--brand)"
          stroke="var(--surface)"
          strokeWidth={2}
        />
      ) : null}

      {/* x-axis date labels */}
      {xLabels.map((l, i) => (
        <text
          key={i}
          x={PAD.left + l.i * dx}
          y={VIEW_H - 8}
          textAnchor={l.align}
          fontSize={10.5}
          fontFamily="var(--font-mono, 'Geist Mono', ui-monospace, monospace)"
          fill="var(--ink-4)"
        >
          {l.label}
        </text>
      ))}

      {/* ---- HOVER OVERLAY ----
          Guideline vertical + dot ampliado + tooltip. Renderizado APÓS o
          gráfico pra ficar visualmente por cima. */}
      {hoverPoint !== null && tooltipPos !== null ? (
        <g pointerEvents="none">
          <line
            x1={hoverPoint.x}
            x2={hoverPoint.x}
            y1={PAD.top}
            y2={PAD.top + INNER_H}
            stroke="var(--brand)"
            strokeOpacity={0.35}
            strokeWidth={1}
            strokeDasharray="2 3"
          />
          <circle
            cx={hoverPoint.x}
            cy={hoverPoint.y}
            r={5.5}
            fill="var(--brand)"
            stroke="var(--surface)"
            strokeWidth={2.5}
          />
          {/* Tooltip pill: rect com sombra discreta + 2 linhas (data + valor) */}
          <rect
            x={tooltipPos.x}
            y={tooltipPos.y}
            width={TT_W}
            height={TT_H}
            rx={8}
            ry={8}
            fill="var(--surface)"
            stroke="var(--line)"
            strokeWidth={1}
            style={{
              filter:
                "drop-shadow(0 4px 12px color-mix(in oklab, var(--ink-1) 12%, transparent))",
            }}
          />
          <text
            x={tooltipPos.x + 10}
            y={tooltipPos.y + 17}
            fontSize={10.5}
            fontFamily="var(--font-mono, 'Geist Mono', ui-monospace, monospace)"
            fill="var(--ink-4)"
          >
            {hoverDate}
          </text>
          <text
            x={tooltipPos.x + 10}
            y={tooltipPos.y + 33}
            fontSize={12.5}
            fontWeight={700}
            fill="var(--ink-1)"
          >
            {valueText}
          </text>
        </g>
      ) : null}

      {/* Hit-areas: 1 rect transparente por ponto, captura mousemove.
          Ficam por ÚLTIMO no DOM pra ficarem em cima de tudo e capturarem
          o mouse. `pointer-events: all` é default em SVG <rect>. */}
      {points.map((p, i) => (
        <rect
          key={i}
          x={p.x - hitW / 2}
          y={PAD.top}
          width={hitW}
          height={INNER_H}
          fill="transparent"
          onMouseEnter={() => setHoverIdx(i)}
          onMouseMove={() => setHoverIdx(i)}
        />
      ))}
    </svg>
  );
}
