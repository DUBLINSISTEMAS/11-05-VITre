/**
 * Schemas Zod do domínio purchase (Sprint 3).
 *
 * Compra é append-only: criada e nunca editada.
 *   - Correção via lançamento reverso (compra negativa) — não implementado
 *     ainda; lojista anota em `notes`.
 *   - Apenas `paidAt` muda depois (marcar como pago via mark-paid).
 */
import { z } from "zod";

import { PAYMENT_METHOD_VALUES } from "@/actions/order/balcao/schema";

export const purchaseItemInputSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullable().default(null),
  quantity: z
    .number()
    .int()
    .positive("Quantidade deve ser maior que zero")
    .max(99_999, "Quantidade acima do máximo"),
  unitCostInCents: z
    .number()
    .int()
    .nonnegative("Custo unitário não pode ser negativo")
    .max(99_999_999, "Custo unitário acima do máximo"),
});
export type PurchaseItemInput = z.input<typeof purchaseItemInputSchema>;

export const createPurchaseSchema = z.object({
  supplierId: z.string().uuid().nullable().default(null),
  invoiceNumber: z
    .preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? null : v),
      z.string().trim().max(60).nullable(),
    )
    .default(null),
  /**
   * Forma de pagamento ao fornecedor (reutiliza enum de pagamento do PDV).
   * NULL = ainda não definida. Quando preenchida JUNTO com `paidAt`, a
   * compra nasce já paga (gera cash_adjustment type='pay_supplier' se há
   * caixa aberto).
   */
  paymentMethod: z.enum(PAYMENT_METHOD_VALUES).nullable().default(null),
  /**
   * Quando marcado como pago no momento da criação. NULL = compra fica em
   * aberto (a pagar). Lojista pode marcar depois via mark-paid.
   */
  paidNow: z.boolean().default(false),
  notes: z
    .preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? null : v),
      z.string().trim().max(500).nullable(),
    )
    .default(null),
  items: z
    .array(purchaseItemInputSchema)
    .min(1, "Adicione pelo menos um item")
    .max(200, "Máximo 200 itens por compra"),
});
export type CreatePurchaseInput = z.input<typeof createPurchaseSchema>;

export const markPurchasePaidSchema = z.object({
  id: z.string().uuid(),
  paymentMethod: z.enum(PAYMENT_METHOD_VALUES),
});
