/**
 * Schemas Zod do domínio `quote_sheet` (ficha de orçamento de balcão).
 * Convenção CLAUDE.md #2: Zod em todos os boundaries.
 *
 * Datas chegam do form HTML como `YYYY-MM-DD`. Mantemos string aqui pra
 * isolar o boundary; a action converte pra Date (meio-dia UTC pra evitar
 * deriva de timezone) antes de gravar.
 */
import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => {
      const t = v?.trim() ?? "";
      return t === "" ? null : t;
    });

const dateOrNull = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  z
    .union([z.string().date(), z.date()])
    .nullable()
    .transform((v) => {
      if (v === null) return null;
      if (v instanceof Date) return v.toISOString().slice(0, 10);
      return v;
    }),
);

const MAX_CENTS = 100_000_000; // R$ 1.000.000 — teto sanitário

const quoteSheetFieldsBase = z.object({
  customerName: z
    .string()
    .trim()
    .min(1, "Nome do cliente é obrigatório.")
    .max(200, "Nome muito longo (máx 200)."),
  customerPhone: optionalText(40),
  /** CPF ou CNPJ — texto livre (UI mascara). Sem dígito-verificador
   *  aqui: joalheiro frequentemente anota incompleto/com erro de digitação
   *  e o objetivo é IMPRIMIR a ficha, não validar fiscalmente. */
  customerDocument: optionalText(20),
  customerCity: optionalText(80),
  receivedAt: dateOrNull,
  deliveryAt: dateOrNull,
  description: z
    .string()
    .trim()
    .min(1, "Descreva a peça/serviço.")
    .max(2000, "Descrição muito longa (máx 2000)."),
  totalInCents: z
    .number()
    .int("Use número inteiro de centavos.")
    .nonnegative("Valor não pode ser negativo.")
    .max(MAX_CENTS, "Valor acima do máximo (R$ 1.000.000)."),
  downPaymentInCents: z
    .number()
    .int("Use número inteiro de centavos.")
    .nonnegative("Entrada não pode ser negativa.")
    .max(MAX_CENTS, "Entrada acima do máximo.")
    .default(0),
  downPaymentNote: optionalText(160),
  noticeText: optionalText(600),
});

function downPaymentRefinement(
  data: { totalInCents: number; downPaymentInCents: number },
  ctx: z.RefinementCtx,
) {
  if (data.downPaymentInCents > data.totalInCents) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["downPaymentInCents"],
      message: "Entrada não pode ser maior que o valor total.",
    });
  }
}

export const createQuoteSheetSchema = quoteSheetFieldsBase.superRefine(
  downPaymentRefinement,
);
export type CreateQuoteSheetInput = z.input<typeof createQuoteSheetSchema>;

export const updateQuoteSheetSchema = quoteSheetFieldsBase
  .extend({
    id: z.string().uuid("Identificador inválido."),
  })
  .superRefine(downPaymentRefinement);
export type UpdateQuoteSheetInput = z.input<typeof updateQuoteSheetSchema>;

export const archiveQuoteSheetSchema = z.object({
  id: z.string().uuid("Identificador inválido."),
});
export type ArchiveQuoteSheetInput = z.infer<typeof archiveQuoteSheetSchema>;

/** Converte string `YYYY-MM-DD` (ou null) pra Date UTC meio-dia.
 *  Meio-dia evita virar o dia anterior em fusos negativos quando o
 *  Postgres serializa como timestamp without time zone. */
export function dateStringToUtcNoon(s: string | null): Date | null {
  if (!s) return null;
  return new Date(`${s}T12:00:00Z`);
}
