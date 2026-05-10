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

/**
 * Helper: normaliza string opcional vinda do form.
 * Trim + "" → null (lojista deixou em branco = sem valor).
 * Aceita também null vindo direto (ex: server prefilling).
 */
const optionalTrimmedString = (max: number, fieldLabel: string) =>
  z
    .union([
      z
        .string()
        .trim()
        .max(max, `${fieldLabel} muito longo (máx ${max}).`),
      z.null(),
    ])
    .transform((v) => (v === null || v === "" ? null : v));

export const variantAxisSchema = z.enum(["size", "color"]);
export type VariantAxis = z.infer<typeof variantAxisSchema>;

export const variantInputSchema = z
  .object({
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
    /**
     * Eixo da variante. "size" renderiza pill com texto; "color" renderiza
     * swatch preenchido por `colorHex`. Default "size" preserva
     * comportamento histórico (todas variantes pré-canvas-v1 são tamanho).
     */
    axis: variantAxisSchema.default("size"),
    /**
     * CSS color string (hex/oklch/rgb). Usado só quando axis="color".
     * Vazio "" → null (lojista limpou). Aceita até 64 chars (cobre
     * "oklch(0.85 0.02 80 / 0.95)" com folga).
     */
    colorHex: optionalTrimmedString(64, "Cor"),
  })
  .refine(
    (v) =>
      v.axis !== "color" || (v.colorHex !== null && v.colorHex.length > 0),
    {
      message: "Informe a cor (ex: #1E3FE6).",
      path: ["colorHex"],
    },
  );
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
  // Meta-fields canvas-v1 (PDP). Todos opcionais; "" → null no transform.
  composition: optionalTrimmedString(120, "Composição"),
  modeling: optionalTrimmedString(120, "Modelagem"),
  lining: optionalTrimmedString(120, "Forro"),
  washing: optionalTrimmedString(120, "Lavagem"),
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
/**
 * RHF: defaultValues = INPUT (pré-transform — `composition` é string `""`).
 * Server: data = OUTPUT (pós-transform — `composition` é `string|null`).
 * Mantemos os 2 tipos exportados pra cada lado importar o seu.
 */
export type ProductFormValues = z.input<typeof productFormFieldsSchema>;
export type ProductFormOutput = z.output<typeof productFormFieldsSchema>;

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
/**
 * Tipo do INPUT da action (pré-Zod-parse). Usamos `z.input<>` porque a action
 * faz `safeParse` internamente — defaults (`axis: "size"`) e transforms
 * (`composition` "" → null) rodam server-side. Se usássemos `z.infer<>`
 * (= output), o form RHF (que carrega `z.input<>`) não tipa-bateria.
 */
export type UpdateProductInput = z.input<typeof updateProductSchema>;

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
