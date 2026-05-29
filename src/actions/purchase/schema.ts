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
  /**
   * Bloco C UX (2026-05-28) — lote da NF do fornecedor.
   * Texto livre até 60 chars (CHECK no SQL 79). Nullable — joalheria/roupa
   * deixa vazio, perfumaria/cosmético preenche. Alimenta `/estoque/vencendo`.
   */
  batchNumber: z
    .preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? null : v),
      z.string().trim().max(60).nullable(),
    )
    .default(null),
  /**
   * Data de validade do lote (formato YYYY-MM-DD do `<input type=date>`).
   * Nullable. Quando preenchida, aparece em `/admin/estoque/vencendo`.
   */
  expiresAt: z
    .preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? null : v),
      z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida")
        .nullable(),
    )
    .default(null),
});
export type PurchaseItemInput = z.input<typeof purchaseItemInputSchema>;

/**
 * Bloco H (2026-05-29) — uma parcela da compra. Quando lojista marca
 * cartão 3×, vira 3 destes (e o action insere 3 rows em `expense`).
 * `dueDate` é string `YYYY-MM-DD` (formato date do Postgres via Drizzle).
 * Soma das `amountInCents` deve bater com o totalInCents calculado da
 * compra (validado na action — Zod só checa shape).
 */
export const purchaseInstallmentInputSchema = z.object({
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data de vencimento inválida"),
  amountInCents: z
    .number()
    .int()
    .positive("Valor da parcela deve ser maior que zero")
    .max(999_999_999, "Valor da parcela acima do máximo"),
});
export type PurchaseInstallmentInput = z.input<
  typeof purchaseInstallmentInputSchema
>;

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
  /**
   * Bloco H (2026-05-29) — agregados da NF do fornecedor. Frete +
   * impostos somam ao total; desconto subtrai. Default 0 mantém compat
   * com callers antigos (form sem header expandido + fixtures).
   */
  freightInCents: z
    .number()
    .int()
    .nonnegative("Frete não pode ser negativo")
    .max(99_999_999, "Frete acima do máximo")
    .default(0),
  discountInCents: z
    .number()
    .int()
    .nonnegative("Desconto não pode ser negativo")
    .max(99_999_999, "Desconto acima do máximo")
    .default(0),
  taxesInCents: z
    .number()
    .int()
    .nonnegative("Impostos não podem ser negativos")
    .max(99_999_999, "Impostos acima do máximo")
    .default(0),
  /**
   * Bloco H (2026-05-29) — parcelas geradas como `expense`. Quando
   * vazio (default), comportamento legacy:
   *   - paidNow=true  → 1 expense com paid_at=now()
   *   - paidNow=false → 1 expense com due_date=null (compra "a pagar"
   *                     sem vencimento — comportamento prévio do form)
   * Quando preenchido (cartão parcelado), gera N expenses com due_dates
   * espaçadas e paid_at=null (ou paid_at=now() em todas se paidNow=true,
   * cenário "pago integralmente no cartão único"). App-layer valida que
   * SUM(installments.amount) === totalCalculado.
   */
  installments: z
    .array(purchaseInstallmentInputSchema)
    .max(24, "Máximo 24 parcelas")
    .default([]),
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
