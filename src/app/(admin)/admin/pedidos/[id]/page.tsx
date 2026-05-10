import { and, eq } from "drizzle-orm";
import { MessageCircleIcon, PhoneIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import type { ORDER_STATUS_VALUES } from "@/actions/order/schema";
import { OrderStatusActions } from "@/components/admin/order-status-actions";
import { OrderStatusBadge } from "@/components/admin/order-status-badge";
import { OrderTimeline } from "@/components/admin/order-timeline";
import { AdminPageHeader } from "@/components/admin/shell/page-header";
import { Button } from "@/components/ui/button";
import { orderItemTable, orderTable } from "@/db/schema";
import { requireSession } from "@/lib/auth-server";
import { formatBRL } from "@/lib/pricing";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { id } = await params;
  const session = await requireSession();
  const store = await getCurrentStore(session.user.id);
  if (!store) {
    throw new Error("UNREACHABLE: pedido detalhe sem loja");
  }

  const result = await withTenant(store.id, session.user.id, async (tx) => {
    const order = await tx.query.orderTable.findFirst({
      where: and(eq(orderTable.id, id), eq(orderTable.storeId, store.id)),
      columns: {
        id: true,
        shortCode: true,
        customerName: true,
        customerPhone: true,
        customerNotes: true,
        totalInCents: true,
        status: true,
        whatsappOpenedAt: true,
        confirmedAt: true,
        expiresAt: true,
        createdAt: true,
      },
    });
    if (!order) return null;

    const items = await tx
      .select({
        id: orderItemTable.id,
        productNameSnapshot: orderItemTable.productNameSnapshot,
        variantNameSnapshot: orderItemTable.variantNameSnapshot,
        imageUrlSnapshot: orderItemTable.imageUrlSnapshot,
        priceInCentsSnapshot: orderItemTable.priceInCentsSnapshot,
        quantity: orderItemTable.quantity,
      })
      .from(orderItemTable)
      .where(eq(orderItemTable.orderId, id));

    return { order, items };
  });

  if (!result) notFound();
  const { order, items } = result;

  // Link WhatsApp: tira o "+" do E.164. Texto pré-preenchido com código.
  const whatsappLink =
    "https://wa.me/" +
    order.customerPhone.replace(/^\+/, "") +
    "?text=" +
    encodeURIComponent(
      `Oi ${order.customerName.split(" ")[0] ?? ""}! Estou retornando sobre o pedido ${order.shortCode} 🙂`,
    );

  const itemCount = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="space-y-4 sm:space-y-6">
      <AdminPageHeader
        title={order.customerName}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <Link
              href="/admin/pedidos"
              prefetch
              className="hocus:text-foreground transition-colors"
            >
              ← Pedidos
            </Link>
            <span aria-hidden className="text-muted-foreground/40">·</span>
            <span className="font-mono">#{order.shortCode}</span>
            <span aria-hidden className="text-muted-foreground/40">·</span>
            <span>
              {formatBRL(order.totalInCents)} · {itemCount}{" "}
              {itemCount === 1 ? "item" : "itens"}
            </span>
          </span>
        }
        actions={<OrderStatusBadge status={order.status} size="md" />}
      />

      <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
        {/* === Coluna esquerda (col-span-2): cliente, itens, snippet WA === */}
        <div className="space-y-4 lg:col-span-2">
          <section className="bg-card space-y-3 rounded-xl border p-4 shadow-sm sm:p-5">
            <h2 className="text-[13.5px] font-semibold tracking-tight">
              Cliente
            </h2>

            <div className="flex flex-wrap items-center gap-3 text-sm">
              <PhoneIcon className="text-muted-foreground size-4 shrink-0" />
              <span className="font-mono text-[13px]">
                {order.customerPhone}
              </span>
              <Button
                asChild
                size="sm"
                className="bg-whatsapp text-whatsapp-foreground hover:bg-whatsapp-hover ml-auto"
              >
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircleIcon /> Abrir conversa
                </a>
              </Button>
            </div>

            {order.customerNotes ? (
              <div className="bg-muted/50 space-y-1 rounded-lg p-3">
                <p className="text-eyebrow">Observações da cliente</p>
                <p className="whitespace-pre-wrap text-sm">
                  {order.customerNotes}
                </p>
              </div>
            ) : null}
          </section>

          <section className="bg-card space-y-3 rounded-xl border p-4 shadow-sm sm:p-5">
            <h2 className="text-[13.5px] font-semibold tracking-tight">Itens</h2>

            <ul className="divide-border divide-y">
              {items.map((it) => {
                const subtotal = it.priceInCentsSnapshot * it.quantity;
                return (
                  <li
                    key={it.id}
                    className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="bg-muted relative size-14 shrink-0 overflow-hidden rounded-lg sm:size-16">
                      {it.imageUrlSnapshot ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={it.imageUrlSnapshot}
                          alt=""
                          className="size-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="truncate text-sm font-medium">
                        {it.productNameSnapshot}
                      </p>
                      {it.variantNameSnapshot ? (
                        <p className="text-muted-foreground text-xs">
                          {it.variantNameSnapshot}
                        </p>
                      ) : null}
                      <p className="text-muted-foreground font-mono text-[11.5px] tabular-nums">
                        {it.quantity} × {formatBRL(it.priceInCentsSnapshot)}
                      </p>
                    </div>
                    <p className="font-mono text-sm font-medium tabular-nums">
                      {formatBRL(subtotal)}
                    </p>
                  </li>
                );
              })}
            </ul>

            <div className="flex items-center justify-between border-t pt-3">
              <span className="text-sm font-medium">Total</span>
              <span className="font-mono text-lg font-semibold tabular-nums">
                {formatBRL(order.totalInCents)}
              </span>
            </div>
          </section>

          {/* Placeholder canvas: snippet última msg WhatsApp.
              Admin não tem histórico de msgs (checkout one-shot via deeplink).
              Cartão visual estático que reforça que conversa fica no app
              do WhatsApp e linka pra reabrir. */}
          <section className="bg-card flex flex-col gap-3 rounded-xl border p-4 shadow-sm sm:p-5">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-[13.5px] font-semibold tracking-tight">
                Conversa no WhatsApp
              </h2>
              <span className="text-eyebrow">Externo</span>
            </div>
            <div className="bg-muted/40 flex flex-col gap-1 rounded-lg p-3">
              <p className="text-muted-foreground text-[11px]">
                Histórico fica no aplicativo WhatsApp da loja. O Vitrê só
                abre a conversa pré-preenchida com o código do pedido.
              </p>
            </div>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="self-start"
            >
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                <MessageCircleIcon /> Abrir conversa
              </a>
            </Button>
          </section>
        </div>

        {/* === Coluna direita (col-span-1, sticky): timeline + ações === */}
        <div className="space-y-4 lg:sticky lg:top-4 lg:col-span-1">
          <section className="bg-card flex flex-col gap-4 rounded-xl border p-4 shadow-sm sm:p-5">
            <h2 className="text-[13.5px] font-semibold tracking-tight">
              Linha do tempo
            </h2>
            <OrderTimeline order={order} />
          </section>

          <section className="bg-card flex flex-col gap-3 rounded-xl border p-4 shadow-sm sm:p-5">
            <h2 className="text-[13.5px] font-semibold tracking-tight">
              Ações
            </h2>
            <OrderStatusActions
              orderId={order.id}
              status={order.status as (typeof ORDER_STATUS_VALUES)[number]}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
