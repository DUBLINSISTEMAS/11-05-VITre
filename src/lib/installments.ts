/**
 * Cálculo de parcelas do cartão de crédito — Sprint 3 (audit 2026-05-26).
 *
 * Aplica Sistema PRICE (juros compostos, padrão BR de cartão) quando
 * `installments > freeUpTo`. Caso contrário, divisão linear sem juros.
 *
 * Fórmula PRICE:
 *   parcela = total × (i × (1+i)^n) / ((1+i)^n − 1)
 *   onde i = bpsPerMonth / 10000 (decimal mensal)
 *
 * Convenções:
 *   - Tudo em CENTAVOS (input e output) pra evitar drift de float.
 *   - Parcela arredondada pra cima no centavo (Math.ceil) e a ÚLTIMA
 *     parcela absorve a diferença pra somar exato ao total. Padrão BR.
 *   - bpsPerMonth = 0 OU installments <= freeUpTo → divisão linear simples.
 */

export interface InstallmentBreakdown {
  /** Quantidade de parcelas. */
  installments: number;
  /** Valor de CADA parcela em centavos (parcelas iguais — quando há
   *  resto de centavo, a última absorve via `lastInstallmentInCents`). */
  perInstallmentInCents: number;
  /** Valor da ÚLTIMA parcela em centavos (= per quando sem resto). */
  lastInstallmentInCents: number;
  /** Total que o cliente paga (subtotal + juros se aplicável). */
  totalWithInterestInCents: number;
  /** Juros total em centavos. 0 quando sem juros. */
  interestInCents: number;
  /** True quando installments > freeUpTo E bpsPerMonth > 0. */
  hasInterest: boolean;
}

export function calculateInstallments(args: {
  /** Total da venda em centavos (subtotal − desconto + acréscimo manual). */
  totalInCents: number;
  /** Número de parcelas (1..24). */
  installments: number;
  /** Juros em basis points por mês (0..9999; 299 = 2.99% a.m.). */
  bpsPerMonth: number;
  /** Parcelas SEM juros antes de aplicar a taxa (1..24). */
  freeUpTo: number;
}): InstallmentBreakdown {
  const { totalInCents, installments, bpsPerMonth, freeUpTo } = args;

  // Sanidade: parcelas >= 1.
  const n = Math.max(1, Math.floor(installments));

  // Caminho sem juros: 1x sempre é sem juros; n <= freeUpTo também.
  // bpsPerMonth = 0 nunca tem juros mesmo se n > freeUpTo.
  const hasInterest = n > 1 && n > freeUpTo && bpsPerMonth > 0;

  if (!hasInterest) {
    const per = Math.floor(totalInCents / n);
    const remainder = totalInCents - per * n;
    return {
      installments: n,
      perInstallmentInCents: per,
      lastInstallmentInCents: per + remainder,
      totalWithInterestInCents: totalInCents,
      interestInCents: 0,
      hasInterest: false,
    };
  }

  // Sistema PRICE em centavos.
  const i = bpsPerMonth / 10_000;
  const onePlusI = 1 + i;
  const onePlusIPowN = Math.pow(onePlusI, n);
  const factor = (i * onePlusIPowN) / (onePlusIPowN - 1);
  // Trabalha em reais (float) e converte pra cents arredondando no fim.
  const totalInReais = totalInCents / 100;
  const perInReais = totalInReais * factor;
  // Centavo arredondado pra cima (favor do lojista — operadora cobra mais).
  const perInCents = Math.ceil(perInReais * 100);
  const totalWithInterestInCents = perInCents * n;
  // Última parcela absorve o "resto" reverso — se total bate por excesso
  // em alguns centavos, a última paga A MENOS. Convenção BR.
  const overage = totalWithInterestInCents - Math.round(totalInReais * 100);
  // overage geralmente é pequeno (centavos do ceil). Se positivo, última
  // parcela reduz; se negativo (raro), aumenta.
  const lastInstallmentInCents = perInCents - overage;
  const actualTotalInCents = perInCents * (n - 1) + lastInstallmentInCents;
  const interestInCents = actualTotalInCents - totalInCents;

  return {
    installments: n,
    perInstallmentInCents: perInCents,
    lastInstallmentInCents,
    totalWithInterestInCents: actualTotalInCents,
    interestInCents,
    hasInterest: true,
  };
}
