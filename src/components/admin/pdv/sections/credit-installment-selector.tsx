/**
 * CreditInstallmentSelector — selector de parcelas do cartão com Sistema PRICE.
 * Extraído de pdv-shell.tsx em S4.1.
 *
 * Sprint 3 (audit 2026-05-26). `amt` é o valor da LINHA de pagamento
 * (não do total da venda). Em pagamento único bate com o total; em mistos
 * é só a fatia do crédito.
 */
import {
  calculateInstallments,
  type InstallmentBreakdown,
} from "@/lib/installments";
import { formatBRL } from "@/lib/pricing";

import { MAX_PDV_INSTALLMENTS } from "../constants";
import type { PaymentLineState } from "../types";

interface CreditInstallmentSelectorProps {
  line: PaymentLineState;
  amt: number;
  cardInterestRateBps: number;
  cardInterestFreeUpTo: number;
  onChangeInstallments: (n: number) => void;
  /**
   * Callback acionado pelo botão "Aplicar à venda". Recebe valor dos juros
   * em centavos; PaymentSection bumpa amountInput + acrescimo da venda.
   */
  onApplyInterest?: (interestInCents: number) => void;
}

export function CreditInstallmentSelector({
  line,
  amt,
  cardInterestRateBps,
  cardInterestFreeUpTo,
  onChangeInstallments,
  onApplyInterest,
}: CreditInstallmentSelectorProps) {
  const breakdowns: InstallmentBreakdown[] = Array.from(
    { length: MAX_PDV_INSTALLMENTS },
    (_, i) =>
      calculateInstallments({
        totalInCents: amt,
        installments: i + 1,
        bpsPerMonth: cardInterestRateBps,
        freeUpTo: cardInterestFreeUpTo,
      }),
  );
  const current = breakdowns[line.installments - 1];

  return (
    <div className="mt-1.5 grid grid-cols-[120px_1fr_auto] items-center gap-1.5">
      <label
        htmlFor={`installments-${line.id}`}
        className="text-ink-4 text-[10.5px]"
      >
        Parcelas
      </label>
      <select
        id={`installments-${line.id}`}
        aria-label="Número de parcelas no cartão"
        className="b3-select h-8 text-[12px]"
        value={line.installments}
        onChange={(e) => onChangeInstallments(Number(e.target.value))}
      >
        {breakdowns.map((b, idx) => {
          const n = idx + 1;
          if (n === 1) {
            return (
              <option key={n} value={n}>
                {n}x (à vista)
              </option>
            );
          }
          if (amt <= 0) {
            return (
              <option key={n} value={n}>
                {n}x
              </option>
            );
          }
          return (
            <option key={n} value={n}>
              {n}x de {formatBRL(b.perInstallmentInCents)}
              {b.hasInterest ? " (com juros)" : ""}
            </option>
          );
        })}
      </select>
      {line.installments > 1 && current ? (
        <span className="text-ink-4 text-[10.5px] tabular-nums">
          {current.hasInterest ? "com juros" : "sem juros"}
        </span>
      ) : (
        <span />
      )}

      {current && current.hasInterest && line.installments > 1 ? (
        <div className="col-span-3 mt-1 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10.5px] text-ink-4">
            Total c/ juros:{" "}
            <span className="text-ink-1 font-semibold tabular-nums">
              {formatBRL(current.totalWithInterestInCents)}
            </span>
            <span className="ml-1 tabular-nums">
              (juros {formatBRL(current.interestInCents)})
            </span>
          </p>
          {onApplyInterest ? (
            <button
              type="button"
              onClick={() => onApplyInterest(current.interestInCents)}
              className="text-mangos-green-800 text-[10.5px] font-semibold underline hover:opacity-70"
              title="Adiciona o valor dos juros como acréscimo da venda e ajusta o valor da linha de cartão"
            >
              Aplicar à venda
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
