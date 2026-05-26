"use server";

/**
 * createBalcaoSale (Fase 5 — ADR-0016)
 *
 * Action de PDV: registra venda balcão admin-side. Diferenças vs. checkout
 * WhatsApp (`create-from-cart.ts`):
 *   - admin autenticado (cai em `withTenant(storeId, userId, ...)` — owner)
 *   - sem `customerName`/`customerPhone` obrigatórios (walk-in dominante)
 *   - `paymentMethod` obrigatório (CHECK constraint do SQL 26 garante)
 *   - nasce `status='confirmed'` (venda fechada + paga + estoque baixado).
 *     Antes (até 2026-05-24) nascia 'fulfilled' direto, pulando o passo
 *     "entregar" — confundia o lojista, que via venda na aba "Cumpridos"
 *     sem ter feito a entrega. Agora vai pra "Confirmados" e o lojista
 *     marca 'fulfilled' manualmente quando o cliente leva (útil pra
 *     retirada agendada / despacho posterior). Ambos contam em
 *     COUNTABLE_STATUSES (faturamento/CMV/margem inalterados).
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
  CouponError,
  incrementCouponUsesTx,
  validateCouponInTx,
} from "@/actions/coupon/internal";
import {
  cashSessionTable,
  customerTable,
  orderItemTable,
  orderPaymentTable,
  orderTable,
  productTable,
  productVariantTable,
  receivableTable,
  storeTable,
} from "@/db/schema";
import { recordAuditEvent } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { recordSaleMovements } from "@/lib/order/record-sale-movements";
import { resolveVariantPrice } from "@/lib/pricing";
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
  PAYMENT_METHOD_VALUES,
} from "./schema";

export type CreateBalcaoSaleErrorCode =
  | "UNAUTHORIZED"
  | "VALIDATION"
  | "RATE_LIMIT"
  | "STORE_NOT_FOUND"
  | "PRODUCT_NOT_FOUND"
  | "OUT_OF_STOCK"
  | "CUSTOMER_NOT_FOUND"
  | "CUSTOMER_REQUIRED_FOR_FIADO"
  | "CASH_RECEIVED_TOO_LOW"
  | "DISCOUNT_OVER_TOTAL"
  | "ITEM_DISCOUNT_OVER_LINE"
  | "PAYMENTS_SUM_MISMATCH"
  | "COUPON_INVALID"
  | "SHORTCODE_RETRY_EXHAUSTED"
  // Sprint 3.5 — store.require_open_cash_session=true bloqueia venda
  // sem cash_session ativa.
  | "CASH_SESSION_REQUIRED"
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

/**
 * Audit 2026-05-26 — gatilho da auditoria de desconto manual. Acima
 * desse percentual do subtotal, grava `order.large_discount_applied` em
 * audit_event pra lojista revisar depois (anti-fraude de vendedora que
 * dá 50% pra amigo).
 *
 * 10% é o padrão; futuro: configurável por loja (Sprint própria PIN).
 */
const LARGE_DISCOUNT_PCT_THRESHOLD = 10;

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
        // 5. Customer (opcional) — confirma que pertence à loja, OU
        //    aceita venda rápida (walkInName) sem cadastro no DB.
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
        } else if (data.walkInName) {
          // Venda rápida: snapshot direto no order, sem cadastro de customer.
          customerSnapshotName = data.walkInName;
          customerSnapshotPhone = data.walkInPhone;
        }

        // 6. Agrega itens por (productId, variantId) — protege contra
        //    duplicatas no payload (mesmo product 2x). Descontos por linha
        //    SOMAM quando o mesmo item duplica (defesa em depth; UI normal
        //    não duplica, mas payload tampered pode). CHECK constraint
        //    final (no DB) garante que o total agregado nunca passa do
        //    bruto da linha agregada.
        const aggregatedKey = (p: string, v: string | null) =>
          `${p}|${v ?? ""}`;
        const aggregated = new Map<
          string,
          {
            productId: string;
            variantId: string | null;
            quantity: number;
            discountInCents: number;
          }
        >();
        for (const it of data.items) {
          const k = aggregatedKey(it.productId, it.variantId);
          const itDiscount = it.discountInCents ?? 0;
          const cur = aggregated.get(k);
          if (cur) {
            cur.quantity += it.quantity;
            cur.discountInCents += itDiscount;
          } else {
            aggregated.set(k, {
              productId: it.productId,
              variantId: it.variantId,
              quantity: it.quantity,
              discountInCents: itDiscount,
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
            // Sprint 1.2 (2026-05-22): bypassa OutOfStockError quando true.
            // Caso de uso: pré-venda / encomenda / sob medida — lojista
            // cobra agora, providencia depois. Estoque vai negativo como
            // sinal de "pendência de entrega".
            allowOversell: true,
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
                  promoPriceInCents: true,
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
          /** Desconto da linha em centavos. NULL = sem desconto (default). */
          itemDiscountInCents: number | null;
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

          // ADR-0026 / fix auditoria B3 — usa helper que honra
          // `variant.promoPriceInCents` quando presente (storefront/
          // checkout já honrava; PDV antes ignorava). Janela é sempre
          // do product (variant não tem startsAt/endsAt própria).
          const effectivePrice = resolveVariantPrice(
            variant
              ? {
                  priceInCents: variant.priceInCents,
                  promoPriceInCents: variant.promoPriceInCents,
                }
              : null,
            {
              basePriceInCents: product.basePriceInCents,
              promoPriceInCents: product.promoPriceInCents,
              promoStartsAt: product.promoStartsAt,
              promoEndsAt: product.promoEndsAt,
            },
            now,
          );

          // Desconto por linha (Fase 4 / pulo de sprint 2026-05-21).
          // Server-side defesa: nunca > price × qty (CHECK no DB também
          // pega via supabase/sql/59). Subtrai do bruto antes de somar no
          // subtotal — o subtotal já vem LÍQUIDO de descontos por linha.
          const lineGross = effectivePrice * it.quantity;
          const rawItemDiscount = it.discountInCents;
          if (rawItemDiscount > lineGross) {
            return {
              ok: false,
              errorCode: "ITEM_DISCOUNT_OVER_LINE" as const,
              errorMessage: `Desconto do item "${product.name}" maior que o subtotal da linha.`,
            };
          }
          const itemDiscountInCents = rawItemDiscount > 0 ? rawItemDiscount : null;

          subtotalInCents += lineGross - rawItemDiscount;
          computedItems.push({
            productId: it.productId,
            variantId: it.variantId,
            productName: product.name,
            variantName: variant?.name ?? null,
            priceInCents: effectivePrice,
            quantity: it.quantity,
            itemDiscountInCents,
          });
        }

        // 9. Aplicar cupom (se fornecido) — server RECALCULA discount.
        //
        // ADR-0026 / fix auditoria 2026-05-18: quando UI envia couponId,
        // o server revalida cupom dentro do tx e descarta o
        // `discountInCents` do payload (anti-tampering). Se o cupom
        // não passar (esgotado, expirado, etc), retorna COUPON_INVALID
        // — UI deve recarregar e mostrar erro.
        //
        // Sem couponId, `discountInCents` do payload é desconto manual
        // do lojista (operador digitou %/valor sem cupom cadastrado).
        let validatedCoupon: { couponId: string; discountInCents: number } | null = null;
        if (data.couponId) {
          try {
            const result = await validateCouponInTx(tx, {
              storeId: store.id,
              couponId: data.couponId,
              subtotalInCents,
            });
            validatedCoupon = {
              couponId: result.couponId,
              discountInCents: result.discountInCents,
            };
          } catch (err) {
            if (err instanceof CouponError) {
              return {
                ok: false,
                errorCode: "COUPON_INVALID" as const,
                errorMessage: err.message,
              };
            }
            throw err;
          }
        }

        // S8 auditoria 2026-05-19 — server-side authoritative:
        //
        //   - com couponId: server usa validatedCoupon.discountInCents e
        //     IGNORA `data.discountInCents` (recomputado de coupon table
        //     dentro do tx; client não dita o número).
        //   - sem couponId: aceita `data.discountInCents` como desconto
        //     manual do lojista (operador digitou %/valor), mas valida
        //     contra subtotal pra impedir total negativo.
        //
        // Se o client mandou `discountInCents` JUNTO com couponId, logamos
        // como warning pra rastrear UI quebrada/tampering, mas NÃO falhamos
        // (cupom server-side vence — não vale punir UX por bug do cliente).
        let discount: number;
        if (validatedCoupon) {
          discount = validatedCoupon.discountInCents;
          if (
            data.discountInCents !== null &&
            data.discountInCents !== undefined &&
            data.discountInCents !== validatedCoupon.discountInCents
          ) {
            logger.warn("balcao.discount_payload_overridden_by_coupon", {
              storeId: store.id,
              couponId: validatedCoupon.couponId,
              payloadDiscount: data.discountInCents,
              serverDiscount: validatedCoupon.discountInCents,
            });
          }
        } else {
          discount = data.discountInCents ?? 0;
        }
        const surcharge = data.surchargeInCents ?? 0;
        if (discount < 0 || discount > subtotalInCents) {
          return {
            ok: false,
            errorCode: "DISCOUNT_OVER_TOTAL" as const,
            errorMessage: "Desconto maior que o subtotal da venda.",
          };
        }
        const totalInCents = subtotalInCents - discount + surcharge;

        // idempotency key compartilhada entre branches sale/quote
        // (declarada antes pra que ambos retry loops possam usar).
        const idempotencyKey = randomUUID();

        // ADR-0022 D1 — auto-attach sessão de caixa ATIVA se houver.
        // Sem sessão aberta: cashSessionId = null (vendas sem caixa
        // formal continuam funcionando, opt-in adoption). RLS-scoped via
        // withTenant(storeId). Lookup uma vez antes dos branches porque
        // os 3 modos (quote/fiado/sale) podem precisar do id —
        // hoisting do const NÃO funciona, declarando aqui em cima
        // antes do primeiro consumo (branch fiado em particular).
        const [activeCashSession] = await tx
          .select({ id: cashSessionTable.id })
          .from(cashSessionTable)
          .where(
            and(
              eq(cashSessionTable.storeId, store.id),
              sql`${cashSessionTable.closedAt} IS NULL`,
            ),
          )
          .limit(1);
        const cashSessionIdForOrder = activeCashSession?.id ?? null;

        // Sprint 3.5 — setting opt-in que exige caixa aberto pra venda
        // balcão. Default false preserva comportamento antigo (só
        // banner amarelo da Onda 2.6). Orçamento (quote) NÃO requer
        // caixa — não há entrada de dinheiro. Vendas e fiado, sim.
        if (
          store.requireOpenCashSession &&
          cashSessionIdForOrder === null &&
          data.mode !== "quote"
        ) {
          return {
            ok: false,
            errorCode: "CASH_SESSION_REQUIRED" as const,
            errorMessage:
              "Caixa fechado. Abra um caixa antes de registrar venda (configurado em /admin/configuracoes).",
          };
        }

        // ============================================================
        // Sprint 1A Fase 4 — BRANCH ORÇAMENTO (mode='quote')
        //
        // Orçamento difere de venda em 3 pontos:
        //   1. Sem payments[] → pula validação de soma e INSERT em
        //      orderPaymentTable
        //   2. Sem stock_movement (cliente não levou nada — só cotou)
        //   3. status='quote', short_code prefixado com 'Q-',
        //      quote_valid_until = now + quoteValidityDays
        //
        // Mantém: items registrados em orderItemTable (lojista vai usar
        // pra reabrir o orçamento depois), customer/walk-in snapshots,
        // cupom validado, idempotency key, retry loop de short_code.
        // ============================================================
        if (data.mode === "quote") {
          const quoteValidUntil = new Date(
            Date.now() + data.quoteValidityDays * 24 * 60 * 60 * 1000,
          );

          let quoteOrderId: string | null = null;
          let quoteShortCode: string | null = null;
          let quotePublicToken: string | null = null;
          let quoteLastError: unknown = null;

          for (let attempt = 0; attempt < MAX_SHORTCODE_RETRIES; attempt++) {
            const candidate = "Q-" + generateShortCode();
            const publicToken = generatePublicOrderToken();
            try {
              await tx.transaction(async (innerTx) => {
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
                    status: "quote",
                    channel: "balcao",
                    paymentMethod: null,
                    discountInCents: discount > 0 ? discount : null,
                    surchargeInCents:
                      data.surchargeInCents ?? null,
                    cashReceivedInCents: null,
                    expiresAt: null,
                    confirmedAt: null,
                    cashSessionId: null,
                    couponId: validatedCoupon?.couponId ?? null,
                    quoteValidUntil,
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
                      imageUrlSnapshot: null,
                      priceInCentsSnapshot: ci.priceInCents,
                      quantity: ci.quantity,
                      discountInCents: ci.itemDiscountInCents,
                    })),
                  );
                }

                // NÃO incrementa coupon (orçamento ainda não consumiu);
                // NÃO insere orderPayment; NÃO desconta stock.

                quoteOrderId = orderRow.id;
                quoteShortCode = candidate;
                quotePublicToken = publicToken;
              });
              break;
            } catch (err: unknown) {
              quoteLastError = err;
              const msg = err instanceof Error ? err.message : String(err);
              if (
                msg.includes("order_short_code_unique") ||
                msg.includes("short_code")
              ) {
                continue;
              }
              throw err;
            }
          }

          if (!quoteOrderId || !quoteShortCode || !quotePublicToken) {
            logger.error("balcao.quote_shortcode_retry_exhausted", {
              err: quoteLastError,
              storeId: store.id,
            });
            return {
              ok: false,
              errorCode: "SHORTCODE_RETRY_EXHAUSTED" as const,
              errorMessage:
                "Falha ao gerar código único do orçamento. Tente novamente.",
            };
          }

          logger.info("balcao.quote_created", {
            storeId: store.id,
            orderId: quoteOrderId,
            shortCode: quoteShortCode,
            quoteValidUntil,
          });

          const storeRow = await tx.query.storeTable.findFirst({
            where: eq(storeTable.id, store.id),
            columns: { slug: true },
          });
          if (storeRow?.slug) {
            revalidateTag(`store-${storeRow.slug}`);
          }
          revalidatePath("/admin/pdv");
          revalidatePath("/admin/pedidos");

          return {
            ok: true,
            orderId: quoteOrderId,
            shortCode: quoteShortCode,
            publicToken: quotePublicToken,
          };
        }

        // ============================================================
        // Sprint 1A Fase 5 — BRANCH FIADO (mode='fiado')
        //
        // Fiado difere de venda em 4 pontos:
        //   1. customerId obrigatório (Zod já garante; defesa extra aqui).
        //   2. Sem payments[] → pula INSERT em orderPaymentTable.
        //   3. Status='confirmed' (venda confirmada, só não tem dinheiro
        //      AINDA — será pago em data futura).
        //   4. INSERT em receivableTable: amount = totalInCents,
        //      due_date = now + dueDaysFromNow, paid_at = null.
        //
        // Mantém estoque (cliente LEVOU a peça): mesmo retry loop com
        // advisory locks + recordSaleMovements do branch sale.
        // ============================================================
        if (data.mode === "fiado") {
          if (!data.customerId) {
            return {
              ok: false,
              errorCode: "CUSTOMER_REQUIRED_FOR_FIADO" as const,
              errorMessage: "Cliente obrigatório para venda fiada.",
            };
          }

          const dueDate = new Date(
            Date.now() + data.dueDaysFromNow * 24 * 60 * 60 * 1000,
          );

          let fiadoOrderId: string | null = null;
          let fiadoShortCode: string | null = null;
          let fiadoPublicToken: string | null = null;
          let fiadoLastError: unknown = null;
          let fiadoSoftFailure: CreateBalcaoSaleResult | null = null;

          for (let attempt = 0; attempt < MAX_SHORTCODE_RETRIES; attempt++) {
            const candidate = generateShortCode();
            const publicToken = generatePublicOrderToken();
            try {
              await tx.transaction(async (innerTx) => {
                // Mesma lógica de estoque do branch sale: advisory lock
                // por entidade + releitura + check + monta salesToRecord.
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

                  if (!targetVariant && !targetProduct) continue;

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
                    // Sprint 1.2: produto marcado como `allow_oversell`
                    // bypassa o bloqueio. Movimento ainda é registrado;
                    // saldo final vira negativo (sinal de "pendência de
                    // entrega"). Não-flag continua bloqueando.
                    if (!product?.allowOversell) {
                      throw new OutOfStockError(ci.productId);
                    }
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
                    status: "confirmed",
                    channel: "balcao",
                    paymentMethod: null,
                    discountInCents: discount > 0 ? discount : null,
                    surchargeInCents:
                      data.surchargeInCents ?? null,
                    cashReceivedInCents: null,
                    expiresAt: null,
                    confirmedAt: new Date(),
                    cashSessionId: cashSessionIdForOrder,
                    couponId: validatedCoupon?.couponId ?? null,
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
                      imageUrlSnapshot: null,
                      priceInCentsSnapshot: ci.priceInCents,
                      quantity: ci.quantity,
                      discountInCents: ci.itemDiscountInCents,
                    })),
                  );
                }

                await recordSaleMovements(innerTx as unknown as Tx, {
                  storeId: store.id,
                  orderId: orderRow.id,
                  sales: salesToRecord,
                });

                if (validatedCoupon) {
                  await incrementCouponUsesTx(innerTx as unknown as Tx, {
                    storeId: store.id,
                    couponId: validatedCoupon.couponId,
                  });
                }

                // Sprint 1A Fase 5 — INSERT em receivable.
                await innerTx.insert(receivableTable).values({
                  storeId: store.id,
                  customerId: data.customerId!,
                  orderId: orderRow.id,
                  amountInCents: totalInCents,
                  dueDate,
                  paidAt: null,
                  createdByUserId: userId,
                });

                fiadoOrderId = orderRow.id;
                fiadoShortCode = candidate;
                fiadoPublicToken = publicToken;
              });
              break;
            } catch (err: unknown) {
              fiadoLastError = err;
              if (err instanceof OutOfStockError) {
                fiadoSoftFailure = {
                  ok: false,
                  errorCode: "OUT_OF_STOCK",
                  errorMessage: "Algum item não tem estoque suficiente.",
                  outOfStockProductIds: [err.productId],
                };
                break;
              }
              if (err instanceof CouponError) {
                fiadoSoftFailure = {
                  ok: false,
                  errorCode: "COUPON_INVALID",
                  errorMessage: err.message,
                };
                break;
              }
              const msg = err instanceof Error ? err.message : String(err);
              if (
                msg.includes("order_short_code_unique") ||
                msg.includes("short_code")
              ) {
                continue;
              }
              throw err;
            }
          }

          if (fiadoSoftFailure) return fiadoSoftFailure;
          if (!fiadoOrderId || !fiadoShortCode || !fiadoPublicToken) {
            logger.error("balcao.fiado_shortcode_retry_exhausted", {
              err: fiadoLastError,
              storeId: store.id,
            });
            return {
              ok: false,
              errorCode: "SHORTCODE_RETRY_EXHAUSTED" as const,
              errorMessage:
                "Falha ao gerar código único da venda fiada. Tente novamente.",
            };
          }

          logger.info("balcao.fiado_created", {
            storeId: store.id,
            orderId: fiadoOrderId,
            shortCode: fiadoShortCode,
            customerId: data.customerId,
            dueDate,
          });

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
            orderId: fiadoOrderId,
            shortCode: fiadoShortCode,
            publicToken: fiadoPublicToken,
          };
        }

        // 10. Normalizar pagamento → payments[] canônico.
        //
        // Sprint 1A: action aceita 2 formatos:
        //   - NOVO: data.payments = [{method, amount, cashReceived, notes}, ...]
        //   - LEGADO: data.paymentMethod + data.cashReceivedInCents (Sprint 1B remove)
        //
        // Quando recebe LEGADO, converte para 1 linha em payments[] com
        // amount = totalInCents. Loga warning pra rastrear callers do
        // formato antigo (UI nova deve enviar payments[] direto).
        type NormalizedPayment = {
          method: typeof PAYMENT_METHOD_VALUES[number];
          amountInCents: number;
          cashReceivedInCents: number | null;
          /** Parcelas (1..24). Só > 1 quando method='credit'. */
          installments: number;
          notes: string | null;
        };

        // Sprint 4C — saldo a virar fiado (NULL ou 0 = sem fiado).
        const creditAmountInCents = data.creditAmountInCents ?? 0;
        const hasCredit = creditAmountInCents > 0;

        if (hasCredit && !data.customerId) {
          return {
            ok: false,
            errorCode: "CUSTOMER_REQUIRED_FOR_FIADO" as const,
            errorMessage:
              "Cliente obrigatório quando há saldo a fiado.",
          };
        }

        let payments: NormalizedPayment[];
        if (data.payments && data.payments.length > 0) {
          payments = data.payments.map((p) => ({
            method: p.method,
            amountInCents: p.amountInCents,
            cashReceivedInCents: p.cashReceivedInCents,
            installments: p.installments,
            notes: p.notes,
          }));
        } else if (data.paymentMethod) {
          logger.warn("balcao.legacy_payment_payload", {
            storeId: store.id,
            paymentMethod: data.paymentMethod,
          });
          payments = [
            {
              method: data.paymentMethod,
              amountInCents: totalInCents - creditAmountInCents,
              cashReceivedInCents:
                data.paymentMethod === "cash"
                  ? data.cashReceivedInCents ?? null
                  : null,
              installments: 1,
              notes: null,
            },
          ];
        } else if (hasCredit) {
          // Sprint 4C — venda 100% fiada via campo novo (equivalente a
          // mode='fiado', mas dentro de mode='sale' pro fluxo unificado).
          payments = [];
        } else {
          // Zod superRefine já barra isso, mas fallback defensivo.
          return {
            ok: false,
            errorCode: "VALIDATION" as const,
            errorMessage: "Defina ao menos uma forma de pagamento.",
          };
        }

        // Sprint 4C — validar soma considerando saldo a fiado:
        //   SUM(payments) + creditAmount === totalInCents
        const paymentsSum = payments.reduce(
          (acc, p) => acc + p.amountInCents,
          0,
        );
        if (paymentsSum + creditAmountInCents !== totalInCents) {
          return {
            ok: false,
            errorCode: "PAYMENTS_SUM_MISMATCH" as const,
            errorMessage: hasCredit
              ? `Soma pagamentos (R$ ${(paymentsSum / 100).toFixed(2)}) + fiado (R$ ${(creditAmountInCents / 100).toFixed(2)}) difere do total (R$ ${(totalInCents / 100).toFixed(2)}).`
              : `Soma dos pagamentos (R$ ${(paymentsSum / 100).toFixed(2)}) difere do total da venda (R$ ${(totalInCents / 100).toFixed(2)}).`,
          };
        }

        // Validar troco per-linha (cash com received < amount).
        // Zod já valida quando cashReceived é preenchido; aqui é defesa
        // em profundidade pra payload legado.
        for (const p of payments) {
          if (
            p.method === "cash" &&
            p.cashReceivedInCents !== null &&
            p.cashReceivedInCents < p.amountInCents
          ) {
            return {
              ok: false,
              errorCode: "CASH_RECEIVED_TOO_LOW" as const,
              errorMessage: "Valor recebido em dinheiro menor que o valor da linha.",
            };
          }
        }

        // Campos legados gravados no orderTable (compat com UI/queries que
        // ainda leem `order.paymentMethod`/`order.cashReceivedInCents`).
        // Primeira linha vence; soma dos cashReceived das linhas cash.
        // Sprint 4C — quando payments=[] (venda 100% fiada via creditAmount),
        // legacyPaymentMethod fica NULL — mesma semântica de mode='fiado'.
        const legacyPaymentMethod = payments[0]?.method ?? null;
        const legacyCashReceived = payments
          .filter((p) => p.method === "cash" && p.cashReceivedInCents !== null)
          .reduce((acc, p) => acc + (p.cashReceivedInCents ?? 0), 0);
        const legacyCashReceivedFinal = legacyCashReceived > 0 ? legacyCashReceived : null;

        // ADR-0022 D1 — cashSessionIdForOrder já foi resolvido lá em
        // cima (antes dos branches quote/fiado/sale). Reuso aqui.

        // 11. Tx aninhada: locks + estoque + INSERT order/items/movements
        let createdOrderId: string | null = null;
        let createdShortCode: string | null = null;
        let createdPublicToken: string | null = null;
        let lastError: unknown = null;
        let softFailure: CreateBalcaoSaleResult | null = null;

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
                  // Sprint 1.2 — espelha o branch sale: produto com
                  // allow_oversell bypassa o bloqueio. Movimento ainda
                  // entra com saldo negativo.
                  if (!product?.allowOversell) {
                    throw new OutOfStockError(ci.productId);
                  }
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
                  status: "confirmed",
                  channel: "balcao",
                  // Campo legado: Sprint 1B vai remover. Usa primeira linha
                  // de payments[] pra UI/queries antigas continuarem lendo.
                  paymentMethod: legacyPaymentMethod,
                  discountInCents: discount > 0 ? discount : null,
                  surchargeInCents:
                    data.surchargeInCents ?? null,
                  // Campo legado: soma de cash_received das linhas method='cash'
                  // (zero/null se não houve linha cash). Sprint 1B remove.
                  cashReceivedInCents: legacyCashReceivedFinal,
                  // expiresAt nullable na Fase 5 — irrelevante pra balcão.
                  expiresAt: null,
                  confirmedAt: new Date(),
                  // ADR-0022 — auto-attach (null se sem sessão aberta).
                  cashSessionId: cashSessionIdForOrder,
                  // ADR-0026 — FK pra cupom usado (NULL se desconto manual).
                  couponId: validatedCoupon?.couponId ?? null,
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
                    discountInCents: ci.itemDiscountInCents,
                  })),
                );
              }

              // Sprint 1A — gravar N linhas em order_payment (multipayment).
              // Backfill SQL 47 garantiu que pedidos antigos já têm 1 linha
              // baseada em order.payment_method. Daqui pra frente, esta
              // tabela é a fonte da verdade (order.payment_method é compat).
              //
              // Sprint 4C — quando payments=[] (venda 100% fiada via
              // creditAmountInCents), pula o INSERT — o saldo vai pra
              // receivable abaixo.
              if (payments.length > 0) {
                await innerTx.insert(orderPaymentTable).values(
                  payments.map((p) => ({
                    storeId: store.id,
                    orderId: orderRow.id,
                    method: p.method,
                    amountInCents: p.amountInCents,
                    cashReceivedInCents: p.cashReceivedInCents,
                    // Parcelas (default 1 quando não enviado). Zod já
                    // validou range 1..24 + regra "só credit pode > 1".
                    installments: p.installments,
                    notes: p.notes,
                  })),
                );
              }

              // Sprint 4C — fiado parcial dentro de mode='sale': cria
              // receivable do saldo restante. Mesma due_date convention
              // do mode='fiado' (now + dueDaysFromNow). customerId já
              // foi validado lá em cima (hasCredit && !customerId rejeita).
              if (hasCredit) {
                const dueDate = new Date(
                  Date.now() + data.dueDaysFromNow * 24 * 60 * 60 * 1000,
                );
                await innerTx.insert(receivableTable).values({
                  storeId: store.id,
                  customerId: data.customerId!,
                  orderId: orderRow.id,
                  amountInCents: creditAmountInCents,
                  dueDate,
                  paidAt: null,
                  createdByUserId: userId,
                });
              }

              await recordSaleMovements(innerTx as unknown as Tx, {
                storeId: store.id,
                orderId: orderRow.id,
                sales: salesToRecord,
              });

              // ADR-0026 — increment atomic uses_count se cupom usado.
              // WHERE uses_count < max_uses RETURNING garante que se 2
              // PDVs simultâneos consumirem o último uso, o segundo
              // falha aqui e rollback (CouponError EXHAUSTED). Defesa
              // em profundidade: CHECK constraint coupon_uses_within_max
              // (supabase/sql/40_coupon_uses_check.sql).
              if (validatedCoupon) {
                await incrementCouponUsesTx(innerTx as unknown as Tx, {
                  storeId: store.id,
                  couponId: validatedCoupon.couponId,
                });
              }

              // Audit 2026-05-26 — registra desconto manual grande (>10%
              // do subtotal) pra lojista ver depois "quem deu 50% nessa
              // venda". Cupom NÃO entra aqui (auditoria de cupom já vive
              // em uses_count). Mesma transação — rollback derruba audit
              // junto, consistência total.
              if (
                discount > 0 &&
                !validatedCoupon &&
                subtotalInCents > 0 &&
                (discount * 100) / subtotalInCents >
                  LARGE_DISCOUNT_PCT_THRESHOLD
              ) {
                await recordAuditEvent(innerTx as unknown as Tx, {
                  storeId: store.id,
                  actorUserId: userId,
                  action: "order.large_discount_applied",
                  entityType: "order",
                  entityId: orderRow.id,
                  payload: {
                    discountInCents: discount,
                    subtotalInCents,
                    discountPct: Number(
                      ((discount * 100) / subtotalInCents).toFixed(2),
                    ),
                    threshold: LARGE_DISCOUNT_PCT_THRESHOLD,
                    channel: "balcao",
                  },
                });
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
                  "Algum item não tem estoque suficiente.",
                outOfStockProductIds: [err.productId],
              };
              break;
            }
            if (err instanceof CouponError) {
              softFailure = {
                ok: false,
                errorCode: "COUPON_INVALID",
                errorMessage: err.message,
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
