/**
 * Schema Zod do PDV / venda balcão (Fase 5 — ADR-0016).
 *
 * Sprint 1A: pagamento dividido (multipayment). A action passa a aceitar
 * `payments: Array<{method, amount, cashReceived, notes}>` (1..5 linhas).
 *
 * Backward compat: payload antigo (`paymentMethod` único + `cashReceivedInCents`)
 * continua aceito — action normaliza para 1 linha em `payments[]` antes
 * de gravar. Sprint 1B remove os campos legados.
 *
 * Diferente do checkout WhatsApp:
 *   - cliente OPCIONAL (walk-in dominante)
 *   - pelo menos 1 forma de pagamento obrigatória
 *   - sem idempotencyKey do client (server gera por sessão de PDV)
 */
import { z } from "zod";

/**
 * Enum espelha order_payment_method do DB (ADR-0034 Camada 1).
 * TED/DOC e outras formas exóticas usam 'other' + notes.
 */
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
type BalcaoItemInput = z.infer<typeof balcaoItemSchema>;

/** E.164 simplificado (mesmo da Fase 3 customer schema). */
const E164 = /^\+[1-9][0-9]{6,14}$/;

/**
 * Linha de pagamento (Sprint 1A multipayment).
 *
 * Regras app-layer:
 *   - amountInCents > 0 (CHECK no DB também — supabase/sql/45)
 *   - cashReceivedInCents só pode ser não-null em method='cash'
 *   - cashReceivedInCents >= amountInCents quando preenchido (troco
 *     positivo). Action revalida server-side.
 *   - notes max 60 chars (lojista digita "TED Banco X", "vale #123", etc).
 *     Vazio vira null pra ficar consistente com o DB CHECK.
 *
 * Validação `sum(amountInCents) === totalInCents` acontece SERVER-SIDE
 * dentro da action (depende de subtotal/desconto/acréscimo).
 */
export const paymentLineSchema = z
  .object({
    method: z.enum(PAYMENT_METHOD_VALUES),
    amountInCents: z
      .number()
      .int()
      .positive("Valor deve ser maior que zero")
      .max(99_999_999, "Valor acima do máximo"),
    cashReceivedInCents: z
      .number()
      .int()
      .min(0)
      .nullable()
      .default(null),
    notes: z
      .preprocess(
        (v) => (typeof v === "string" && v.trim() === "" ? null : v),
        z.string().trim().max(60, "Máximo 60 caracteres").nullable(),
      )
      .default(null),
  })
  .superRefine((line, ctx) => {
    if (line.method !== "cash" && line.cashReceivedInCents !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cashReceivedInCents"],
        message: "Recebido em dinheiro só aplica em method='cash'",
      });
    }
    if (
      line.method === "cash" &&
      line.cashReceivedInCents !== null &&
      line.cashReceivedInCents < line.amountInCents
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cashReceivedInCents"],
        message: "Valor recebido menor que o valor da linha",
      });
    }
  });

type PaymentLineInput = z.input<typeof paymentLineSchema>;
type PaymentLineParsed = z.output<typeof paymentLineSchema>;

/**
 * Sprint 1A — modo da venda balcão.
 *   - 'sale'  (default): venda normal com payments[] e desconto de estoque
 *   - 'quote' (Fase 4): orçamento — sem payments, sem stock, short_code Q-,
 *     status='quote', quote_valid_until = now + quoteValidityDays
 *   - 'fiado' (Fase 5): venda fiada — customerId obrigatório, sem payments,
 *     DESCONTA estoque, status='confirmed', insere linha em receivable
 *     com due_date = now + dueDaysFromNow.
 */
export const BALCAO_MODE_VALUES = ["sale", "quote", "fiado"] as const;
type BalcaoMode = (typeof BALCAO_MODE_VALUES)[number];

export const createBalcaoSaleSchema = z
  .object({
    /** Modo da operação. Default 'sale' pra backward compat. */
    mode: z.enum(BALCAO_MODE_VALUES).default("sale"),
    /**
     * Sprint 1A Fase 4 — validade do orçamento em dias (só usado em
     * mode='quote'). Default 7. Aceita 1..365.
     */
    quoteValidityDays: z
      .number()
      .int()
      .min(1)
      .max(365)
      .default(7),
    /**
     * Sprint 1A Fase 5 — vencimento do fiado em dias a partir de agora
     * (só usado em mode='fiado'). Default 30. Aceita 1..365.
     */
    dueDaysFromNow: z
      .number()
      .int()
      .min(1)
      .max(365)
      .default(30),
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

    /**
     * Sprint 1A: forma canônica. Array de 1 a 5 linhas de pagamento.
     * Sum(amountInCents) === totalInCents (validado server-side após
     * cálculo de subtotal/desconto/acréscimo).
     */
    payments: z
      .array(paymentLineSchema)
      .min(1, "Adicione pelo menos uma forma de pagamento")
      .max(5, "Máximo 5 formas de pagamento")
      .optional(),

    /**
     * @deprecated Sprint 1A — usar `payments[]`. Sprint 1B remove.
     * Action normaliza para `payments: [{method, amount=total, cashReceived}]`
     * automaticamente. Loga warning quando recebe payload no formato antigo.
     */
    paymentMethod: z.enum(PAYMENT_METHOD_VALUES).optional(),
    /**
     * @deprecated Sprint 1A — usar `payments[].cashReceivedInCents`.
     */
    cashReceivedInCents: z.number().int().min(0).nullable().optional(),

    /**
     * Desconto manual em centavos. NULL = sem desconto.
     * Quando `couponId` é fornecido, o server IGNORA este valor e
     * recalcula a partir do cupom — defesa contra tampering.
     */
    discountInCents: z
      .number()
      .int()
      .min(0, "Desconto não pode ser negativo")
      .nullable(),
    /**
     * ADR-0026 / fix auditoria 2026-05-18 — FK opcional para cupom.
     */
    couponId: z.string().uuid().nullable().default(null),
    /**
     * ADR-0020 — acréscimo manual em centavos (taxa cartão, frete, embalagem,
     * "fechar redondo"). NULL = sem acréscimo. Simétrico a discountInCents.
     */
    surchargeInCents: z
      .number()
      .int()
      .min(0, "Acréscimo não pode ser negativo")
      .nullable(),
    /** Observação livre do pedido inteiro (cheque #, vale, fiado, etc).
     * String vazia vira null pra ficar consistente com o CHECK do DB. */
    notes: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? null : v),
      z.string().trim().max(500, "Máximo 500 caracteres").nullable(),
    ),
  })
  .superRefine((data, ctx) => {
    // Sprint 1A Fase 4 — invariantes do modo 'quote':
    //   payments[] DEVE ser undefined ou [] (orçamento não recebe pagamento)
    //   paymentMethod legacy DEVE ser undefined ou null
    //   cashReceivedInCents legacy DEVE ser undefined ou null
    if (data.mode === "quote") {
      if (data.payments && data.payments.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["payments"],
          message: "Orçamento (mode='quote') não aceita formas de pagamento",
        });
      }
      if (data.paymentMethod) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["paymentMethod"],
          message: "Orçamento (mode='quote') não aceita paymentMethod",
        });
      }
      if (
        data.cashReceivedInCents !== null &&
        data.cashReceivedInCents !== undefined
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["cashReceivedInCents"],
          message: "Orçamento não tem dinheiro recebido",
        });
      }
      return;
    }

    // Sprint 1A Fase 5 — invariantes do modo 'fiado':
    //   customerId OBRIGATÓRIO (fiado precisa de cliente identificado)
    //   payments[] DEVE ser undefined ou []
    //   paymentMethod legacy DEVE ser undefined ou null
    if (data.mode === "fiado") {
      if (!data.customerId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["customerId"],
          message: "Cliente obrigatório para venda fiada",
        });
      }
      if (data.payments && data.payments.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["payments"],
          message: "Fiado (mode='fiado') não aceita formas de pagamento",
        });
      }
      if (data.paymentMethod) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["paymentMethod"],
          message: "Fiado (mode='fiado') não aceita paymentMethod",
        });
      }
      if (
        data.cashReceivedInCents !== null &&
        data.cashReceivedInCents !== undefined
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["cashReceivedInCents"],
          message: "Fiado não tem dinheiro recebido",
        });
      }
      return;
    }

    // Modo 'sale': pelo menos uma das duas formas: payments[] (nova) OU
    // paymentMethod (legacy).
    if (!data.payments && !data.paymentMethod) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["payments"],
        message: "Defina ao menos uma forma de pagamento",
      });
      return;
    }
    // Legacy: cash_received só com cash. Mesma regra do schema antigo.
    if (
      data.paymentMethod &&
      data.cashReceivedInCents !== null &&
      data.cashReceivedInCents !== undefined &&
      data.paymentMethod !== "cash"
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cashReceivedInCents"],
        message: "Valor recebido em dinheiro só aplica quando método é 'cash'",
      });
    }
  });

export type CreateBalcaoSaleInput = z.input<typeof createBalcaoSaleSchema>;
type CreateBalcaoSaleParsed = z.output<typeof createBalcaoSaleSchema>;
