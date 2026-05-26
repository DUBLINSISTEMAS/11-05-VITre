/**
 * Schemas Zod para o domínio `customer` (Fase 3 — ADR-0014).
 *
 * Convenção CLAUDE.md #2: Zod em todos os boundaries. Cliente cadastrado
 * pelo lojista no admin — NÃO confundir com consumidor anônimo do
 * storefront (ADR-0008).
 */
import { z } from "zod";

import { isValidDocument, normalizeDocument } from "@/lib/document";

const E164 = /^\+[1-9][0-9]{6,14}$/;
const UF = /^[A-Z]{2}$/;
const CEP = /^[0-9]{8}$/;

/**
 * String trim + length, ou `null` se vazia. Convenção do MVP: nullable
 * em DB, "" em UI vira `null` na action. `.nullish().transform(v => v ?? null)`
 * mantém o tipo de input opcional pra callers antigos enquanto força
 * tipo de saída `string | null` consistente. Memory:
 * `zod-nullish-transform-for-existing-fixtures.md`.
 */
const optionalString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => {
      const t = v?.trim() ?? "";
      return t === "" ? null : t;
    });

/**
 * Schema base — mesmos campos em create e update. UF normalizada pra
 * uppercase no próprio schema (memory `auditoria-K4` / store schema:
 * normalização vive no boundary, não no action, pra evitar drift).
 */
const customerInputBase = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nome obrigatório.")
    .max(120, "Nome muito longo (máx 120)."),
  phone: z
    .string()
    .trim()
    .regex(E164, "Telefone inválido. Use formato internacional (+5511999999999)."),
  email: z
    .string()
    .trim()
    .max(254)
    .email("E-mail inválido.")
    .nullish()
    .transform((v) => {
      const t = v?.trim() ?? "";
      return t === "" ? null : t;
    })
    .or(
      // Aceita explicit empty string como null (form com input vazio)
      z.literal("").transform(() => null),
    ),
  addressStreet: optionalString(160),
  addressNumber: optionalString(20),
  addressComplement: optionalString(80),
  addressNeighborhood: optionalString(80),
  addressCity: optionalString(80),
  addressState: z
    .string()
    .trim()
    .max(2, "Use 2 letras (ex: MA).")
    .toUpperCase()
    .nullish()
    .transform((v) => {
      const t = v?.trim() ?? "";
      if (t === "") return null;
      return t;
    })
    .refine((v) => v === null || UF.test(v), {
      message: "Use 2 letras (ex: MA).",
    }),
  addressZip: z
    .string()
    .trim()
    .nullish()
    .transform((v) => {
      const t = v?.trim().replace(/\D/g, "") ?? "";
      return t === "" ? null : t;
    })
    .refine((v) => v === null || CEP.test(v), {
      message: "CEP inválido (use 8 dígitos).",
    }),
  notes: optionalString(1000),
  /**
   * ADR-0021 — PF (individual) ou PJ (company). Default individual.
   * Required no schema (sempre vem do form), default cobre callers antigos.
   */
  type: z.enum(["individual", "company"]).default("individual"),
  /**
   * ADR-0021 — CPF (PF, 11 dígitos) ou CNPJ (PJ, 14). Pode chegar
   * mascarado do form ("999.999.999-99") — normalizamos pra só dígitos
   * antes de gravar. Vazio → null. Dígito verificador validado em
   * `documentRefinement` abaixo (cross-field com `type`).
   */
  document: z
    .string()
    .trim()
    .nullish()
    .transform((v) => {
      const digits = normalizeDocument(v ?? undefined);
      return digits === "" ? null : digits;
    }),
  /**
   * Audit 2026-05-26 — atribuição de grupo. Antes o schema do form
   * ignorava `groupId` mesmo com a coluna existindo no DB e FK ativa.
   * Toda a feature de tier wholesale (PDV usa via groupPricingTier)
   * ficava inacessível porque cliente nunca tinha grupo. Agora opcional
   * via select no form. NULL = sem grupo (default).
   */
  groupId: z
    .string()
    .uuid("Grupo inválido.")
    .nullish()
    .transform((v) => v ?? null),
});

/**
 * Validação cruzada documento × tipo. Roda APÓS o `.transform()` acima,
 * então `data.document` já tá normalizado (só dígitos ou null).
 *
 * Extraída como callback nomeado pra reusar entre create/update (memory
 * `zod-v4-zodeffects-not-exported.md` — duplicar inline também é aceito,
 * mas helper com path: string[] simples roda OK no Zod v4).
 */
function documentRefinement(
  data: { type: "individual" | "company"; document: string | null },
  ctx: z.RefinementCtx,
) {
  if (data.document === null) return;
  // Length sanity (DB CHECK também cobre, mas mensagem amigável em app):
  const expectedLen = data.type === "individual" ? 11 : 14;
  if (data.document.length !== expectedLen) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["document"],
      message:
        data.type === "individual"
          ? "CPF deve ter 11 dígitos."
          : "CNPJ deve ter 14 dígitos.",
    });
    return;
  }
  if (!isValidDocument(data.document, data.type)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["document"],
      message:
        data.type === "individual" ? "CPF inválido." : "CNPJ inválido.",
    });
  }
}

export const createCustomerSchema = customerInputBase.superRefine(
  documentRefinement,
);
export type CreateCustomerInput = z.input<typeof createCustomerSchema>;

export const updateCustomerSchema = customerInputBase
  .extend({
    id: z.string().uuid("Identificador inválido."),
  })
  .superRefine(documentRefinement);
export type UpdateCustomerInput = z.input<typeof updateCustomerSchema>;

export const deleteCustomerSchema = z.object({
  customerId: z.string().uuid("Identificador inválido."),
});
export type DeleteCustomerInput = z.infer<typeof deleteCustomerSchema>;
