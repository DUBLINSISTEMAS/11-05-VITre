"use server";

/**
 * loadDashboardKpis — Bloco F.2.4/F.2.5 da ressignificação (2026-05-28).
 *
 * Une 2 cargas leves do dashboard:
 *   1. KPIs SECUNDÁRIOS tabulares (substitui 4 MetricCards genéricos):
 *      vendas count, clientes novos, devoluções, faturamento bruto —
 *      ambos pra janela do `?periodo=N` (7/30/90).
 *   2. MINI-SNAPSHOT da loja online: recados pendentes (lead.status='new'),
 *      produtos publicados, produtos publicados sem foto.
 *
 * Razão de unir: tanto KPIs quanto loja online são fontes leves (counts
 * agregados), ambas precisam do mesmo `withTenant`, e ambas renderizam
 * em REGIÕES adjacentes do dashboard. Fazer 1 transação evita overhead.
 *
 * Os 4 KPIs aqui SUBSTITUEM os MetricCards genéricos do WIP — vão pra
 * UI como LINHA TABULAR densa (1 linha em desktop, 2x2 grid em mobile)
 * em vez de 4 cards individuais com big number isolado. Princípio do
 * conselho: densificar por SUBTRAÇÃO.
 */

import { and, countDistinct, eq, sql } from "drizzle-orm";
import { headers } from "next/headers";

import {
  customerTable,
  orderTable,
  productImageTable,
  productTable,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

export interface DashboardKpiPair {
  current: number;
  previous: number;
}

export interface DashboardKpis {
  /** Quantidade de vendas confirmadas no período. */
  vendas: DashboardKpiPair;
  /** Faturamento BRUTO (soma de order.total) em centavos. */
  faturamento: DashboardKpiPair;
  /** Clientes NOVOS cadastrados no período. */
  clientesNovos: DashboardKpiPair;
  /** Devoluções (order.status='returned') no período. */
  devolucoes: DashboardKpiPair;
}

export interface DashboardLojaOnline {
  /** Produtos publicados na vitrine pública (is_active + is_published). */
  produtosPublicados: number;
  /** Produtos publicados que NÃO têm nenhuma imagem (UX vergonhoso). */
  produtosSemFoto: number;
  /** Slug usado pra link "Ver loja". */
  storeSlug: string;
}

export interface LoadDashboardKpisOutput {
  kpis: DashboardKpis;
  lojaOnline: DashboardLojaOnline;
}

export interface LoadDashboardKpisInput {
  /** Período em dias (7/30/90). Mesmo controle do DateRangePill. */
  periodoDays: number;
}

export async function loadDashboardKpis(
  input: LoadDashboardKpisInput,
): Promise<LoadDashboardKpisOutput | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;

  const store = await getCurrentStore(session.user.id);
  if (!store) return null;

  const days = input.periodoDays;

  return withTenant(store.id, session.user.id, async (tx) => {
    const now = new Date();
    const periodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const prevStart = new Date(
      periodStart.getTime() - days * 24 * 60 * 60 * 1000,
    );

    // === KPI 1: VENDAS + FATURAMENTO (current + previous) em 1 query ===
    const [vendasAgg] = await tx
      .select({
        countCurrent: sql<number>`count(*) filter (
          where ${orderTable.status} in ('confirmed','fulfilled')
            and ${orderTable.createdAt} >= ${periodStart}
            and ${orderTable.createdAt} < ${now}
        )::int`,
        countPrevious: sql<number>`count(*) filter (
          where ${orderTable.status} in ('confirmed','fulfilled')
            and ${orderTable.createdAt} >= ${prevStart}
            and ${orderTable.createdAt} < ${periodStart}
        )::int`,
        sumCurrent: sql<number>`coalesce(sum(${orderTable.totalInCents}) filter (
          where ${orderTable.status} in ('confirmed','fulfilled')
            and ${orderTable.createdAt} >= ${periodStart}
            and ${orderTable.createdAt} < ${now}
        ), 0)::int`,
        sumPrevious: sql<number>`coalesce(sum(${orderTable.totalInCents}) filter (
          where ${orderTable.status} in ('confirmed','fulfilled')
            and ${orderTable.createdAt} >= ${prevStart}
            and ${orderTable.createdAt} < ${periodStart}
        ), 0)::int`,
        returnedCurrent: sql<number>`count(*) filter (
          where ${orderTable.status} = 'returned'
            and ${orderTable.createdAt} >= ${periodStart}
            and ${orderTable.createdAt} < ${now}
        )::int`,
        returnedPrevious: sql<number>`count(*) filter (
          where ${orderTable.status} = 'returned'
            and ${orderTable.createdAt} >= ${prevStart}
            and ${orderTable.createdAt} < ${periodStart}
        )::int`,
      })
      .from(orderTable)
      .where(eq(orderTable.storeId, store.id));

    // === KPI 2: CLIENTES NOVOS (current + previous) em 1 query ===
    const [customersAgg] = await tx
      .select({
        countCurrent: sql<number>`count(*) filter (
          where ${customerTable.createdAt} >= ${periodStart}
            and ${customerTable.createdAt} < ${now}
        )::int`,
        countPrevious: sql<number>`count(*) filter (
          where ${customerTable.createdAt} >= ${prevStart}
            and ${customerTable.createdAt} < ${periodStart}
        )::int`,
      })
      .from(customerTable)
      .where(eq(customerTable.storeId, store.id));

    // === LOJA ONLINE: 2 counts em paralelo (mesma transação seq) ===
    // Onda L1 (2026-05-29) — query de leads/recados removida; UI admin
    // nao consome mais esse contador.
    const [publishedAgg] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(productTable)
      .where(
        and(
          eq(productTable.storeId, store.id),
          eq(productTable.isActive, true),
          eq(productTable.isPublishedToStorefront, true),
        ),
      );

    // Produtos publicados SEM imagem: LEFT JOIN no productImage e
    // count(DISTINCT product) onde nenhuma imagem encontrada.
    const [noPhotoAgg] = await tx
      .select({
        count: countDistinct(productTable.id),
      })
      .from(productTable)
      .leftJoin(productImageTable, eq(productImageTable.productId, productTable.id))
      .where(
        and(
          eq(productTable.storeId, store.id),
          eq(productTable.isActive, true),
          eq(productTable.isPublishedToStorefront, true),
          sql`${productImageTable.id} is null`,
        ),
      );

    return {
      kpis: {
        vendas: {
          current: Number(vendasAgg?.countCurrent ?? 0),
          previous: Number(vendasAgg?.countPrevious ?? 0),
        },
        faturamento: {
          current: Number(vendasAgg?.sumCurrent ?? 0),
          previous: Number(vendasAgg?.sumPrevious ?? 0),
        },
        clientesNovos: {
          current: Number(customersAgg?.countCurrent ?? 0),
          previous: Number(customersAgg?.countPrevious ?? 0),
        },
        devolucoes: {
          current: Number(vendasAgg?.returnedCurrent ?? 0),
          previous: Number(vendasAgg?.returnedPrevious ?? 0),
        },
      },
      lojaOnline: {
        produtosPublicados: Number(publishedAgg?.count ?? 0),
        produtosSemFoto: Number(noPhotoAgg?.count ?? 0),
        storeSlug: store.slug,
      },
    };
  });
}

