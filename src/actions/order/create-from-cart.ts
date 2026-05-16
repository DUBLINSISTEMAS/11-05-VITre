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
import { and, asc, eq, inArray, sql } from "drizzle-orm";
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
  stockMovementTable,
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
import { ANON_USER_ID, withServiceRole, withTenant } from "@/lib/tenant";
import { parseWhatsAppBR } from "@/lib/whatsapp-format";
import {
  buildOrderMessageFromTemplate,
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
  /**
   * Token opaco de 32 chars usado em fluxos públicos (/sucesso, /p/[token]).
   * shortCode (4 chars) é APENAS pra exibição na UI — adivinhável em rota.
   */
  publicToken?: string;
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

  // 3. Resolve store (service_role — slug→tenant antes de saber id).
  //    Gate H1 da auditoria 2026-05-11: ESCOPO MÍNIMO. Antes a função inteira
  //    rodava sob withServiceRole (BYPASSRLS) — 200+ linhas vulneráveis a bug
  //    cross-tenant. Agora só este SELECT roda em service role; o resto vai
  //    pra withTenant(store.id, ANON_USER_ID, ...) e ganha defesa em
  //    profundidade do RLS (convenção #1).
  type StoreCtx = NonNullable<
    Awaited<ReturnType<typeof resolveStoreBySlug>>
  >;
  const store: StoreCtx | null = await resolveStoreBySlug(data.storeSlug);
  if (!store) {
    return {
      ok: false,
      errorCode: "STORE_NOT_FOUND",
      errorMessage: "Loja não encontrada.",
    };
  }

  return withTenant<CreateOrderResult>(
    store.id,
    ANON_USER_ID,
    async (tx) => {
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
          store.whatsappTemplate,
          data.customerName,
          existing.id,
          existing.shortCode,
          existing.publicToken,
          existing.totalInCents,
          data.customerNotes ?? undefined,
          store.paymentMethodsNote,
        );
        return {
          ok: true,
          shortCode: existing.shortCode,
          publicToken: existing.publicToken,
          whatsappUrl: buildWhatsAppUrl(store.whatsappNumber, message ?? ""),
        };
      }

      // 5. Carregar produtos + variantes
      //
      // Auditoria I6 (2026-05-12): agrega items duplicados por
      // (productId, variantId) ANTES de validar estoque. Sem isso, se o
      // payload tinha 2 entries do mesmo produto/variante (cliente
      // espertinho, bug no client, replay attack), o decremento de
      // estoque rodava 2x — `pg` driver não dedupe nada.
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

      const productIds = Array.from(new Set(inputItems.map((i) => i.productId)));
      const variantIds = inputItems
        .map((i) => i.variantId)
        .filter((v): v is string => v !== null);
      const uniqueVariantIds = Array.from(new Set(variantIds));

      // SÉRIE dentro do withServiceRole tx — `pg` deprecou paralelas no
      // mesmo client. 2 SELECTs com index são rápidos.
      const products = await tx
        .select()
        .from(productTable)
        .where(
          and(
            eq(productTable.storeId, store.id),
            eq(productTable.isActive, true),
            inArray(productTable.id, productIds),
          ),
        );
      const variants =
        uniqueVariantIds.length > 0
          ? await tx
              .select()
              .from(productVariantTable)
              .where(
                and(
                  eq(productVariantTable.storeId, store.id),
                  eq(productVariantTable.isActive, true),
                  inArray(productVariantTable.id, uniqueVariantIds),
                ),
              )
          : [];

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

      for (const item of inputItems) {
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
      // Auditoria I1 (2026-05-12): captura erros "soft" do inner tx
      // (OutOfStock detectado pelo UPDATE com `gte`) sem fazer `return`
      // de dentro do try-catch dentro do callback. Antes, o return
      // interno completava o callback externo do withTenant, que então
      // committa o outer tx — funcional, mas frágil porque qualquer
      // mutação futura adicionada antes do inner tx ficaria committed
      // mesmo após erro. Agora: set softFailure, break do loop, return
      // ÚNICO ao final do callback.
      let softFailure: CreateOrderResult | null = null;

      for (let attempt = 0; attempt < MAX_SHORTCODE_RETRIES; attempt += 1) {
        const candidate = generateShortCode();
        const publicToken = generatePublicOrderToken();
        try {
          await tx.transaction(async (innerTx) => {
            // FASE 4 (ADR-0015): decremento via INSERT em stock_movement
            // do tipo `sale` (trigger SQL atualiza o cache stock_quantity).
            //
            // Atomicidade: pg_advisory_xact_lock por entidade alvo
            // (variant tem prioridade sobre product). Lock é segurado
            // até COMMIT do tx pai — protege contra checkouts concorrentes
            // do mesmo produto (oversell).
            //
            // Ordem: 1) lock + validar estoque; 2) INSERT order; 3)
            // INSERT order_items; 4) INSERT movements com referenceId
            // = orderId. CHECK exige reference_id NOT NULL quando type
            // = 'order', então movements DEPOIS do order.
            interface SaleSpec {
              productId: string;
              variantId: string | null;
              quantity: number;
            }
            const salesToRecord: SaleSpec[] = [];

            for (const ci of computedItems) {
              const product = productById.get(ci.productId);
              const variant = ci.variantId ? variantById.get(ci.variantId) : null;
              const targetVariant = Boolean(
                variant?.trackStock && variant.stockQuantity !== null,
              );
              const targetProduct = Boolean(
                !targetVariant &&
                  product?.trackStock &&
                  product.stockQuantity !== null,
              );

              if (!targetVariant && !targetProduct) {
                // Estoque ilimitado — sem movement, sem lock.
                continue;
              }

              const lockTarget =
                targetVariant && variant ? variant.id : ci.productId;
              await innerTx.execute(
                sql`SELECT pg_advisory_xact_lock(hashtext(${"stock-" + lockTarget}))`,
              );

              let currentStock: number | null = null;
              if (targetVariant && variant) {
                const [row] = await innerTx
                  .select({ stockQuantity: productVariantTable.stockQuantity })
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

            // Fase 4 (ADR-0015): INSERT stock_movement do tipo `sale`
            // pra cada item rastreado. Trigger atualiza cache atomicamente
            // dentro do mesmo COMMIT. Lock advisory já adquirido acima.
            if (salesToRecord.length > 0) {
              await innerTx.insert(stockMovementTable).values(
                salesToRecord.map((s) => ({
                  storeId: store.id,
                  productId: s.productId,
                  variantId: s.variantId,
                  movementType: "sale" as const,
                  quantityDelta: -s.quantity,
                  referenceType: "order",
                  referenceId: orderRow.id,
                })),
              );
            }

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
                "Algum item não tem mais estoque suficiente. Atualize a sacola.",
              outOfStockProductIds: [err.productId],
            };
            break;
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

      if (softFailure) return softFailure;

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

      const message = buildOrderMessageFromTemplate({
        template: store.whatsappTemplate,
        storeName: store.name,
        customerName: data.customerName,
        items: messageItems,
        totalInCents,
        shortCode: createdShortCode,
        publicUrl,
        customerNotes: data.customerNotes || undefined,
        paymentMethodsNote: store.paymentMethodsNote,
      });

      // Convenção #4 do CLAUDE.md: mutações que afetam catálogo público
      // invalidam o cache do storefront. Estoque foi decrementado, então
      // PDP/listagens precisam ler fresh.
      revalidateTag(`store-${store.slug}`);

      return {
        ok: true,
        shortCode: createdShortCode,
        publicToken: createdPublicToken,
        whatsappUrl: buildWhatsAppUrl(store.whatsappNumber, message),
      };
    },
  );
}

/**
 * Resolve store por slug em escopo mínimo de service role (gate H1).
 * Antes a função inteira rodava sob withServiceRole — agora só este SELECT.
 * Retorna apenas os campos que createOrderFromCart precisa downstream.
 */
async function resolveStoreBySlug(
  slug: string,
): Promise<
  | {
      id: string;
      slug: string;
      name: string;
      whatsappNumber: string;
      whatsappTemplate: string | null;
      paymentMethodsNote: string | null;
    }
  | null
> {
  return withServiceRole(
    `createOrderFromCart: resolve store by slug=${slug}`,
    async (tx) => {
      const rows = await tx
        .select({
          id: storeTable.id,
          slug: storeTable.slug,
          name: storeTable.name,
          whatsappNumber: storeTable.whatsappNumber,
          whatsappTemplate: storeTable.whatsappTemplate,
          // Pagamento (Fase 2 — ADR-0013): alimenta {formaPagamento}
          // no template WhatsApp da lojista.
          paymentMethodsNote: storeTable.paymentMethodsNote,
        })
        .from(storeTable)
        .where(
          and(eq(storeTable.slug, slug), eq(storeTable.isActive, true)),
        )
        .limit(1);
      return rows[0] ?? null;
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
  whatsappTemplate: string | null,
  customerName: string,
  orderId: string,
  shortCode: string,
  publicToken: string,
  totalInCents: number,
  notes: string | undefined,
  paymentMethodsNote: string | null,
): Promise<string> {
  const items = await tx
    .select()
    .from(orderItemTable)
    .where(eq(orderItemTable.orderId, orderId));

  const baseUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  return buildOrderMessageFromTemplate({
    template: whatsappTemplate,
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
    paymentMethodsNote,
  });
}
