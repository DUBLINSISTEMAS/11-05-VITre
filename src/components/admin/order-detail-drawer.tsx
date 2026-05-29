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
  CheckCircle2Icon,
  Loader2Icon,
  MessageCircleIcon,
  PhoneIcon,
  PrinterIcon,
  ReceiptIcon,
  StoreIcon,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
// useTransition é mantido só pra OrderNotesEditor (save inline com pending
// previsível). O useTransition do drawer principal foi removido: ver
// useEffect abaixo — combinava setState fora da transition + async server
// action e perdia o pending state intermitente em React 19, causando
// "loading travado" reportado pelo founder em 2026-05-29.

import {
  loadOrderDetail,
  type OrderDetail,
} from "@/actions/order/load-detail";
import { updateOrderNotes } from "@/actions/order/update-notes";
import { CustomerLinkSection } from "@/components/admin/customer-link-section";
import { OrderConfirmPaymentDialog } from "@/components/admin/order-confirm-payment-dialog";
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

/**
 * Audit 2026-05-26 — label de pagamento com parcelamento. Hoje o drawer
 * mostrava só "Crédito" mesmo em 3×; agora mostra "Crédito 3×" quando faz
 * sentido. Outras formas (cash/pix/debit/other) são sempre à vista.
 */
/**
 * Chip de validade do orçamento (Semana 5 — 2026-05-28).
 * Inline no header do drawer pra status=quote. Cor reflete urgência:
 *   verde   → +2d restantes
 *   âmbar   → 1-2d (joalheiro liga pro cliente)
 *   vermelho → expirado
 */
function QuoteValidityChip({ validUntil }: { validUntil: Date }) {
  const ms = validUntil.getTime() - Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  let label: string;
  let className: string;
  if (ms < 0) {
    const days = Math.floor(-ms / dayMs);
    label =
      days === 0
        ? "Expirou hoje"
        : days === 1
          ? "Expirou ontem"
          : `Expirou há ${days}d`;
    className = "text-destructive font-semibold";
  } else {
    const days = Math.floor(ms / dayMs);
    if (days === 0) {
      label = "Expira hoje";
      className = "text-state-warning font-semibold";
    } else if (days === 1) {
      label = "Expira amanhã";
      className = "text-state-warning font-semibold";
    } else {
      label = `${days}d restantes`;
      className = "text-state-success font-medium";
    }
  }
  return (
    <span
      className={className}
      title={validUntil.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })}
    >
      {label}
    </span>
  );
}

function paymentLabelFull(method: string, installments: number): string {
  const base = PAYMENT_LABELS[method] ?? method;
  if (method === "credit" && installments > 1) {
    return `${base} ${installments}×`;
  }
  return base;
}

// Onda 36 (2026-05-28) — espelha STATUSES_THAT_ACCEPT_PAYMENT da action
// confirmOrderPayment. Mantemos a fonte verdadeira no server (que faz
// guarda real); este Set client-side só decide se renderiza o CTA.
const ACCEPTS_PAYMENT_STATUSES = new Set([
  "awaiting_whatsapp",
  "confirmed",
  "fulfilled",
]);

interface OrderDetailDrawerProps {
  /** ID do pedido aberto. null = fechado. */
  orderId: string | null;
  onOpenChange: (open: boolean) => void;
}

export function OrderDetailDrawer({ orderId, onOpenChange }: OrderDetailDrawerProps) {
  const [data, setData] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // Incrementado quando o CustomerLinkSection muda o vínculo — força
  // refetch do detalhe pra o drawer refletir o novo estado.
  const [reloadKey, setReloadKey] = useState(0);

  // Fix 2026-05-29 — loading travado em orçamento PDV. Antes usava
  // useTransition + async function; o pending state se perdia ao combinar
  // com setStates síncronos fora da transition (reset de data/error). Agora
  // gerencia isLoading manualmente com cleanup via cancelled flag pra
  // descartar respostas obsoletas se o orderId mudar antes da action
  // resolver (clicar rápido em duas vendas seguidas).
  useEffect(() => {
    if (!orderId) {
      setData(null);
      setError(null);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setData(null);
    setError(null);
    setIsLoading(true);

    loadOrderDetail(orderId)
      .then((res) => {
        if (cancelled) return;
        setIsLoading(false);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setData(res.order);
      })
      .catch((err) => {
        if (cancelled) return;
        setIsLoading(false);
        logger.error("admin.order.detail_load_failed", { err, orderId });
        setError("Não foi possível carregar a venda. Tente novamente.");
      });

    return () => {
      cancelled = true;
    };
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
            onNotesUpdate={(next) => {
              setData((prev) =>
                prev ? { ...prev, customerNotes: next } : prev,
              );
            }}
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
  onNotesUpdate,
}: {
  order: OrderDetail;
  onCustomerLinkChange: () => void;
  /** Sprint final 2026-05-26 — sobe notes atualizadas pro parent reconciliar
   *  o state sem refetch (otimista). */
  onNotesUpdate: (next: string | null) => void;
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
              {/* Semana 5 da ressignificação (2026-05-28) — título reflete
                  natureza: orçamento (futuro) ≠ venda (passado). Antes
                  mostrava "Venda #X" mesmo pra quote, confundia lojista. */}
              {order.status === "quote" ? "Orçamento" : "Venda"}{" "}
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
                {/* Validade do orçamento — joalheiro vê de cara, antes
                    de prosseguir, quanto tempo ainda tem pra fechar. */}
                {order.status === "quote" && order.quoteValidUntil ? (
                  <>
                    <span aria-hidden>·</span>
                    <QuoteValidityChip validUntil={order.quoteValidUntil} />
                  </>
                ) : null}
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
          {/* Audit 2026-05-26 — observação editável inline. Antes era
              read-only mesmo com o comentário em orders-table prometendo
              "edita no drawer". Action updateOrderNotes lida com o save. */}
          <OrderNotesEditor
            orderId={order.id}
            initialNotes={order.customerNotes}
            onUpdate={onNotesUpdate}
          />
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
                      {paymentLabelFull(
                        order.payments[0]!.method,
                        order.payments[0]!.installments,
                      )}
                    </b>
                  </span>
                ) : (
                  <span>
                    <b className="text-ink-1">Pagamento misto</b> —{" "}
                    {order.payments.length} formas
                  </span>
                )}
              </div>
            ) : ACCEPTS_PAYMENT_STATUSES.has(order.status) ? (
              /* Onda 36 (2026-05-28) — sem order_payment registrado.
                 Típico de venda WhatsApp criada via storefront: cliente
                 confirmou no chat e pagou fora. Lojista agora registra
                 a forma pra DRE/dashboard refletirem taxa real e
                 settlement_date. Quote/canceled/expired/returned NÃO
                 mostram CTA — pagamento naqueles estados é nonsense. */
              <div
                className="mt-2 border-t pt-2"
                style={{
                  borderTop: "1px dashed var(--brand-line)",
                  borderColor: "var(--brand-line)",
                }}
              >
                <div className="text-ink-3 mb-2 text-[12px]">
                  {order.status === "awaiting_whatsapp"
                    ? "Cliente confirmou pelo WhatsApp e pagou fora. Confirme a venda e registre como ele pagou:"
                    : "Pagamento ainda não registrado."}
                </div>
                <OrderConfirmPaymentDialog
                  orderId={order.id}
                  totalInCents={order.totalInCents}
                  confirmStatusAfter={order.status === "awaiting_whatsapp"}
                />
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
                        {paymentLabelFull(p.method, p.installments)}
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

        {/* Sprint 1A Fase 4 + Semana 5 (2026-05-28) — Transformar
            orçamento em venda. Em status=quote, este vira o CTA
            principal do drawer (movido pra topo, verde, com ícone).
            Decisão #4 do paradigma: vendedor cria venda separada (não
            converte status diretamente). PDV abre com itens pré-
            carregados; vendedor reconfere e fecha como venda real.

            Audit 2026-05-28: o CTA fica visível MESMO se a validade
            expirou — joalheiro frequentemente renegocia orçamento
            antigo. Texto vira "Renovar e criar venda" para sinalizar
            que vendedor precisa reconferir preço/condição. */}
        {order.status === "quote" ? (
          <Button asChild size="sm" className="w-full gap-1.5">
            <a href={`/admin/pdv?fromQuote=${order.id}`}>
              <CheckCircle2Icon className="size-4" aria-hidden />
              {order.quoteValidUntil &&
              order.quoteValidUntil <= new Date()
                ? "Renovar e criar venda"
                : "Aceitar e criar venda"}
            </a>
          </Button>
        ) : null}

        {/* Audit 2026-05-26 — `target="_blank"` removido: o lojista pediu
            pra NÃO abrir nova aba. Navega na mesma tab; a página
            `/imprimir` dispara `window.print()` auto e o lojista volta
            pela seta do browser. Sprint 4 vai refatorar pra portal de
            print inline (sem navegação), mas isso é épico próprio. */}
        <Button asChild variant="outline" size="sm" className="w-full">
          <a href={`/admin/pedidos/${order.id}/imprimir`}>
            <PrinterIcon aria-hidden />{" "}
            {order.status === "quote" ? "Imprimir orçamento" : "Imprimir venda"}
          </a>
        </Button>
      </div>
    </>
  );
}

/**
 * Editor inline de observação da venda — Sprint final Vendas 2026-05-26.
 *
 * Antes: card cinza read-only renderizado apenas quando havia notes.
 * Agora: 3 estados — vazio (link "Adicionar observação"), com notes (texto
 * + link "Editar"), editing (textarea + Salvar/Cancelar).
 *
 * `onUpdate` notifica o parent pra reconciliar `data.customerNotes` sem
 * refetch (UX otimista). Falha do servidor reverte via re-fetch.
 */
function OrderNotesEditor({
  orderId,
  initialNotes,
  onUpdate,
}: {
  orderId: string;
  initialNotes: string | null;
  onUpdate: (next: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialNotes ?? "");
  const [isPending, startTransition] = useTransition();

  const startEdit = () => {
    setDraft(initialNotes ?? "");
    setEditing(true);
  };

  const cancel = () => {
    setEditing(false);
    setDraft(initialNotes ?? "");
  };

  const save = () => {
    startTransition(async () => {
      const next = draft.trim() === "" ? null : draft.trim();
      const r = await updateOrderNotes({ orderId, notes: next });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      onUpdate(next);
      setEditing(false);
      toast.success(
        next === null
          ? "Observação removida."
          : "Observação salva.",
      );
    });
  };

  if (editing) {
    return (
      <div className="bg-bg-app mt-2 space-y-2 rounded-lg p-3">
        <p className="text-eyebrow">Observação da venda</p>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="Ex: embrulho de presente · retirar dia 30 · fiado vale #12"
          className="border-line focus:border-brand bg-surface w-full resize-y rounded-md border px-3 py-2 text-[13px] outline-none transition"
          disabled={isPending}
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={cancel}
            disabled={isPending}
            className="text-ink-4 hover:text-ink-1 text-[12px]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={save}
            disabled={isPending}
            className="b3-btn b3-btn--sm b3-btn--primary"
          >
            {isPending ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    );
  }

  if (initialNotes && initialNotes.trim().length > 0) {
    return (
      <div className="bg-bg-app mt-2 space-y-1 rounded-lg p-3">
        <div className="flex items-baseline justify-between">
          <p className="text-eyebrow">Observação da venda</p>
          <button
            type="button"
            onClick={startEdit}
            className="text-mangos-green-800 text-[11px] font-medium hover:underline"
          >
            Editar
          </button>
        </div>
        <p className="text-ink-1 text-sm whitespace-pre-wrap">
          {initialNotes}
        </p>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={startEdit}
      className="text-ink-4 hover:text-ink-2 mt-2 inline-flex items-center gap-1 text-[12px] font-medium"
    >
      + Adicionar observação
    </button>
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
