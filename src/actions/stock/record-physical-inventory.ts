"use server";

/**
 * recordPhysicalInventory — Sprint 3C.
 *
 * Recebe um batch de contagens físicas (lojista contou X peças do produto Y)
 * e gera os ajustes em massa. Pra cada item: delta = countedQuantity -
 * saldoAtual. Quando delta != 0 cria um stock_movement type='adjustment'.
 *
 * Tudo dentro de um único withTenant (que abre uma transação RLS): falha
 * num item == rollback geral. Itens com delta=0 são pulados — sem ruído na
 * trilha de auditoria.
 *
 * Trigger SQL `sync_stock_cache_on_movement` (SQL 24) atualiza
 * product/variant.stock_quantity automaticamente após cada INSERT.
 *
 * referenceType/referenceId ficam NULL — pattern idêntico a
 * record-movement.ts (ajuste manual não tem origem em order/purchase).
 *
 * Lock: pg_advisory_xact_lock por entidade alvo pra serializar contra
 * vendas e outros ajustes simultâneos.
 */
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

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
import { safeUserMessage } from "@/lib/safe-error";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

const inventoryItemSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullable().default(null),
  /** Quantidade contada fisicamente (>= 0, integer). */
  countedQuantity: z
    .number()
    .int("Use número inteiro.")
    .nonnegative("Quantidade não pode ser negativa.")
    .max(999_999, "Quantidade acima do máximo."),
});

const inputSchema = z.object({
  items: z
    .array(inventoryItemSchema)
    .min(1, "Inclua ao menos 1 item na contagem.")
    .max(500, "Máximo 500 items por batch."),
  /** Texto livre comum a todos os ajustes deste batch. */
  notes: z
    .preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? null : v),
      z.string().trim().max(500).nullable(),
    )
    .default(null),
});
export type RecordPhysicalInventoryInput = z.input<typeof inputSchema>;

export interface PhysicalInventoryResultEntry {
  productId: string;
  variantId: string | null;
  productName: string;
  delta: number;
  systemBefore: number;
  countedAfter: number;
}

export type RecordPhysicalInventoryResult =
  | {
      ok: true;
      adjustmentsCount: number;
      skippedNoChange: number;
      entries: PhysicalInventoryResultEntry[];
    }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function recordPhysicalInventory(
  input: RecordPhysicalInventoryInput,
): Promise<RecordPhysicalInventoryResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { ok: false, error: "Sessão expirada." };
  const userId = session.user.id;

  const store = await getCurrentStore(userId);
  if (!store) return { ok: false, error: "Loja não encontrada." };

  try {
    await checkRateLimit(rateLimits.mutation, userId);
  } catch (err) {
    if (err instanceof RateLimitError) {
      return { ok: false, error: err.message };
    }
    throw err;
  }

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (!fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return { ok: false, error: "Verifique os campos.", fieldErrors };
  }

  try {
    const out = await withTenant<RecordPhysicalInventoryResult>(
      store.id,
      userId,
      async (tx) => {
        const entries: PhysicalInventoryResultEntry[] = [];
        let adjustmentsCount = 0;
        let skippedNoChange = 0;

        for (const it of parsed.data.items) {
          // Lock por alvo (variant.id quando há variante, senão product.id).
          // Pattern idêntico a record-movement.ts + create-balcao-sale.ts.
          const lockTarget = it.variantId ?? it.productId;
          await tx.execute(
            sql`SELECT pg_advisory_xact_lock(hashtext(${"stock-" + lockTarget}))`,
          );

          let currentStock = 0;
          let productName = "(produto)";

          if (it.variantId) {
            const [vrow] = await tx
              .select({
                stockQuantity: productVariantTable.stockQuantity,
                trackStock: productVariantTable.trackStock,
                productId: productVariantTable.productId,
                variantName: productVariantTable.name,
              })
              .from(productVariantTable)
              .where(
                and(
                  eq(productVariantTable.id, it.variantId),
                  eq(productVariantTable.storeId, store.id),
                ),
              );
            if (!vrow) {
              throw new Error(`Variante ${it.variantId} não encontrada.`);
            }
            if (vrow.productId !== it.productId) {
              throw new Error(
                "Variante não pertence ao produto informado.",
              );
            }
            if (!vrow.trackStock) {
              throw new Error(
                `Variante "${vrow.variantName}" não controla estoque.`,
              );
            }
            currentStock = vrow.stockQuantity ?? 0;

            const [prow] = await tx
              .select({ name: productTable.name })
              .from(productTable)
              .where(eq(productTable.id, it.productId));
            productName = `${prow?.name ?? "(produto)"} · ${vrow.variantName}`;
          } else {
            const [prow] = await tx
              .select({
                stockQuantity: productTable.stockQuantity,
                trackStock: productTable.trackStock,
                name: productTable.name,
              })
              .from(productTable)
              .where(
                and(
                  eq(productTable.id, it.productId),
                  eq(productTable.storeId, store.id),
                ),
              );
            if (!prow) {
              throw new Error(`Produto ${it.productId} não encontrado.`);
            }
            if (!prow.trackStock) {
              throw new Error(
                `Produto "${prow.name}" não controla estoque.`,
              );
            }
            currentStock = prow.stockQuantity ?? 0;
            productName = prow.name;
          }

          const delta = it.countedQuantity - currentStock;

          entries.push({
            productId: it.productId,
            variantId: it.variantId,
            productName,
            delta,
            systemBefore: currentStock,
            countedAfter: it.countedQuantity,
          });

          if (delta === 0) {
            skippedNoChange += 1;
            continue;
          }

          // INSERT stock_movement type='adjustment' — trigger SQL 24
          // atualiza o cache product/variant.stock_quantity em seguida.
          // referenceType/referenceId NULL: pattern de ajuste manual
          // (record-movement.ts), CHECK constraint do SQL 22 permite.
          await tx.insert(stockMovementTable).values({
            storeId: store.id,
            productId: it.productId,
            variantId: it.variantId,
            movementType: "adjustment",
            quantityDelta: delta,
            notes:
              parsed.data.notes ?? "Contagem física — ajuste em batch",
            createdBy: userId,
          });
          adjustmentsCount += 1;
        }

        return {
          ok: true as const,
          adjustmentsCount,
          skippedNoChange,
          entries,
        };
      },
    );

    if (out.ok) {
      revalidatePath("/admin/estoque");
      revalidatePath("/admin/estoque/contagem");
      revalidatePath("/admin/estoque/relatorio");
      revalidatePath("/admin/produtos");
      revalidateTag(`store-${store.slug}`);

      logger.info("stock.physical_inventory_recorded", {
        storeId: store.id,
        itemCount: parsed.data.items.length,
        adjustmentsCount: out.adjustmentsCount,
        skippedNoChange: out.skippedNoChange,
      });
    }
    return out;
  } catch (e) {
    logger.error("stock.physical_inventory_failed", { err: e });
    return {
      ok: false,
      error: safeUserMessage(
        e,
        "Falha ao registrar contagem física. Tente novamente.",
      ),
    };
  }
}
