"use server";

/**
 * loadProdutosBombando — Bloco F.2.3 da ressignificação (2026-05-28).
 *
 * "Produtos que tão bombando essa semana" — substitui o "Top 3 por lucro
 * absoluto" do plano original. Razão (conselho 2026-05-28): top por lucro
 * absoluto destaca SEMPRE os mesmos produtos caros (aliança de ouro) e
 * esconde o brinco que faz o GIRO. Sandra "já sabe" qual peça dá mais
 * lucro absoluto. O que ela NÃO sabe é qual produto está acelerando
 * agora — informação acionável que vira pedido de reposição.
 *
 * Critério: produto cuja quantidade vendida nos últimos 7 dias está
 * 30% ou mais ACIMA da média móvel diária dos 28 dias ANTERIORES
 * a essa janela (dia 8-35). Métrica = aceleração relativa.
 *
 * Fórmula:
 *   acceleration_pct = (qty_current_7d / 7) / (qty_baseline_28d / 28)
 *
 *   → 1.0  = vendeu igual a média histórica
 *   → 1.30 = vendeu 30% mais por dia (gatilho mínimo)
 *   → 2.00 = dobrou o ritmo (bombando alto)
 *
 * Guard: produto precisa ter vendido pelo menos 2 unidades na janela
 * atual pra entrar no ranking. Evita ruído de produto com 1 venda
 * aleatória que aparece "+infinity%" se baseline=0.
 *
 * FALLBACK: loja jovem sem 28 dias de histórico OU sem produto com
 * aceleração ≥ 30%, devolve Top 3 por LUCRO ABSOLUTO da semana com
 * flag `fallback: true`. UI mostra label diferente nesse caso.
 *
 * Performance: 1 query agregada com filter() condicionais — single
 * pass sobre order_item × order com 2 janelas de tempo. Index hit:
 * order(store_id, status, created_at). Em prod com 5k vendas/mês:
 * ~30-50ms.
 *
 * O loader também devolve `imageUrl` (snapshot da primeira imagem
 * do item) pra UI mostrar thumbnail — vendedora visualiza imediato.
 */

import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { headers } from "next/headers";

import { COUNTABLE_STATUSES } from "@/actions/order/constants";
import { orderItemTable, orderTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

/** Item devolvido pro UI. */
export interface ProdutoBombando {
  productId: string;
  name: string;
  imageUrl: string | null;
  /** Unidades vendidas nos últimos 7 dias. */
  qtyCurrent: number;
  /**
   * Multiplicador da aceleração. Ex: 1.85 = "vende 85% mais por dia agora
   * que na média dos 28d anteriores". NULL no modo fallback (sem baseline).
   */
  accelerationMultiplier: number | null;
  /**
   * Lucro absoluto em centavos (revenue − cost). Apenas usa itens com
   * unit_cost_snapshot preenchido. Quando NULL, custo não disponível.
   */
  profitAbsoluteInCents: number | null;
  /** Receita absoluta da janela atual em centavos. */
  revenueInCents: number;
}

export interface LoadProdutosBombandoOutput {
  items: ProdutoBombando[];
  /**
   * true = não havia produto com aceleração 30%+, usamos Top 3 por lucro
   * absoluto. UI muda label de "tá bombando" pra "Top 3 da semana".
   */
  fallback: boolean;
}

export async function loadProdutosBombando(): Promise<LoadProdutosBombandoOutput> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { items: [], fallback: false };

  const store = await getCurrentStore(session.user.id);
  if (!store) return { items: [], fallback: false };

  return withTenant(store.id, session.user.id, async (tx) => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyFiveDaysAgo = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000);

    // 1 query agrupada: por produto, calcula 2 janelas de tempo via filter().
    // Filtra apenas itens de pedidos contáveis (confirmed/fulfilled — nem
    // canceled, nem returned, nem awaiting_whatsapp). image_url_snapshot
    // pode variar entre vendas do mesmo produto (lojista trocou foto);
    // pegamos o MAX (mais recente alfabeticamente coincide com URL nova
    // de Supabase Storage — assinatura mais nova). Pequena aproximação
    // intencional pra evitar 2ª query de imagem.
    const rows = await tx
      .select({
        productId: orderItemTable.productId,
        name: sql<string>`max(${orderItemTable.productNameSnapshot})`,
        imageUrl: sql<string | null>`max(${orderItemTable.imageUrlSnapshot})`,
        qtyCurrent: sql<number>`coalesce(sum(${orderItemTable.quantity}) filter (
          where ${orderTable.createdAt} >= ${sevenDaysAgo}
        ), 0)::int`,
        qtyBaseline: sql<number>`coalesce(sum(${orderItemTable.quantity}) filter (
          where ${orderTable.createdAt} >= ${thirtyFiveDaysAgo}
            and ${orderTable.createdAt} < ${sevenDaysAgo}
        ), 0)::int`,
        revenueCurrent: sql<number>`coalesce(sum(
          ${orderItemTable.priceInCentsSnapshot} * ${orderItemTable.quantity}
          - coalesce(${orderItemTable.discountInCents}, 0)
        ) filter (
          where ${orderTable.createdAt} >= ${sevenDaysAgo}
        ), 0)::int`,
        profitCurrent: sql<number | null>`sum(
          (${orderItemTable.priceInCentsSnapshot} - coalesce(${orderItemTable.unitCostSnapshotInCents}, 0))
            * ${orderItemTable.quantity}
          - coalesce(${orderItemTable.discountInCents}, 0)
        ) filter (
          where ${orderTable.createdAt} >= ${sevenDaysAgo}
            and ${orderItemTable.unitCostSnapshotInCents} is not null
        )`,
      })
      .from(orderItemTable)
      .innerJoin(orderTable, eq(orderTable.id, orderItemTable.orderId))
      .where(
        and(
          eq(orderTable.storeId, store.id),
          inArray(orderTable.status, [...COUNTABLE_STATUSES]),
          gte(orderTable.createdAt, thirtyFiveDaysAgo),
          lt(orderTable.createdAt, now),
        ),
      )
      .groupBy(orderItemTable.productId);

    // Filtra produtos com pelo menos 2 unidades vendidas na janela atual
    // (guard anti-ruído) e calcula aceleração.
    const candidates = rows
      .filter((r) => Number(r.qtyCurrent ?? 0) >= 2)
      .map((r) => {
        const qtyCur = Number(r.qtyCurrent ?? 0);
        const qtyBase = Number(r.qtyBaseline ?? 0);
        // Média diária: janela atual = 7 dias, baseline = 28 dias.
        const dailyCurrent = qtyCur / 7;
        const dailyBaseline = qtyBase / 28;
        const accel =
          dailyBaseline > 0 ? dailyCurrent / dailyBaseline : null;
        return {
          productId: r.productId,
          name: r.name ?? "Produto",
          imageUrl: r.imageUrl,
          qtyCurrent: qtyCur,
          qtyBaseline: qtyBase,
          accelerationMultiplier: accel,
          revenueInCents: Number(r.revenueCurrent ?? 0),
          profitAbsoluteInCents:
            r.profitCurrent !== null && r.profitCurrent !== undefined
              ? Number(r.profitCurrent)
              : null,
        };
      });

    // Bombando = aceleração >= 1.30 (30% acima da média).
    const bombando = candidates
      .filter(
        (c) => c.accelerationMultiplier !== null && c.accelerationMultiplier >= 1.3,
      )
      .sort(
        (a, b) =>
          (b.accelerationMultiplier ?? 0) - (a.accelerationMultiplier ?? 0),
      )
      .slice(0, 3);

    if (bombando.length > 0) {
      return {
        items: bombando.map((c) => ({
          productId: c.productId,
          name: c.name,
          imageUrl: c.imageUrl,
          qtyCurrent: c.qtyCurrent,
          accelerationMultiplier: c.accelerationMultiplier,
          profitAbsoluteInCents: c.profitAbsoluteInCents,
          revenueInCents: c.revenueInCents,
        })),
        fallback: false,
      };
    }

    // FALLBACK: Top 3 por lucro absoluto (ou receita se sem custo).
    // Sort: profit (nullable) primeiro, revenue como tie-break.
    const fallback = candidates
      .sort((a, b) => {
        const ap = a.profitAbsoluteInCents ?? 0;
        const bp = b.profitAbsoluteInCents ?? 0;
        if (ap !== bp) return bp - ap;
        return b.revenueInCents - a.revenueInCents;
      })
      .slice(0, 3);

    return {
      items: fallback.map((c) => ({
        productId: c.productId,
        name: c.name,
        imageUrl: c.imageUrl,
        qtyCurrent: c.qtyCurrent,
        accelerationMultiplier: null, // fallback NÃO mostra aceleração
        profitAbsoluteInCents: c.profitAbsoluteInCents,
        revenueInCents: c.revenueInCents,
      })),
      fallback: true,
    };
  });
}
