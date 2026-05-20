// Card de operação do dia — dashboard /admin (Sprint 0, Prompt 5).
// Pattern: label eyebrow (uppercase pequeno) + valor grande tabular-nums +
// sub-info opcional + CTA opcional. Tons semânticos: ok (verde), warn
// (laranja), danger (vermelho), neutral (default).
import Link from "next/link";

import { cn } from "@/lib/utils";

export type OpCardTone = "neutral" | "ok" | "warn" | "danger";

export interface OpCardProps {
  label: string;
  /** Valor principal (string formatada — R$, count, etc). */
  value: string;
  /** Linha secundária opcional. */
  subInfo?: string;
  /** Linha secundária em tom destacado (ex: vencidos em vermelho). */
  subInfoEmphasis?: { text: string; tone: OpCardTone };
  /** CTA opcional no rodapé. */
  cta?: { label: string; href: string } | { label: string; disabled: true; tooltip?: string };
}

const TONE_TEXT_CLASS: Record<OpCardTone, string> = {
  neutral: "text-ink-1",
  ok: "text-ok",
  warn: "text-warn",
  danger: "text-danger",
};

export function OpCard({ label, value, subInfo, subInfoEmphasis, cta }: OpCardProps) {
  return (
    <div className="b3-card b3-card-pad flex flex-col gap-2">
      <span className="text-ink-4 text-[11px] font-semibold uppercase tracking-[0.06em]">
        {label}
      </span>
      <span className="mono text-ink-1 text-[22px] font-bold leading-tight tabular-nums">
        {value}
      </span>
      {(subInfo || subInfoEmphasis) && (
        <div className="text-ink-4 flex flex-col gap-0.5 text-[12px]">
          {subInfo ? <span>{subInfo}</span> : null}
          {subInfoEmphasis ? (
            <span
              className={cn(
                "font-medium",
                TONE_TEXT_CLASS[subInfoEmphasis.tone],
              )}
            >
              {subInfoEmphasis.text}
            </span>
          ) : null}
        </div>
      )}
      {cta ? (
        <div className="mt-1">
          {"disabled" in cta ? (
            <button
              type="button"
              disabled
              title={cta.tooltip}
              className="b3-btn b3-btn--sm cursor-not-allowed opacity-50"
            >
              {cta.label}
            </button>
          ) : (
            <Link
              href={cta.href}
              prefetch
              className="b3-btn b3-btn--sm"
            >
              {cta.label}
            </Link>
          )}
        </div>
      ) : null}
    </div>
  );
}
