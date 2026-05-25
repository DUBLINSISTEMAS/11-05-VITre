// Sparkline SVG inline — handoff design 2026-05-25 (Passo 3 redesign dashboard).
//
// Replica `design_handoff_mangos_pay/app-oficial/dashboard.jsx` linhas 54-102:
// - viewBox 720x180 com padding pra y-axis labels (esquerda) + x-axis labels
//   (inferior)
// - 5 gridlines tracejadas horizontais com label R$ em escala (kk/MM)
// - 3 x-axis date labels (start, meio, hoje) em Geist Mono
// - Path stroke + area fill em brand verde Mangos (var(--brand))
// - Endpoint dot no último ponto, cor brand
//
// Cores: verde brand Mangos (var(--brand) = #174D44). O codebase tinha
// `#1A3A8F` (navy antigo Vitrê) — bug residual do rebrand 2026-05-21,
// corrigido aqui.
//
// SVG puro, zero deps (~80kB economizados vs Recharts).

const VIEW_W = 720;
const VIEW_H = 180;
const PAD = { top: 12, right: 12, bottom: 28, left: 36 };
const INNER_W = VIEW_W - PAD.left - PAD.right;
const INNER_H = VIEW_H - PAD.top - PAD.bottom;
const TICKS = 4;

function formatBRLShort(cents: number): string {
  if (cents >= 100_000_00) {
    return "R$ " + (cents / 100_000_00).toFixed(1).replace(".", ",") + "M";
  }
  if (cents >= 1000_00) {
    return "R$ " + (cents / 1000_00).toFixed(1).replace(".", ",") + "k";
  }
  return (
    "R$ " +
    (cents / 100).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".")
  );
}

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

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      width="100%"
      role="img"
      aria-label="Tendência de receita no período"
      className={className}
      style={{ display: "block", maxWidth: "100%" }}
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

      {/* Endpoint dot — último valor da série */}
      <circle
        cx={lastPoint.x}
        cy={lastPoint.y}
        r={4}
        fill="var(--brand)"
        stroke="var(--surface)"
        strokeWidth={2}
      />

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
    </svg>
  );
}
