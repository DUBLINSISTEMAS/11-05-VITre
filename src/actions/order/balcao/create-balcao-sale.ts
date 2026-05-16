"use server";

/**
 * createBalcaoSale (Fase 5 — ADR-0016)
 *
 * Action de PDV: registra venda balcão admin-side. Diferenças vs. checkout
 * WhatsApp (`create-from-cart.ts`):
 *   - admin autenticado (cai em `withTenant(storeId, userId, ...)` — owner)
 *   - sem `customerName`/`customerPhone` obrigatórios (walk-in dominante)
 *   - `paymentMethod` obrigatório (CHECK constraint do SQL 26 garante)
 *   - nasce `status='fulfilled'` direto (venda já concluída no balcão)
 *   - sem WhatsApp redirect, sem timer de expiração
 *   - idempotency key gerada pelo server (uma por chamada — protege
 *     contra duplo-clique do botão "Finalizar venda")
 *
 * Atomicidade: pg_advisory_xact_lock por entidade alvo + INSERT em batch
 * de stock_movement type=`sale` via helper compartilhado (Fase 4).
 */
import { randomUUID } from "node:crypto";

import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";

import {
  customerTable,
  orderItemTable,
  orderTable,
  productTable,
  productVariantTable,
  storeTable,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { recordSaleMovements } from "@/lib/order/record-sale-movements";
import { getEffectivePrice } from "@/lib/pricing";
import { generatePublicOrderToken } from "@/lib/public-order";
import {
  checkRateLimit,
  RateLimitError,
  rateLimits,
} from "@/lib/rate-limit";
import { generateShortCode } from "@/lib/shortcode";
import { getCurrentStore } from "@/lib/store-context";
import { type Tx, withTenant } from "@/lib/tenant";

import {
  type CreateBalcaoSaleInput,
  createBalcaoSaleSchema,
} from "./schema";

export type CreateBalcaoSaleErrorCode =
  | "UNAUTHORIZED"
  | "VALIDATION"
  | "RATE_LIMIT"
  | "STORE_NOT_FOUND"
  | "PRODUCT_NOT_FOUND"
  | "OUT_OF_STOCK"
  | "CUSTOMER_NOT_FOUND"
  | "CASH_RECEIVED_TOO_LOW"
  | "DISCOUNT_OVER_TOTAL"
  | "SHORTCODE_RETRY_EXHAUSTED"
  | "UNKNOWN";

export interface CreateBalcaoSaleResult {
  ok: boolean;
  orderId?: string;
  shortCode?: string;
  publicToken?: string;
  errorCode?: CreateBalcaoSaleErrorCode;
  errorMessage?: string;
  fieldErrors?: Record<string, string>;
  outOfStockProductIds?: string[];
}

class OutOfStockError extends Error {
  constructor(public readonly productId: string) {
    super("OUT_OF_STOCK");
  }
}

const MAX_SHORTCODE_RETRIES = 5;

export async function createBalcaoSale(
  input: CreateBalcaoSaleInput,
): Promise<CreateBalcaoSaleResult> {
  // 1. Auth
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return {
      ok: false,
      errorCode: "UNAUTHORIZED",
      errorMessage: "Sessão expirada. Faça login novamente.",
    };
  }
  const userId = session.user.id;

  // 2. Rate limit (mutation — 60/min por user)
  try {
    await checkRateLimit(rateLimits.mutation, userId);
  } catch (err) {
    if (err instanceof RateLimitError) {
      return {
        ok: false,
        errorCode: "RATE_LIMIT",
        errorMessage: err.message,
      };
    }
    throw err;
  }

  // 3. Zod
  const parsed = createBalcaoSaleSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (!fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return {
      ok: false,
      errorCode: "VALIDATION",
      errorMessage:
        parsed.error.issues[0]?.message ?? "Dados inválidos.",
      fieldErrors,
    };
  }
  const data = parsed.data;

  // 4. Store do user logado
  const store = await getCurrentStore(userId);
  if (!store) {
    return {
      ok: false,
      errorCode: "STORE_NOT_FOUND",
      errorMessage: "Loja não encontrada.",
    };
  }

  try {
    return await withTenant<CreateBalcaoSaleResult>(
      store.id,
      userId,
      async (tx) => {
        // 5. Customer (opcional) — confirma que pertence à loja
        let customerSnapshotName = "Cliente balcão";
        let customerSnapshotPhone: string | null = null;
        if (data.customerId) {
          const cust = await tx.query.customerTable.findFirst({
            where: and(
              eq(customerTable.id, data.customerId),
              eq(customerTable.storeId, store.id),
            ),
            columns: { name: true, phone: true },
          });
          if (!cust) {
            return {
              ok: false,
              errorCode: "CUSTOMER_NOT_FOUND" as const,
              errorMessage: "Cliente não encontrado nesta loja.",
            };
          }
          customerSnapshotName = cust.name;
          customerSnapshotPhone = cust.phone;
        }

        // 6. Agrega itens por (productId, variantId) — protege contra
        //    duplicatas no payload (mesmo product 2x).
        const aggregatedKey = (p: string, v: string | null) =>
          `${p}|${v ?? ""}`;
        const aggregated = new Map<
          string,
          { productId: string; variantId: string | null; quantity: number }
        >();
        for (const it of data.items) {
          const k = aggregatedKey(it.productId, it.variantId);
          const cur = aggregated.get(k);
          if (cur) {
            cur.quantity += it.quantity;
          } else {
            aggregated.set(k, {
              productId: it.productId,
              variantId: it.variantId,
              quantity: it.quantity,
            });
          }
        }
        const inputItems = Array.from(aggregated.values());

        // 7. Carregar products + variants
        const productIds = Array.from(
          new Set(inputItems.map((it) => it.productId)),
        );
        const variantIds = inputItems
          .map((it) => it.variantId)
          .filter((v): v is string => v !== null);

        const products = await tx.query.productTable.findMany({
          where: and(
            inArray(productTable.id, productIds),
            eq(productTable.storeId, store.id),
          ),
          columns: {
            id: true,
            name: true,
            basePriceInCents: true,
            promoPriceInCents: true,
            promoStartsAt: true,
            promoEndsAt: true,
            trackStock: true,
            stockQuantity: true,
          },
        });

        if (products.length !== productIds.length) {
          const found = new Set(products.map((p) => p.id));
          const missing = productIds.filter((id) => !found.has(id));
          return {
            ok: false,
            errorCode: "PRODUCT_NOT_FOUND" as const,
            errorMessage: "Algum produto não foi encontrado.",
            outOfStockProductIds: missing,
          };
        }

        const variants =
          variantIds.length > 0
            ? await tx.query.productVariantTable.findMany({
                where: and(
                  inArray(productVariantTable.id, variantIds),
                  eq(productVariantTable.storeId, store.id),
                ),
                columns: {
                  id: true,
                  productId: true,
                  name: true,
                  priceInCents: true,
                  trackStock: true,
                  stockQuantity: true,
                },
              })
            : [];

        const productById = new Map(products.map((p) => [p.id, p]));
        const variantById = new Map(variants.map((v) => [v.id, v]));

        // 8. Calcular preço efetivo (snapshot pra orderItem)
        const now = new Date();
        const computedItems: Array<{
          productId: string;
          variantId: string | null;
          productName: string;
          variantName: string | null;
          priceInCents: number;
          quantity: number;
        }> = [];
        let subtotalInCents = 0;

        for (const it of inputItems) {
          const product = productById.get(it.productId);
          if (!product) {
            return {
              ok: false,
              errorCode: "PRODUCT_NOT_FOUND" as const,
              errorMessage: "Produto removido durante a venda.",
              outOfStockProductIds: [it.productId],
            };
          }
          let variant: typeof variants[number] | null = null;
          if (it.variantId) {
            variant = variantById.get(it.variantId) ?? null;
            if (!variant || variant.productId !== product.id) {
              return {
                ok: false,
                errorCode: "PRODUCT_NOT_FOUND" as const,
                errorMessage: "Variante não encontrada.",
                outOfStockProductIds: [it.productId],
              };
            }
          }

          const effectivePrice = variant?.priceInCents
            ? variant.priceInCents
            : getEffectivePrice(
                {
                  basePriceInCents: product.basePriceInCents,
                  promoPriceInCents: product.promoPriceInCents,
                  promoStartsAt: product.promoStartsAt,
                  promoEndsAt: product.promoEndsAt,
                },
                now,
              );

          subtotalInCents += effectivePrice * it.quantity;
          computedItems.push({
            productId: it.productId,
            variantId: it.variantId,
            productName: product.name,
            variantName: variant?.name ?? null,
            priceInCents: effectivePrice,
            quantity: it.quantity,
          });
        }

        // 9. Aplicar desconto
        const discount = data.discountInCents ?? 0;
        if (discount > subtotalInCents) {
          return {
            ok: false,
            errorCode: "DISCOUNT_OVER_TOTAL" as const,
            errorMessage: "Desconto maior que o subtotal da venda.",
          };
        }
        const totalInCents = subtotalInCents - discount;

        // 10. Validar troco (se cash + cashReceived informado)
        if (
          data.paymentMethod === "cash" &&
          data.cashReceivedInCents !== null &&
          data.cashReceivedInCents < totalInCents
        ) {
          return {
            ok: false,
            errorCode: "CASH_RECEIVED_TOO_LOW" as const,
            errorMessage: "Valor recebido menor que o total.",
          };
        }

        // 11. Tx aninhada: locks + estoque + INSERT order/items/movements
        let createdOrderId: string | null = null;
        let createdShortCode: string | null = null;
        let createdPublicToken: string | null = null;
        let lastError: unknown = null;
        let softFailure: CreateBalcaoSaleResult | null = null;

        const idempotencyKey = randomUUID();

        for (let attempt = 0; attempt < MAX_SHORTCODE_RETRIES; attempt++) {
          const candidate = generateShortCode();
          const publicToken = generatePublicOrderToken();
          try {
            await tx.transaction(async (innerTx) => {
              const salesToRecord: Array<{
                productId: string;
                variantId: string | null;
                quantity: number;
              }> = [];

              for (const ci of computedItems) {
                const product = productById.get(ci.productId);
                const variant = ci.variantId
                  ? variantById.get(ci.variantId)
                  : null;

                const targetVariant = Boolean(
                  variant?.trackStock && variant.stockQuantity !== null,
                );
                const targetProduct = Boolean(
                  !targetVariant &&
                    product?.trackStock &&
                    product.stockQuantity !== null,
                );

                if (!targetVariant && !targetProduct) {
                  continue; // estoque ilimitado — sem lock, sem movement
                }

                const lockTarget =
                  targetVariant && variant ? variant.id : ci.productId;
                await innerTx.execute(
                  sql`SELECT pg_advisory_xact_lock(hashtext(${"stock-" + lockTarget}))`,
                );

                let currentStock: number | null = null;
                if (targetVariant && variant) {
                  const [row] = await innerTx
                    .select({
                      stockQuantity: productVariantTable.stockQuantity,
                    })
                    .from(productVariantTable)
                    .where(
                      and(
                        eq(productVariantTable.id, variant.id),
                        eq(productVariantTable.storeId, store.id),
                      ),
                    );
                  currentStock = row?.stockQuantity ?? null;
                } else if (targetProduct) {
                  const [row] = await innerTx
                    .select({ stockQuantity: productTable.stockQuantity })
                    .from(productTable)
                    .where(
                      and(
                        eq(productTable.id, ci.productId),
                        eq(productTable.storeId, store.id),
                      ),
                    );
                  currentStock = row?.stockQuantity ?? null;
                }

                if (currentStock === null || currentStock < ci.quantity) {
                  throw new OutOfStockError(ci.productId);
                }

                salesToRecord.push({
                  productId: ci.productId,
                  variantId: targetVariant && variant ? variant.id : null,
                  quantity: ci.quantity,
                });
              }

              const inserted = await innerTx
                .insert(orderTable)
                .values({
                  storeId: store.id,
                  shortCode: candidate,
                  publicToken,
                  idempotencyKey,
                  customerName: customerSnapshotName,
                  customerPhone: customerSnapshotPhone,
                  customerId: data.customerId,
                  customerNotes: data.notes,
                  totalInCents,
                  status: "fulfilled",
                  channel: "balcao",
                  paymentMethod: data.paymentMethod,
                  discountInCents:
                    data.discountInCents ?? null,
                  cashReceivedInCents:
                    data.paymentMethod === "cash"
                      ? data.cashReceivedInCents
                      : null,
                  // expiresAt nullable na Fase 5 — irrelevante pra balcão.
                  expiresAt: null,
                  confirmedAt: new Date(),
                })
                .returning({ id: orderTable.id });

              const orderRow = inserted[0];
              if (!orderRow) throw new Error("INSERT order não retornou id");

              if (computedItems.length > 0) {
                await innerTx.insert(orderItemTable).values(
                  computedItems.map((ci) => ({
                    orderId: orderRow.id,
                    productId: ci.productId,
                    variantId: ci.variantId,
                    productNameSnapshot: ci.productName,
                    variantNameSnapshot: ci.variantName,
                    imageUrlSnapshot: null, // PDV não precisa snapshot de imagem
                    priceInCentsSnapshot: ci.priceInCents,
                    quantity: ci.quantity,
                  })),
                );
              }

              await recordSaleMovements(innerTx as unknown as Tx, {
                storeId: store.id,
                orderId: orderRow.id,
                sales: salesToRecord,
              });

              createdOrderId = orderRow.id;
              createdShortCode = candidate;
              createdPublicToken = publicToken;
            });
            break; // sucesso
          } catch (err: unknown) {
            lastError = err;
            if (err instanceof OutOfStockError) {
              softFailure = {
                ok: false,
                errorCode: "OUT_OF_STOCK",
                errorMessage:
                  "Algum item não tem estoque suficiente.",
                outOfStockProductIds: [err.productId],
              };
              break;
            }
            const msg = err instanceof Error ? err.message : String(err);
            if (
              msg.includes("order_short_code_unique") ||
              msg.includes("short_code")
            ) {
              continue; // retry shortCode
            }
            throw err;
          }
        }

        if (softFailure) return softFailure;
        if (!createdOrderId || !createdShortCode || !createdPublicToken) {
          logger.error("balcao.shortcode_retry_exhausted", {
            err: lastError,
            storeId: store.id,
          });
          return {
            ok: false,
            errorCode: "SHORTCODE_RETRY_EXHAUSTED",
            errorMessage:
              "Falha ao gerar código único da venda. Tente novamente.",
          };
        }

        // 12. Revalidar caches
        const storeRow = await tx.query.storeTable.findFirst({
          where: eq(storeTable.id, store.id),
          columns: { slug: true },
        });
        if (storeRow?.slug) {
          revalidateTag(`store-${storeRow.slug}`);
        }
        revalidatePath("/admin/pdv");
        revalidatePath("/admin/pedidos");
        revalidatePath("/admin/estoque");
        revalidatePath("/admin/produtos");

        return {
          ok: true,
          orderId: createdOrderId,
          shortCode: createdShortCode,
          publicToken: createdPublicToken,
        };
      },
    );
  } catch (e) {
    logger.error("balcao.create_failed", { err: e, storeId: store.id });
    return {
      ok: false,
      errorCode: "UNKNOWN",
      errorMessage: "Falha ao registrar venda. Tente novamente.",
    };
  }
}
