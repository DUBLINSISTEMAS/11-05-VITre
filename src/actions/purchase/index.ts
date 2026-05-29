"use server";

/**
 * Server actions do domínio purchase (Sprint 3 — Compras + custo médio).
 *
 * Princípios CLAUDE.md aplicados:
 * - RLS-first via withTenant
 * - Zod boundaries
 * - "use server" mutations
 * - Append-only: createPurchase NÃO edita (compra é histórico). Apenas
 *   `paidAt` muda depois via markPurchasePaid.
 * - Snapshot: purchaseItem grava productNameSnapshot + unitCostInCents
 *   (DELETE de produto preserva histórico).
 *
 * Núcleo desta camada: CUSTO MÉDIO MÓVEL PONDERADO (WAC — weighted average).
 * Fórmula:
 *
 *     novo_custo = (saldo_atual * custo_atual + qty_compra * custo_compra)
 *                  / (saldo_atual + qty_compra)
 *
 * Casos especiais:
 *   - saldo_atual = 0 OU custo_atual = null  → novo_custo = custo_compra
 *   - saldo_atual + qty_compra = 0 (impossível com qty > 0 mas defensivo) → mantém
 *
 * Onde grava: product.cost_price_in_cents (não em variant — custo é por
 * produto, mesmo que stock seja por variant).
 *
 * Race conditions: pg_advisory_xact_lock(hashtext('cost-product-<id>'))
 * antes da releitura. Serializa compras concorrentes do mesmo produto.
 */
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import {
  cashAdjustmentTable,
  cashSessionTable,
  expenseTable,
  productTable,
  productVariantTable,
  purchaseItemTable,
  purchaseTable,
  stockMovementTable,
  supplierTable,
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

import {
  type CreatePurchaseInput,
  createPurchaseSchema,
  markPurchasePaidSchema,
} from "./schema";
import type { PurchaseDetail, PurchaseListRow } from "./types";

async function getSessionAndStore() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  const store = await getCurrentStore(session.user.id);
  if (!store) return null;
  return { session, store };
}

export interface LoadPurchasesFilters {
  supplierId?: string | null;
  /** YYYY-MM-DD. Inclusivo. */
  from?: string | null;
  /** YYYY-MM-DD. Inclusivo (até 23:59:59.999). */
  to?: string | null;
  /** "all" (default) | "paid" | "pending" */
  status?: "all" | "paid" | "pending";
  page?: number;
  pageSize?: number;
}

export interface LoadPurchasesOutput {
  rows: PurchaseListRow[];
  total: number;
  totalInCents: number;
  page: number;
  pageSize: number;
}

const DEFAULT_PAGE_SIZE = 30;

/**
 * Bloco H.C (2026-05-29) — listagem paginada com filtros e totalizador.
 *
 * Antes era hard-limit 50, sem filtros — loja madura perdia histórico
 * silenciosamente e "quanto comprei do fornecedor X em maio" exigia SQL.
 *
 * Filtros: fornecedor, intervalo de data (created_at), status (pago/pendente).
 * Output inclui `totalInCents` do conjunto FILTRADO (não da página) pra
 * mostrar "30 compras · R$ X" no header.
 */
export async function loadPurchases(
  filters: LoadPurchasesFilters = {},
): Promise<LoadPurchasesOutput> {
  const ctx = await getSessionAndStore();
  if (!ctx) {
    return { rows: [], total: 0, totalInCents: 0, page: 1, pageSize: DEFAULT_PAGE_SIZE };
  }

  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.max(1, Math.min(100, filters.pageSize ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * pageSize;
  const status = filters.status ?? "all";

  return withTenant(ctx.store.id, ctx.session.user.id, async (tx) => {
    const conditions = [eq(purchaseTable.storeId, ctx.store.id)];
    if (filters.supplierId) {
      conditions.push(eq(purchaseTable.supplierId, filters.supplierId));
    }
    if (filters.from) {
      conditions.push(sql`${purchaseTable.createdAt} >= ${filters.from}::date`);
    }
    if (filters.to) {
      conditions.push(
        sql`${purchaseTable.createdAt} < (${filters.to}::date + interval '1 day')`,
      );
    }
    if (status === "paid") {
      conditions.push(sql`${purchaseTable.paidAt} is not null`);
    } else if (status === "pending") {
      conditions.push(sql`${purchaseTable.paidAt} is null`);
    }
    const whereClause = and(...conditions);

    // Totais do conjunto filtrado (NÃO da página).
    const [totals] = await tx
      .select({
        count: sql<number>`count(*)::int`,
        sum: sql<number>`coalesce(sum(${purchaseTable.totalInCents}), 0)::int`,
      })
      .from(purchaseTable)
      .where(whereClause);
    const total = totals?.count ?? 0;
    const totalInCents = totals?.sum ?? 0;

    if (total === 0) {
      return { rows: [], total: 0, totalInCents: 0, page, pageSize };
    }

    const rows = await tx
      .select({
        id: purchaseTable.id,
        invoiceNumber: purchaseTable.invoiceNumber,
        totalInCents: purchaseTable.totalInCents,
        paidAt: purchaseTable.paidAt,
        paymentMethod: purchaseTable.paymentMethod,
        notes: purchaseTable.notes,
        createdAt: purchaseTable.createdAt,
        supplierId: purchaseTable.supplierId,
        supplierName: supplierTable.name,
      })
      .from(purchaseTable)
      .leftJoin(supplierTable, eq(supplierTable.id, purchaseTable.supplierId))
      .where(whereClause)
      .orderBy(desc(purchaseTable.createdAt))
      .limit(pageSize)
      .offset(offset);

    const ids = rows.map((r) => r.id);
    const counts =
      ids.length > 0
        ? await tx
            .select({
              purchaseId: purchaseItemTable.purchaseId,
              n: sql<number>`count(*)::int`,
            })
            .from(purchaseItemTable)
            .where(inArray(purchaseItemTable.purchaseId, ids))
            .groupBy(purchaseItemTable.purchaseId)
        : [];
    const countById = new Map(counts.map((c) => [c.purchaseId, c.n]));

    return {
      rows: rows.map((r) => ({
        id: r.id,
        invoiceNumber: r.invoiceNumber,
        totalInCents: r.totalInCents,
        paidAt: r.paidAt,
        paymentMethod: r.paymentMethod,
        notes: r.notes,
        createdAt: r.createdAt,
        supplierId: r.supplierId,
        supplierName: r.supplierName,
        itemCount: countById.get(r.id) ?? 0,
      })),
      total,
      totalInCents,
      page,
      pageSize,
    };
  });
}

export async function loadPurchaseDetail(
  purchaseId: string,
): Promise<PurchaseDetail | null> {
  const ctx = await getSessionAndStore();
  if (!ctx) return null;

  return withTenant(ctx.store.id, ctx.session.user.id, async (tx) => {
    const [purchase] = await tx
      .select()
      .from(purchaseTable)
      .where(
        and(
          eq(purchaseTable.id, purchaseId),
          eq(purchaseTable.storeId, ctx.store.id),
        ),
      )
      .limit(1);
    if (!purchase) return null;

    let supplierName: string | null = null;
    if (purchase.supplierId) {
      const [s] = await tx
        .select({ name: supplierTable.name })
        .from(supplierTable)
        .where(eq(supplierTable.id, purchase.supplierId))
        .limit(1);
      supplierName = s?.name ?? null;
    }

    const items = await tx
      .select()
      .from(purchaseItemTable)
      .where(eq(purchaseItemTable.purchaseId, purchaseId));

    return { purchase, supplierName, items };
  });
}

export type CreatePurchaseResult =
  | { ok: true; purchaseId: string; totalInCents: number; itemCount: number }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Registra uma compra completa:
 *   1. INSERT purchase header
 *   2. INSERT N purchase_items em batch (snapshot do nome/custo)
 *   3. Pra cada item: advisory lock + WAC + UPDATE product.cost_price
 *      + UPDATE product/variant.stock_quantity + INSERT stock_movement
 *      type='manual_in' reference_type='purchase'
 *   4. Se `paidNow` E há caixa aberto: INSERT cash_adjustment type='pay_supplier'
 *
 * Tudo numa única transaction. Falha em qualquer item rollback geral.
 */
export async function createPurchase(
  input: CreatePurchaseInput,
): Promise<CreatePurchaseResult> {
  const ctx = await getSessionAndStore();
  if (!ctx) return { ok: false, error: "Sessão expirada." };

  try {
    await checkRateLimit(rateLimits.mutation, ctx.session.user.id);
  } catch (err) {
    if (err instanceof RateLimitError) {
      return { ok: false, error: err.message };
    }
    throw err;
  }

  const parsed = createPurchaseSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (!fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return { ok: false, error: "Verifique os campos.", fieldErrors };
  }
  const data = parsed.data;

  // Quando paidNow=true, paymentMethod precisa estar setado.
  if (data.paidNow && !data.paymentMethod) {
    return {
      ok: false,
      error: "Defina a forma de pagamento ao marcar como pago.",
      fieldErrors: {
        paymentMethod: "Obrigatório quando 'pago agora' está marcado.",
      },
    };
  }

  try {
    return await withTenant<CreatePurchaseResult>(
      ctx.store.id,
      ctx.session.user.id,
      async (tx) => {
        // Valida supplier (se fornecido) pertence à loja.
        if (data.supplierId) {
          const [s] = await tx
            .select({ id: supplierTable.id })
            .from(supplierTable)
            .where(
              and(
                eq(supplierTable.id, data.supplierId),
                eq(supplierTable.storeId, ctx.store.id),
              ),
            )
            .limit(1);
          if (!s) {
            return {
              ok: false,
              error: "Fornecedor não encontrado nesta loja.",
              fieldErrors: {
                supplierId: "Fornecedor inválido.",
              } as Record<string, string>,
            };
          }
        }

        // Pré-carrega produtos e variantes referenciados.
        const productIds = Array.from(
          new Set(data.items.map((i) => i.productId)),
        );
        const products = await tx
          .select({
            id: productTable.id,
            name: productTable.name,
            trackStock: productTable.trackStock,
            costPriceInCents: productTable.costPriceInCents,
          })
          .from(productTable)
          .where(
            and(
              inArray(productTable.id, productIds),
              eq(productTable.storeId, ctx.store.id),
            ),
          );
        if (products.length !== productIds.length) {
          const found = new Set(products.map((p) => p.id));
          const missing = productIds.find((id) => !found.has(id));
          return {
            ok: false,
            error: `Produto não encontrado: ${missing}`,
          };
        }
        const productById = new Map(products.map((p) => [p.id, p]));

        const variantIds = data.items
          .map((i) => i.variantId)
          .filter((v): v is string => v !== null);
        const variants =
          variantIds.length > 0
            ? await tx
                .select({
                  id: productVariantTable.id,
                  productId: productVariantTable.productId,
                  name: productVariantTable.name,
                  trackStock: productVariantTable.trackStock,
                })
                .from(productVariantTable)
                .where(
                  and(
                    inArray(productVariantTable.id, variantIds),
                    eq(productVariantTable.storeId, ctx.store.id),
                  ),
                )
            : [];
        const variantById = new Map(variants.map((v) => [v.id, v]));

        // Validações por item antes do INSERT
        for (const it of data.items) {
          if (it.variantId) {
            const v = variantById.get(it.variantId);
            if (!v) {
              return {
                ok: false,
                error: `Variante não encontrada: ${it.variantId}`,
              };
            }
            if (v.productId !== it.productId) {
              return {
                ok: false,
                error: "Variante não pertence ao produto informado.",
              };
            }
          }
        }

        // Total da compra (Bloco H 2026-05-29):
        //   subtotal = SUM(items.qty * unitCost)
        //   total = subtotal + frete + impostos − desconto
        // Validações:
        //   - desconto não pode exceder subtotal + frete + impostos
        //   - se parcelado (installments preenchido), SUM(parcelas) === total
        const subtotalInCents = data.items.reduce(
          (acc, it) => acc + it.quantity * it.unitCostInCents,
          0,
        );
        const grossWithExtrasInCents =
          subtotalInCents + data.freightInCents + data.taxesInCents;
        if (data.discountInCents > grossWithExtrasInCents) {
          return {
            ok: false,
            error: `Desconto (${data.discountInCents}) maior que subtotal + frete + impostos (${grossWithExtrasInCents}).`,
            fieldErrors: {
              discountInCents: "Acima do total bruto da compra.",
            } as Record<string, string>,
          };
        }
        const totalInCents = grossWithExtrasInCents - data.discountInCents;

        const installmentsCount =
          data.installments.length > 0 ? data.installments.length : 1;

        if (data.installments.length > 0) {
          const installmentsSum = data.installments.reduce(
            (acc, p) => acc + p.amountInCents,
            0,
          );
          if (installmentsSum !== totalInCents) {
            return {
              ok: false,
              error: `Soma das parcelas (${installmentsSum}) não bate com o total calculado (${totalInCents}).`,
              fieldErrors: {
                installments:
                  "Soma das parcelas precisa bater com o total da compra.",
              } as Record<string, string>,
            };
          }
        }

        // Auto-attach a sessão de caixa ATIVA pra registrar pay_supplier
        // quando paidNow=true. Sem sessão aberta, o cash_adjustment NÃO é
        // gerado mas paid_at é registrado na purchase mesmo assim (lojista
        // pode pagar fornecedor fora do horário comercial).
        const [activeCashSession] = await tx
          .select({ id: cashSessionTable.id })
          .from(cashSessionTable)
          .where(
            and(
              eq(cashSessionTable.storeId, ctx.store.id),
              sql`${cashSessionTable.closedAt} IS NULL`,
            ),
          )
          .limit(1);

        // Tx aninhada — toda a operação em um único bloco atômico.
        let purchaseId: string | null = null;
        await tx.transaction(async (innerTx) => {
          const inserted = await innerTx
            .insert(purchaseTable)
            .values({
              storeId: ctx.store.id,
              supplierId: data.supplierId,
              invoiceNumber: data.invoiceNumber,
              totalInCents,
              // Bloco H: snapshotam os agregados da NF.
              freightInCents: data.freightInCents,
              discountInCents: data.discountInCents,
              taxesInCents: data.taxesInCents,
              installmentsCount,
              paidAt: data.paidNow ? new Date() : null,
              paymentMethod: data.paymentMethod,
              notes: data.notes,
              createdByUserId: ctx.session.user.id,
            })
            .returning({ id: purchaseTable.id });
          const row = inserted[0];
          if (!row) throw new Error("INSERT purchase não retornou id");
          purchaseId = row.id;

          // INSERT items em batch com snapshots
          await innerTx.insert(purchaseItemTable).values(
            data.items.map((it) => {
              const p = productById.get(it.productId)!;
              const v = it.variantId ? variantById.get(it.variantId) : null;
              return {
                purchaseId: row.id,
                productId: it.productId,
                variantId: it.variantId,
                productNameSnapshot: p.name,
                variantNameSnapshot: v?.name ?? null,
                quantity: it.quantity,
                unitCostInCents: it.unitCostInCents,
                // Bloco C UX (2026-05-28) — lote + validade opcionais.
                // Quando preenchidos, alimentam /admin/estoque/vencendo
                // (FEFO). Coluna existe no DB desde SQL 79 mas até hoje
                // o form não enviava.
                batchNumber: it.batchNumber,
                expiresAt: it.expiresAt,
                // totalCostInCents é GENERATED ALWAYS no DB (SQL 45).
                // Drizzle ainda exige o valor no INSERT — passamos calculado;
                // DB ignora e usa a expressão (qty * unit_cost).
                totalCostInCents: it.quantity * it.unitCostInCents,
              };
            }),
          );

          // Pra cada item:
          //   1. advisory lock POR PRODUTO (não por variante — custo é
          //      do produto). Se 2 itens da mesma compra são do mesmo
          //      produto (variantes diferentes), o lock é o mesmo —
          //      processa em série.
          //   2. Releitura de saldo_atual + custo_atual do PRODUTO
          //   3. WAC: novo_custo
          //   4. UPDATE product.cost_price_in_cents
          //   5. UPDATE stock_quantity (product OU variant conforme alvo)
          //   6. INSERT stock_movement type='manual_in' reference=purchase
          for (const it of data.items) {
            const product = productById.get(it.productId)!;
            const variant = it.variantId
              ? variantById.get(it.variantId)
              : null;

            // S2.6 (2026-05-26) — WAC variante-aware:
            //   - Se purchase_item tem variant_id: lock + WAC na VARIANTE
            //     (estoque da variante × custo atual da variante).
            //     Joalheria com ouro 18k e banhado mantém cost separado.
            //   - Else: lock + WAC no produto (comportamento legacy pré-S2.6).

            if (variant) {
              // ────── WAC POR VARIANTE ──────
              await innerTx.execute(
                sql`SELECT pg_advisory_xact_lock(hashtext(${"cost-variant-" + variant.id}))`,
              );

              const [variantRow] = await innerTx
                .select({
                  stockQuantity: productVariantTable.stockQuantity,
                  costPriceInCents: productVariantTable.costPriceInCents,
                })
                .from(productVariantTable)
                .where(eq(productVariantTable.id, variant.id));
              if (!variantRow) {
                throw new Error(`Variante ${variant.id} sumiu durante a tx.`);
              }

              // Custo atual da variante: usa o próprio coalesced com o do
              // produto (se variante nunca teve compra com cost, herda).
              const variantStock = variantRow.stockQuantity ?? 0;
              const currentCost =
                variantRow.costPriceInCents ?? product.costPriceInCents ?? 0;
              const newQty = it.quantity;
              const newCost = it.unitCostInCents;
              const totalQty = variantStock + newQty;
              const weightedCost =
                currentCost === 0 || variantStock === 0
                  ? newCost
                  : Math.round(
                      (variantStock * currentCost + newQty * newCost) /
                        totalQty,
                    );

              await innerTx
                .update(productVariantTable)
                .set({ costPriceInCents: weightedCost })
                .where(
                  and(
                    eq(productVariantTable.id, variant.id),
                    eq(productVariantTable.storeId, ctx.store.id),
                  ),
                );
            } else {
              // ────── WAC NO PRODUTO (comportamento legacy) ──────
              await innerTx.execute(
                sql`SELECT pg_advisory_xact_lock(hashtext(${"cost-product-" + it.productId}))`,
              );

              const [productRow] = await innerTx
                .select({
                  trackStock: productTable.trackStock,
                  stockQuantity: productTable.stockQuantity,
                  costPriceInCents: productTable.costPriceInCents,
                })
                .from(productTable)
                .where(eq(productTable.id, it.productId));
              if (!productRow) {
                throw new Error(`Produto ${it.productId} sumiu durante a tx.`);
              }

              // Estoque AGREGADO do produto. Quando o produto tem variantes
              // ativas SEM variant_id no purchase_item, isso é incomum mas
              // pode ocorrer (compra "geral"). Soma das variantes.
              const variantStockRows = await innerTx
                .select({
                  stockQuantity: productVariantTable.stockQuantity,
                })
                .from(productVariantTable)
                .where(
                  and(
                    eq(productVariantTable.productId, it.productId),
                    eq(productVariantTable.storeId, ctx.store.id),
                    eq(productVariantTable.trackStock, true),
                  ),
                );
              const variantStockSum = variantStockRows.reduce(
                (acc, r) => acc + (r.stockQuantity ?? 0),
                0,
              );
              const aggregateStock =
                variantStockRows.length > 0
                  ? variantStockSum
                  : (productRow.stockQuantity ?? 0);

              const currentCost = productRow.costPriceInCents ?? 0;
              const newQty = it.quantity;
              const newCost = it.unitCostInCents;
              const totalQty = aggregateStock + newQty;
              const weightedCost =
                currentCost === 0 || aggregateStock === 0
                  ? newCost
                  : Math.round(
                      (aggregateStock * currentCost + newQty * newCost) /
                        totalQty,
                    );

              await innerTx
                .update(productTable)
                .set({
                  costPriceInCents: weightedCost,
                  updatedAt: new Date(),
                })
                .where(
                  and(
                    eq(productTable.id, it.productId),
                    eq(productTable.storeId, ctx.store.id),
                  ),
                );
            }

            // 5. UPDATE stock_quantity (incrementa). Alvo:
            //    - Se variant.trackStock: incrementa na VARIANTE
            //    - Else if product.trackStock: incrementa no PRODUTO
            //    - Else: sem stock_movement (sem track) — apenas o custo
            //      foi atualizado acima.
            const targetVariant = Boolean(variant?.trackStock);
            const targetProduct = !targetVariant && product.trackStock;

            if (!targetVariant && !targetProduct) {
              // Não rastreia estoque — pula movement.
              continue;
            }

            if (targetVariant && variant) {
              await innerTx
                .update(productVariantTable)
                .set({
                  stockQuantity: sql`coalesce(${productVariantTable.stockQuantity}, 0) + ${it.quantity}`,
                })
                .where(
                  and(
                    eq(productVariantTable.id, variant.id),
                    eq(productVariantTable.storeId, ctx.store.id),
                  ),
                );
            } else {
              await innerTx
                .update(productTable)
                .set({
                  stockQuantity: sql`coalesce(${productTable.stockQuantity}, 0) + ${it.quantity}`,
                  updatedAt: new Date(),
                })
                .where(
                  and(
                    eq(productTable.id, it.productId),
                    eq(productTable.storeId, ctx.store.id),
                  ),
                );
            }

            // 6. INSERT stock_movement (auditoria)
            await innerTx.insert(stockMovementTable).values({
              storeId: ctx.store.id,
              productId: it.productId,
              variantId: targetVariant && variant ? variant.id : null,
              movementType: "manual_in",
              quantityDelta: it.quantity,
              referenceType: "purchase",
              referenceId: row.id,
              notes: data.invoiceNumber
                ? `NF ${data.invoiceNumber}`
                : null,
              createdBy: ctx.session.user.id,
            });
          }

          // Se paidNow E há caixa aberto: gera cash_adjustment.
          if (data.paidNow && activeCashSession) {
            await innerTx.insert(cashAdjustmentTable).values({
              cashSessionId: activeCashSession.id,
              type: "pay_supplier",
              amountInCents: totalInCents,
              reason: data.invoiceNumber
                ? `Compra NF ${data.invoiceNumber}`
                : `Compra #${row.id.slice(0, 8)}`,
              createdByUserId: ctx.session.user.id,
            });
          }

          // Bloco H (2026-05-29) — gera contas a pagar (`expense`) derivadas.
          //   - Sem installments: 1 expense (total inteiro)
          //   - Com installments: N expenses, cada uma com due_date própria
          //   - paidNow=true: paid_at = now() em TODAS (cenário "paguei
          //     tudo no cartão único" ou "à vista no dinheiro"); senão NULL
          //   - supplier_id + purchase_id vinculados pra navegação reversa
          //   - category "supplies" (default razoável; lojista pode mudar
          //     editando no /admin/financeiro/pagar depois)
          const shortRef = row.id.slice(0, 8);
          const purchaseLabel = data.invoiceNumber
            ? `Compra NF ${data.invoiceNumber}`
            : `Compra #${shortRef}`;
          const nowDate = new Date().toISOString().slice(0, 10);
          const paidAtIso = data.paidNow ? nowDate : null;

          if (data.installments.length === 0) {
            await innerTx.insert(expenseTable).values({
              storeId: ctx.store.id,
              createdBy: ctx.session.user.id,
              category: "supplies",
              amountInCents: totalInCents,
              paidAt: paidAtIso,
              dueDate: paidAtIso, // sem parcelas: due = paid pra ser válido
              supplierId: data.supplierId,
              purchaseId: row.id,
              recurring: false,
              notes: purchaseLabel,
            });
          } else {
            const installmentRows = data.installments.map((p, idx) => ({
              storeId: ctx.store.id,
              createdBy: ctx.session.user.id,
              category: "supplies" as const,
              amountInCents: p.amountInCents,
              paidAt: paidAtIso,
              dueDate: p.dueDate,
              supplierId: data.supplierId,
              purchaseId: row.id,
              recurring: false,
              notes: `${purchaseLabel} · parcela ${idx + 1}/${data.installments.length}`,
            }));
            await innerTx.insert(expenseTable).values(installmentRows);
          }
        });

        if (!purchaseId) {
          return { ok: false, error: "Falha ao registrar compra." };
        }

        revalidatePath("/admin/compras");
        revalidatePath("/admin/produtos");
        revalidatePath("/admin/estoque");
        revalidatePath("/admin/pdv/caixa");
        // Bloco H — expenses derivadas afetam /admin/financeiro.
        revalidatePath("/admin/financeiro");

        logger.info("purchase.created", {
          storeId: ctx.store.id,
          purchaseId,
          totalInCents,
          itemCount: data.items.length,
          paidNow: data.paidNow,
        });

        return {
          ok: true,
          purchaseId,
          totalInCents,
          itemCount: data.items.length,
        };
      },
    );
  } catch (e) {
    logger.error("purchase.create_failed", { err: e });
    return { ok: false, error: "Falha ao registrar compra." };
  }
}

/**
 * Marca compra como paga depois (não no momento da criação). Gera
 * cash_adjustment type='pay_supplier' se há caixa aberto.
 * Idempotente — se já paga, retorna ok sem mexer.
 */
export async function markPurchasePaid(
  input: { id: string; paymentMethod: "cash" | "pix" | "debit" | "credit" | "other" },
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getSessionAndStore();
  if (!ctx) return { ok: false, error: "Sessão expirada." };

  try {
    await checkRateLimit(rateLimits.mutation, ctx.session.user.id);
  } catch (err) {
    if (err instanceof RateLimitError) {
      return { ok: false, error: err.message };
    }
    throw err;
  }

  const parsed = markPurchasePaidSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };

  try {
    return await withTenant<{ ok: boolean; error?: string }>(
      ctx.store.id,
      ctx.session.user.id,
      async (tx) => {
        const [purchase] = await tx
          .select()
          .from(purchaseTable)
          .where(
            and(
              eq(purchaseTable.id, parsed.data.id),
              eq(purchaseTable.storeId, ctx.store.id),
            ),
          )
          .limit(1);

        if (!purchase) return { ok: false, error: "Compra não encontrada." };
        if (purchase.paidAt) return { ok: true }; // idempotente

        await tx.transaction(async (innerTx) => {
          await innerTx
            .update(purchaseTable)
            .set({
              paidAt: new Date(),
              paymentMethod: parsed.data.paymentMethod,
            })
            .where(
              and(
                eq(purchaseTable.id, parsed.data.id),
                eq(purchaseTable.storeId, ctx.store.id),
              ),
            );

          const [activeCashSession] = await innerTx
            .select({ id: cashSessionTable.id })
            .from(cashSessionTable)
            .where(
              and(
                eq(cashSessionTable.storeId, ctx.store.id),
                sql`${cashSessionTable.closedAt} IS NULL`,
              ),
            )
            .limit(1);

          if (activeCashSession) {
            await innerTx.insert(cashAdjustmentTable).values({
              cashSessionId: activeCashSession.id,
              type: "pay_supplier",
              amountInCents: purchase.totalInCents,
              reason: purchase.invoiceNumber
                ? `Compra NF ${purchase.invoiceNumber}`
                : `Compra #${purchase.id.slice(0, 8)}`,
              createdByUserId: ctx.session.user.id,
            });
          }
        });

        revalidatePath("/admin/compras");
        revalidatePath(`/admin/compras/${parsed.data.id}`);
        revalidatePath("/admin/pdv/caixa");
        return { ok: true };
      },
    );
  } catch (e) {
    logger.error("purchase.mark_paid_failed", { err: e });
    return { ok: false, error: "Falha ao marcar como pago." };
  }
}
