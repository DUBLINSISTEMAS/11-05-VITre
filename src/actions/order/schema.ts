/**
 * Schemas Zod do domínio `order`.
 *
 * Status flow:
 *   quote → confirmed (via "transformar em venda" no PDV) | canceled
 *   awaiting_whatsapp → confirmed → fulfilled | canceled | expired
 *   confirmed pode virar fulfilled OU canceled
 *   awaiting_whatsapp pode virar confirmed OU canceled OU expired
 *   fulfilled/canceled/expired = terminais
 *
 * Sprint 1A Fase 4 — 'quote' (orçamento) adicionado. Sem pagamento,
 * sem stock_movement; converte em confirmed via PDV.
 */
import { z } from "zod";

import { isValidWhatsAppBR } from "@/lib/whatsapp-format";

export const ORDER_STATUS_VALUES = [
  "quote",
  "awaiting_whatsapp",
  "confirmed",
  "fulfilled",
  "canceled",
  "expired",
  // Pre-Sprint-6 C — devolução total. Não chega aqui via update-status
  // (lojista usa recordOrderReturn action), mas precisa estar no union
  // pra tipos de query/UI baterem com o DB enum.
  "returned",
] as const;

export const updateOrderStatusSchema = z.object({
  orderId: z.string().uuid(),
  nextStatus: z.enum(ORDER_STATUS_VALUES),
});
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;

/**
 * Mapa de transições válidas via UI manual (não inclui 'returned' —
 * devolução é fluxo separado: recordOrderReturn faz a transição
 * fulfilled/confirmed → returned dentro da própria action).
 */
export const VALID_TRANSITIONS: Record<
  (typeof ORDER_STATUS_VALUES)[number],
  ReadonlyArray<(typeof ORDER_STATUS_VALUES)[number]>
> = {
  quote: ["confirmed", "canceled"],
  awaiting_whatsapp: ["confirmed", "canceled", "expired"],
  confirmed: ["fulfilled", "canceled"],
  fulfilled: [],
  canceled: [],
  expired: [],
  returned: [],
};

// =====================================================================
// createOrderFromCart (Fase 1.6)
// =====================================================================

export const customerInputSchema = z.object({
  customerName: z
    .string()
    .trim()
    .min(2, "Nome muito curto")
    .max(120, "Nome muito longo")
    // Onda 31 (2026-05-27): exige pelo menos uma letra (BR + acentos).
    // Antes aceitava "999", "----", "@@@" etc — spam óbvio que rate
    // limit protege em volume mas suja o admin com nomes inválidos.
    // Permite letras, espaços, hífen e apóstrofo (D'Avila, Anne-Marie).
    .refine(
      (v) => /[a-zA-ZÀ-ÿ]/.test(v),
      "Nome precisa ter pelo menos uma letra",
    ),
  customerPhone: z
    .string()
    .trim()
    .min(1, "WhatsApp obrigatório")
    .refine(isValidWhatsAppBR, "WhatsApp inválido"),
  customerNotes: z
    .string()
    .trim()
    .max(500, "Máximo 500 caracteres")
    .optional()
    .or(z.literal("")),
});
export type CustomerInput = z.infer<typeof customerInputSchema>;

export const cartItemInputSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullable(),
  quantity: z.number().int().min(1).max(99),
});
export const createOrderInputSchema = customerInputSchema.extend({
  storeSlug: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "Slug inválido"),
  idempotencyKey: z.string().uuid("Chave de idempotência inválida"),
  items: z.array(cartItemInputSchema).min(1, "Sacola vazia").max(99),
  /**
   * ADR-0026 / fix auditoria 2026-05-18 — cupom opcional no storefront.
   * Aceita CÓDIGO (não couponId) porque storefront é anônimo. Server
   * revalida + recalcula desconto + incrementa uses_count atomic no
   * mesmo tx do INSERT order. NULL/undefined = sem cupom.
   *
   * Hoje storefront NÃO usa este campo (UX 1.6 segue zero cupom
   * automático — lojista combina via WhatsApp). Campo opt-in pra
   * futuro UI de input de código no storefront.
   */
  couponCode: z
    .preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? null : v),
      z.string().trim().toUpperCase().nullable(),
    )
    .optional()
    .default(null),
});
export type CreateOrderInput = z.input<typeof createOrderInputSchema>;
