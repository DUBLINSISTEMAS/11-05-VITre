"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";

import { productTable, productVariantTable, stockMovementTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  checkRateLimit,
  RateLimitError,
  rateLimits,
} from "@/lib/rate-limit";
import { generateUniqueProductSlug } from "@/lib/slug-uniqueness";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

import {
  applyKindOverrides,
  productFormSchema,
  type ProductFormValues,
} from "./schema";

export type CreateProductFromValuesResult =
  | { ok: true; productId: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function createProductFromValues(
  input: ProductFormValues,
): Promise<CreateProductFromValuesResult> {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user) {
    return { ok: false, error: "Sessão expirada. Faça login novamente." };
  }
  const userId = session.user.id;

  try {
    await checkRateLimit(rateLimits.mutation, userId);
  } catch (e) {
    if (e instanceof RateLimitError) return { ok: false, error: e.message };
    throw e;
  }

  const parsed = productFormSchema.safeParse(input);
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
  // R3 Semana 4 da ressignificação — defesa em profundidade. Mesmo
  // comportamento do update.ts: kind=raw_material zera campos
  // comerciais e força unpublish. UI já condiciona (R3), server-side
  // não confia em payload nenhum vindo do cliente.
  const data = applyKindOverrides(parsed.data);

  const store = await getCurrentStore(userId);
  if (!store) return { ok: false, error: "Loja não encontrada." };

  try {
    const row = await withTenant(store.id, userId, async (tx) => {
      // S1.3 (2026-05-26): quota de produtos por loja. Check ANTES do insert
      // pra evitar falha tardia. count() é cheap (index scan em store_id).
      const [countRow] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(productTable)
        .where(eq(productTable.storeId, store.id));
      const currentCount = countRow?.count ?? 0;
      if (currentCount >= store.maxProductsCount) {
        throw new Error(
          `Limite de ${store.maxProductsCount} produtos atingido no seu plano. Apague produtos antigos ou contate o suporte.`,
        );
      }

      const slug = await generateUniqueProductSlug({
        storeId: store.id,
        name: data.name,
        client: tx,
      });

      // Onda 1.4 Passo 2 (2026-05-24): condição alinhada com update.ts e
      // loadStockSnapshot. Produto-base controla saldo SE não há variante
      // rastreada. Antes era `variants.length === 0` — produto com variante
      // não rastreada caía em limbo (ver comentário extenso em update.ts).
      const hasTrackedVariants = data.variants.some(
        (v) => v.stockQuantity !== null,
      );
      const productInitialStock =
        !hasTrackedVariants && data.trackStock
          ? (data.stockQuantity ?? 0)
          : 0;

      const [created] = await tx
        .insert(productTable)
        .values({
          storeId: store.id,
          categoryId: data.categoryId,
          name: data.name,
          kind: data.kind,
          slug,
          description: data.description,
          basePriceInCents: data.basePriceInCents,
          wholesalePriceInCents: data.wholesalePriceInCents,
          promoPriceInCents: data.promoPriceInCents,
          trackStock: data.trackStock,
          allowOversell: data.allowOversell,
          // `stock_quantity` é CACHE — a fonte de verdade é `stock_movement`
          // (ver inventory.ts:4-7). Nasce zerado quando trackStock=true; o
          // INSERT do movement inicial abaixo dispara o trigger
          // `sync_stock_cache_on_movement` (SQL 60), que soma o delta em cima
          // deste 0. Trigger é SECURITY DEFINER + RAISE EXCEPTION em row_count=0,
          // então qualquer falha silenciosa aborta a tx inteira.
          stockQuantity: data.trackStock ? 0 : null,
          installmentsOverride: data.installmentsOverride,
          cashDiscountOverrideBps: data.cashDiscountOverrideBps,
          isActive: data.isActive,
          isFeatured: data.isFeatured,
          isPublishedToStorefront: data.isPublishedToStorefront,
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
          brandId: data.brandId,
          unit: data.unit,
          internalCode: data.internalCode,
          defaultCommissionBps: data.defaultCommissionBps,
          ncm: data.ncm,
          weightGrams: data.weightGrams === null ? null : String(data.weightGrams),
        })
        .returning({ id: productTable.id });

      if (!created) return null;

      if (productInitialStock > 0) {
        // Onda 1.4 Passo 2 (2026-05-24): reference_type/id omitidos =
        // ambos NULL. Satisfaz CHECK stock_movement_reference_consistency
        // (SQL 22). Antes passávamos "manual" sem id e a tx abortava.
        await tx.insert(stockMovementTable).values({
          storeId: store.id,
          productId: created.id,
          variantId: null,
          movementType: "initial",
          quantityDelta: productInitialStock,
          notes: "Saldo inicial cadastrado no produto.",
          createdBy: userId,
        });
      }

      if (data.variants.length > 0) {
        const createdVariants = await tx
          .insert(productVariantTable)
          .values(
            data.variants.map((v) => ({
              storeId: store.id,
              productId: created.id,
              name: v.name,
              priceInCents: v.priceInCents,
              stockQuantity: v.stockQuantity !== null ? 0 : null,
              trackStock: v.stockQuantity !== null,
              axis: v.axis,
              colorHex: v.axis === "color" ? v.colorHex : null,
              featuredImageId: v.featuredImageId,
            })),
          )
          .returning({
            id: productVariantTable.id,
            stockQuantity: productVariantTable.stockQuantity,
          });

        const movements = createdVariants.flatMap((variant, index) => {
          const initial = data.variants[index]?.stockQuantity ?? 0;
          if (initial <= 0) return [];
          return [{
            storeId: store.id,
            productId: created.id,
            variantId: variant.id,
            movementType: "initial" as const,
            quantityDelta: initial,
            notes: "Saldo inicial cadastrado na variante.",
            createdBy: userId,
          }];
        });

        if (movements.length > 0) {
          await tx.insert(stockMovementTable).values(movements);
        }
      }

      return created;
    });

    if (!row) return { ok: false, error: "Falha ao criar produto." };

    revalidatePath("/admin/produtos");
    revalidatePath("/admin/estoque");
    revalidateTag(`store-${store.slug}`);

    return { ok: true, productId: row.id };
  } catch (e) {
    logger.error("product.create_from_values.tx_failed", {
      err: e,
      storeId: store.id,
    });
    return { ok: false, error: "Falha ao criar produto. Tente novamente." };
  }
}
