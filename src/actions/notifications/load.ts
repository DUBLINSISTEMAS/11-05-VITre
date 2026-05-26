"use server";

import { and, desc, eq, gte, isNull } from "drizzle-orm";
import { headers } from "next/headers";

import { orderTable, productTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

/**
 * Notificações in-app do admin — Sprint final Vendas (audit 2026-05-26).
 *
 * Hoje varre 2 fontes leves:
 *   1. Pedidos `awaiting_whatsapp` recentes que o lojista AINDA NÃO ABRIU
 *      no WhatsApp (whatsapp_opened_at IS NULL). Janela: 24h.
 *   2. Produtos com `track_stock=true` em estoque baixo (stock <= min)
 *      OU zerado. Limit 10 — sem flood quando loja tem 200 produtos.
 *
 * Sem tabela `notification` dedicada (não compensa overhead pro MVP).
 * Reads diretos sobre `order` e `product` — ambos têm índices por
 * (store_id, status) e (store_id, track_stock) respectivamente.
 *
 * Polling: caller (NotificationsPopover) decide cadência. Default
 * sugerido: refetch ao montar + a cada 60s enquanto popover aberto.
 */
export interface AdminNotificationItem {
  id: string;
  type: "sale" | "stock";
  title: string;
  body: string;
  /** Texto curto "há 2 min" / "ontem". Formatado no client. */
  createdAt: Date;
  unread: boolean;
  /** Rota pra navegar no click. */
  href: string;
}

export interface AdminNotificationsResult {
  items: AdminNotificationItem[];
  unreadCount: number;
}

export async function loadAdminNotifications(): Promise<AdminNotificationsResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { items: [], unreadCount: 0 };

  const store = await getCurrentStore(session.user.id);
  if (!store) return { items: [], unreadCount: 0 };

  return withTenant(store.id, session.user.id, async (tx) => {
    const items: AdminNotificationItem[] = [];

    // 1) Vendas WhatsApp pendentes (não abertas) das últimas 24h.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const pendingSales = await tx
      .select({
        id: orderTable.id,
        shortCode: orderTable.shortCode,
        customerName: orderTable.customerName,
        totalInCents: orderTable.totalInCents,
        createdAt: orderTable.createdAt,
      })
      .from(orderTable)
      .where(
        and(
          eq(orderTable.storeId, store.id),
          eq(orderTable.status, "awaiting_whatsapp"),
          gte(orderTable.createdAt, since),
          isNull(orderTable.whatsappOpenedAt),
        ),
      )
      .orderBy(desc(orderTable.createdAt))
      .limit(10);

    for (const s of pendingSales) {
      const totalLabel = (s.totalInCents / 100)
        .toFixed(2)
        .replace(".", ",")
        .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
      items.push({
        id: `sale-${s.id}`,
        type: "sale",
        title: `Venda nova · #${s.shortCode}`,
        body: `${s.customerName} · R$ ${totalLabel}`,
        createdAt: s.createdAt,
        unread: true,
        href: `/admin/pedidos?detail=${s.id}`,
      });
    }

    // 2) Estoque baixo (track_stock + min stock setado + stock <= min).
    // Pegamos só os top 5 pra não dominar o painel — lista completa fica
    // em /admin/estoque?status=low. "Unread" = sempre true (não há
    // controle de read state hoje); badge mostra só pra atenção.
    const lowStock = await tx
      .select({
        id: productTable.id,
        name: productTable.name,
        stockQuantity: productTable.stockQuantity,
        minStockQuantity: productTable.minStockQuantity,
        updatedAt: productTable.updatedAt,
      })
      .from(productTable)
      .where(
        and(
          eq(productTable.storeId, store.id),
          eq(productTable.trackStock, true),
          eq(productTable.isActive, true),
        ),
      )
      .limit(50);
    const criticalStock = lowStock
      .filter(
        (p) =>
          p.minStockQuantity !== null &&
          p.stockQuantity !== null &&
          p.stockQuantity <= p.minStockQuantity,
      )
      .slice(0, 5);
    for (const p of criticalStock) {
      const isZero = (p.stockQuantity ?? 0) === 0;
      items.push({
        id: `stock-${p.id}`,
        type: "stock",
        title: isZero ? `Sem estoque: ${p.name}` : `Estoque baixo: ${p.name}`,
        body: isZero
          ? "Reposição urgente"
          : `${p.stockQuantity} restante${p.stockQuantity === 1 ? "" : "s"} (mínimo ${p.minStockQuantity})`,
        createdAt: p.updatedAt,
        unread: true,
        href: `/admin/estoque/relatorio`,
      });
    }

    // Ordena por createdAt desc — venda nova fica primeiro porque é mais
    // urgente que estoque (que muda em horas, venda em minutos).
    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return {
      items,
      unreadCount: items.filter((n) => n.unread).length,
    };
  });
}
