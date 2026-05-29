"use server";

/**
 * loadDashboardChannels — Distribuição de vendas por canal no período.
 *
 * Onda M5 (2026-05-29): nova fatia do dashboard pra responder "de onde
 * está vindo a venda?". Usa o enum `order_channel` (whatsapp + balcao —
 * CLAUDE.md, Estado atual verificado).
 *
 * Retorna count + faturamento por canal pra UI poder escolher narrativa
 * (quantidade ou volume). Inclui total pra calcular fatia. Quando o
 * período tem 0 vendas, devolve all zeros (componente cuida do empty
 * state).
 */

import { sql } from "drizzle-orm";
import { headers } from "next/headers";

import { orderTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

export type OrderChannel = "whatsapp" | "balcao";

export interface ChannelSlice {
  channel: OrderChannel;
  count: number;
  revenueInCents: number;
}

export interface LoadDashboardChannelsOutput {
  slices: ChannelSlice[];
  totalCount: number;
  totalRevenueInCents: number;
}

export interface LoadDashboardChannelsInput {
  periodoDays: number;
}

export async function loadDashboardChannels(
  input: LoadDashboardChannelsInput,
): Promise<LoadDashboardChannelsOutput | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;

  const store = await getCurrentStore(session.user.id);
  if (!store) return null;

  const days = input.periodoDays;

  return withTenant(store.id, session.user.id, async (tx) => {
    const now = new Date();
    const periodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const rows = await tx
      .select({
        channel: orderTable.channel,
        count: sql<number>`count(*)::int`,
        revenueInCents: sql<number>`coalesce(sum(${orderTable.totalInCents}), 0)::int`,
      })
      .from(orderTable)
      .where(
        sql`${orderTable.storeId} = ${store.id}
            and ${orderTable.status} in ('confirmed','fulfilled')
            and ${orderTable.createdAt} >= ${periodStart}
            and ${orderTable.createdAt} < ${now}`,
      )
      .groupBy(orderTable.channel);

    // Garante presença de TODOS os canais conhecidos (zeros pros faltantes)
    const byChannel = new Map<OrderChannel, ChannelSlice>();
    for (const channel of ["whatsapp", "balcao"] as const) {
      byChannel.set(channel, {
        channel,
        count: 0,
        revenueInCents: 0,
      });
    }
    for (const r of rows) {
      const ch = r.channel as OrderChannel;
      byChannel.set(ch, {
        channel: ch,
        count: Number(r.count),
        revenueInCents: Number(r.revenueInCents),
      });
    }

    const slices = Array.from(byChannel.values());
    const totalCount = slices.reduce((acc, s) => acc + s.count, 0);
    const totalRevenueInCents = slices.reduce(
      (acc, s) => acc + s.revenueInCents,
      0,
    );

    return {
      slices,
      totalCount,
      totalRevenueInCents,
    };
  });
}
