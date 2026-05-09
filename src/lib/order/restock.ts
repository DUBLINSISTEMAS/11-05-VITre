/**
 * Helper transacional de reposição de estoque (`restockOrderItems`).
 *
 * Espelha a lógica de decremento em `src/actions/order/create-from-cart.ts`
 * (linhas ~336-383) MAS no sentido inverso (`+= quantity` em vez de
 * `-= quantity`).
 *
 * Usado em duas trilhas:
 *  1. `src/actions/order/update-status.ts` — cancelamento manual via UI admin
 *     em transição `awaiting_whatsapp → canceled` ou `confirmed → canceled`,
 *     e também em `awaiting_whatsapp → expired` (caso o lojista force).
 *  2. `src/app/api/cron/expire-orders/route.ts` — expiração automática de
 *     pedidos `awaiting_whatsapp` cujo `expires_at < now()`.
 *
 * Garantias:
 *  - **Atomicidade controlada pelo caller**: o helper recebe `tx` (de
 *    `@/lib/tenant`) e NÃO abre transação própria. O caller compõe
 *    reposição + UPDATE de status na mesma transação `withTenant`, então
 *    qualquer falha rola tudo back.
 *  - **Variant-first com fallback produto**: se a variante tem
 *    `track_stock = true`, repõe na variante; senão, se o produto tem
 *    `track_stock = true`, repõe no produto; senão, no-op (estoque ilimitado
 *    nos dois lados).
 *  - **Defesa em profundidade**: WHERE inclui `storeId` em todos os UPDATEs.
 *    RLS já bloquearia via GUC `app.current_store_id`, mas double-check
 *    evita estoque "vazar" caso o caller passe um storeId errado por engano.
 *  - **Sem optimistic lock**: ao contrário do decremento (que usa
 *    `gte(stockQuantity, qty)` pra evitar overshoot negativo), reposição
 *    pode ultrapassar o valor original — o lojista pode ter aumentado
 *    capacidade depois. Apenas `+=` direto via expressão SQL.
 *  - **Log defensivo**: se um UPDATE retorna 0 rows (ex: variant deletada),
 *    apenas `console.warn` — não falha. Caso raro, mas possível em fluxos
 *    de soft-delete futuros.
 */
import { and, eq, inArray, sql } from "drizzle-orm";

import {
  orderItemTable,
  productTable,
  productVariantTable,
} from "@/db/schema";
import type { Tx } from "@/lib/tenant";

interface RestockOrderItem {
  productId: string;
  variantId: string | null;
  quantity: number;
}

interface RestockSummary {
  /** Total de linhas de orderItem processadas. */
  itemsProcessed: number;
  /** UPDATEs que retornaram 0 rows (variant/produto inexistente — caso raro). */
  partialMisses: number;
}

export async function restockOrderItems(
  tx: Tx,
  orderId: string,
  storeId: string,
): Promise<RestockSummary> {
  // 1. Carrega os items do pedido. RLS garante que só vemos items da loja
  //    correta via GUC, mas o helper NÃO precisa filtrar storeId aqui pois
  //    `order_item` não carrega storeId direto — ele herda via JOIN com
  //    `order`. O caller já validou tenant.
  const items: RestockOrderItem[] = await tx
    .select({
      productId: orderItemTable.productId,
      variantId: orderItemTable.variantId,
      quantity: orderItemTable.quantity,
    })
    .from(orderItemTable)
    .where(eq(orderItemTable.orderId, orderId));

  if (items.length === 0) {
    return { itemsProcessed: 0, partialMisses: 0 };
  }

  // 2. Carrega TODOS os produtos e variantes em batch (2 queries totais,
  //    paralelas). Antes era 2N queries seriais.
  const productIds = Array.from(new Set(items.map((i) => i.productId)));
  const variantIds = items
    .map((i) => i.variantId)
    .filter((v): v is string => v !== null);
  const variantIdsUnique = Array.from(new Set(variantIds));

  const [productRows, variantRows] = await Promise.all([
    tx
      .select({
        id: productTable.id,
        trackStock: productTable.trackStock,
        stockQuantity: productTable.stockQuantity,
      })
      .from(productTable)
      .where(
        and(
          eq(productTable.storeId, storeId),
          inArray(productTable.id, productIds),
        ),
      ),
    variantIdsUnique.length > 0
      ? tx
          .select({
            id: productVariantTable.id,
            trackStock: productVariantTable.trackStock,
            stockQuantity: productVariantTable.stockQuantity,
          })
          .from(productVariantTable)
          .where(
            and(
              eq(productVariantTable.storeId, storeId),
              inArray(productVariantTable.id, variantIdsUnique),
            ),
          )
      : Promise.resolve(
          [] as Array<{
            id: string;
            trackStock: boolean;
            stockQuantity: number | null;
          }>,
        ),
  ]);

  const productById = new Map(productRows.map((p) => [p.id, p]));
  const variantById = new Map(variantRows.map((v) => [v.id, v]));

  // 3. Decide destino de cada item e dispara UPDATEs em paralelo.
  let partialMisses = 0;
  const updatePromises: Array<Promise<void>> = [];

  for (const item of items) {
    const product = productById.get(item.productId);
    const variant = item.variantId ? variantById.get(item.variantId) : null;

    const shouldRestockVariant = Boolean(
      variant?.trackStock && variant.stockQuantity !== null,
    );
    const shouldRestockProduct = Boolean(
      !shouldRestockVariant &&
        product?.trackStock &&
        product.stockQuantity !== null,
    );

    if (shouldRestockVariant && variant) {
      updatePromises.push(
        tx
          .update(productVariantTable)
          .set({
            stockQuantity: sql`${productVariantTable.stockQuantity} + ${item.quantity}`,
          })
          .where(
            and(
              eq(productVariantTable.id, variant.id),
              eq(productVariantTable.storeId, storeId),
            ),
          )
          .returning({ id: productVariantTable.id })
          .then((updated) => {
            if (updated.length === 0) {
              // Pode acontecer se: variant foi deletada entre carregamento e
              // UPDATE (race extremamente improvável dentro da mesma tx), ou
              // caller passou storeId errado (defesa em profundidade).
              partialMisses += 1;
              console.warn(`[restock] partial: variant UPDATE retornou 0 rows`, {
                orderId,
                storeId,
                productId: item.productId,
                variantId: item.variantId,
                quantity: item.quantity,
              });
            }
          }),
      );
      continue;
    }

    if (shouldRestockProduct && product) {
      updatePromises.push(
        tx
          .update(productTable)
          .set({
            stockQuantity: sql`${productTable.stockQuantity} + ${item.quantity}`,
          })
          .where(
            and(
              eq(productTable.id, product.id),
              eq(productTable.storeId, storeId),
            ),
          )
          .returning({ id: productTable.id })
          .then((updated) => {
            if (updated.length === 0) {
              partialMisses += 1;
              console.warn(`[restock] partial: product UPDATE retornou 0 rows`, {
                orderId,
                storeId,
                productId: item.productId,
                quantity: item.quantity,
              });
            }
          }),
      );
    }
    // else: produto sem trackStock e variante sem trackStock — no-op
    // (cenário 3 dos testes). Estoque é ilimitado nos dois lados.
  }

  await Promise.all(updatePromises);

  return { itemsProcessed: items.length, partialMisses };
}
