"use client";

import {
  Loader2Icon,
  MessageCircleIcon,
  PhoneIcon,
  PrinterIcon,
} from "lucide-react";
import Image from "next/image";
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
      <DialogHeader className="border-b border-line px-5 py-4 sm:px-6">
        <DialogTitle className="sr-only">Carregando venda…</DialogTitle>
        <DialogDescription className="sr-only">
          Aguardando dados da venda.
        </DialogDescription>
      </DialogHeader>
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-ink-4">
        <Loader2Icon className="size-4 animate-spin" /> Carregando…
      </div>
    </>
  );
}

function DialogShellError({ message }: { message: string }) {
  return (
    <>
      <DialogHeader className="border-b border-line px-5 py-4 sm:px-6">
        <DialogTitle>Não foi possível abrir a venda</DialogTitle>
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
      <DialogHeader className="border-b border-line px-5 py-4 sm:px-6">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1 space-y-0.5">
            <DialogTitle className="text-base font-semibold text-ink-1 sm:text-lg">
              {order.customerName}
            </DialogTitle>
            <DialogDescription className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
              <span className="font-mono">#{order.shortCode}</span>
              <span aria-hidden className="text-ink-5">·</span>
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
        <section className="b3-card space-y-3 p-4">
          <h3 className="text-[13.5px] font-semibold tracking-tight text-ink-1">
            Cliente
          </h3>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <PhoneIcon className="size-4 shrink-0 text-ink-4" />
            <span className="font-mono text-[13px] text-ink-1">
              {order.customerPhone ?? (
                <span className="text-ink-4 italic">
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
            <div className="space-y-1 rounded-lg bg-bg-app p-3">
              <p className="text-eyebrow">Observações da cliente</p>
              <p className="whitespace-pre-wrap text-sm text-ink-1">
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
        <section className="b3-card space-y-3 p-4">
          <h3 className="text-[13.5px] font-semibold tracking-tight text-ink-1">
            Linha do tempo
          </h3>
          <OrderTimeline order={order} />
        </section>

        {/* Itens */}
        <section className="b3-card space-y-3 p-4">
          <h3 className="text-[13.5px] font-semibold tracking-tight text-ink-1">Itens</h3>
          <ul className="divide-y divide-line">
            {order.items.map((it) => {
              const subtotal = it.priceInCentsSnapshot * it.quantity;
              return (
                <li
                  key={it.id}
                  className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-bg-app sm:size-14">
                    {it.imageUrlSnapshot ? (
                      <Image
                        src={it.imageUrlSnapshot}
                        alt=""
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="truncate text-sm font-medium text-ink-1">
                      {it.productNameSnapshot}
                    </p>
                    {it.variantNameSnapshot ? (
                      <p className="text-ink-4 text-xs">
                        {it.variantNameSnapshot}
                      </p>
                    ) : null}
                    <p className="font-mono text-[11.5px] tabular-nums text-ink-4">
                      {it.quantity} × {formatBRL(it.priceInCentsSnapshot)}
                    </p>
                  </div>
                  <p className="font-mono text-sm font-medium tabular-nums text-ink-1">
                    {formatBRL(subtotal)}
                  </p>
                </li>
              );
            })}
          </ul>
          <div className="flex items-center justify-between border-t border-line pt-3">
            <span className="text-sm font-medium text-ink-1">Total</span>
            <span className="font-mono text-base font-semibold tabular-nums text-ink-1">
              {formatBRL(order.totalInCents)}
            </span>
          </div>
        </section>

        {/* Ações */}
        <section className="b3-card space-y-3 p-4">
          <h3 className="text-[13.5px] font-semibold tracking-tight text-ink-1">Ações</h3>
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
              <PrinterIcon /> Imprimir venda
            </a>
          </Button>
        </section>
      </div>
    </>
  );
}
