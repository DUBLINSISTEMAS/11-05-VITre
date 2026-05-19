"use client";

/**
 * ADR-0034 Camada 2 — preview de margem em tempo real.
 *
 * Recebe custo e preço de venda (em centavos), exibe Lucro/un, Margem
 * bruta % e Markup %. Atualiza enquanto lojista digita. Quando custo
 * está NULL, mostra aviso "margem desconhecida — preencha o custo".
 *
 * Convenções varejo BR:
 *   - Markup       = (venda - custo) / custo            (ex: comprou 10, vende 30 → markup 200%)
 *   - Margem bruta = (venda - custo) / venda            (ex: comprou 10, vende 30 → margem 66.67%)
 *   - Lucro/un     = venda - custo
 *
 * Lojista usa markup pra precificar e margem bruta pra avaliar — os 2
 * são complementares, mostrar ambos.
 */

import { AlertCircleIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react";

interface MarginLivePreviewProps {
  costPriceInCents: number | null | undefined;
  basePriceInCents: number | null | undefined;
  /**
   * Quando false, esconde o componente. Conveniente quando lojista ainda
   * não preencheu nem custo nem venda — não polui visual com placeholder.
   */
  showWhenEmpty?: boolean;
}

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatPercent(value: number): string {
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
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
      <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-[12.5px] text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
        <AlertCircleIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div>
          <p className="font-medium">Margem desconhecida.</p>
          <p className="text-amber-800 dark:text-amber-300">
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
      <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-[12.5px] text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
        <AlertCircleIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div>
          <p className="font-medium">Defina o preço de venda.</p>
          <p className="text-amber-800 dark:text-amber-300">
            Sem preço de venda, não dá pra calcular margem. Sugestão de
            markup 100%: {formatBRL(cost * 2)}.
          </p>
        </div>
      </div>
    );
  }

  // Estado 4: ambos preenchidos — cálculo principal.
  const profitInCents = price - cost;
  const isProfit = profitInCents > 0;
  const isLoss = profitInCents < 0;
  // Markup: divisão por custo. Cost > 0 garantido pelo branch acima.
  // (cost === 0 caso especial: produto brinde — markup infinito; mostramos texto.)
  const markupPct = cost > 0 ? (profitInCents / cost) * 100 : null;
  // Margem bruta: divisão por venda. Price > 0 garantido.
  const marginPct = (profitInCents / price) * 100;

  const tone = isLoss
    ? "border-destructive/40 bg-destructive/5 text-destructive"
    : isProfit
      ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200"
      : "border-ink-5 bg-bg-app text-ink-2";

  const Icon = isLoss
    ? TrendingDownIcon
    : isProfit
      ? TrendingUpIcon
      : AlertCircleIcon;

  return (
    <div
      className={`flex flex-col gap-2 rounded-lg border px-3 py-2.5 text-[12.5px] ${tone}`}
      aria-live="polite"
    >
      <div className="flex items-center gap-2 font-semibold">
        <Icon className="size-4 shrink-0" aria-hidden />
        <span>
          {isLoss
            ? "Prejuízo por unidade"
            : isProfit
              ? "Lucro por unidade"
              : "Sem lucro nem prejuízo"}
          : {formatBRL(profitInCents)}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 tabular-nums">
        <dt className="text-current/70">Margem bruta</dt>
        <dd className="text-right font-medium">{formatPercent(marginPct)}</dd>
        <dt className="text-current/70">Markup</dt>
        <dd className="text-right font-medium">
          {markupPct === null ? "—" : formatPercent(markupPct)}
        </dd>
      </dl>
    </div>
  );
}
