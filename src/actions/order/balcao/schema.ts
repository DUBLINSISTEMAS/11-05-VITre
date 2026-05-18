/**
 * Schema Zod do PDV / venda balcão (Fase 5 — ADR-0016).
 *
 * Diferente do checkout WhatsApp:
 *   - cliente OPCIONAL (walk-in dominante)
 *   - paymentMethod OBRIGATÓRIO
 *   - discount/cashReceived opcionais (Postgres CHECK valida coerência)
 *   - sem idempotencyKey do client (server gera por sessão de PDV)
 */
import { z } from "zod";

export const PAYMENT_METHOD_VALUES = [
  "cash",
  "pix",
  "debit",
  "credit",
  "other",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHOD_VALUES)[number];

export const balcaoItemSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullable(),
  quantity: z.number().int().min(1).max(99),
});
export type BalcaoItemInput = z.infer<typeof balcaoItemSchema>;

/** E.164 simplificado (mesmo da Fase 3 customer schema). */
const E164 = /^\+[1-9][0-9]{6,14}$/;

export const createBalcaoSaleSchema = z
  .object({
    items: z
      .array(balcaoItemSchema)
      .min(1, "Adicione pelo menos um item")
      .max(99, "Máximo 99 itens por venda"),
    /** FK customer opcional. NULL = walk-in. */
    customerId: z.string().uuid().nullable(),
    /**
     * Venda rápida (ADR-0030 / Frente A): quando NÃO há customerId, lojista
     * pode digitar um nome (+ tel opcional) que vira snapshot do order SEM
     * criar customer no DB. Ignorado se customerId presente.
     */
    walkInName: z
      .preprocess(
        (v) => (typeof v === "string" && v.trim() === "" ? null : v),
        z.string().trim().min(1).max(120).nullable(),
      )
      .default(null),
    walkInPhone: z
      .preprocess(
        (v) => (typeof v === "string" && v.trim() === "" ? null : v),
        z
          .string()
          .trim()
          .regex(E164, "Telefone inválido. Use formato +5511999999999.")
          .nullable(),
      )
      .default(null),
    paymentMethod: z.enum(PAYMENT_METHOD_VALUES),
    /** Desconto manual em centavos. NULL = sem desconto. */
    discountInCents: z
      .number()
      .int()
      .min(0, "Desconto não pode ser negativo")
      .nullable(),
    /**
     * ADR-0020 — acréscimo manual em centavos (taxa cartão, frete, embalagem,
     * "fechar redondo"). NULL = sem acréscimo. Simétrico a discountInCents.
     */
    surchargeInCents: z
      .number()
      .int()
      .min(0, "Acréscimo não pode ser negativo")
      .nullable(),
    /** Valor recebido em dinheiro (pra cálculo de troco). Só faz sentido
     * quando paymentMethod === 'cash'. */
    cashReceivedInCents: z
      .number()
      .int()
      .min(0)
      .nullable(),
    /** Observação livre (cheque #, vale, fiado, etc). String vazia
     * vira null pra ficar consistente com o CHECK do DB. */
    notes: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? null : v),
      z.string().trim().max(500, "Máximo 500 caracteres").nullable(),
    ),
  })
  .superRefine((data, ctx) => {
    // cash_received só faz sentido com method='cash'
    if (data.cashReceivedInCents !== null && data.paymentMethod !== "cash") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cashReceivedInCents"],
        message: "Valor recebido em dinheiro só aplica quando método é 'cash'",
      });
    }
  });

export type CreateBalcaoSaleInput = z.input<typeof createBalcaoSaleSchema>;
export type CreateBalcaoSaleParsed = z.output<typeof createBalcaoSaleSchema>;
