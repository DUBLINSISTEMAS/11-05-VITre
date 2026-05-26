/**
 * Cálculo de multa + juros em fiado (S3.2 do Plano de Endurecimento).
 *
 * Convenções BR:
 *   - Multa: % cobrada UMA VEZ quando o pagamento atrasa (após due_date).
 *   - Juros: % por mês cobrados sobre o principal, proporcional à fração
 *     do mês de atraso.
 *
 * Bps em centavos: 100 bps = 1%. Defaults da loja: 200 bps multa (2%) +
 * 100 bps juros/mês (1%/mês).
 *
 * Pure function — sem side effects, sem DB. Caller passa dueDate +
 * principal + bps; recebe { feeInCents, interestInCents, totalInCents }.
 */

export interface FeesInput {
  /** Valor original do fiado em centavos (não desconta pagamentos parciais). */
  principalInCents: number;
  /** Data de vencimento. Se null ou futuro, retorna zero fees. */
  dueDate: Date | string | null;
  /** Multa em bps (200 = 2%). */
  lateFeeBps: number;
  /** Juros por mês em bps (100 = 1%/mês). */
  interestPerMonthBps: number;
  /** Quando calcular ("agora"). Default new Date(). Testável. */
  now?: Date;
}

export interface FeesResult {
  /** Dias completos de atraso (0 se não está vencido). */
  daysLate: number;
  /** Meses fracionários de atraso (0 se não vencido). */
  monthsLate: number;
  /** Multa aplicada (uma vez). 0 se não vencido. */
  feeInCents: number;
  /** Juros acumulado proporcional. 0 se não vencido. */
  interestInCents: number;
  /** principal + multa + juros. */
  totalInCents: number;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Calcula multa + juros em fiado em atraso.
 *
 * Regra: mês = 30 dias corridos (convenção comercial BR. Não usa calendário
 * civil pra não confundir lojista — "atrasou 30 dias = 1 mês de juros").
 */
export function calculateReceivableFees(input: FeesInput): FeesResult {
  const {
    principalInCents,
    dueDate,
    lateFeeBps,
    interestPerMonthBps,
    now = new Date(),
  } = input;

  if (dueDate === null) {
    return {
      daysLate: 0,
      monthsLate: 0,
      feeInCents: 0,
      interestInCents: 0,
      totalInCents: principalInCents,
    };
  }

  const due = dueDate instanceof Date ? dueDate : new Date(dueDate);
  const diffMs = now.getTime() - due.getTime();
  if (diffMs <= 0) {
    return {
      daysLate: 0,
      monthsLate: 0,
      feeInCents: 0,
      interestInCents: 0,
      totalInCents: principalInCents,
    };
  }

  const daysLate = Math.floor(diffMs / MS_PER_DAY);
  const monthsLate = diffMs / MS_PER_DAY / 30; // fracionário

  const feeInCents = Math.round((principalInCents * lateFeeBps) / 10000);
  const interestInCents = Math.round(
    (principalInCents * interestPerMonthBps * monthsLate) / 10000,
  );

  return {
    daysLate,
    monthsLate,
    feeInCents,
    interestInCents,
    totalInCents: principalInCents + feeInCents + interestInCents,
  };
}

/**
 * Aplica recebimento parcial seguindo regra BR: abate primeiro JUROS,
 * depois MULTA, depois PRINCIPAL. Retorna o que sobra de cada bucket.
 *
 * Caller usa pra atualizar `receivable_payment.amount_in_cents` e decidir
 * se o receivable virou pago integralmente.
 */
export function applyReceivablePayment(input: {
  paymentInCents: number;
  feeInCents: number;
  interestInCents: number;
  principalInCents: number;
}): {
  appliedToInterest: number;
  appliedToFee: number;
  appliedToPrincipal: number;
  remainingInterest: number;
  remainingFee: number;
  remainingPrincipal: number;
} {
  let remaining = input.paymentInCents;

  const appliedToInterest = Math.min(remaining, input.interestInCents);
  remaining -= appliedToInterest;

  const appliedToFee = Math.min(remaining, input.feeInCents);
  remaining -= appliedToFee;

  const appliedToPrincipal = Math.min(remaining, input.principalInCents);
  remaining -= appliedToPrincipal;

  return {
    appliedToInterest,
    appliedToFee,
    appliedToPrincipal,
    remainingInterest: input.interestInCents - appliedToInterest,
    remainingFee: input.feeInCents - appliedToFee,
    remainingPrincipal: input.principalInCents - appliedToPrincipal,
  };
}
