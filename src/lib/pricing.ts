/**
 * Helpers de preço.
 *
 * Promoção é inline no `productTable` (campos `promoPriceInCents`,
 * `promoStartsAt`, `promoEndsAt`). "Em promoção" depende de:
 *   - `promoPriceInCents` não-nulo E
 *   - janela de datas válida (now ∈ [promoStartsAt, promoEndsAt], com cada
 *     extremidade opcional — null = sem limite naquele lado).
 *
 * Toda lógica vive aqui pra evitar drift entre lista, detalhe, carrinho e
 * snapshot do `order_item`.
 */

export interface PromoFields {
  basePriceInCents: number;
  promoPriceInCents: number | null;
  promoStartsAt?: Date | null;
  promoEndsAt?: Date | null;
}

/**
 * Retorna `true` se há promoção válida agora. Aceita `now` opcional pra
 * facilitar teste e janelas determinísticas no SSR (evita "agora muda
 * entre RSC e client" — passe a mesma referência se importar).
 */
export function hasActivePromo(p: PromoFields, now: Date = new Date()): boolean {
  if (p.promoPriceInCents === null || p.promoPriceInCents === undefined) {
    return false;
  }
  if (p.promoPriceInCents >= p.basePriceInCents) {
    // Defesa: schema já valida, mas se entrar dado ruim do passado, ignora.
    return false;
  }
  if (p.promoStartsAt && p.promoStartsAt > now) return false;
  if (p.promoEndsAt && p.promoEndsAt < now) return false;
  return true;
}

/**
 * Preço efetivo em centavos: promoPrice se ativo, senão basePrice.
 */
export function getEffectivePrice(
  p: PromoFields,
  now: Date = new Date(),
): number {
  return hasActivePromo(p, now) ? p.promoPriceInCents! : p.basePriceInCents;
}

/**
 * Formata centavos como BRL: 1990 → "R$ 19,90".
 */
export function formatBRL(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

// ============================================================
// Variant pricing — resolução compartilhada (PDV + checkout)
// ============================================================
//
// Variant tem override de preço base (`priceInCents`) e de promo
// (`promoPriceInCents`). NÃO tem janela própria — a janela de promo
// é sempre `product.promoStartsAt`/`product.promoEndsAt` (compartilhada).
//
// Regra de fallback (espelha o que `create-from-cart.ts` já fazia):
//   - base efetivo: `variant.priceInCents ?? product.basePriceInCents`
//   - promo efetiva: `variant.promoPriceInCents ?? product.promoPriceInCents`
//   - janela: sempre vinda do product
//
// PDV (`createBalcaoSale`) ignorava `variant.promoPriceInCents` antes
// desta consolidação — storefront/checkout honrava. Helper unifica.

export interface VariantPriceInput {
  /** Override de preço base da variante (null = herda do product). */
  priceInCents: number | null;
  /** Override de promo da variante (null = herda do product). */
  promoPriceInCents: number | null;
}

export interface ProductPriceInput {
  basePriceInCents: number;
  promoPriceInCents: number | null;
  promoStartsAt?: Date | null;
  promoEndsAt?: Date | null;
}

/**
 * Resolve o preço efetivo (em centavos) considerando override de variante.
 *
 * Quando `variant` é null, equivale a `getEffectivePrice(product, now)`.
 *
 * Quando `variant` é informada:
 *   - base = variant.priceInCents ?? product.basePriceInCents
 *   - promo = variant.promoPriceInCents ?? product.promoPriceInCents
 *   - janela de promo = product.promoStartsAt/promoEndsAt
 *
 * Helper PURO. Sem acesso a DB / agora externo. Use o mesmo `now` que
 * você usa pra demais snapshots da venda pra evitar drift.
 */
export function resolveVariantPrice(
  variant: VariantPriceInput | null,
  product: ProductPriceInput,
  now: Date = new Date(),
): number {
  const basePriceInCents =
    variant?.priceInCents ?? product.basePriceInCents;
  const promoPriceInCents =
    variant?.promoPriceInCents ?? product.promoPriceInCents;
  return getEffectivePrice(
    {
      basePriceInCents,
      promoPriceInCents,
      promoStartsAt: product.promoStartsAt,
      promoEndsAt: product.promoEndsAt,
    },
    now,
  );
}

// ============================================================
// Pagamento configurável (Fase 2 — ADR-0013)
// ============================================================

/**
 * Subset das colunas de pagamento da loja consumido pelo renderer de
 * parcela. Vem do loader (já carrega `store` para o BrandProvider) —
 * passe apenas estes 4 campos pra manter `ProductPurchasePanelProps`
 * enxuto. NÃO inclui `cashDiscountBps` / `paymentMethodsNote` — esses
 * são renderizados por outros helpers/blocos.
 */
export interface PaymentConfig {
  acceptsCard: boolean;
  cardMaxInstallments: number;
  installmentBasePrice: "base" | "effective";
  showInstallmentsOnPDP: boolean;
}

export interface InstallmentInput {
  basePriceInCents: number;
  effectivePriceInCents: number;
  storePayment: PaymentConfig;
  /**
   * Override do max-parcelas APENAS deste produto. Quando preenchido,
   * SUBSTITUI `storePayment.cardMaxInstallments`. null = usa default
   * da loja. Caso de uso: loja default 3x, produto específico 10x.
   */
  productInstallmentsOverride: number | null;
}

/**
 * Formata parcelas sem juros considerando a configuração de pagamento
 * da loja + override opcional por produto.
 *
 * Retorna "" (label suprimida) quando QUALQUER gate falhar:
 *   1. `acceptsCard === false`               (loja não aceita cartão)
 *   2. `showInstallmentsOnPDP === false`     (loja prefere esconder)
 *   3. teto efetivo de parcelas <= 1         ("1× sem juros" é ruído)
 *   4. preço base <= 0                       (produto sem preço)
 *
 * Quando passa todos os gates, divide pelo preço escolhido conforme
 * `installmentBasePrice`:
 *   - "base":      divide pelo preço cheio (`basePriceInCents`)
 *   - "effective": divide pelo preço atual (`effectivePriceInCents`,
 *                  promo se ativa, senão = base)
 *
 * Divisão simples por N (sem ajuste de centavos sobrando — não há
 * gateway, valor é informativo).
 */
export function formatInstallments(input: InstallmentInput): string {
  if (!input.storePayment.acceptsCard) return "";
  if (!input.storePayment.showInstallmentsOnPDP) return "";

  const ceiling =
    input.productInstallmentsOverride ?? input.storePayment.cardMaxInstallments;
  if (ceiling <= 1) return "";

  const baseCents =
    input.storePayment.installmentBasePrice === "base"
      ? input.basePriceInCents
      : input.effectivePriceInCents;
  if (baseCents <= 0) return "";

  const each = Math.floor(baseCents / ceiling);
  return `ou ${ceiling}× de ${formatBRL(each)} sem juros`;
}

/**
 * Resolve o desconto à vista efetivo considerando override por produto.
 *
 * Regras (override por produto vence quando preenchido):
 *   - `productOverride === null`     → usa `storeBps`
 *   - `productOverride === 0`        → SEM desconto (mesmo se loja oferece)
 *   - `productOverride > 0`          → usa o valor do produto, ignora loja
 *
 * O caso `productOverride === 0` é semanticamente diferente de `null`:
 * é uma decisão ativa do lojista de DESLIGAR o desconto neste produto.
 * Caso de uso: produto com margem apertada que não comporta o desconto
 * padrão da loja.
 *
 * Helper puro pra ser usado em loaders, panels e testes (sem render).
 */
export function resolveCashDiscountBps(
  storeBps: number,
  productOverride: number | null,
): number {
  return productOverride === null ? storeBps : productOverride;
}

/**
 * Calcula desconto à vista a partir de `cashDiscountBps` (basis points).
 * Retorna `null` quando não há desconto efetivo ou preço inválido.
 *
 * Label NÃO menciona método (PIX/dinheiro) — Mangos Pay não processa
 * transação; o método específico vive em `paymentMethodsNote` (texto
 * livre do lojista) e é combinado no WhatsApp.
 *
 * Para o cálculo POR PRODUTO, resolva primeiro com `resolveCashDiscountBps`
 * e passe o resultado aqui. Esta função é low-level e não conhece a
 * regra de override — deixa quem chama escolher a fonte.
 *
 * Exemplo: effective=10000 (R$ 100), bps=1000 (10%)
 *   → { discountedCents: 9000, label: "à vista R$ 90,00 (10% off)" }
 *
 * Percentual usa decimal só quando não é múltiplo de 100 bps:
 *   bps=550 (5.5%) → "5.5% off"
 *   bps=1000 (10%) → "10% off"
 */
export function formatCashDiscount(
  effectivePriceInCents: number,
  cashDiscountBps: number,
): { discountedCents: number; label: string } | null {
  if (cashDiscountBps <= 0 || effectivePriceInCents <= 0) return null;
  const discounted = Math.floor(
    (effectivePriceInCents * (10000 - cashDiscountBps)) / 10000,
  );
  const percent = (cashDiscountBps / 100).toFixed(
    cashDiscountBps % 100 === 0 ? 0 : 1,
  );
  return {
    discountedCents: discounted,
    label: `à vista ${formatBRL(discounted)} (${percent}% off)`,
  };
}
