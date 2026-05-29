/**
 * <Money> — display monetário canônico do sistema.
 *
 * Onda R3 (2026-05-29) — primeira peça da lapidação. Base pra TUDO que
 * mostra R$ no admin: KPI, table cell, drawer field, print A4. Sem este
 * componente, mudar "estilo monetario" vira caça de classes Tailwind em
 * 30+ arquivos.
 *
 * Hierarquia visual (sistema-minimalista tipo Linear/Stripe):
 *   kpi   24px / 700 / tabular-nums      — KPI principal de tela
 *   lg    18px / 700 / tabular-nums      — total destacado em row/drawer
 *   md    14px / 600 / tabular-nums      — valor de tabela / inline
 *   sm    12px / 500 / tabular-nums      — meta, sub-total
 *
 * Tom semantico (cor):
 *   positive   — lucro confortavel (margem >= 10%)
 *   warning    — lucro apertado (margem < 10%)
 *   negative   — prejuizo (lucro < 0)
 *   muted      — valor sem ponderacao (preco, custo cru)
 *   neutral    — corpo escuro (ink-1)
 *
 * Modo compacto (mobile <640px ou container apertado):
 *   "R$ 1,2k" / "R$ 1,2M" — preserva legibilidade em 320px.
 *
 * Sem prefixo de sinal por padrao (+/-). Show via prop `showSign`.
 */
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/pricing";

export type MoneySize = "kpi" | "lg" | "md" | "sm";
export type MoneyTone = "positive" | "warning" | "negative" | "muted" | "neutral";

interface MoneyProps {
  /** Valor em centavos. NULL renderiza placeholder (—). */
  valueInCents: number | null | undefined;
  size?: MoneySize;
  tone?: MoneyTone;
  /** Prefixo +/− visivel. Util pra delta (despesa subtrai). */
  showSign?: boolean;
  /** Abrevia em mobile (R$ 1,2k). Default detecta via Tailwind sm:hidden. */
  compact?: boolean;
  /** Quando valor e null, texto custom no lugar de "—". */
  fallback?: string;
  /** Classes extras (cuidado: pode quebrar hierarquia se sobrescrever). */
  className?: string;
  /** Title HTML (tooltip nativo). */
  title?: string;
  /** ARIA label customizado pro screen reader. */
  "aria-label"?: string;
}

const SIZE_CLASS: Record<MoneySize, string> = {
  kpi: "text-[24px] font-bold leading-none",
  lg: "text-[18px] font-bold leading-tight",
  md: "text-[14px] font-semibold leading-tight",
  sm: "text-[12px] font-medium leading-tight",
};

const TONE_CLASS: Record<MoneyTone, string> = {
  positive: "text-emerald-700 dark:text-emerald-400",
  warning: "text-amber-700 dark:text-amber-400",
  negative: "text-rose-700 dark:text-rose-400",
  muted: "text-ink-4",
  neutral: "text-ink-1",
};

/** Formata em "R$ 1,2k" pra mobile. Preserva precisao pra valores <1000. */
function formatCompact(cents: number): string {
  const reais = cents / 100;
  const abs = Math.abs(reais);
  const sign = reais < 0 ? "−" : "";
  if (abs >= 1_000_000) {
    return `${sign}R$ ${(abs / 1_000_000).toFixed(1).replace(".", ",")}M`;
  }
  if (abs >= 1_000) {
    return `${sign}R$ ${(abs / 1_000).toFixed(1).replace(".", ",")}k`;
  }
  return formatBRL(cents);
}

export function Money({
  valueInCents,
  size = "md",
  tone = "neutral",
  showSign = false,
  compact = false,
  fallback = "—",
  className,
  title,
  "aria-label": ariaLabel,
}: MoneyProps) {
  if (valueInCents === null || valueInCents === undefined) {
    return (
      <span
        className={cn(
          "tabular-nums",
          SIZE_CLASS[size],
          "text-ink-4",
          className,
        )}
        title={title}
        aria-label={ariaLabel ?? fallback}
      >
        {fallback}
      </span>
    );
  }

  const formatted = compact
    ? formatCompact(valueInCents)
    : formatBRL(valueInCents);

  // showSign: prefixa "+" se positivo (não-zero), "−" ja vem do format quando
  // negativo. Zero permanece "R$ 0,00" sem sinal.
  let text = formatted;
  if (showSign && valueInCents > 0) {
    text = `+${formatted}`;
  }

  return (
    <span
      className={cn(
        "tabular-nums whitespace-nowrap",
        SIZE_CLASS[size],
        TONE_CLASS[tone],
        className,
      )}
      title={title}
      aria-label={ariaLabel}
    >
      {text}
    </span>
  );
}

/**
 * Deriva tom a partir de lucro e margem%. Fonte unica de verdade pra cor
 * de lucro/sobra em todo o sistema.
 *
 *   prejuizo (lucro < 0)         -> negative
 *   apertado (margem < 10)       -> warning
 *   confortavel (margem >= 10)   -> positive
 *   null (sem dado)              -> muted
 */
export function profitTone(
  netProfitInCents: number | null,
  netMarginPct: number | null,
): MoneyTone {
  if (netProfitInCents === null || netMarginPct === null) return "muted";
  if (netProfitInCents < 0) return "negative";
  if (netMarginPct < 10) return "warning";
  return "positive";
}
