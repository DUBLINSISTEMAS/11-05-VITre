"use client";

// Drawer de detalhe da venda — handoff design 2026-05-25 (Passo 4 redesign).
//
// Substitui `OrderDetailDialog` (Dialog modal centrado) por `Sheet`
// slide-right max-w-[560px] conforme protótipo
// (`design_handoff_mangos_pay/app-oficial/drawers.jsx` linhas 6-176).
//
// Reaproveita 100% da lógica de carregamento + sub-componentes:
//   - loadOrderDetail (server action)
//   - OrderTimeline
//   - OrderStatusActions
//   - CustomerLinkSection
//   - OrderReturnDialog (abre por cima do drawer)
//
// O que muda visualmente vs a Dialog anterior:
//   1. Wrapper Sheet (slide right) em vez de Dialog (zoom-center)
//   2. Header em b3-drawer-hd: avatar ícone + "Venda #<code>" + status pill + canal + relativo
//   3. Customer card com avatar de iniciais (verde Mangos brand-wash)
//   4. Resumo financeiro como card dedicado (cream-soft + brand-line)
//
// O drawer é controlado via `orderId` prop. null = fechado. O host
// (`OrderDetailDrawerListener`) é quem segura o state e roda na admin-shell.

import {
  Loader2Icon,
  MessageCircleIcon,
  PhoneIcon,
  PrinterIcon,
  ReceiptIcon,
  StoreIcon,
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatRelativeDate } from "@/lib/format";
import { logger } from "@/lib/logger";
import { formatBRL } from "@/lib/pricing";

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Dinheiro",
  pix: "PIX",
  debit: "Débito",
  credit: "Crédito",
  other: "Outro",
};

interface OrderDetailDrawerProps {
  /** ID do pedido aberto. null = fechado. */
  orderId: string | null;
  onOpenChange: (open: boolean) => void;
}

export function OrderDetailDrawer({ orderId, onOpenChange }: OrderDetailDrawerProps) {
  const [data, setData] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startLoad] = useTransition();
  // Incrementado quando o CustomerLinkSection muda o vínculo — força
  // refetch do detalhe pra o drawer refletir o novo estado.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!orderId) {
      setData(null);
      setError(null);
      return;
    }
    setData(null);
    setError(null);
    startLoad(async () => {
      try {
        const res = await loadOrderDetail(orderId);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setData(res.order);
      } catch (err) {
        logger.error("admin.order.detail_load_failed", { err, orderId });
        setError("Não foi possível carregar a venda. Tente novamente.");
      }
    });
  }, [orderId, reloadKey]);

  return (
    <Sheet open={orderId !== null} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[560px]"
      >
        {isLoading || (!data && !error) ? (
          <DrawerLoading />
        ) : error ? (
          <DrawerError message={error} />
        ) : data ? (
          <DrawerContent
            order={data}
            onCustomerLinkChange={() => setReloadKey((k) => k + 1)}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function DrawerLoading() {
  return (
    <>
      <SheetHeader className="border-line border-b px-5 py-4">
        <SheetTitle className="sr-only">Carregando venda…</SheetTitle>
        <SheetDescription className="sr-only">
          Aguardando dados da venda.
        </SheetDescription>
      </SheetHeader>
      <div className="text-ink-4 flex flex-1 items-center justify-center gap-2 text-sm">
        <Loader2Icon className="size-4 animate-spin" aria-hidden /> Carregando…
      </div>
    </>
  );
}

function DrawerError({ message }: { message: string }) {
  return (
    <SheetHeader className="border-line border-b px-5 py-4">
      <SheetTitle>Não foi possível abrir a venda</SheetTitle>
      <SheetDescription>{message}</SheetDescription>
    </SheetHeader>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function DrawerContent({
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

  const channelLabel = order.channel === "balcao" ? "Balcão" : "Loja online";
  const isBalcao = order.channel === "balcao";

  return (
    <>
      {/* Header bundle-style — icon brand + "Venda #<code>" + status pill + canal + tempo. */}
      <SheetHeader className="border-line shrink-0 gap-0 border-b px-5 py-4">
        <div className="flex items-start gap-3">
          <div
            aria-hidden
            className="grid size-9 shrink-0 place-items-center rounded-[10px]"
            style={{ background: "var(--mangos-green-800)", color: "white" }}
          >
            <ReceiptIcon className="size-4.5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <SheetTitle className="text-ink-1 text-[15px] font-semibold tracking-tight">
              Venda{" "}
              <span
                className="font-mono"
                style={{ color: "var(--mangos-green-800)" }}
              >
                #{order.shortCode}
              </span>
            </SheetTitle>
            <SheetDescription asChild>
              <div className="text-ink-4 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px]">
                <OrderStatusBadge status={order.status} />
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1">
                  {isBalcao ? (
                    <StoreIcon className="size-3" aria-hidden />
                  ) : (
                    <MessageCircleIcon className="size-3" aria-hidden />
                  )}
                  {channelLabel}
                </span>
                <span aria-hidden>·</span>
                <span>{formatRelativeDate(order.createdAt)}</span>
              </div>
            </SheetDescription>
          </div>
        </div>
      </SheetHeader>

      {/* Body — scroll vertical interno. */}
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {/* Cliente (avatar + nome + telefone + WhatsApp) */}
        <Section title="Cliente">
          <div className="bg-bg-app flex items-center gap-3 rounded-[10px] p-3">
            <div
              aria-hidden
              className="grid size-10 shrink-0 place-items-center rounded-full text-[13px] font-bold"
              style={{
                background: "var(--mangos-green-100)",
                color: "var(--mangos-green-800)",
              }}
            >
              {getInitials(order.customerName)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-ink-1 truncate text-[13.5px] font-semibold">
                {order.customerName}
              </p>
              <p className="text-ink-4 mt-0.5 flex items-center gap-1 font-mono text-[11.5px]">
                <PhoneIcon className="size-3" aria-hidden />
                {order.customerPhone ?? (
                  <span className="italic">Sem telefone (balcão)</span>
                )}
              </p>
            </div>
            {whatsappLink ? (
              <Button
                asChild
                size="sm"
                variant="outline"
                className="shrink-0"
                aria-label="Abrir conversa no WhatsApp"
              >
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircleIcon aria-hidden /> WhatsApp
                </a>
              </Button>
            ) : null}
          </div>
          {order.customerNotes ? (
            <div className="bg-bg-app mt-2 space-y-1 rounded-lg p-3">
              <p className="text-eyebrow">Observações da cliente</p>
              <p className="text-ink-1 text-sm whitespace-pre-wrap">
                {order.customerNotes}
              </p>
            </div>
          ) : null}
        </Section>

        {/* Cliente cadastrado (vínculo opcional — Fase 3 / ADR-0014) */}
        <CustomerLinkSection
          orderId={order.id}
          linkedCustomer={order.linkedCustomer}
          snapshotName={order.customerName}
          snapshotPhone={order.customerPhone}
          onChange={onCustomerLinkChange}
        />

        {/* Itens da venda */}
        <Section title="Itens da venda">
          <div className="border-line overflow-hidden rounded-[10px] border">
            <ul>
              {order.items.map((it, idx) => {
                const subtotal = it.priceInCentsSnapshot * it.quantity;
                const isLast = idx === order.items.length - 1;
                return (
                  <li
                    key={it.id}
                    className={`flex items-center gap-3 p-3 ${isLast ? "" : "border-line border-b"}`}
                  >
                    <div className="bg-bg-app relative size-10 shrink-0 overflow-hidden rounded-md">
                      {it.imageUrlSnapshot ? (
                        <Image
                          src={it.imageUrlSnapshot}
                          alt=""
                          fill
                          sizes="40px"
                          className="object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-ink-1 truncate text-[13px] font-medium leading-tight">
                        {it.productNameSnapshot}
                      </p>
                      {it.variantNameSnapshot ? (
                        <p className="text-ink-4 mt-0.5 text-[11px]">
                          {it.variantNameSnapshot}
                        </p>
                      ) : null}
                      <p className="text-ink-4 mt-0.5 font-mono text-[11px] tabular-nums">
                        {it.quantity} × {formatBRL(it.priceInCentsSnapshot)}
                      </p>
                    </div>
                    <span className="text-ink-1 font-mono text-[13.5px] font-bold tabular-nums">
                      {formatBRL(subtotal)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </Section>

        {/* Resumo financeiro (cream + brand-line) — destaque do total + método */}
        <Section title="Resumo financeiro">
          <div
            className="rounded-[10px] p-3"
            style={{
              background: "var(--mangos-cream-soft)",
              border: "1px solid var(--brand-line)",
            }}
          >
            <div className="text-ink-3 mb-1.5 flex justify-between text-[13px]">
              <span>Itens ({itemCount})</span>
              <span className="font-mono tabular-nums">
                {formatBRL(order.totalInCents)}
              </span>
            </div>
            <div
              className="mt-2 flex items-baseline justify-between border-t pt-2"
              style={{ borderColor: "var(--brand-line)" }}
            >
              <span className="text-[13px] font-bold">Total</span>
              <span
                className="font-mono text-[19px] font-bold tabular-nums"
                style={{ color: "var(--mangos-green-900)" }}
              >
                {formatBRL(order.totalInCents)}
              </span>
            </div>
            {order.payments.length > 0 ? (
              <div
                className="text-ink-3 mt-2 border-t pt-2 text-[12px]"
                style={{
                  borderTop: "1px dashed var(--brand-line)",
                  borderColor: "var(--brand-line)",
                }}
              >
                {order.payments.length === 1 ? (
                  <span>
                    Pagamento:{" "}
                    <b className="text-ink-1">
                      {PAYMENT_LABELS[order.payments[0]!.method] ??
                        order.payments[0]!.method}
                    </b>
                  </span>
                ) : (
                  <span>
                    <b className="text-ink-1">Pagamento misto</b> —{" "}
                    {order.payments.length} formas
                  </span>
                )}
              </div>
            ) : null}
          </div>

          {/* Detalhamento dos pagamentos quando 2+ */}
          {order.payments.length > 1 ? (
            <ul className="divide-line mt-2 divide-y">
              {order.payments.map((p) => {
                const troco =
                  p.method === "cash" &&
                  p.cashReceivedInCents !== null &&
                  p.cashReceivedInCents > p.amountInCents
                    ? p.cashReceivedInCents - p.amountInCents
                    : null;
                return (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-3 py-2 text-sm first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-ink-1 font-medium">
                        {PAYMENT_LABELS[p.method] ?? p.method}
                      </p>
                      {troco !== null ? (
                        <p className="text-ink-4 font-mono text-[11.5px] tabular-nums">
                          Recebido {formatBRL(p.cashReceivedInCents!)} · troco{" "}
                          {formatBRL(troco)}
                        </p>
                      ) : null}
                    </div>
                    <span className="text-ink-1 font-mono text-[13px] font-semibold tabular-nums">
                      {formatBRL(p.amountInCents)}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </Section>

        {/* Linha do tempo (componente já existente) */}
        <Section title="Linha do tempo">
          <OrderTimeline order={order} />
        </Section>

        {/* Devoluções (quando houver) */}
        {order.returns.length > 0 ? (
          <Section title="Devoluções">
            <ul className="divide-line divide-y text-[12.5px]">
              {order.returns.map((r) => (
                <li key={r.id} className="py-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-state-error text-[10.5px] font-bold uppercase tracking-wide">
                      {r.returnType === "full"
                        ? "Devolução total"
                        : "Devolução parcial"}
                    </span>
                    <span className="text-ink-1 mono font-medium tabular-nums">
                      {formatBRL(r.refundedInCents)}
                    </span>
                  </div>
                  <p className="text-ink-3 mt-1 text-[12px]">{r.reason}</p>
                  <p className="text-ink-4 mt-0.5 text-[10.5px]">
                    {r.createdAt.toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}{" "}
                    {r.createdAt.toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}
      </div>

      {/* Footer com ações por status — sticky, separador acima. */}
      <div className="border-line bg-surface shrink-0 space-y-3 border-t p-4">
        <OrderStatusActions
          orderId={order.id}
          status={order.status}
          items={order.items}
          totalInCents={order.totalInCents}
        />

        {/* Sprint 1A Fase 4 — Transformar orçamento em venda. */}
        {order.status === "quote" &&
        order.quoteValidUntil &&
        order.quoteValidUntil > new Date() ? (
          <Button asChild size="sm" className="w-full">
            <a href={`/admin/pdv?fromQuote=${order.id}`}>Transformar em venda</a>
          </Button>
        ) : null}

        <Button asChild variant="outline" size="sm" className="w-full">
          <a
            href={`/admin/pedidos/${order.id}/imprimir`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <PrinterIcon aria-hidden />{" "}
            {order.status === "quote" ? "Imprimir orçamento" : "Imprimir venda"}
          </a>
        </Button>
      </div>
    </>
  );
}

/** Section helper — replica `FormSection` do bundle (título + body). */
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-ink-1 text-[13px] font-semibold tracking-tight">
        {title}
      </h3>
      {children}
    </section>
  );
}
