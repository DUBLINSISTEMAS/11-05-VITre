/**
 * Schemas Zod do domínio `product`. Single source of truth pro client e server.
 */
import { z } from "zod";

// ---------- Imagem (já existentes) ----------

export const uploadProductImageSchema = z.object({
  productId: z.string().uuid("ID de produto inválido."),
});
export const deleteProductImageSchema = z.object({
  imageId: z.string().uuid("ID de imagem inválido."),
});
export const reorderProductImagesSchema = z.object({
  productId: z.string().uuid(),
  orderedImageIds: z.array(z.string().uuid()).min(1).max(5),
});
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
    .optional()
    .transform((v) => (v == null || v === "" ? null : v));

export const variantAxisSchema = z.enum(["size", "color"]);
export type VariantAxis = z.infer<typeof variantAxisSchema>;

/**
 * ADR-0034 Camada 2 — unidade de venda do produto. Espelha DB enum
 * `product_unit`. Default `un` cobre 95% varejo SMB BR.
 */
export const productUnitSchema = z.enum([
  "un",
  "pc",
  "kg",
  "g",
  "m",
  "cm",
  "ml",
  "L",
  "m2",
  "m3",
  // Onda 2.10 — glossário CLAUDE.md.
  "par",
  "duzia",
]);
export type ProductUnit = z.infer<typeof productUnitSchema>;

/**
 * ADR-0034 Camada 2 — helpers de validação Zod pros campos novos.
 * Replicam CHECKs do DB (SQLs 44 e 48) pra dar feedback no form sem
 * round-trip ao server. Database continua sendo a SoT — se algo passa
 * por aqui mas viola CHECK, action retorna erro.
 */

/** Inteiro nullable não-negativo em centavos. */
const optionalNonnegativeIntInCents = (fieldLabel: string) =>
  z
    .number()
    .int("Use um número inteiro.")
    .min(0, `${fieldLabel} não pode ser negativo.`)
    .max(999_999_999, `${fieldLabel} acima do máximo permitido.`)
    .nullish()
    .transform((v) => v ?? null);

/** Quantidade inteira nullable não-negativa. */
const optionalNonnegativeQuantity = (fieldLabel: string) =>
  z
    .number()
    .int("Use um número inteiro.")
    .min(0, `${fieldLabel} não pode ser negativo.`)
    .nullish()
    .transform((v) => v ?? null);

/**
 * GTIN — só dígitos, 8/12/13/14. Vazio "" / undefined / null → null.
 * `.optional()` é o jeito canônico do Zod aceitar undefined; sem isso,
 * qualquer caller que passa objeto sem `gtin` quebra antes mesmo dos
 * refines de validação semântica. Alinha com os outros campos opcionais
 * (wholesalePriceInCents, brandId, defaultCommissionBps, etc.).
 */
const optionalGtin = z
  .union([
    z
      .string()
      .trim()
      .regex(/^[0-9]+$/, "Use apenas dígitos.")
      .refine((s) => [8, 12, 13, 14].includes(s.length), {
        message: "GTIN precisa ter 8, 12, 13 ou 14 dígitos.",
      }),
    z.literal(""),
    z.null(),
  ])
  .optional()
  .transform((v) => (v == null || v === "" ? null : v));

/** NCM — só dígitos, 8 caracteres exatos. Vazio / undefined / null → null. */
const optionalNcm = z
  .union([
    z
      .string()
      .trim()
      .regex(/^[0-9]{8}$/, "NCM precisa ter exatamente 8 dígitos."),
    z.literal(""),
    z.null(),
  ])
  .optional()
  .transform((v) => (v == null || v === "" ? null : v));

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
    /**
     * Foto destacada da variante (padrão Shopify): quando cliente
     * seleciona essa variação no PDP, galeria scrolla pra essa imagem.
     * NULL = usa primeira imagem do produto (padrão).
     */
    featuredImageId: z
      .union([z.string().uuid(), z.null()])
      .default(null),
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
 * ser aplicados nos dois lados — sem isso, lojista preencheria promo > base
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
  /**
   * ADR-0034 Camada 2 — preço de atacado em centavos. NULL = não configurado.
   * CHECK wholesale <= base no DB (SQL 48); refine no Zod abaixo replica
   * pra feedback em tempo real.
   */
  wholesalePriceInCents: optionalNonnegativeIntInCents("Preço de atacado"),
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
  /**
   * Onda 2.15 — permite venda mesmo com saldo zerado (encomenda).
   * Default false. Só faz sentido quando trackStock=true; quando
   * trackStock=false, o estoque já é ilimitado.
   */
  allowOversell: z.boolean().default(false),
  /**
   * Override de max-parcelas APENAS deste produto. null = usa default
   * da loja (`store.cardMaxInstallments`). Range 1..12 (CHECK no
   * SQL 17). Fase 2 / ADR-0013.
   *
   * `.nullish().default(null)`: input opcional (callers antigos +
   * fixtures não precisam passar); output garante `null` ou `number`.
   */
  installmentsOverride: z
    .number()
    .int("Use um número inteiro.")
    .min(1, "Mínimo 1 parcela.")
    .max(12, "Máximo 12 parcelas.")
    .nullish()
    .transform((v) => v ?? null),
  /**
   * Override de desconto à vista APENAS deste produto, em basis points.
   * null = usa default da loja (`store.cashDiscountBps`). 0 também é
   * override válido (= sem desconto neste produto mesmo que loja ofereça).
   * Range 0..9999 (CHECK no SQL 18). Fase 2 / ADR-0013.
   *
   * Mesmo padrão `.nullish().transform()` de `installmentsOverride` —
   * memory `zod-nullish-transform-for-existing-fixtures.md`.
   */
  cashDiscountOverrideBps: z
    .number()
    .int("Use um número inteiro.")
    .min(0, "Não pode ser negativo.")
    .max(9999, "Máximo 99.99%.")
    .nullish()
    .transform((v) => v ?? null),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
  /**
   * ADR-0030 (Frente B) — Publicado na loja online?
   * Default true em fixtures antigas via `.default(true)` no input schema.
   * isActive=true && isPublishedToStorefront=false → produto existe pra
   * estoque/PDV/relatórios mas NÃO aparece no storefront público.
   */
  isPublishedToStorefront: z.boolean().default(true),
  // Meta-fields canvas-v1 (PDP). Todos opcionais; "" → null no transform.
  composition: optionalTrimmedString(120, "Composição"),
  modeling: optionalTrimmedString(120, "Modelagem"),
  lining: optionalTrimmedString(120, "Forro"),
  washing: optionalTrimmedString(120, "Lavagem"),
  variants: z.array(variantInputSchema).max(20, "Máximo de 20 variantes."),

  // =====================================================================
  // ADR-0034 Camada 2 — campos de gestão (custo, estoque mín/máx, GTIN,
  // marca, unidade, código interno, comissão padrão, NCM). Todos opcionais
  // — UI mostra warning quando custo está NULL ("margem desconhecida").
  // =====================================================================

  /** Preço de custo em centavos. NULL = lojista ainda não cadastrou. */
  costPriceInCents: optionalNonnegativeIntInCents("Preço de custo"),
  /** Estoque mínimo — dispara alerta de reposição em /admin/estoque/baixo. */
  minStockQuantity: optionalNonnegativeQuantity("Estoque mínimo"),
  /** Estoque máximo — projeção de compra. CHECK max >= min no DB (SQL 44). */
  maxStockQuantity: optionalNonnegativeQuantity("Estoque máximo"),
  /** GTIN (EAN-8/12/13 ou DUN-14). Só dígitos, sem máscara. */
  gtin: optionalGtin,
  /**
   * Marca como texto. Sprint 2A: vira snapshot histórico do nome da marca
   * no momento do save. Quando lojista escolhe do select de marcas
   * cadastradas, gravamos AMBOS brandId + brand (nome). Quando digita
   * texto livre (sem escolher), brandId=null e brand=texto.
   */
  brand: optionalTrimmedString(80, "Marca"),
  /**
   * Sprint 2A: FK opcional pra brand.id. NULL quando lojista digitou
   * texto livre. Aceita UUID ou null.
   */
  brandId: z
    .string()
    .uuid()
    .nullish()
    .transform((v) => v ?? null),
  /** Unidade de venda. Default 'un'. */
  unit: productUnitSchema.default("un"),
  /** Código interno do lojista (SKU manual / código de etiqueta). */
  internalCode: optionalTrimmedString(60, "Código interno"),
  /**
   * Comissão padrão de vendedor em basis points (0..10000 = 0..100%).
   * NULL = sem comissão configurada pra este produto. UI mostra "%" no
   * input mas grava em bps (input 5.5 → 550 bps).
   */
  defaultCommissionBps: z
    .number()
    .int("Use um número inteiro.")
    .min(0, "Comissão não pode ser negativa.")
    .max(10000, "Comissão máxima 100%.")
    .nullish()
    .transform((v) => v ?? null),
  /**
   * NCM brasileiro pra integração futura com Bling/Tiny. Texto livre 8
   * dígitos. Mangos Pay NÃO valida tabela TIPI nem calcula imposto (ADR-0033).
   */
  ncm: optionalNcm,
  /**
   * S2.7 (2026-05-26) — peso em gramas. 3 casas decimais.
   * Joalheria reprecifica por grama. Range 0..100000g.
   * Drizzle numeric() = string ao ler; aceita number no input pra UX.
   */
  weightGrams: z
    .union([z.number(), z.string(), z.null()])
    .nullish()
    .transform((v) => {
      if (v === null || v === undefined || v === "") return null;
      const n = typeof v === "string" ? parseFloat(v) : v;
      return Number.isFinite(n) ? n : null;
    })
    .pipe(
      z
        .number()
        .min(0, "Peso não pode ser negativo.")
        .max(100000, "Peso acima do máximo (100kg).")
        .nullable(),
    ),
});

// ⚠️ MANTENHA SINCRONIZADO: estes 4 refines aparecem em
// `productFormSchema` E `updateProductSchema`. Auditoria K1 (2026-05-12)
// tentou centralizar num helper genérico, mas Zod v4 não exporta
// `ZodEffects` como nome simples — a tipagem do helper engole inferência
// e quebra `z.input<>`/`z.output<>` nos callers. Duplicação ficou como
// trade-off aceito; checklist quando alterar: confira AMBOS.
const PROMO_LESS_THAN_BASE = (v: {
  basePriceInCents: number;
  promoPriceInCents: number | null;
}) =>
  v.promoPriceInCents === null ||
  v.promoPriceInCents < v.basePriceInCents;
const PROMO_LESS_THAN_BASE_MSG: { message: string; path: string[] } = {
  message: "Preço promocional precisa ser menor que o preço normal.",
  path: ["promoPriceInCents"],
};
const STOCK_REQUIRED_WHEN_TRACKED = (v: {
  trackStock: boolean;
  stockQuantity: number | null;
}) => !v.trackStock || v.stockQuantity !== null;
const STOCK_REQUIRED_MSG: { message: string; path: string[] } = {
  message: "Informe a quantidade em estoque.",
  path: ["stockQuantity"],
};
const ACTIVE_REQUIRES_PRICE = (v: {
  isActive: boolean;
  basePriceInCents: number;
}) => !v.isActive || v.basePriceInCents > 0;
const ACTIVE_REQUIRES_PRICE_MSG: { message: string; path: string[] } = {
  message: "Informe um preço maior que zero para publicar.",
  path: ["basePriceInCents"],
};
const SINGLE_VARIANT_AXIS = (v: { variants: Array<{ axis: VariantAxis }> }) => {
  if (v.variants.length <= 1) return true;
  const firstAxis = v.variants[0]?.axis;
  return v.variants.every((variant) => variant.axis === firstAxis);
};
const SINGLE_VARIANT_AXIS_MSG: { message: string; path: string[] } = {
  message: "Use apenas um tipo de variante por produto: tamanho ou cor.",
  path: ["variants"],
};
/** ADR-0034 Camada 2 — atacado nunca pode ser maior que varejo (CHECK no SQL 48). */
const WHOLESALE_LTE_BASE = (v: {
  basePriceInCents: number;
  wholesalePriceInCents: number | null;
}) =>
  v.wholesalePriceInCents === null ||
  v.wholesalePriceInCents <= v.basePriceInCents;
const WHOLESALE_LTE_BASE_MSG: { message: string; path: string[] } = {
  message: "Preço de atacado precisa ser menor ou igual ao preço de venda.",
  path: ["wholesalePriceInCents"],
};
/** ADR-0034 Camada 2 — estoque máximo >= mínimo (CHECK no SQL 44). */
const MAX_STOCK_GTE_MIN = (v: {
  minStockQuantity: number | null;
  maxStockQuantity: number | null;
}) =>
  v.minStockQuantity === null ||
  v.maxStockQuantity === null ||
  v.maxStockQuantity >= v.minStockQuantity;
const MAX_STOCK_GTE_MIN_MSG: { message: string; path: string[] } = {
  message: "Estoque máximo precisa ser maior ou igual ao mínimo.",
  path: ["maxStockQuantity"],
};

/** Schema do form (sem `productId`) — usado pelo RHF no client. */
export const productFormSchema = productFormFieldsSchema
  .refine(PROMO_LESS_THAN_BASE, PROMO_LESS_THAN_BASE_MSG)
  .refine(STOCK_REQUIRED_WHEN_TRACKED, STOCK_REQUIRED_MSG)
  .refine(ACTIVE_REQUIRES_PRICE, ACTIVE_REQUIRES_PRICE_MSG)
  .refine(SINGLE_VARIANT_AXIS, SINGLE_VARIANT_AXIS_MSG)
  .refine(WHOLESALE_LTE_BASE, WHOLESALE_LTE_BASE_MSG)
  .refine(MAX_STOCK_GTE_MIN, MAX_STOCK_GTE_MIN_MSG);
/**
 * RHF: defaultValues = INPUT (pré-transform — `composition` é string `""`).
 * Server: data = OUTPUT (pós-transform — `composition` é `string|null`).
 * Mantemos os 2 tipos exportados pra cada lado importar o seu.
 */
export type ProductFormValues = z.input<typeof productFormFieldsSchema>;
/** Schema da action — adiciona `productId` e reaplica refines (ver nota
 *  acima sobre duplicação intencional). */
export const updateProductSchema = productFormFieldsSchema
  .extend({ productId: z.string().uuid() })
  .refine(PROMO_LESS_THAN_BASE, PROMO_LESS_THAN_BASE_MSG)
  .refine(STOCK_REQUIRED_WHEN_TRACKED, STOCK_REQUIRED_MSG)
  .refine(ACTIVE_REQUIRES_PRICE, ACTIVE_REQUIRES_PRICE_MSG)
  .refine(SINGLE_VARIANT_AXIS, SINGLE_VARIANT_AXIS_MSG)
  .refine(WHOLESALE_LTE_BASE, WHOLESALE_LTE_BASE_MSG)
  .refine(MAX_STOCK_GTE_MIN, MAX_STOCK_GTE_MIN_MSG);
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

// ---------- Bulk actions (Lote 3 — canvas tabela densa) ----------

/** Limite por chamada — protege contra abuso e mantém transação curta. */
export const BULK_PRODUCTS_MAX = 100;

export const bulkToggleActiveSchema = z.object({
  productIds: z
    .array(z.string().uuid())
    .min(1, "Selecione pelo menos um produto.")
    .max(
      BULK_PRODUCTS_MAX,
      `Máximo ${BULK_PRODUCTS_MAX} produtos por vez.`,
    ),
  isActive: z.boolean(),
});
export type BulkToggleActiveInput = z.infer<typeof bulkToggleActiveSchema>;

export const bulkDeleteProductsSchema = z.object({
  productIds: z
    .array(z.string().uuid())
    .min(1, "Selecione pelo menos um produto.")
    .max(
      BULK_PRODUCTS_MAX,
      `Máximo ${BULK_PRODUCTS_MAX} produtos por vez.`,
    ),
});
export type BulkDeleteProductsInput = z.infer<typeof bulkDeleteProductsSchema>;

// ---------- Bulk update custo (ADR-0034 Camada 2 — /admin/produtos/custos) ----------

/**
 * Linha do batch de atualização de custo. Cada linha representa um produto
 * que o lojista editou na grid bulk-edit. Linhas com `null` em ambos os
 * campos viram no-op (lojista limpou ambos os campos).
 *
 * `costPriceInCents` undefined = "não tocou" (mantém valor atual no DB).
 * `costPriceInCents` null = "limpou explicitamente" (zera no DB).
 * Mesma semântica pra `defaultCommissionBps`.
 */
export const productCostBatchRowSchema = z.object({
  productId: z.string().uuid(),
  costPriceInCents: z
    .number()
    .int()
    .min(0, "Custo não pode ser negativo.")
    .max(999_999_999, "Custo acima do máximo permitido.")
    .nullable()
    .optional(),
  defaultCommissionBps: z
    .number()
    .int()
    .min(0, "Comissão não pode ser negativa.")
    .max(10000, "Comissão máxima 100%.")
    .nullable()
    .optional(),
});
export type ProductCostBatchRow = z.infer<typeof productCostBatchRowSchema>;

export const updateProductCostBatchSchema = z.object({
  rows: z
    .array(productCostBatchRowSchema)
    .min(1, "Nenhuma alteração pra salvar.")
    .max(
      BULK_PRODUCTS_MAX,
      `Máximo ${BULK_PRODUCTS_MAX} produtos por vez.`,
    ),
});
export type UpdateProductCostBatchInput = z.infer<
  typeof updateProductCostBatchSchema
>;
