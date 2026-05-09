/**
 * Schemas Zod do domínio `order`.
 *
 * Status flow:
 *   awaiting_whatsapp → confirmed → fulfilled | canceled | expired
 *   confirmed pode virar fulfilled OU canceled
 *   awaiting_whatsapp pode virar confirmed OU canceled OU expired
 *   fulfilled/canceled/expired = terminais
 */
import { z } from "zod";

import { isValidWhatsAppBR } from "@/lib/whatsapp-format";

export const ORDER_STATUS_VALUES = [
  "awaiting_whatsapp",
  "confirmed",
  "fulfilled",
  "canceled",
  "expired",
] as const;

export const updateOrderStatusSchema = z.object({
  orderId: z.string().uuid(),
  nextStatus: z.enum(ORDER_STATUS_VALUES),
});
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;

/**
 * Mapa de transições válidas. Server action usa pra rejeitar mudanças
 * inconsistentes (ex: voltar de fulfilled pra confirmed).
 */
export const VALID_TRANSITIONS: Record<
  (typeof ORDER_STATUS_VALUES)[number],
  ReadonlyArray<(typeof ORDER_STATUS_VALUES)[number]>
> = {
  awaiting_whatsapp: ["confirmed", "canceled", "expired"],
  confirmed: ["fulfilled", "canceled"],
  fulfilled: [],
  canceled: [],
  expired: [],
};

// =====================================================================
// createOrderFromCart (Fase 1.6)
// =====================================================================

export const customerInputSchema = z.object({
  customerName: z
    .string()
    .trim()
    .min(2, "Nome muito curto")
    .max(120, "Nome muito longo"),
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
export type CartItemInput = z.infer<typeof cartItemInputSchema>;

export const createOrderInputSchema = customerInputSchema.extend({
  storeSlug: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "Slug inválido"),
  idempotencyKey: z.string().uuid("Chave de idempotência inválida"),
  items: z.array(cartItemInputSchema).min(1, "Sacola vazia").max(99),
});
export type CreateOrderInput = z.infer<typeof createOrderInputSchema>;
