"use client";

// Simulador rápido de markup/margem — handoff Passo 10.
//
// Botões pré-definidos (Markup 10/20/30/50% / Margem 40/50/60%) que
// calculam o preço de venda a partir do custo atual e atualizam o campo
// basePriceInCents do form.
//
// - Markup X% → preço = custo × (1 + X/100)
// - Margem X% → preço = custo ÷ (1 − X/100)
//
// Disabled quando custo === 0/null (nada pra simular). Aria-disabled e
// title explicam.

import type { UseFormSetValue } from "react-hook-form";

import type { ProductFormValues } from "@/actions/product/schema";

interface MarginQuickSimulatorProps {
  costPriceInCents: number | null | undefined;
  setValue: UseFormSetValue<ProductFormValues>;
}

const MARKUP_PRESETS = [10, 20, 30, 50] as const;
const MARGIN_PRESETS = [40, 50, 60] as const;

export function MarginQuickSimulator({
  costPriceInCents,
  setValue,
}: MarginQuickSimulatorProps) {
  const cost =
    typeof costPriceInCents === "number" && costPriceInCents > 0
      ? costPriceInCents
      : null;
  const disabled = cost === null;

  const applyMarkup = (pct: number) => {
    if (cost === null) return;
    const next = Math.round(cost * (1 + pct / 100));
    setValue("basePriceInCents", next, { shouldDirty: true, shouldValidate: true });
  };
  const applyMargin = (pct: number) => {
    if (cost === null) return;
    // Inversa: preço = custo / (1 − margem). Margem 100% inviável (divisão por 0).
    if (pct >= 100) return;
    const next = Math.round(cost / (1 - pct / 100));
    setValue("basePriceInCents", next, { shouldDirty: true, shouldValidate: true });
  };

  return (
    <div className="space-y-2">
      <p className="text-ink-3 text-[12px]">
        Calcula o preço de venda a partir do custo. Clique pra aplicar.
      </p>
      <div className="flex flex-wrap gap-2">
        {MARKUP_PRESETS.map((pct) => (
          <button
            key={`markup-${pct}`}
            type="button"
            onClick={() => applyMarkup(pct)}
            disabled={disabled}
            className="b3-btn b3-btn--sm"
            title={
              disabled
                ? "Preencha o custo pra simular preço"
                : `Define preço de venda = custo × ${1 + pct / 100}`
            }
            aria-label={`Aplicar markup de ${pct}%`}
          >
            Markup {pct}%
          </button>
        ))}
        <span className="border-line mx-1 self-stretch border-l" aria-hidden />
        {MARGIN_PRESETS.map((pct) => (
          <button
            key={`margin-${pct}`}
            type="button"
            onClick={() => applyMargin(pct)}
            disabled={disabled}
            className="b3-btn b3-btn--sm"
            title={
              disabled
                ? "Preencha o custo pra simular preço"
                : `Define preço de venda pra ter ${pct}% de margem bruta`
            }
            aria-label={`Aplicar margem de ${pct}%`}
          >
            Margem {pct}%
          </button>
        ))}
      </div>
    </div>
  );
}
