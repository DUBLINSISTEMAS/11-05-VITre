"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";

import {
  productTable,
  productVariantTable,
  stockMovementTable,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  checkRateLimit,
  RateLimitError,
  rateLimits,
} from "@/lib/rate-limit";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

import { type RecordMovementInput, recordMovementSchema } from "./schema";

export type RecordMovementResult =
  | { ok: true; movementId: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Registra movimentação manual de estoque (Fase 4 — ADR-0015).
 *
 * Tipos aceitos: `manual_in`, `manual_out`, `adjustment`. Outros tipos
 * (`sale`/`return`/`initial`) são gerados pelo sistema e NÃO entram aqui.
 *
 * Sinal do `quantity_delta`:
 *   - manual_in:   +quantity (entrada)
 *   - manual_out:  -quantity (saída)
 *   - adjustment:  +quantity ou -quantity (controlado por adjustmentDirection)
 *
 * Trigger SQL `stock_movement_sync_cache` atualiza
 * `product.stock_quantity` / `product_variant.stock_quantity`
 * automaticamente — não precisamos UPDATE manual aqui.
 */
export async function recordStockMovement(
  input: RecordMovementInput,
): Promise<RecordMovementResult> {
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

  const parsed = recordMovementSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (!fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return { ok: false, error: "Confira os campos.", fieldErrors };
  }
  const data = parsed.data;

  const store = await getCurrentStore(userId);
  if (!store) return { ok: false, error: "Loja não encontrada." };

  // Determina o sinal do delta a partir do tipo
  let delta: number;
  switch (data.movementType) {
    case "manual_in":
      delta = data.quantity;
      break;
    case "manual_out":
      delta = -data.quantity;
      break;
    case "adjustment":
      delta =
        data.adjustmentDirection === "negative"
          ? -data.quantity
          : data.quantity;
      break;
  }

  try {
    const movementId = await withTenant(store.id, userId, async (tx) => {
      // Garante que produto/variant existem na loja
      const product = await tx.query.productTable.findFirst({
        where: and(
          eq(productTable.id, data.productId),
          eq(productTable.storeId, store.id),
        ),
        columns: { id: true, slug: true },
      });
      if (!product) return null;

      if (data.variantId) {
        const variant = await tx.query.productVariantTable.findFirst({
          where: and(
            eq(productVariantTable.id, data.variantId),
            eq(productVariantTable.storeId, store.id),
            eq(productVariantTable.productId, data.productId),
          ),
          columns: { id: true },
        });
        if (!variant) return null;
      }

      const [inserted] = await tx
        .insert(stockMovementTable)
        .values({
          storeId: store.id,
          productId: data.productId,
          variantId: data.variantId,
          movementType: data.movementType,
          quantityDelta: delta,
          notes: data.notes,
          createdBy: userId,
          // referenceType/referenceId ficam NULL — movimento manual,
          // não vinculado a order. CHECK constraint permite.
        })
        .returning({ id: stockMovementTable.id });

      return inserted?.id ?? null;
    });

    if (!movementId) {
      return { ok: false, error: "Produto ou variante não encontrado." };
    }

    revalidatePath("/admin/estoque");
    revalidatePath("/admin/produtos");
    revalidatePath(`/admin/produtos/${data.productId}`);
    revalidateTag(`store-${store.slug}`);

    return { ok: true, movementId };
  } catch (e) {
    logger.error("stock.record_movement_failed", {
      err: e,
      storeId: store.id,
      productId: data.productId,
      type: data.movementType,
    });
    return { ok: false, error: "Falha ao registrar movimentação." };
  }
}
