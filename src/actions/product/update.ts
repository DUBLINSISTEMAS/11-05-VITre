"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";

import {
  categoryTable,
  productTable,
  productVariantTable,
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
 * - removidas (id existia no banco mas sumiu do array): DELETE
 *
 * Por que diff e não delete-insert? Variantes já vendidas vão estar referenciadas
 * em `order_item` no futuro (Fase 1.6). Recriar variant gera id novo e quebra
 * histórico. Diff preserva ids existentes.
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
        columns: { id: true, slug: true, name: true },
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

      // 8. Mutação: produto + variantes (diff). Defesa em profundidade:
      // todo WHERE carrega `storeId` mesmo com RLS já filtrando.
      await tx
        .update(productTable)
        .set({
          name: data.name,
          slug: nextSlug,
          description: data.description,
          basePriceInCents: data.basePriceInCents,
          promoPriceInCents: data.promoPriceInCents,
          categoryId: data.categoryId,
          trackStock: data.trackStock,
          stockQuantity: data.trackStock ? data.stockQuantity : null,
          isActive: data.isActive,
          isFeatured: data.isFeatured,
          // Meta-fields canvas-v1 — null quando lojista deixou em branco
          // (Zod transform "" → null já normalizou).
          composition: data.composition,
          modeling: data.modeling,
          lining: data.lining,
          washing: data.washing,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(productTable.id, data.productId),
            eq(productTable.storeId, store.id),
          ),
        );

      // --- Diff de variantes ---
      const incomingWithId = data.variants.filter((v) => v.id);
      const incomingNew = data.variants.filter((v) => !v.id);

      const dbVariants = await tx
        .select({ id: productVariantTable.id })
        .from(productVariantTable)
        .where(
          and(
            eq(productVariantTable.productId, data.productId),
            eq(productVariantTable.storeId, store.id),
          ),
        );

      const dbIds = new Set(dbVariants.map((v) => v.id));
      const incomingIds = new Set(incomingWithId.map((v) => v.id!));

      const toDelete = [...dbIds].filter((id) => !incomingIds.has(id));
      if (toDelete.length > 0) {
        await tx
          .delete(productVariantTable)
          .where(
            and(
              inArray(productVariantTable.id, toDelete),
              eq(productVariantTable.productId, data.productId),
              eq(productVariantTable.storeId, store.id),
            ),
          );
      }

      for (const v of incomingWithId) {
        await tx
          .update(productVariantTable)
          .set({
            name: v.name,
            priceInCents: v.priceInCents,
            stockQuantity: v.stockQuantity,
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
      }

      if (incomingNew.length > 0) {
        await tx.insert(productVariantTable).values(
          incomingNew.map((v) => ({
            storeId: store.id,
            productId: data.productId,
            name: v.name,
            priceInCents: v.priceInCents,
            stockQuantity: v.stockQuantity,
            trackStock: v.stockQuantity !== null,
            axis: v.axis,
            colorHex: v.axis === "color" ? v.colorHex : null,
            featuredImageId: v.featuredImageId,
          })),
        );
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
  revalidateTag(`store-${store.slug}`);

  return { ok: true, productId: data.productId, slug: stepResult.nextSlug };
}
