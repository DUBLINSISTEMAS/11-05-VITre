"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";

import {
  categoryTable,
  productTable,
  productVariantTable,
  stockMovementTable,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { getConstraintName, isUniqueViolation } from "@/lib/db-errors";
import { logger } from "@/lib/logger";
import {
  checkRateLimit,
  RateLimitError,
  rateLimits,
} from "@/lib/rate-limit";
import { generateSlug } from "@/lib/slug";
import { generateUniqueProductSlug } from "@/lib/slug-uniqueness";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

import { type UpdateProductInput,updateProductSchema } from "./schema";

export type UpdateProductResult =
  | { ok: true; productId: string; slug: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Atualiza produto + variantes em UMA transação.
 *
 * Estratégia de variantes (diff por id):
 * - mantidas (com `id`): UPDATE
 * - novas (sem `id`): INSERT
 * - removidas (id existia no banco mas sumiu do array): inativação
 *
 * Por que diff e não delete-insert? Variantes já vendidas podem estar referenciadas
 * em `order_item` e `stock_movement`. Recriar/apagar variant gera id novo,
 * quebra histórico e pode apagar movimentos por cascade. Diff preserva ids existentes.
 *
 * Slug: regenera quando o nome muda, com sufixo `-2/-3/...` se duplicado na loja.
 *
 * Categoria: valida que pertence à mesma loja (defesa em profundidade — RLS já
 * impediria, mas falha cedo dá mensagem melhor).
 */
export async function updateProduct(
  input: UpdateProductInput,
): Promise<UpdateProductResult> {
  const requestHeaders = await headers();

  // 1. Auth
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user) {
    return { ok: false, error: "Sessão expirada. Faça login novamente." };
  }
  const userId = session.user.id;

  // 2. Rate limit
  try {
    await checkRateLimit(rateLimits.mutation, userId);
  } catch (e) {
    if (e instanceof RateLimitError) return { ok: false, error: e.message };
    throw e;
  }

  // 3. Validação Zod (com fieldErrors pra UI mostrar inline)
  const parsed = updateProductSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (!fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return {
      ok: false,
      error: "Confira os campos destacados.",
      fieldErrors,
    };
  }
  const data = parsed.data;

  // 4. Resolve loja
  const store = await getCurrentStore(userId);
  if (!store) return { ok: false, error: "Loja não encontrada." };

  // 5–8. Toda lógica de DB roda dentro de withTenant — RLS aplicada via GUC.
  type StepResult =
    | { ok: true; nextSlug: string }
    | { ok: false; error: string; fieldErrors?: Record<string, string> };

  let stepResult: StepResult;
  try {
    stepResult = await withTenant(store.id, userId, async (tx) => {
      // 5. Verifica que produto pertence à loja
      const existing = await tx.query.productTable.findFirst({
        where: and(
          eq(productTable.id, data.productId),
          eq(productTable.storeId, store.id),
        ),
        columns: {
          id: true,
          slug: true,
          name: true,
          trackStock: true,
          stockQuantity: true,
        },
      });
      if (!existing) {
        return { ok: false, error: "Produto não encontrado." } as const;
      }

      // 6. Valida categoria (se informada) pertence à loja
      if (data.categoryId) {
        const cat = await tx.query.categoryTable.findFirst({
          where: and(
            eq(categoryTable.id, data.categoryId),
            eq(categoryTable.storeId, store.id),
          ),
          columns: { id: true },
        });
        if (!cat) {
          return {
            ok: false,
            error: "Categoria não encontrada.",
            fieldErrors: { categoryId: "Categoria inválida." },
          } as const;
        }
      }

      // 7. Slug: regenera se o slug-base do nome mudou OU se ainda é placeholder
      // de draft. Caso contrário mantém o atual — URL pública é estável e não
      // quebra links já compartilhados via WhatsApp pelo lojista.
      const isDraftSlug = existing.slug.startsWith("draft-");
      const slugBaseChanged =
        generateSlug(existing.name) !== generateSlug(data.name);
      let nextSlug = existing.slug;
      if (isDraftSlug || slugBaseChanged) {
        nextSlug = await generateUniqueProductSlug({
          storeId: store.id,
          name: data.name,
          excludeProductId: data.productId,
          client: tx,
        });
      }

      const productStockDelta =
        data.variants.length === 0 && data.trackStock
          ? (data.stockQuantity ?? 0) - (existing.stockQuantity ?? 0)
          : 0;
      const nextProductStockCache = data.trackStock
        ? existing.stockQuantity ?? 0
        : null;

      // 8. Mutação: produto + variantes (diff). Defesa em profundidade:
      // todo WHERE carrega `storeId` mesmo com RLS já filtrando.
      await tx
        .update(productTable)
        .set({
          name: data.name,
          slug: nextSlug,
          description: data.description,
          basePriceInCents: data.basePriceInCents,
          wholesalePriceInCents: data.wholesalePriceInCents,
          promoPriceInCents: data.promoPriceInCents,
          categoryId: data.categoryId,
          trackStock: data.trackStock,
          stockQuantity: nextProductStockCache,
          installmentsOverride: data.installmentsOverride,
          cashDiscountOverrideBps: data.cashDiscountOverrideBps,
          isActive: data.isActive,
          isFeatured: data.isFeatured,
          isPublishedToStorefront: data.isPublishedToStorefront,
          // Meta-fields canvas-v1 — null quando lojista deixou em branco
          // (Zod transform "" → null já normalizou).
          composition: data.composition,
          modeling: data.modeling,
          lining: data.lining,
          washing: data.washing,
          // ADR-0034 Camada 2 — campos de gestão.
          costPriceInCents: data.costPriceInCents,
          minStockQuantity: data.minStockQuantity,
          maxStockQuantity: data.maxStockQuantity,
          gtin: data.gtin,
          brand: data.brand,
          unit: data.unit,
          internalCode: data.internalCode,
          defaultCommissionBps: data.defaultCommissionBps,
          ncm: data.ncm,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(productTable.id, data.productId),
            eq(productTable.storeId, store.id),
          ),
        );

      if (productStockDelta !== 0) {
        await tx.insert(stockMovementTable).values({
          storeId: store.id,
          productId: data.productId,
          variantId: null,
          movementType: "adjustment",
          quantityDelta: productStockDelta,
          referenceType: "manual",
          notes: "Ajuste de estoque pelo editor do produto.",
          createdBy: userId,
        });
      }

      // --- Diff de variantes ---
      const incomingWithId = data.variants.filter((v) => v.id);
      const incomingNew = data.variants.filter((v) => !v.id);

      const dbVariants = await tx
        .select({
          id: productVariantTable.id,
          stockQuantity: productVariantTable.stockQuantity,
        })
        .from(productVariantTable)
        .where(
          and(
            eq(productVariantTable.productId, data.productId),
            eq(productVariantTable.storeId, store.id),
          ),
        );

      const dbIds = new Set(dbVariants.map((v) => v.id));
      const dbVariantById = new Map(dbVariants.map((v) => [v.id, v]));
      const incomingIds = new Set(incomingWithId.map((v) => v.id!));

      const toDeactivate = [...dbIds].filter((id) => !incomingIds.has(id));
      if (toDeactivate.length > 0) {
        await tx
          .update(productVariantTable)
          .set({
            isActive: false,
            trackStock: false,
            stockQuantity: null,
          })
          .where(
            and(
              inArray(productVariantTable.id, toDeactivate),
              eq(productVariantTable.productId, data.productId),
              eq(productVariantTable.storeId, store.id),
            ),
          );
      }

      for (const v of incomingWithId) {
        const currentVariantStock = dbVariantById.get(v.id!)?.stockQuantity ?? 0;
        const nextVariantStock = v.stockQuantity ?? 0;
        const delta = v.stockQuantity !== null ? nextVariantStock - currentVariantStock : 0;

        await tx
          .update(productVariantTable)
          .set({
            name: v.name,
            priceInCents: v.priceInCents,
            stockQuantity: v.stockQuantity !== null ? currentVariantStock : null,
            trackStock: v.stockQuantity !== null,
            // Eixo canvas-v1: zera colorHex quando axis="size" pra não
            // arrastar valor antigo se lojista trocou tamanho ↔ cor.
            axis: v.axis,
            colorHex: v.axis === "color" ? v.colorHex : null,
            featuredImageId: v.featuredImageId,
          })
          .where(
            and(
              eq(productVariantTable.id, v.id!),
              eq(productVariantTable.productId, data.productId),
              eq(productVariantTable.storeId, store.id),
            ),
          );

        if (delta !== 0) {
          await tx.insert(stockMovementTable).values({
            storeId: store.id,
            productId: data.productId,
            variantId: v.id!,
            movementType: "adjustment",
            quantityDelta: delta,
            referenceType: "manual",
            notes: "Ajuste de estoque pelo editor do produto.",
            createdBy: userId,
          });
        }
      }

      if (incomingNew.length > 0) {
        const createdVariants = await tx
          .insert(productVariantTable)
          .values(
            incomingNew.map((v) => ({
              storeId: store.id,
              productId: data.productId,
              name: v.name,
              priceInCents: v.priceInCents,
              stockQuantity: v.stockQuantity !== null ? 0 : null,
              trackStock: v.stockQuantity !== null,
              axis: v.axis,
              colorHex: v.axis === "color" ? v.colorHex : null,
              featuredImageId: v.featuredImageId,
            })),
          )
          .returning({ id: productVariantTable.id });

        const movements = createdVariants.flatMap((variant, index) => {
          const initial = incomingNew[index]?.stockQuantity ?? 0;
          if (initial <= 0) return [];
          return [{
            storeId: store.id,
            productId: data.productId,
            variantId: variant.id,
            movementType: "initial" as const,
            quantityDelta: initial,
            referenceType: "manual",
            notes: "Saldo inicial cadastrado na variante.",
            createdBy: userId,
          }];
        });

        if (movements.length > 0) {
          await tx.insert(stockMovementTable).values(movements);
        }
      }

      return { ok: true, nextSlug } as const;
    });
  } catch (e) {
    // Tradução de unique violation no slug (lojista-friendly)
    if (isUniqueViolation(e)) {
      const constraint = getConstraintName(e);
      if (constraint === "product_store_slug_unique") {
        return {
          ok: false,
          error:
            "Outro produto com nome muito parecido foi cadastrado agora. Mude levemente o nome e salve de novo.",
          fieldErrors: { name: "Nome em uso por outro produto." },
        };
      }
    }
    logger.error("product.update.tx_failed", {
      err: e,
      storeId: store.id,
      productId: data.productId,
    });
    return { ok: false, error: "Falha ao salvar. Tente novamente." };
  }

  if (!stepResult.ok) return stepResult;

  // 9. Invalida caches: admin (lista) + storefront público
  revalidatePath("/admin/produtos");
  revalidatePath("/admin/estoque");
  revalidateTag(`store-${store.slug}`);

  return { ok: true, productId: data.productId, slug: stepResult.nextSlug };
}
