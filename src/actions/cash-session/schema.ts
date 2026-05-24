/**
 * Schemas Zod para o domínio `cash_session` / `cash_adjustment` (ADR-0022).
 *
 * Convenção CLAUDE.md #2: Zod em todos os boundaries.
 */
import { z } from "zod";

const MAX_AMOUNT_IN_CENTS = 10_000_000_00; // R$ 10 milhões — limite anti-erro de UI

export const openCashSessionSchema = z.object({
  openingAmountInCents: z
    .number()
    .int("Use valor inteiro em centavos.")
    .min(0, "Troco inicial não pode ser negativo.")
    .max(MAX_AMOUNT_IN_CENTS, "Valor acima do limite."),
});
export type OpenCashSessionInput = z.input<typeof openCashSessionSchema>;

export const closeCashSessionSchema = z
  .object({
    sessionId: z.string().uuid("Identificador inválido."),
    /** Contagem física do caixa em centavos. */
    closingActualInCents: z
      .number()
      .int("Use valor inteiro em centavos.")
      .min(0, "Contagem não pode ser negativa.")
      .max(MAX_AMOUNT_IN_CENTS, "Valor acima do limite."),
    /** Esperado calculado server-side; o caller envia pra confirmar diff (UX) */
    closingExpectedInCents: z
      .number()
      .int()
      .min(0)
      .max(MAX_AMOUNT_IN_CENTS),
    /** Obrigatório SE diferença ≠ 0 (refinement abaixo). */
    closingNotes: z
      .string()
      .trim()
      .max(1000, "Observação muito longa (máx 1000).")
      .nullish()
      .transform((v) => {
        const t = v?.trim() ?? "";
        return t === "" ? null : t;
      }),
  })
  .superRefine((data, ctx) => {
    // ADR-0022 D5 — diferença ≠ 0 exige closingNotes preenchido.
    if (
      data.closingActualInCents !== data.closingExpectedInCents &&
      data.closingNotes === null
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["closingNotes"],
        message:
          "Diferença detectada — descreva o motivo (sobra, falta, sangria não registrada…).",
      });
    }
  });
export type CloseCashSessionInput = z.input<typeof closeCashSessionSchema>;

export const recordAdjustmentSchema = z.object({
  sessionId: z.string().uuid("Identificador inválido."),
  type: z.enum(["sangria", "reinforcement"], {
    message: "Tipo inválido. Use sangria ou reinforcement.",
  }),
  amountInCents: z
    .number()
    .int("Use valor inteiro em centavos.")
    .min(1, "Valor deve ser maior que zero.")
    .max(MAX_AMOUNT_IN_CENTS, "Valor acima do limite."),
  reason: z
    .string()
    .trim()
    .max(500, "Motivo muito longo (máx 500).")
    .nullish()
    .transform((v) => {
      const t = v?.trim() ?? "";
      return t === "" ? null : t;
    }),
});
export type RecordAdjustmentInput = z.input<typeof recordAdjustmentSchema>;
