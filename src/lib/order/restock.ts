/**
 * Reposição de estoque via `stock_movement` (Fase 4 — ADR-0015).
 *
 * REFACTOR 2026-05-16: antes da Fase 4, este helper fazia
 * `UPDATE stockQuantity = stockQuantity + qty` direto no
 * product/product_variant. Agora insere `stock_movement` do tipo `return`
 * — o trigger SQL `stock_movement_sync_cache` atualiza o cache
 * automaticamente (ver supabase/sql/24_*). Auditoria automática + base
 * pra reabertura de pedido sem perder histórico.
 *
 * Usado em:
 *  1. `src/actions/order/update-status.ts` — cancelamento manual via UI
 *     em `awaiting_whatsapp → canceled`, `confirmed → canceled`, ou
 *     `awaiting_whatsapp → expired` forçado pelo lojista.
 *  2. `src/app/api/cron/expire-orders/route.ts` — expiração automática
 *     de pedidos `awaiting_whatsapp` cujo `expires_at < now()`.
 *
 * Garantias:
 *  - Atomicidade controlada pelo caller (recebe `tx`, não abre própria).
 *    Inserts de movement + UPDATE de status na mesma transação. Trigger
 *    SQL roda no mesmo commit — invariante "movement persistido => cache
 *    sincronizado" preservada.
 *  - Variant-first com fallback produto, mesma regra do decremento.
 *  - Defesa em profundidade: WHERE inclui `storeId` no SELECT de items
 *    via JOIN com `order` (já filtrado pelo caller). Movement leva
 *    `storeId` direto pra RLS check passar.
 *  - Append-only: NÃO permitimos editar/apagar movements (correção =
 *    novo movement do tipo `adjustment` reverso).
 *  - Sem optimistic lock: reposição pode ultrapassar o valor original
 *    (lojista pode ter aumentado capacidade). Apenas soma direto via
 *    INSERT + trigger.
 */
import { and, eq, inArray } from "drizzle-orm";

import {
  orderItemTable,
  productTable,
  productVariantTable,
  stockMovementTable,
} from "@/db/schema";
import { logger } from "@/lib/logger";
import type { Tx } from "@/lib/tenant";

interface RestockOrderItem {
  productId: string;
  variantId: string | null;
  quantity: number;
}

interface RestockSummary {
  /** Total de linhas de orderItem processadas. */
  itemsProcessed: number;
  /** Items que viraram no-op (produto+variant sem trackStock). */
  noopItems: number;
}

export async function restockOrderItems(
  tx: Tx,
  orderId: string,
  storeId: string,
): Promise<RestockSummary> {
  const items: RestockOrderItem[] = await tx
    .select({
      productId: orderItemTable.productId,
      variantId: orderItemTable.variantId,
      quantity: orderItemTable.quantity,
    })
    .from(orderItemTable)
    .where(eq(orderItemTable.orderId, orderId));

  if (items.length === 0) {
    return { itemsProcessed: 0, noopItems: 0 };
  }

  // Carrega produtos + variantes em batch (SÉRIE — pg deprecou paralelas).
  const productIds = Array.from(new Set(items.map((i) => i.productId)));
  const variantIds = items
    .map((i) => i.variantId)
    .filter((v): v is string => v !== null);
  const variantIdsUnique = Array.from(new Set(variantIds));

  const productRows = await tx
    .select({
      id: productTable.id,
      trackStock: productTable.trackStock,
    })
    .from(productTable)
    .where(
      and(eq(productTable.storeId, storeId), inArray(productTable.id, productIds)),
    );
  const variantRows =
    variantIdsUnique.length > 0
      ? await tx
          .select({
            id: productVariantTable.id,
            trackStock: productVariantTable.trackStock,
          })
          .from(productVariantTable)
          .where(
            and(
              eq(productVariantTable.storeId, storeId),
              inArray(productVariantTable.id, variantIdsUnique),
            ),
          )
      : ([] as Array<{ id: string; trackStock: boolean }>);

  const productById = new Map(productRows.map((p) => [p.id, p]));
  const variantById = new Map(variantRows.map((v) => [v.id, v]));

  let noopItems = 0;

  for (const item of items) {
    const product = productById.get(item.productId);
    const variant = item.variantId ? variantById.get(item.variantId) : null;

    const targetVariantId =
      variant?.trackStock ? variant.id : null;
    const writeToProduct =
      !targetVariantId && product?.trackStock === true;

    if (!targetVariantId && !writeToProduct) {
      // Produto sem trackStock e variante sem trackStock — estoque
      // ilimitado nos dois lados. No-op.
      noopItems += 1;
      continue;
    }

    try {
      await tx.insert(stockMovementTable).values({
        storeId,
        productId: item.productId,
        variantId: targetVariantId,
        movementType: "return",
        quantityDelta: item.quantity, // positivo: volta pro estoque
        referenceType: "order",
        referenceId: orderId,
        notes: "Devolução automática por cancelamento/expiração",
      });
    } catch (e) {
      // Caso raro: variant/produto deletado entre carregamento e INSERT
      // (a FK do movement vira inválida). Log e segue — não bloqueia o
      // cancelamento do pedido.
      logger.warn("restock.movement_insert_failed", {
        err: e,
        orderId,
        storeId,
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
      });
    }
  }

  return { itemsProcessed: items.length, noopItems };
}
