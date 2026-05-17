// Sparkline SVG inline — port Dublin v3 (ADR-0019, Onda A.5).
// Replica `bagy-extra.jsx` linhas 68-76: viewBox 600x240, 4 grid lines
// dashed (#E8EAEE), path stroke brand 2.5px, area-fill rgba(brand 0.08).
//
// SVG puro pra evitar bundle Recharts (~80kB). Auto-scale ao maior valor
// com fallback 1 (série toda zero → renderiza linha rasa no fundo).
//
// preserveAspectRatio=none deforma a curva pra preencher o container —
// é o comportamento do handoff e está OK porque a leitura é tendência,
// não valor exato.

export interface SparklineProps {
  /** Série numérica. Cada elemento = um ponto no eixo X. */
  data: number[];
  /** Altura visual aproximada (CSS height). Default 240. */
  height?: number;
  className?: string;
}

export function Sparkline({ data, height = 240, className }: SparklineProps) {
  const safeData = data.length > 0 ? data : [0, 0];
  const max = Math.max(...safeData, 1);
  const lastIdx = safeData.length - 1 || 1;

  // y = 240 - (v/max) * 200 - 20 → mantém 20px de padding top/bottom.
  // x = (i / (length-1)) * 600 → distribui linear no viewBox.
  const points = safeData.map((v, i) => {
    const x = (i / lastIdx) * 600;
    const y = 240 - (v / max) * 200 - 20;
    return { x, y };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");

  // Area-fill começa em (0, 220) → desce pra (600, 220) pra fechar polígono
  const areaPath = `M 0 220 ${points
    .map((p) => `L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ")} L 600 220 Z`;

  return (
    <svg
      viewBox="0 0 600 240"
      preserveAspectRatio="none"
      width="100%"
      height={height}
      role="img"
      aria-label="Tendência de receita no período"
      className={className}
    >
      {/* 4 grid lines tracejadas em 20/40/60/80% do height */}
      {[0.2, 0.4, 0.6, 0.8].map((y) => (
        <line
          key={y}
          x1="0"
          x2="600"
          y1={240 * y}
          y2={240 * y}
          stroke="#E8EAEE"
          strokeDasharray="2 2"
        />
      ))}

      {/* Area-fill sob a curva */}
      <path d={areaPath} fill="rgba(26,58,143,0.08)" />

      {/* Linha principal */}
      <path
        d={linePath}
        stroke="#1A3A8F"
        strokeWidth="2.5"
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
