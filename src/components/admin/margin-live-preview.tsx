"use client";

/**
 * ADR-0034 Camada 2 — preview de margem em tempo real.
 *
 * Recebe custo e preço de venda (em centavos), exibe Lucro/un, Margem
 * bruta %, Markup % e Ponto de equilíbrio. Atualiza enquanto lojista
 * digita. Quando custo está NULL, mostra aviso "margem desconhecida —
 * preencha o custo".
 *
 * Convenções varejo BR:
 *   - Markup           = (venda - custo) / custo        (markup 200% = comprou 10 vende 30)
 *   - Margem bruta     = (venda - custo) / venda        (margem 66.67% mesmo exemplo)
 *   - Lucro/un         = venda - custo
 *   - Ponto equilíbrio = unidades/mês pra cobrir R$1k de custo fixo
 *
 * Lojista usa markup pra precificar e margem bruta pra avaliar. Ponto
 * de equilíbrio responde a "quantas peças preciso vender pra esse
 * produto pagar minha conta de luz?".
 *
 * Handoff Passo 10 (2026-05-25): visual de 4 cards em cream-soft +
 * brand-line bordering, bate o protótipo do ProductFormDrawer pixel-pixel.
 */

import { AlertCircleIcon } from "lucide-react";

import { formatBRL } from "@/lib/pricing";

interface MarginLivePreviewProps {
  costPriceInCents: number | null | undefined;
  basePriceInCents: number | null | undefined;
  /**
   * Quando false, esconde o componente. Conveniente quando lojista ainda
   * não preencheu nem custo nem venda — não polui visual com placeholder.
   */
  showWhenEmpty?: boolean;
}

function formatPercent(value: number, digits = 1): string {
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`;
}

export function MarginLivePreview({
  costPriceInCents,
  basePriceInCents,
  showWhenEmpty = false,
}: MarginLivePreviewProps) {
  const cost =
    typeof costPriceInCents === "number" && costPriceInCents >= 0
      ? costPriceInCents
      : null;
  const price =
    typeof basePriceInCents === "number" && basePriceInCents > 0
      ? basePriceInCents
      : null;

  // Estado 1: nenhum dado ainda — opcional esconder.
  if (cost === null && price === null) {
    if (!showWhenEmpty) return null;
    return (
      <div className="rounded-lg border border-dashed border-ink-5 bg-bg-app px-3 py-2.5 text-[12.5px] text-ink-4">
        Preencha custo e preço de venda pra ver a margem aqui.
      </div>
    );
  }

  // Estado 2: tem preço mas não tem custo — aviso.
  if (cost === null) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-[12.5px] text-amber-900">
        <AlertCircleIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div>
          <p className="font-medium">Margem desconhecida.</p>
          <p className="text-amber-800">
            Preencha o <strong>preço de custo</strong> pra calcular margem e
            lucro automaticamente em todos os relatórios.
          </p>
        </div>
      </div>
    );
  }

  // Estado 3: tem custo mas não tem preço de venda — aviso simétrico.
  if (price === null) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-[12.5px] text-amber-900">
        <AlertCircleIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div>
          <p className="font-medium">Defina o preço de venda.</p>
          <p className="text-amber-800">
            Sem preço de venda, não dá pra calcular margem. Sugestão de
            markup 100%: {formatBRL(cost * 2)}.
          </p>
        </div>
      </div>
    );
  }

  // Estado 4: ambos preenchidos — cálculo principal (4 KPIs).
  const profitInCents = price - cost;
  const isLoss = profitInCents < 0;
  // Markup: divisão por custo. Cost = 0 caso especial (brinde) → mostra "—".
  const markupPct = cost > 0 ? (profitInCents / cost) * 100 : null;
  // Margem bruta: divisão por venda.
  const marginPct = (profitInCents / price) * 100;
  // Ponto de equilíbrio: unidades/mês pra cobrir R$1k fixo (referência
  // didática). Quando profit ≤ 0, não faz sentido.
  const breakEvenUnits =
    profitInCents > 0 ? Math.ceil(100000 / profitInCents) : null;

  const profitColor = isLoss
    ? "var(--danger)"
    : "var(--mangos-green-800)";
  const marginColor =
    marginPct > 40
      ? "var(--ok)"
      : marginPct > 20
        ? "var(--warn)"
        : "var(--danger)";

  return (
    <div
      className="rounded-[12px] p-4"
      style={{
        background: "var(--mangos-cream-soft)",
        border: "1px solid var(--brand-line)",
      }}
      aria-live="polite"
    >
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Kpi label="Lucro/un" value={formatBRL(profitInCents)} color={profitColor} />
        <Kpi label="Margem" value={formatPercent(marginPct)} color={marginColor} />
        <Kpi
          label="Markup"
          value={markupPct === null ? "—" : formatPercent(markupPct, 0)}
        />
        <Kpi
          label="Equilíbrio"
          value={breakEvenUnits !== null ? `${breakEvenUnits}` : "—"}
          hint="un/mês p/ R$1k"
        />
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  color,
  hint,
}: {
  label: string;
  value: string;
  color?: string;
  hint?: string;
}) {
  return (
    <div>
      <p className="text-ink-4 text-[10.5px] font-bold uppercase tracking-[0.06em]">
        {label}
      </p>
      <p
        className="font-mono text-[19px] font-bold tabular-nums leading-tight"
        style={color ? { color } : { color: "var(--mangos-green-900)" }}
      >
        {value}
      </p>
      {hint ? (
        <p className="text-ink-4 mt-0.5 text-[10px]">{hint}</p>
      ) : null}
    </div>
  );
}
