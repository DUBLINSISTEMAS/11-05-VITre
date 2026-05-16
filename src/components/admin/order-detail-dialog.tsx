"use client";

import {
  Loader2Icon,
  MessageCircleIcon,
  PhoneIcon,
  PrinterIcon,
} from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import {
  loadOrderDetail,
  type OrderDetail,
} from "@/actions/order/load-detail";
import { CustomerLinkSection } from "@/components/admin/customer-link-section";
import { OrderStatusActions } from "@/components/admin/order-status-actions";
import { OrderStatusBadge } from "@/components/admin/order-status-badge";
import { OrderTimeline } from "@/components/admin/order-timeline";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatBRL } from "@/lib/pricing";

interface OrderDetailDialogProps {
  /** ID do pedido aberto. null = fechado. */
  orderId: string | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * Modal de detalhe do pedido. Onda 4 (2026-05-12) — substitui a rota
 * /admin/pedidos/[id] que foi deletada.
 *
 * Lazy load: chama loadOrderDetail só quando abre.
 * Refresh: action updateOrderStatus dentro do dialog dispara router.refresh,
 * que invalida a página de listagem por trás.
 */
export function OrderDetailDialog({
  orderId,
  onOpenChange,
}: OrderDetailDialogProps) {
  const [data, setData] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startLoad] = useTransition();
  // `reloadKey` é incrementado quando o CustomerLinkSection muda o
  // vínculo — força refetch do detalhe pro modal refletir o novo estado.
  const [reloadKey, setReloadKey] = useState(0);

  // Carrega quando orderId muda pra um valor não-null OU quando reloadKey muda.
  useEffect(() => {
    if (!orderId) {
      setData(null);
      setError(null);
      return;
    }
    setData(null);
    setError(null);
    startLoad(async () => {
      const res = await loadOrderDetail(orderId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setData(res.order);
    });
  }, [orderId, reloadKey]);

  return (
    <Dialog open={orderId !== null} onOpenChange={onOpenChange}>
      {/*
        `sm:max-w-3xl` (não `max-w-3xl`) é obrigatório: DialogContent base
        do shadcn aplica `sm:max-w-lg` (512px) que vence em ≥640px sem o
        prefixo `sm:` aqui — twMerge não dedupa base vs variante. Mesma
        pegadinha do ProductDialog. Ver memory `shadcn-dialog-base-sm-maxw-lg-gotcha`.
      */}
      <DialogContent className="max-h-[90vh] max-w-none overflow-y-auto p-0 sm:max-w-3xl sm:rounded-2xl">
        {isLoading || (!data && !error) ? (
          <DialogShellLoading />
        ) : error ? (
          <DialogShellError message={error} />
        ) : data ? (
          <OrderDetailContent
            order={data}
            onCustomerLinkChange={() => setReloadKey((k) => k + 1)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function DialogShellLoading() {
  return (
    <>
      <DialogHeader className="border-b px-5 py-4 sm:px-6">
        <DialogTitle className="sr-only">Carregando pedido…</DialogTitle>
        <DialogDescription className="sr-only">
          Aguardando dados do pedido.
        </DialogDescription>
      </DialogHeader>
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2Icon className="size-4 animate-spin" /> Carregando…
      </div>
    </>
  );
}

function DialogShellError({ message }: { message: string }) {
  return (
    <>
      <DialogHeader className="border-b px-5 py-4 sm:px-6">
        <DialogTitle>Não foi possível abrir o pedido</DialogTitle>
        <DialogDescription>{message}</DialogDescription>
      </DialogHeader>
    </>
  );
}

function OrderDetailContent({
  order,
  onCustomerLinkChange,
}: {
  order: OrderDetail;
  onCustomerLinkChange: () => void;
}) {
  const itemCount = order.items.reduce((s, i) => s + i.quantity, 0);
  const whatsappLink = order.customerPhone
    ? "https://wa.me/" +
      order.customerPhone.replace(/^\+/, "") +
      "?text=" +
      encodeURIComponent(
        `Oi ${order.customerName.split(" ")[0] ?? ""}! Estou retornando sobre o pedido ${order.shortCode} 🙂`,
      )
    : null;

  return (
    <>
      <DialogHeader className="border-b px-5 py-4 sm:px-6">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1 space-y-0.5">
            <DialogTitle className="text-base font-semibold sm:text-lg">
              {order.customerName}
            </DialogTitle>
            <DialogDescription className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
              <span className="font-mono">#{order.shortCode}</span>
              <span aria-hidden className="text-muted-foreground/40">·</span>
              <span>
                {formatBRL(order.totalInCents)} · {itemCount}{" "}
                {itemCount === 1 ? "item" : "itens"}
              </span>
            </DialogDescription>
          </div>
          <div className="shrink-0 pr-6">
            <OrderStatusBadge status={order.status} size="md" />
          </div>
        </div>
      </DialogHeader>

      <div className="space-y-4 px-5 py-4 sm:px-6">
        {/* Cliente + ações primárias */}
        <section className="space-y-3 rounded-xl border bg-card p-4">
          <h3 className="text-[13.5px] font-semibold tracking-tight">
            Cliente
          </h3>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <PhoneIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className="font-mono text-[13px]">
              {order.customerPhone ?? (
                <span className="text-muted-foreground italic">
                  Sem telefone (balcão)
                </span>
              )}
            </span>
            {whatsappLink ? (
              <Button
                asChild
                size="sm"
                className="bg-whatsapp text-whatsapp-foreground hover:bg-whatsapp-hover ml-auto"
              >
                <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                  <MessageCircleIcon /> Abrir conversa
                </a>
              </Button>
            ) : null}
          </div>

          {order.customerNotes ? (
            <div className="space-y-1 rounded-lg bg-muted/50 p-3">
              <p className="text-eyebrow">Observações da cliente</p>
              <p className="whitespace-pre-wrap text-sm">
                {order.customerNotes}
              </p>
            </div>
          ) : null}
        </section>

        {/* Cliente cadastrado (vínculo opcional — Fase 3 / ADR-0014) */}
        <CustomerLinkSection
          orderId={order.id}
          linkedCustomer={order.linkedCustomer}
          snapshotName={order.customerName}
          snapshotPhone={order.customerPhone}
          onChange={onCustomerLinkChange}
        />

        {/* Linha do tempo */}
        <section className="space-y-3 rounded-xl border bg-card p-4">
          <h3 className="text-[13.5px] font-semibold tracking-tight">
            Linha do tempo
          </h3>
          <OrderTimeline order={order} />
        </section>

        {/* Itens */}
        <section className="space-y-3 rounded-xl border bg-card p-4">
          <h3 className="text-[13.5px] font-semibold tracking-tight">Itens</h3>
          <ul className="divide-y divide-border">
            {order.items.map((it) => {
              const subtotal = it.priceInCentsSnapshot * it.quantity;
              return (
                <li
                  key={it.id}
                  className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-muted sm:size-14">
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
                    <p className="font-mono text-[11.5px] tabular-nums text-muted-foreground">
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
            <span className="font-mono text-base font-semibold tabular-nums">
              {formatBRL(order.totalInCents)}
            </span>
          </div>
        </section>

        {/* Ações */}
        <section className="space-y-3 rounded-xl border bg-card p-4">
          <h3 className="text-[13.5px] font-semibold tracking-tight">Ações</h3>
          <OrderStatusActions orderId={order.id} status={order.status} />
          <Button
            asChild
            variant="outline"
            size="sm"
            className="w-full"
          >
            <a
              href={`/admin/pedidos/${order.id}/imprimir`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <PrinterIcon /> Imprimir pedido
            </a>
          </Button>
        </section>
      </div>
    </>
  );
}
