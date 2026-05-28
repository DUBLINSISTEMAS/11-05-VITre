// KpisSecundarios — Bloco F.2.5 da ressignificação (2026-05-28).
//
// SUBSTITUI os 4 MetricCards genéricos por UMA LINHA TABULAR densa
// (estilo planilha-de-contador, princípio 3 do CLAUDE.md). Densificação
// por SUBTRAÇÃO — em vez de 4 cards de 220px largura cada com big
// number isolado, uma faixa de 4 colunas inline com label pequeno +
// valor médio + delta.
//
// Métricas (todas pra janela do ?periodo=N):
//   - Vendas (count)
//   - Clientes novos (count)
//   - Devoluções (count)
//   - Faturamento bruto (R$)
//
// NÃO é o "hero" — Hero é lucro líquido (F.2.1). Esses 4 são secundários,
// úteis pra audit/contexto mas não merecem cards individuais.

import type { DashboardKpis } from "@/actions/dashboard/load-kpis";
import { formatBRL } from "@/lib/pricing";

interface KpisSecundariosProps {
  kpis: DashboardKpis;
  periodoLabel: string;
}

function deltaPct(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function formatDelta(pct: number | null): {
  text: string;
  tone: "up" | "down" | "flat" | "none";
} {
  if (pct === null) return { text: "—", tone: "none" };
  const flat = Math.abs(pct) < 0.5;
  if (flat) return { text: "0%", tone: "flat" };
  const formatted = `${pct > 0 ? "+" : "−"}${Math.abs(pct).toFixed(0)}%`;
  return { text: formatted, tone: pct > 0 ? "up" : "down" };
}

export function KpisSecundarios({ kpis, periodoLabel }: KpisSecundariosProps) {
  const ven = formatDelta(deltaPct(kpis.vendas.current, kpis.vendas.previous));
  const fat = formatDelta(
    deltaPct(kpis.faturamento.current, kpis.faturamento.previous),
  );
  const cli = formatDelta(
    deltaPct(kpis.clientesNovos.current, kpis.clientesNovos.previous),
  );
  const dev = formatDelta(
    deltaPct(kpis.devolucoes.current, kpis.devolucoes.previous),
  );

  return (
    <section className="b3-kpis-row" aria-label={`Indicadores ${periodoLabel}`}>
      <Kpi
        label="Vendas"
        value={String(kpis.vendas.current)}
        delta={ven}
      />
      <Kpi
        label="Faturamento bruto"
        value={formatBRL(kpis.faturamento.current)}
        delta={fat}
      />
      <Kpi
        label="Clientes novos"
        value={String(kpis.clientesNovos.current)}
        delta={cli}
      />
      <Kpi
        label="Devoluções"
        value={String(kpis.devolucoes.current)}
        delta={dev}
        invertColors
      />
    </section>
  );
}

interface KpiProps {
  label: string;
  value: string;
  delta: { text: string; tone: "up" | "down" | "flat" | "none" };
  /**
   * Devolução é "ruim quando sobe". Inverte semântica: up=danger, down=ok.
   * Só usado pra `Devoluções` — outras métricas crescer é positivo.
   */
  invertColors?: boolean;
}

function Kpi({ label, value, delta, invertColors }: KpiProps) {
  let toneClass = "";
  if (delta.tone === "up") {
    toneClass = invertColors ? "b3-kpi-delta--bad" : "b3-kpi-delta--good";
  } else if (delta.tone === "down") {
    toneClass = invertColors ? "b3-kpi-delta--good" : "b3-kpi-delta--bad";
  } else if (delta.tone === "flat") {
    toneClass = "b3-kpi-delta--flat";
  } else {
    toneClass = "b3-kpi-delta--none";
  }

  return (
    <div className="b3-kpi">
      <span className="b3-kpi-label">{label}</span>
      <div className="b3-kpi-value-row">
        <strong className="b3-kpi-value">{value}</strong>
        <span className={`b3-kpi-delta ${toneClass}`}>{delta.text}</span>
      </div>
    </div>
  );
}
