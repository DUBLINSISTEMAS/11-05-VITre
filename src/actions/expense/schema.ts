/**
 * Schemas Zod do domínio expense (S2.1).
 *
 * Convenções:
 *   - `amountInCents` integer positivo (sem valor negativo aceito).
 *   - `paidAt` ou `dueDate` obrigatório pelo menos um (CHECK no SQL 75).
 *   - `recurring` quando true, app gera 12 entries no insert (não 1).
 *   - `category` enum fixo — facilita relatório por categoria.
 */
import { z } from "zod";

export const EXPENSE_CATEGORIES = [
  "rent",
  "payroll",
  "utilities",
  "supplies",
  "marketing",
  "tax",
  "card_fees",
  "other",
] as const;

export const expenseCategorySchema = z.enum(EXPENSE_CATEGORIES);
export type ExpenseCategory = z.infer<typeof expenseCategorySchema>;

export const CATEGORY_LABEL_BR: Record<ExpenseCategory, string> = {
  rent: "Aluguel",
  payroll: "Salário/comissão",
  utilities: "Luz/água/internet",
  supplies: "Materiais de consumo",
  marketing: "Marketing/ads",
  tax: "Impostos",
  card_fees: "Taxas de maquininha",
  other: "Outro",
};

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

const expenseFieldsSchema = z.object({
  category: expenseCategorySchema.default("other"),
  amountInCents: z
    .number()
    .int("Use número inteiro de centavos.")
    .positive("Valor deve ser maior que zero.")
    .max(1_000_000_00, "Valor acima do máximo (R$ 1.000.000)."),
  paidAt: dateOrNull,
  dueDate: dateOrNull,
  supplierId: z
    .string()
    .uuid()
    .nullish()
    .transform((v) => v ?? null),
  /** true = repetir mensalmente (gera 12 entries). UI passa esse flag. */
  recurring: z.boolean().default(false),
  notes: z
    .preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? null : v),
      z.string().trim().max(500).nullable(),
    )
    .default(null),
});

export const createExpenseSchema = expenseFieldsSchema.refine(
  (d) => d.paidAt !== null || d.dueDate !== null,
  {
    message: "Informe a data de pagamento ou de vencimento.",
    path: ["paidAt"],
  },
);
export type CreateExpenseInput = z.input<typeof createExpenseSchema>;

export const updateExpenseSchema = expenseFieldsSchema
  .extend({
    id: z.string().uuid(),
  })
  .refine((d) => d.paidAt !== null || d.dueDate !== null, {
    message: "Informe a data de pagamento ou de vencimento.",
    path: ["paidAt"],
  });
export type UpdateExpenseInput = z.input<typeof updateExpenseSchema>;

export const deleteExpenseSchema = z.object({
  id: z.string().uuid(),
});

export const listExpensesSchema = z.object({
  /** ISO date inclusive. */
  from: z.string().date().optional(),
  /** ISO date inclusive. */
  to: z.string().date().optional(),
  category: expenseCategorySchema.optional(),
  paid: z.enum(["all", "paid", "pending"]).default("all"),
});
export type ListExpensesInput = z.input<typeof listExpensesSchema>;
