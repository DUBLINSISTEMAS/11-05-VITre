"use server";

/**
 * Server action `createOrderFromCart`.
 *
 * Fluxo:
 *  1. Rate limit por IP (5/min).
 *  2. Validar input (Zod).
 *  3. Resolver store ativa por slug (service_role — antes de saber tenant).
 *  4. Idempotency: se já existe order com (storeId, idempotencyKey)
 *     retorna o existente — duplo-clique vira no-op.
 *  5. Carregar produtos + variantes (validar existência, atividade,
 *     mesma store).
 *  6. Validar estoque atômico (variant.trackStock vence; senão produto).
 *  7. Calcular preço efetivo via `pricing.ts` em request-time (`now()`).
 *  8. Gerar shortCode com retry em colisão UNIQUE.
 *  9. INSERT order + orderItem em transação.
 * 10. Construir mensagem WhatsApp truncada + URL `wa.me`.
 *
 * Resposta: { ok, shortCode, whatsappUrl } em caso de sucesso.
 * Erros tipados pra o cliente decidir UX (toast, retry, etc).
 */
import { and, asc, eq, gte, inArray, sql } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { headers } from "next/headers";

import {
  type CreateOrderInput,
  createOrderInputSchema,
} from "@/actions/order/schema";
import {
  orderItemTable,
  orderTable,
  productImageTable,
  productTable,
  productVariantTable,
  storeTable,
} from "@/db/schema";
import { isStockExhausted, resolveStockState } from "@/lib/cart/stock";
import { env } from "@/lib/env";
import { getEffectivePrice } from "@/lib/pricing";
import { generatePublicOrderToken } from "@/lib/public-order";
import {
  checkRateLimit,
  getClientIp,
  RateLimitError,
  rateLimits,
} from "@/lib/rate-limit";
import { generateShortCode } from "@/lib/shortcode";
import { withServiceRole } from "@/lib/tenant";
import { parseWhatsAppBR } from "@/lib/whatsapp-format";
import {
  buildOrderMessage,
  buildWhatsAppUrl,
  type WhatsAppItemInput,
} from "@/lib/whatsapp-message";

export type CreateOrderErrorCode =
  | "VALIDATION"
  | "RATE_LIMIT"
  | "STORE_NOT_FOUND"
  | "PRODUCT_NOT_FOUND"
  | "OUT_OF_STOCK"
  | "EMPTY_CART"
  | "SHORTCODE_RETRY_EXHAUSTED"
  | "UNKNOWN";

export interface CreateOrderResult {
  ok: boolean;
  shortCode?: string;
  whatsappUrl?: string;
  errorCode?: CreateOrderErrorCode;
  errorMessage?: string;
  /** IDs de produto sem estoque suficiente (quando errorCode=OUT_OF_STOCK). */
  outOfStockProductIds?: string[];
}

class OutOfStockError extends Error {
  constructor(public readonly productId: string) {
    super("OUT_OF_STOCK");
  }
}

const ORDER_TTL_DAYS = 14;
const MAX_SHORTCODE_RETRIES = 5;

export async function createOrderFromCart(
  input: CreateOrderInput,
): Promise<CreateOrderResult> {
  // 1. Rate limit
  try {
    const headerList = await headers();
    await checkRateLimit(rateLimits.createOrder, getClientIp(headerList));
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

  // 2. Validação Zod
  const parsed = createOrderInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errorCode: "VALIDATION",
      errorMessage:
        parsed.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }
  const data = parsed.data;

  // 3. Resolve store (service_role — slug→tenant antes de saber id)
  return withServiceRole(
    `createOrderFromCart slug=${data.storeSlug}`,
    async (tx) => {
      const store = await tx.query.storeTable.findFirst({
        where: and(
          eq(storeTable.slug, data.storeSlug),
          eq(storeTable.isActive, true),
        ),
      });
      if (!store) {
        return {
          ok: false,
          errorCode: "STORE_NOT_FOUND",
          errorMessage: "Loja não encontrada.",
        };
      }

      // 4. Idempotência
      const existing = await tx.query.orderTable.findFirst({
        where: and(
          eq(orderTable.storeId, store.id),
          eq(orderTable.idempotencyKey, data.idempotencyKey),
        ),
      });
      if (existing) {
        const message = await rebuildMessageForExisting(
          tx,
          store.name,
          data.customerName,
          existing.id,
          existing.shortCode,
          existing.publicToken,
          existing.totalInCents,
          data.customerNotes ?? undefined,
        );
        return {
          ok: true,
          shortCode: existing.shortCode,
          whatsappUrl: buildWhatsAppUrl(store.whatsappNumber, message ?? ""),
        };
      }

      // 5. Carregar produtos + variantes
      const productIds = Array.from(new Set(data.items.map((i) => i.productId)));
      const variantIds = data.items
        .map((i) => i.variantId)
        .filter((v): v is string => v !== null);
      const uniqueVariantIds = Array.from(new Set(variantIds));

      const [products, variants] = await Promise.all([
        tx
          .select()
          .from(productTable)
          .where(
            and(
              eq(productTable.storeId, store.id),
              eq(productTable.isActive, true),
              inArray(productTable.id, productIds),
            ),
          ),
        uniqueVariantIds.length > 0
          ? tx
              .select()
              .from(productVariantTable)
              .where(
                and(
                  eq(productVariantTable.storeId, store.id),
                  eq(productVariantTable.isActive, true),
                  inArray(productVariantTable.id, uniqueVariantIds),
                ),
              )
          : Promise.resolve([]),
      ]);

      if (products.length !== productIds.length) {
        const found = new Set(products.map((p) => p.id));
        const missing = productIds.filter((id) => !found.has(id));
        return {
          ok: false,
          errorCode: "PRODUCT_NOT_FOUND",
          errorMessage:
            "Algum produto não está mais disponível. Atualize a sacola.",
          outOfStockProductIds: missing,
        };
      }

      const productById = new Map(products.map((p) => [p.id, p]));
      const variantById = new Map(variants.map((v) => [v.id, v]));

      // 6. Validar estoque + 7. calcular preço efetivo
      const now = new Date();
      const outOfStock: string[] = [];
      const computedItems: Array<{
        productId: string;
        variantId: string | null;
        productName: string;
        variantName: string | null;
        imageUrl: string | null;
        priceInCents: number;
        quantity: number;
      }> = [];
      let totalInCents = 0;

      for (const item of data.items) {
        const product = productById.get(item.productId);
        if (!product) {
          outOfStock.push(item.productId);
          continue;
        }

        let variant: typeof variants[number] | null = null;
        if (item.variantId) {
          variant = variantById.get(item.variantId) ?? null;
          if (!variant || variant.productId !== product.id) {
            outOfStock.push(item.productId);
            continue;
          }
        }

        // Estoque via fonte da verdade compartilhada com o client (PDP).
        const stock = resolveStockState(
          { trackStock: product.trackStock, stockQuantity: product.stockQuantity },
          variant
            ? { trackStock: variant.trackStock, stockQuantity: variant.stockQuantity }
            : null,
        );
        if (isStockExhausted(stock, item.quantity)) {
          outOfStock.push(item.productId);
          continue;
        }

        // Preço efetivo: variante manda se tem priceInCents próprio.
        const basePriceInCents =
          variant?.priceInCents ?? product.basePriceInCents;
        const promoPriceInCents =
          variant?.promoPriceInCents ?? product.promoPriceInCents;
        const promoFields = {
          basePriceInCents,
          promoPriceInCents,
          promoStartsAt: product.promoStartsAt,
          promoEndsAt: product.promoEndsAt,
        };
        const effective = getEffectivePrice(promoFields, now);

        computedItems.push({
          productId: product.id,
          variantId: variant?.id ?? null,
          productName: product.name,
          variantName: variant?.name ?? null,
          imageUrl: null, // será preenchido depois
          priceInCents: effective,
          quantity: item.quantity,
        });
        totalInCents += effective * item.quantity;
      }

      if (outOfStock.length > 0) {
        return {
          ok: false,
          errorCode: "OUT_OF_STOCK",
          errorMessage:
            "Algum item não tem mais estoque suficiente. Atualize a sacola.",
          outOfStockProductIds: Array.from(new Set(outOfStock)),
        };
      }

      if (computedItems.length === 0) {
        return {
          ok: false,
          errorCode: "EMPTY_CART",
          errorMessage: "Sacola vazia.",
        };
      }

      // Anexa imageUrl (1ª foto position=0) — 1 query batch
      const imgs = await tx
        .select({
          productId: productImageTable.productId,
          url: productImageTable.url,
          position: productImageTable.position,
        })
        .from(productImageTable)
        .where(
          and(
            eq(productImageTable.storeId, store.id),
            inArray(productImageTable.productId, productIds),
          ),
        )
        .orderBy(asc(productImageTable.position));
      const firstImageBy = new Map<string, string>();
      for (const img of imgs) {
        if (!firstImageBy.has(img.productId)) {
          firstImageBy.set(img.productId, img.url);
        }
      }
      for (const ci of computedItems) {
        ci.imageUrl = firstImageBy.get(ci.productId) ?? null;
      }

      // 8. Gerar shortCode com retry
      // 9. INSERT order + items dentro de transação
      const phone = parseWhatsAppBR(data.customerPhone);
      const expiresAt = new Date(
        Date.now() + ORDER_TTL_DAYS * 24 * 60 * 60 * 1000,
      );

      let createdOrderId: string | null = null;
      let createdShortCode: string | null = null;
      let createdPublicToken: string | null = null;
      let lastError: unknown = null;

      for (let attempt = 0; attempt < MAX_SHORTCODE_RETRIES; attempt += 1) {
        const candidate = generateShortCode();
        const publicToken = generatePublicOrderToken();
        try {
          await tx.transaction(async (innerTx) => {
            for (const ci of computedItems) {
              const product = productById.get(ci.productId);
              const variant = ci.variantId ? variantById.get(ci.variantId) : null;
              const shouldDecrementVariant = Boolean(
                variant?.trackStock && variant.stockQuantity !== null,
              );
              const shouldDecrementProduct = Boolean(
                !shouldDecrementVariant &&
                  product?.trackStock &&
                  product.stockQuantity !== null,
              );

              if (shouldDecrementVariant && variant) {
                const updated = await innerTx
                  .update(productVariantTable)
                  .set({
                    stockQuantity: sql`${productVariantTable.stockQuantity} - ${ci.quantity}`,
                  })
                  .where(
                    and(
                      eq(productVariantTable.id, variant.id),
                      eq(productVariantTable.storeId, store.id),
                      gte(productVariantTable.stockQuantity, ci.quantity),
                    ),
                  )
                  .returning({ id: productVariantTable.id });

                if (updated.length === 0) {
                  throw new OutOfStockError(ci.productId);
                }
              }

              if (shouldDecrementProduct) {
                const updated = await innerTx
                  .update(productTable)
                  .set({
                    stockQuantity: sql`${productTable.stockQuantity} - ${ci.quantity}`,
                  })
                  .where(
                    and(
                      eq(productTable.id, ci.productId),
                      eq(productTable.storeId, store.id),
                      gte(productTable.stockQuantity, ci.quantity),
                    ),
                  )
                  .returning({ id: productTable.id });

                if (updated.length === 0) {
                  throw new OutOfStockError(ci.productId);
                }
              }
            }

            const inserted = await innerTx
              .insert(orderTable)
              .values({
                storeId: store.id,
                shortCode: candidate,
                publicToken,
                idempotencyKey: data.idempotencyKey,
                customerName: data.customerName,
                customerPhone: phone.e164,
                customerNotes: data.customerNotes || null,
                totalInCents,
                status: "awaiting_whatsapp",
                expiresAt,
              })
              .returning({ id: orderTable.id });

            const orderRow = inserted[0];
            if (!orderRow) throw new Error("INSERT order não retornou id");

            await innerTx.insert(orderItemTable).values(
              computedItems.map((ci) => ({
                orderId: orderRow.id,
                productId: ci.productId,
                variantId: ci.variantId,
                productNameSnapshot: ci.productName,
                variantNameSnapshot: ci.variantName,
                imageUrlSnapshot: ci.imageUrl,
                priceInCentsSnapshot: ci.priceInCents,
                quantity: ci.quantity,
              })),
            );

            createdOrderId = orderRow.id;
            createdShortCode = candidate;
            createdPublicToken = publicToken;
          });
          break; // sucesso
        } catch (err: unknown) {
          lastError = err;
          if (err instanceof OutOfStockError) {
            return {
              ok: false,
              errorCode: "OUT_OF_STOCK",
              errorMessage:
                "Algum item não tem mais estoque suficiente. Atualize a sacola.",
              outOfStockProductIds: [err.productId],
            };
          }
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes("order_short_code_unique") || msg.includes("short_code")) {
            // Colisão de shortCode — tenta de novo.
            continue;
          }
          if (msg.includes("order_store_idempotency_unique")) {
            // Race com outra request usando mesma idempotency key —
            // recupera o pedido existente e retorna.
            const existingRace = await tx.query.orderTable.findFirst({
              where: and(
                eq(orderTable.storeId, store.id),
                eq(orderTable.idempotencyKey, data.idempotencyKey),
              ),
            });
            if (existingRace) {
              createdOrderId = existingRace.id;
              createdShortCode = existingRace.shortCode;
              createdPublicToken = existingRace.publicToken;
              break;
            }
          }
          // Outro erro — propaga.
          throw err;
        }
      }

      if (!createdOrderId || !createdShortCode || !createdPublicToken) {
        return {
          ok: false,
          errorCode: "SHORTCODE_RETRY_EXHAUSTED",
          errorMessage:
            lastError instanceof Error
              ? lastError.message
              : "Não foi possível gerar código do pedido. Tente novamente.",
        };
      }

      // 10. Mensagem WhatsApp + URL
      const baseUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
      const publicUrl = `${baseUrl}/p/${createdPublicToken}`;
      const messageItems: WhatsAppItemInput[] = computedItems.map((ci) => ({
        productName: ci.productName,
        variantName: ci.variantName,
        quantity: ci.quantity,
        priceInCents: ci.priceInCents,
      }));

      const message = buildOrderMessage({
        storeName: store.name,
        customerName: data.customerName,
        items: messageItems,
        totalInCents,
        shortCode: createdShortCode,
        publicUrl,
        customerNotes: data.customerNotes || undefined,
      });

      // Convenção #4 do CLAUDE.md: mutações que afetam catálogo público
      // invalidam o cache do storefront. Estoque foi decrementado, então
      // PDP/listagens precisam ler fresh.
      revalidateTag(`store-${store.slug}`);

      return {
        ok: true,
        shortCode: createdShortCode,
        whatsappUrl: buildWhatsAppUrl(store.whatsappNumber, message),
      };
    },
  );
}

/**
 * Reconstrói mensagem WhatsApp pra um pedido já existente (retorno de
 * idempotency hit). Carrega items+produto pra re-snapshot.
 */
async function rebuildMessageForExisting(
  tx: Parameters<Parameters<typeof withServiceRole>[1]>[0],
  storeName: string,
  customerName: string,
  orderId: string,
  shortCode: string,
  publicToken: string,
  totalInCents: number,
  notes?: string,
): Promise<string> {
  const items = await tx
    .select()
    .from(orderItemTable)
    .where(eq(orderItemTable.orderId, orderId));

  const baseUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  return buildOrderMessage({
    storeName,
    customerName,
    items: items.map((it) => ({
      productName: it.productNameSnapshot,
      variantName: it.variantNameSnapshot,
      quantity: it.quantity,
      priceInCents: it.priceInCentsSnapshot,
    })),
    totalInCents,
    shortCode,
    publicUrl: `${baseUrl}/p/${publicToken}`,
    customerNotes: notes,
  });
}
