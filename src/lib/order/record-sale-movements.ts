/**
 * Helper compartilhado entre `create-from-cart.ts` (checkout WhatsApp) e
 * `create-balcao-sale.ts` (PDV — Fase 5/ADR-0016).
 *
 * Insere um movement type=`sale` por item rastreado, vinculado ao pedido
 * recém-criado via `reference_type='order'` + `reference_id=orderId`.
 * Trigger SQL `stock_movement_sync_cache` (SQL 24) atualiza o cache
 * `stock_quantity` em product/variant atomicamente dentro do mesmo COMMIT.
 *
 * Precondições do caller (não checadas aqui):
 *   - pg_advisory_xact_lock por entidade alvo já adquirido
 *   - estoque pré-validado sob o lock (releitura do cache)
 *   - orderId é UUID válido recém-inserido no mesmo tx
 *
 * Se a lista vier vazia (todos os itens são estoque ilimitado), no-op.
 */
import { stockMovementTable } from "@/db/schema";
import type { Tx } from "@/lib/tenant";

export interface SaleMovementSpec {
  productId: string;
  variantId: string | null;
  quantity: number;
}

export async function recordSaleMovements(
  tx: Tx,
  args: {
    storeId: string;
    orderId: string;
    sales: ReadonlyArray<SaleMovementSpec>;
  },
): Promise<void> {
  if (args.sales.length === 0) return;

  await tx.insert(stockMovementTable).values(
    args.sales.map((s) => ({
      storeId: args.storeId,
      productId: s.productId,
      variantId: s.variantId,
      movementType: "sale" as const,
      quantityDelta: -s.quantity,
      referenceType: "order",
      referenceId: args.orderId,
    })),
  );
}
