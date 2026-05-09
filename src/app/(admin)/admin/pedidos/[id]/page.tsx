import { and, eq } from "drizzle-orm";
import {
  ArrowLeftIcon,
  CalendarIcon,
  MessageCircleIcon,
  PhoneIcon,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import type { ORDER_STATUS_VALUES } from "@/actions/order/schema";
import { OrderStatusActions } from "@/components/admin/order-status-actions";
import { OrderStatusBadge } from "@/components/admin/order-status-badge";
import { Button } from "@/components/ui/button";
import { orderItemTable, orderTable } from "@/db/schema";
import { requireSession } from "@/lib/auth-server";
import { formatFullDate } from "@/lib/format";
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

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/pedidos">
            <ArrowLeftIcon /> Voltar
          </Link>
        </Button>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-muted-foreground font-mono text-sm">
            #{order.shortCode}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {order.customerName}
          </h1>
          <p className="text-muted-foreground text-sm">
            {formatBRL(order.totalInCents)} ·{" "}
            {totalItemCount(items)}{" "}
            {totalItemCount(items) === 1 ? "item" : "itens"}
          </p>
        </div>
        <OrderStatusBadge status={order.status} size="md" />
      </header>

      {/* Cliente */}
      <section className="bg-background/50 space-y-3 rounded-xl border p-4 sm:p-5">
        <h2 className="text-sm font-semibold tracking-tight">Cliente</h2>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <PhoneIcon className="text-muted-foreground size-4 shrink-0" />
          <span>{order.customerPhone}</span>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="ml-auto"
          >
            <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
              <MessageCircleIcon /> Abrir WhatsApp
            </a>
          </Button>
        </div>

        {order.customerNotes ? (
          <div className="bg-muted/50 space-y-1 rounded-lg p-3">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Observações da cliente
            </p>
            <p className="text-sm whitespace-pre-wrap">{order.customerNotes}</p>
          </div>
        ) : null}
      </section>

      {/* Itens */}
      <section className="bg-background/50 space-y-3 rounded-xl border p-4 sm:p-5">
        <h2 className="text-sm font-semibold tracking-tight">Itens</h2>

        <ul className="divide-border divide-y">
          {items.map((it) => {
            const subtotal = it.priceInCentsSnapshot * it.quantity;
            return (
              <li key={it.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
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
                  <p className="text-muted-foreground text-xs">
                    {it.quantity} × {formatBRL(it.priceInCentsSnapshot)}
                  </p>
                </div>
                <p className="text-sm font-medium">{formatBRL(subtotal)}</p>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center justify-between border-t pt-3">
          <span className="text-sm font-medium">Total</span>
          <span className="text-lg font-semibold">
            {formatBRL(order.totalInCents)}
          </span>
        </div>
      </section>

      {/* Datas */}
      <section className="bg-background/50 space-y-2 rounded-xl border p-4 sm:p-5">
        <h2 className="text-sm font-semibold tracking-tight">Linha do tempo</h2>
        <ul className="space-y-1.5 text-sm">
          <DateRow label="Criado" date={order.createdAt} icon />
          {order.whatsappOpenedAt ? (
            <DateRow label="Aberto no WhatsApp" date={order.whatsappOpenedAt} />
          ) : null}
          {order.confirmedAt ? (
            <DateRow label="Confirmado" date={order.confirmedAt} />
          ) : null}
          <DateRow label="Expira em" date={order.expiresAt} />
        </ul>
      </section>

      {/* Ações */}
      <section className="bg-background/50 space-y-3 rounded-xl border p-4 sm:p-5">
        <h2 className="text-sm font-semibold tracking-tight">Ações</h2>
        <OrderStatusActions
          orderId={order.id}
          status={order.status as (typeof ORDER_STATUS_VALUES)[number]}
        />
      </section>
    </div>
  );
}

function totalItemCount(items: ReadonlyArray<{ quantity: number }>): number {
  return items.reduce((s, i) => s + i.quantity, 0);
}

function DateRow({
  label,
  date,
  icon,
}: {
  label: string;
  date: Date;
  icon?: boolean;
}) {
  return (
    <li className="flex items-center gap-2">
      {icon ? <CalendarIcon className="text-muted-foreground size-3.5 shrink-0" /> : <span className="size-3.5 shrink-0" />}
      <span className="text-muted-foreground">{label}:</span>
      <span>{formatFullDate(date)}</span>
    </li>
  );
}
