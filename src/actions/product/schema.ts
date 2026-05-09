/**
 * Schemas Zod do domínio `product`. Single source of truth pro client e server.
 */
import { z } from "zod";

// ---------- Imagem (já existentes) ----------

export const uploadProductImageSchema = z.object({
  productId: z.string().uuid("ID de produto inválido."),
});
export type UploadProductImageInput = z.infer<typeof uploadProductImageSchema>;

export const deleteProductImageSchema = z.object({
  imageId: z.string().uuid("ID de imagem inválido."),
});
export type DeleteProductImageInput = z.infer<typeof deleteProductImageSchema>;

export const reorderProductImagesSchema = z.object({
  productId: z.string().uuid(),
  orderedImageIds: z.array(z.string().uuid()).min(1).max(5),
});
export type ReorderProductImagesInput = z.infer<typeof reorderProductImagesSchema>;

// ---------- Variante (input do form, antes de persistir) ----------

export const variantInputSchema = z.object({
  /** Presente quando já está no banco; ausente em variante nova. */
  id: z.string().uuid().optional(),
  /**
   * Id estável client-side (gerado em adições novas). Server ignora — só
   * existe para o React keyear linhas no editor. Mantido no schema pra
   * Zod não strip-ar e quebrar estabilidade durante re-renders.
   */
  tempId: z.string().optional(),
  name: z
    .string()
    .trim()
    .min(1, "Nome da variante não pode ficar em branco.")
    .max(40, "Nome muito longo (máx 40)."),
  /** centavos. null = usa basePriceInCents do produto. */
  priceInCents: z
    .number()
    .int()
    .min(0, "Preço não pode ser negativo.")
    .max(999_999_999, "Preço acima do máximo permitido.")
    .nullable(),
  /** null = sem controle de estoque pra esta variante (herda do produto). */
  stockQuantity: z
    .number()
    .int()
    .min(0, "Estoque não pode ser negativo.")
    .nullable(),
});
export type VariantInput = z.infer<typeof variantInputSchema>;

// ---------- Update produto ----------

/**
 * Campos do form do produto. Reaproveitados pelo RHF (client) e pela action
 * server (que apenas adiciona `productId`). Os 2 refines abaixo precisam
 * ser aplicados nos dois lados — sem isso, Sandra preencheria promo > base
 * e só veria o erro depois do submit.
 */
const productFormFieldsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nome muito curto.")
    .max(120, "Nome muito longo (máx 120)."),
  description: z
    .string()
    .trim()
    .max(2000, "Descrição muito longa (máx 2000)."),
  basePriceInCents: z
    .number()
    .int()
    .min(0, "Preço não pode ser negativo.")
    .max(999_999_999, "Preço acima do máximo permitido."),
  promoPriceInCents: z
    .number()
    .int()
    .min(0, "Preço promocional não pode ser negativo.")
    .nullable(),
  categoryId: z.string().uuid().nullable(),
  trackStock: z.boolean(),
  stockQuantity: z
    .number()
    .int()
    .min(0, "Estoque não pode ser negativo.")
    .nullable(),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
  variants: z.array(variantInputSchema).max(20, "Máximo de 20 variantes."),
});

/** Schema do form (sem `productId`) — usado pelo RHF no client. */
export const productFormSchema = productFormFieldsSchema
  .refine(
    (v) =>
      v.promoPriceInCents === null ||
      v.promoPriceInCents < v.basePriceInCents,
    {
      message: "Preço promocional precisa ser menor que o preço normal.",
      path: ["promoPriceInCents"],
    },
  )
  .refine((v) => !v.trackStock || v.stockQuantity !== null, {
    message: "Informe a quantidade em estoque.",
    path: ["stockQuantity"],
  });
export type ProductFormValues = z.infer<typeof productFormFieldsSchema>;

/** Schema da action — adiciona `productId` e reaplica refines. */
export const updateProductSchema = productFormFieldsSchema
  .extend({ productId: z.string().uuid() })
  .refine(
    (v) =>
      v.promoPriceInCents === null ||
      v.promoPriceInCents < v.basePriceInCents,
    {
      message: "Preço promocional precisa ser menor que o preço normal.",
      path: ["promoPriceInCents"],
    },
  )
  .refine((v) => !v.trackStock || v.stockQuantity !== null, {
    message: "Informe a quantidade em estoque.",
    path: ["stockQuantity"],
  });
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

// ---------- Toggle ativo / Delete ----------

export const toggleActiveSchema = z.object({
  productId: z.string().uuid(),
  isActive: z.boolean(),
});
export type ToggleActiveInput = z.infer<typeof toggleActiveSchema>;

export const deleteProductSchema = z.object({
  productId: z.string().uuid(),
});
export type DeleteProductInput = z.infer<typeof deleteProductSchema>;
