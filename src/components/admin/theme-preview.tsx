/**
 * Mini-mockup visual de um preset de tema.
 *
 * Renderiza um SVG ~160x100px mostrando os 3 eixos principais do preset:
 *   - Hero (barra do topo) com indicação do layout (cover/split/minimal)
 *   - Faixa de 3 tiles de categoria com o shape correto
 *   - 2 cards de produto com o variant correto
 *   - Indicação textual sutil do bottom-nav style (footer)
 *
 * Não é pixel-perfect — é um "diagrama" pra dar sensação de cada preset
 * em ~100ms de leitura. Usuário valida no storefront real depois.
 *
 * Server-component-friendly.
 */
import type { ThemePreset } from "@/lib/storefront/themes";

interface ThemePreviewProps {
  preset: ThemePreset;
}

export function ThemePreview({ preset }: ThemePreviewProps) {
  return (
    <svg
      viewBox="0 0 160 100"
      xmlns="http://www.w3.org/2000/svg"
      className="block w-full"
      aria-hidden="true"
    >
      {/* Fundo do mockup */}
      <rect x="0" y="0" width="160" height="100" rx="6" fill="#F3F4F6" />

      {/* Hero */}
      <HeroMock variant={preset.heroStyle} />

      {/* Faixa de categorias */}
      <g transform="translate(8, 42)">
        <CategoryTileMock shape={preset.categoryShape} x={0} />
        <CategoryTileMock shape={preset.categoryShape} x={16} />
        <CategoryTileMock shape={preset.categoryShape} x={32} />
        <CategoryTileMock shape={preset.categoryShape} x={48} />
        <CategoryTileMock shape={preset.categoryShape} x={64} />
      </g>

      {/* Cards de produto */}
      <g transform="translate(8, 60)">
        <ProductCardMock variant={preset.productCardStyle} x={0} />
        <ProductCardMock variant={preset.productCardStyle} x={50} />
        <ProductCardMock variant={preset.productCardStyle} x={100} />
      </g>

      {/* Bottom-nav (linha + 4 dots) */}
      <BottomNavMock variant={preset.bottomNavStyle} />
    </svg>
  );
}

function HeroMock({ variant }: { variant: ThemePreset["heroStyle"] }) {
  if (variant === "split") {
    return (
      <g>
        <rect x="8" y="6" width="72" height="32" rx="4" fill="#1E3FE6" opacity="0.85" />
        <rect x="80" y="6" width="72" height="32" rx="4" fill="#FFFFFF" />
        <rect x="86" y="14" width="40" height="3" rx="1.5" fill="#1E3FE6" />
        <rect x="86" y="20" width="56" height="2" rx="1" fill="#9CA3AF" />
        <rect x="86" y="25" width="48" height="2" rx="1" fill="#9CA3AF" />
        <rect x="86" y="31" width="20" height="3" rx="1.5" fill="#1E3FE6" />
      </g>
    );
  }
  if (variant === "minimal") {
    return (
      <g>
        <rect x="8" y="6" width="144" height="32" rx="4" fill="#DBE3FF" />
        <rect x="56" y="14" width="48" height="3" rx="1.5" fill="#1E3FE6" />
        <rect x="40" y="20" width="80" height="3" rx="1.5" fill="#111827" />
        <rect x="64" y="28" width="32" height="5" rx="2.5" fill="#111827" />
      </g>
    );
  }
  // cover (default)
  return (
    <g>
      <rect x="8" y="6" width="144" height="32" rx="4" fill="#1E3FE6" />
      <rect x="8" y="22" width="144" height="16" rx="0" fill="#000000" opacity="0.25" />
      <rect x="14" y="26" width="48" height="3" rx="1.5" fill="#FFFFFF" />
      <rect x="14" y="32" width="32" height="3" rx="1.5" fill="#FFFFFF" opacity="0.85" />
    </g>
  );
}

function CategoryTileMock({
  shape,
  x,
}: {
  shape: ThemePreset["categoryShape"];
  x: number;
}) {
  const radius = shape === "circle" ? 6 : shape === "square" ? 1 : 2.5;
  return (
    <rect
      x={x}
      y="0"
      width="12"
      height="12"
      rx={radius}
      ry={radius}
      fill="#FFFFFF"
      stroke="#D1D5DB"
      strokeWidth="0.5"
    />
  );
}

function ProductCardMock({
  variant,
  x,
}: {
  variant: ThemePreset["productCardStyle"];
  x: number;
}) {
  // Variant tokens (mapeamento simplificado pro mockup):
  // - minimal: sem stroke, texto curto
  // - bold: stroke mais grosso, "tag" e título mais alto
  // - standard: stroke fino normal
  const strokeWidth = variant === "bold" ? 1 : variant === "minimal" ? 0 : 0.5;
  const showTag = variant !== "minimal";
  const tagFill = variant === "bold" ? "#111827" : "#FFFFFF";
  const tagStroke = variant === "bold" ? "none" : "#D1D5DB";
  const titleHeight = variant === "bold" ? 2.5 : 2;
  return (
    <g transform={`translate(${x}, 0)`}>
      <rect
        x="0"
        y="0"
        width="40"
        height="22"
        rx="2"
        fill="#FFFFFF"
        stroke={strokeWidth > 0 ? "#D1D5DB" : "none"}
        strokeWidth={strokeWidth}
      />
      <rect x="3" y="3" width="34" height="11" rx="1.5" fill="#E5E7EB" />
      {showTag && (
        <rect
          x="5"
          y="5"
          width="9"
          height="3"
          rx="0.5"
          fill={tagFill}
          stroke={tagStroke}
          strokeWidth="0.3"
        />
      )}
      <rect x="3" y="16" width="22" height={titleHeight} rx="0.5" fill="#111827" />
      <rect x="3" y="19.5" width="14" height="1.5" rx="0.5" fill="#1E3FE6" />
    </g>
  );
}

function BottomNavMock({
  variant,
}: {
  variant: ThemePreset["bottomNavStyle"];
}) {
  // Linha de separação muda conforme o estilo do bottom-nav:
  //   pill  = sem linha, com pill em volta do ativo
  //   rule  = linha fina superior
  //   glass = linha translucida + blur (representado por opacidade)
  if (variant === "pill") {
    return (
      <g transform="translate(8, 90)">
        <rect x="0" y="-2" width="144" height="9" rx="4.5" fill="#FFFFFF" stroke="#D1D5DB" strokeWidth="0.3" />
        <rect x="3" y="0" width="14" height="5" rx="2.5" fill="#111827" />
        <circle cx="40" cy="2.5" r="1.2" fill="#9CA3AF" />
        <circle cx="60" cy="2.5" r="1.2" fill="#9CA3AF" />
        <circle cx="80" cy="2.5" r="1.2" fill="#9CA3AF" />
        <circle cx="100" cy="2.5" r="1.2" fill="#9CA3AF" />
      </g>
    );
  }
  if (variant === "rule") {
    return (
      <g transform="translate(8, 90)">
        <line x1="0" y1="-3" x2="144" y2="-3" stroke="#111827" strokeWidth="0.4" />
        <circle cx="20" cy="2.5" r="1.5" fill="#111827" />
        <circle cx="50" cy="2.5" r="1.2" fill="#9CA3AF" />
        <circle cx="80" cy="2.5" r="1.2" fill="#9CA3AF" />
        <circle cx="110" cy="2.5" r="1.2" fill="#9CA3AF" />
      </g>
    );
  }
  // glass
  return (
    <g transform="translate(8, 90)">
      <rect x="0" y="-3" width="144" height="9" rx="2" fill="#FFFFFF" opacity="0.7" stroke="#9CA3AF" strokeWidth="0.2" />
      <circle cx="20" cy="1.5" r="1.4" fill="#111827" />
      <circle cx="50" cy="1.5" r="1.2" fill="#9CA3AF" />
      <circle cx="80" cy="1.5" r="1.2" fill="#9CA3AF" />
      <circle cx="110" cy="1.5" r="1.2" fill="#9CA3AF" />
    </g>
  );
}
