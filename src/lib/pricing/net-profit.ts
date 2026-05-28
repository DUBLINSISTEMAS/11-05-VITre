/**
 * Helper canônico de LUCRO LÍQUIDO REAL por transação.
 *
 * Bloco C da ressignificação (2026-05-27, docs/RESSIGNIFICACAO-ADMIN.md).
 *
 * Fonte ÚNICA da verdade pra TUDO que mostra "quanto sobrou":
 *   - Aba Precificação do produto (workbench de margem por forma de pagamento)
 *   - Tela /admin/resultado (DRE honesto)
 *   - Dashboard /admin (card "Você lucrou X")
 *   - PDV (margem ao vivo na linha do item — gate por permissão)
 *   - Exportação contador (CSV/PDF)
 *
 * Princípios:
 *   - Pure function. Sem side-effects. Sem DB. Importável por client OU server.
 *   - TODOS os valores em centavos (integer). Nunca float.
 *   - Helper recebe SNAPSHOTS quando disponíveis (transação histórica) OU
 *     contemporâneo (precificação prospectiva). A diferença é responsabilidade
 *     do caller — o helper só calcula.
 *   - Output garantido: net_profit pode ser NEGATIVO (margem ruim) e
 *     net_margin_pct pode ser >100 (custo zero) ou negativo. Não silencia.
 *
 * Decomposição:
 *
 *   netProfit = revenue
 *             − cost                  (CMV: vem de variant.cost ou product.cost
 *                                       OU de order_item.unit_cost_snapshot)
 *             − paymentFee            (taxa REAL da maquininha — pro método
 *                                       e parcelas escolhidos)
 *             − commission            (% da venda devida à vendedora)
 *             − tax                   (Simples Nacional sobre venda, se loja
 *                                       optar por descontar)
 *
 *   netMarginPct = netProfit / revenue × 100  (zero se revenue=0)
 */

// =====================================================================
// Types
// =====================================================================

/**
 * Métodos de pagamento que afetam o cálculo de taxa da maquininha.
 * Alinhado com `order_payment_method` enum no DB:
 *   - cash, pix, fiado, other → sem taxa cartão (return 0)
 *   - debit                   → cardRealFeeBpsDebit
 *   - credit                  → faixa por parcelas (1x | 2-6x | 7-12x)
 *
 * Para uso prático, `fiado` é tratado como sem taxa (cobrança vem depois
 * via receivable_payment, com método próprio nesse momento).
 */
export type PaymentMethodCategory =
  | "cash"
  | "pix"
  | "debit"
  | "credit"
  | "fiado"
  | "other";

/**
 * Configuração de taxas reais da maquininha (já cadastradas pelo lojista
 * em `/admin/pagamento`, gravadas em `store.card_real_fee_bps_*`).
 * Valores em bps (1bps = 0.01%; 350bps = 3.5%).
 */
export interface StoreFeeConfig {
  cardRealFeeBpsDebit: number;
  cardRealFeeBpsCredit1x: number;
  cardRealFeeBpsCredit2xTo6x: number;
  cardRealFeeBpsCredit7xTo12x: number;
}

export interface NetProfitInput {
  /**
   * Receita bruta da transação em centavos — preço pago pelo cliente
   * MENOS descontos do item E do carrinho (proporcional).
   * Não inclui frete (frete é repasse, não receita).
   */
  revenueInCents: number;
  /**
   * Custo unitário × quantidade em centavos. NULL não é aceito — caller
   * deve passar 0 explicitamente quando produto não tem custo cadastrado
   * (e a UI vai sinalizar "custo desconhecido" pro lojista preencher).
   */
  costInCents: number;
  /** Método de pagamento — define se aplica taxa cartão. */
  paymentMethod: PaymentMethodCategory;
  /**
   * Número de parcelas. Só relevante pra credit; outros métodos passam 1.
   * Range 1..24 (validado em caller via Zod no order_payment.installments).
   */
  installments: number;
  /**
   * Comissão da vendedora em bps (0..10000 = 0..100%). 0 = sem comissão.
   * Snapshot ideal: vem de order_item.commission_snapshot_in_cents já
   * calculado, então caller pode passar 0 aqui e somar manualmente.
   * Default 0 — vendedora opcional.
   */
  commissionBps: number;
  /**
   * Imposto sobre venda em bps. 0..10000. Ex: Simples Nacional 6% = 600.
   * Lojista escolhe deduzir ou não no /admin/configuracoes (não implementado
   * em UI ainda, mas helper suporta).
   * Default 0.
   */
  taxBps: number;
  /** Taxas reais da maquininha — `store.card_real_fee_bps_*`. */
  storeFees: StoreFeeConfig;
}

export interface NetProfitResult {
  revenueInCents: number;
  costInCents: number;
  paymentFeeInCents: number;
  commissionInCents: number;
  taxInCents: number;
  /** Receita − todos os custos. Pode ser negativo. */
  netProfitInCents: number;
  /**
   * Margem líquida em % (0..100, ou negativo). 0 quando revenue=0 (evita
   * Infinity). >100 é matematicamente possível se custo for negativo
   * (devolução) — nunca acontece em venda real, mas helper não silencia.
   */
  netMarginPct: number;
  /** bps efetivamente aplicado pra taxa cartão (debug + auditoria). */
  effectiveCardFeeBps: number;
}

// =====================================================================
// Public API
// =====================================================================

/**
 * Resolve a taxa real da maquininha para um método + parcelas + config
 * da loja. Pure function. Caller usa pra:
 *   - Persistir `order_payment.card_fee_snapshot_in_cents` no INSERT
 *     (snapshot fica fixo mesmo se lojista mudar taxa depois).
 *   - Mostrar simulação no workbench de precificação.
 *
 * Range de parcelas:
 *   - 1x         → cardRealFeeBpsCredit1x
 *   - 2x..6x     → cardRealFeeBpsCredit2xTo6x
 *   - 7x..24x    → cardRealFeeBpsCredit7xTo12x (faixa cobre até 24x — após
 *                  12x a maquininha cobra o mesmo bps ou mais; helper
 *                  trata como conservador)
 *
 * Outros métodos retornam 0 (sem taxa).
 */
export function resolveCardFeeBps(
  method: PaymentMethodCategory,
  installments: number,
  storeFees: StoreFeeConfig,
): number {
  if (method === "debit") return storeFees.cardRealFeeBpsDebit;
  if (method === "credit") {
    if (installments <= 1) return storeFees.cardRealFeeBpsCredit1x;
    if (installments <= 6) return storeFees.cardRealFeeBpsCredit2xTo6x;
    return storeFees.cardRealFeeBpsCredit7xTo12x;
  }
  return 0;
}

/**
 * Calcula taxa real em centavos a partir de receita + bps.
 * Arredonda usando Math.round (centavo mais próximo) — convenção idêntica
 * à lib/installments.ts existente.
 */
function bpsToCents(amountInCents: number, bps: number): number {
  if (amountInCents <= 0 || bps <= 0) return 0;
  return Math.round((amountInCents * bps) / 10000);
}

/**
 * Núcleo do cálculo. Veja docstring do módulo.
 */
export function calculateNetProfit(input: NetProfitInput): NetProfitResult {
  const {
    revenueInCents,
    costInCents,
    paymentMethod,
    installments,
    commissionBps,
    taxBps,
    storeFees,
  } = input;

  const effectiveCardFeeBps = resolveCardFeeBps(
    paymentMethod,
    installments,
    storeFees,
  );

  // Taxa cartão é calculada sobre a receita BRUTA (o cliente paga R$ X,
  // a maquininha desconta % de R$ X). Não usa "receita líquida" como base.
  const paymentFeeInCents = bpsToCents(revenueInCents, effectiveCardFeeBps);

  // Comissão é sobre a receita BRUTA (vendedora ganha % do que vendeu,
  // independente das taxas que a loja paga). Convenção do varejo BR.
  const commissionInCents = bpsToCents(revenueInCents, commissionBps);

  // Imposto também sobre receita bruta (Simples Nacional é % do
  // faturamento, não do lucro).
  const taxInCents = bpsToCents(revenueInCents, taxBps);

  const netProfitInCents =
    revenueInCents -
    costInCents -
    paymentFeeInCents -
    commissionInCents -
    taxInCents;

  const netMarginPct =
    revenueInCents === 0 ? 0 : (netProfitInCents / revenueInCents) * 100;

  return {
    revenueInCents,
    costInCents,
    paymentFeeInCents,
    commissionInCents,
    taxInCents,
    netProfitInCents,
    netMarginPct,
    effectiveCardFeeBps,
  };
}

// =====================================================================
// Defaults razoáveis (uso em testes + fallback quando store ainda não
// configurou taxa real). Médias Stone/Cielo 2025.
// =====================================================================

export const DEFAULT_STORE_FEES: StoreFeeConfig = {
  cardRealFeeBpsDebit: 199, // 1.99%
  cardRealFeeBpsCredit1x: 350, // 3.50%
  cardRealFeeBpsCredit2xTo6x: 599, // 5.99%
  cardRealFeeBpsCredit7xTo12x: 1199, // 11.99%
};

// =====================================================================
// Helpers thin pra persistir snapshots no INSERT de order_payment
// =====================================================================

/**
 * Calcula a taxa em centavos pra snapshot em order_payment.card_fee_snapshot_in_cents.
 * Retorna NULL quando o método não tem taxa cartão (cash/pix/fiado/other),
 * pra deixar a coluna NULL em vez de 0 (semântica: NULL = "não aplica",
 * 0 = "taxa explicitamente zerada pelo lojista").
 */
export function computeCardFeeSnapshot(
  amountInCents: number,
  method: PaymentMethodCategory,
  installments: number,
  storeFees: StoreFeeConfig,
): number | null {
  if (method !== "credit" && method !== "debit") return null;
  const bps = resolveCardFeeBps(method, installments, storeFees);
  return bpsToCents(amountInCents, bps);
}

export interface StoreSettlementConfig {
  settlementDaysPix: number;
  settlementDaysDebit: number;
  settlementDaysCredit: number;
}

/**
 * Calcula a data de settlement pra snapshot em order_payment.settlement_date.
 * Retorna NULL pra cash/fiado/other (cash já entrou em caixa; fiado tem
 * sua própria cobrança futura; other é livre).
 *
 * Para credit/debit/pix: createdAt + N dias do método. Retorna string
 * ISO YYYY-MM-DD (formato `date` do Postgres via Drizzle).
 */
export function computeSettlementDate(
  createdAt: Date,
  method: PaymentMethodCategory,
  store: StoreSettlementConfig,
): string | null {
  const days =
    method === "pix"
      ? store.settlementDaysPix
      : method === "debit"
        ? store.settlementDaysDebit
        : method === "credit"
          ? store.settlementDaysCredit
          : null;
  if (days === null) return null;
  const out = new Date(createdAt.getTime());
  out.setUTCDate(out.getUTCDate() + days);
  return out.toISOString().slice(0, 10);
}
