/**
 * Schemas Zod do domínio supplier (Sprint 2C).
 *
 * Estrutura espelha customer/schema.ts (document opcional CPF/CNPJ
 * sem máscara, endereço opcional, phone opcional).
 */
import { z } from "zod";

import { isValidCnpj, isValidCpf, normalizeDocument } from "@/lib/document";

/** "" → null para campos texto opcionais. */
const optText = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().trim().max(max).nullable(),
  );

/** Documento CPF (11) ou CNPJ (14), sem máscara. Valida dígito verificador. */
const optDocument = z
  .preprocess(
    (v) => {
      if (typeof v !== "string") return v;
      const trimmed = v.trim();
      if (trimmed === "") return null;
      return normalizeDocument(trimmed);
    },
    z.string().nullable(),
  )
  .superRefine((value, ctx) => {
    if (value === null || value === undefined) return;
    if (value.length === 11) {
      if (!isValidCpf(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "CPF inválido.",
        });
      }
    } else if (value.length === 14) {
      if (!isValidCnpj(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "CNPJ inválido.",
        });
      }
    } else {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Documento deve ter 11 (CPF) ou 14 (CNPJ) dígitos.",
      });
    }
  });

export const upsertSupplierSchema = z.object({
  id: z.string().uuid().nullable(),
  name: z.string().trim().min(1, "Nome obrigatório").max(120),
  document: optDocument,
  phone: optText(40),
  email: optText(120),
  addressStreet: optText(200),
  addressNumber: optText(20),
  addressComplement: optText(80),
  addressNeighborhood: optText(80),
  addressCity: optText(80),
  addressState: z.preprocess(
    (v) => {
      if (typeof v !== "string") return v;
      const trimmed = v.trim().toUpperCase();
      return trimmed === "" ? null : trimmed;
    },
    z
      .string()
      .length(2, "UF deve ter 2 letras")
      .regex(/^[A-Z]{2}$/, "UF inválida")
      .nullable(),
  ),
  addressZip: z.preprocess(
    (v) => {
      if (typeof v !== "string") return v;
      const digits = v.replace(/\D/g, "");
      return digits === "" ? null : digits;
    },
    z
      .string()
      .regex(/^\d{8}$/, "CEP deve ter 8 dígitos")
      .nullable(),
  ),
  notes: optText(500),
  isActive: z.boolean().default(true),
});
export type UpsertSupplierInput = z.input<typeof upsertSupplierSchema>;

export const deleteSupplierSchema = z.object({
  id: z.string().uuid(),
});
