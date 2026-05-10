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

/**
 * Label de preço pra listagem: mostra promoção ativa quando aplicável.
 *  - "R$ 19,90" (sem promo)
 *  - "R$ 14,90 (de R$ 19,90)" (promo ativa)
 */
export function formatPriceLabel(
  p: PromoFields,
  now: Date = new Date(),
): string {
  if (hasActivePromo(p, now)) {
    return `${formatBRL(p.promoPriceInCents!)} (de ${formatBRL(p.basePriceInCents)})`;
  }
  return formatBRL(p.basePriceInCents);
}

/**
 * Formata parcelas sem juros: 60700, 3 → "ou 3× de R$ 202,33 sem juros".
 * Canvas linha 271 do _vitre-storefront.jsx.
 *
 * Divisão simples por N (sem ajuste de centavos sobrando — comum em
 * checkout brasileiro mostrar valor da parcela "ideal" e somar diferença
 * na 1ª no momento da cobrança real, mas como não há gateway o número é
 * só informativo).
 */
export function formatInstallments(cents: number, installments = 3): string {
  if (installments <= 1 || cents <= 0) return "";
  const each = Math.floor(cents / installments);
  return `ou ${installments}× de ${formatBRL(each)} sem juros`;
}
