/**
 * Recibo de venda balcão imprimível (Fase 5 — ADR-0016).
 *
 * Rota auth-gated com lookup pelo `publicToken` (opaco). Layout 80mm-friendly
 * (cabe em impressora térmica comum E em A4/A5). `window.print()` é
 * disparado automaticamente; lojista pode reimprimir ou voltar.
 *
 * CSS @media print esconde chrome do admin (sidebar/topbar). Cores neutras,
 * mono pra valores monetários.
 */
import { and, asc, eq } from "drizzle-orm";
import { CheckCircle2Icon, ShoppingCartIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PrintTrigger } from "@/app/(admin)/admin/pedidos/[id]/imprimir/print-trigger";
import { PrintStoreHeader } from "@/components/admin/print/print-store-header";
import {
  customerTable,
  orderItemTable,
  orderPaymentTable,
  orderTable,
} from "@/db/schema";
import { requireSession } from "@/lib/auth-server";
import { formatBRL } from "@/lib/pricing";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

interface ReciboPageProps {
  params: Promise<{ token: string }>;
  /** Sprint 4.6 — `fmt` controla layout. Default 'thermal' (compatível
   *  com impressora 80mm). A4 pra jato/laser doméstico. */
  searchParams: Promise<{ fmt?: string }>;
}

type ReceiptFmt = "thermal" | "a4";

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Dinheiro",
  pix: "PIX",
  debit: "Débito",
  credit: "Crédito",
  other: "Outro",
};

/**
 * Monta label exibido no recibo. Cartão crédito com parcelas vira
 * "Crédito 3x"; demais formas (sem parcelas significativas) mostram
 * só o nome.
 */
function formatPaymentLabel(p: {
  method: string;
  installments: number;
}): string {
  const base = PAYMENT_LABELS[p.method] ?? p.method;
  if (p.method === "credit" && p.installments > 1) {
    return `${base} ${p.installments}x`;
  }
  return base;
}

export default async function ReciboBalcaoPage({
  params,
  searchParams,
}: ReciboPageProps) {
  const { token } = await params;
  const { fmt: rawFmt } = await searchParams;
  // Sprint 4.6 — default 'thermal' preserva comportamento (impressora
  // 80mm é o caso de uso original do balcão BR).
  const fmt: ReceiptFmt = rawFmt === "a4" ? "a4" : "thermal";
  const isA4 = fmt === "a4";

  const session = await requireSession();
  const store = await getCurrentStore(session.user.id);
  if (!store) {
    throw new Error("UNREACHABLE: recibo sem loja");
  }

  const result = await withTenant(store.id, session.user.id, async (tx) => {
    const order = await tx.query.orderTable.findFirst({
      where: and(
        eq(orderTable.publicToken, token),
        eq(orderTable.storeId, store.id),
      ),
    });
    if (!order) return null;

    const items = await tx
      .select()
      .from(orderItemTable)
      .where(eq(orderItemTable.orderId, order.id))
      .orderBy(asc(orderItemTable.id));

    // Onda 1.3 — fonte de verdade do pagamento: order_payment.
    // Antes o recibo lia order.paymentMethod (legacy = primeira linha)
    // e venda mista R$80 cash + R$50 pix imprimia "Dinheiro" só.
    const payments = await tx
      .select({
        id: orderPaymentTable.id,
        method: orderPaymentTable.method,
        amountInCents: orderPaymentTable.amountInCents,
        cashReceivedInCents: orderPaymentTable.cashReceivedInCents,
        installments: orderPaymentTable.installments,
      })
      .from(orderPaymentTable)
      .where(
        and(
          eq(orderPaymentTable.orderId, order.id),
          eq(orderPaymentTable.storeId, store.id),
        ),
      )
      .orderBy(asc(orderPaymentTable.createdAt));

    const linkedCustomer = order.customerId
      ? await tx.query.customerTable.findFirst({
          where: eq(customerTable.id, order.customerId),
          columns: { name: true, phone: true },
        })
      : null;

    return { order, items, payments, linkedCustomer };
  });

  if (!result) notFound();

  const { order, items, payments, linkedCustomer } = result;
  const itemCount = items.reduce((s, it) => s + it.quantity, 0);
  // Subtotal BRUTO (sem descontos por linha) — soma de price × qty.
  const subtotalGross = items.reduce(
    (s, it) => s + it.priceInCentsSnapshot * it.quantity,
    0,
  );
  // Soma dos descontos POR LINHA (order_item.discount_in_cents).
  // NULL = sem desconto na linha (default da maioria das vendas).
  const itemDiscountsTotal = items.reduce(
    (s, it) => s + (it.discountInCents ?? 0),
    0,
  );
  // Subtotal LÍQUIDO (= bruto − descontos por linha). É o que o desconto
  // GERAL é aplicado em cima. Cálculo coerente com o que o server
  // persistiu em order.total_in_cents.
  const subtotalNet = subtotalGross - itemDiscountsTotal;
  const discount = order.discountInCents ?? 0;
  const surcharge = order.surchargeInCents ?? 0;
  const hasItemDiscounts = itemDiscountsTotal > 0;

  // Onda 1.3 — pagamento real. Quando há payments (caminho atual), usa
  // a lista. Quando vazio (pedido legado pre-backfill ADR-0034 ou
  // orçamento aguardando pagamento), fallback no campo legacy.
  type ReceiptPaymentLine = {
    id: string;
    method: string;
    amountInCents: number;
    cashReceivedInCents: number | null;
    installments: number;
  };
  const paymentLines: ReceiptPaymentLine[] =
    payments.length > 0
      ? payments
      : order.paymentMethod
        ? [
            {
              id: "legacy",
              method: order.paymentMethod,
              amountInCents: order.totalInCents,
              cashReceivedInCents: order.cashReceivedInCents,
              installments: 1,
            },
          ]
        : [];

  // Troco soma só das linhas em dinheiro com recebido > valor da linha.
  const trocoTotal = paymentLines.reduce((acc, p) => {
    if (
      p.method === "cash" &&
      p.cashReceivedInCents !== null &&
      p.cashReceivedInCents > p.amountInCents
    ) {
      return acc + (p.cashReceivedInCents - p.amountInCents);
    }
    return acc;
  }, 0);
  const hasMultiplePayments = paymentLines.length > 1;

  return (
    <>
      <style>{`
        @media print {
          @page { size: ${isA4 ? "A4" : "80mm auto"}; margin: ${isA4 ? "1.5cm" : "4mm"}; }
          html, body { background: white !important; color: black !important; }
          [data-admin-chrome] { display: none !important; }
        }
      `}</style>

      <div
        className={`mx-auto px-4 py-6 print:px-0 print:py-0 ${
          isA4 ? "max-w-[210mm]" : "max-w-[420px]"
        }`}
      >
        {/* Banner de sucesso + toggle de formato — só em tela */}
        <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
          <div className="flex items-center gap-2 rounded-lg border border-ok/30 bg-ok-wash p-3 text-sm text-ok">
            <CheckCircle2Icon className="size-5 shrink-0 text-ok" />
            <span className="font-medium">Venda registrada</span>
          </div>
          {/* Sprint 4.6 — toggle térmico/A4. Click muda só ?fmt= sem refresh
              de dados; o caller usa Link pra preservar estado da página. */}
          <div className="ml-auto flex overflow-hidden rounded-md border border-line text-[12px]">
            <Link
              href={`/admin/pdv/recibo/${token}?fmt=thermal`}
              className={`px-3 py-1.5 ${
                !isA4 ? "bg-brand text-white" : "bg-surface text-ink-2 hover:bg-bg-app"
              }`}
              aria-pressed={!isA4}
              title="Layout 80mm para impressora térmica"
            >
              Térmico 80mm
            </Link>
            <Link
              href={`/admin/pdv/recibo/${token}?fmt=a4`}
              className={`border-l border-line px-3 py-1.5 ${
                isA4 ? "bg-brand text-white" : "bg-surface text-ink-2 hover:bg-bg-app"
              }`}
              aria-pressed={isA4}
              title="Layout A4 para impressora jato/laser"
            >
              A4
            </Link>
          </div>
        </div>

        <PrintTrigger />

        <article
          className={`bg-white text-black ${
            isA4 ? "px-10 py-8 text-[13px]" : "px-4 py-5"
          }`}
        >
          {/* Onda 2.7 — cabeçalho universal (logo, nome, CNPJ, endereço, tel). */}
          <div className="border-b border-black/20 pb-3">
            <PrintStoreHeader store={store} variant={isA4 ? "a4" : "thermal"} />
            <p
              className={`mt-2 font-mono uppercase tracking-wider text-black/70 text-center ${
                isA4 ? "text-[12px]" : "text-[11px]"
              }`}
            >
              Venda balcão · #{order.shortCode}
            </p>
            <p className="text-[11px] text-black/60 text-center">
              {order.createdAt.toLocaleString("pt-BR", {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </p>
          </div>

          {/* Cliente */}
          {linkedCustomer ? (
            <section className="mt-3 text-[12px]">
              <p className="text-black/60 uppercase tracking-wider text-[10.5px]">
                Cliente
              </p>
              <p className="font-medium">{linkedCustomer.name}</p>
              <p className="font-mono text-[11.5px]">{linkedCustomer.phone}</p>
            </section>
          ) : null}

          {/* Itens */}
          <section className="mt-3">
            <table className="w-full border-collapse text-[12px]">
              <tbody>
                {items.map((it) => (
                  <tr
                    key={it.id}
                    className="border-b border-black/10 align-top"
                  >
                    <td className="py-1.5">
                      <div className="font-medium">{it.productNameSnapshot}</div>
                      {it.variantNameSnapshot ? (
                        <div className="text-[10.5px] text-black/60">
                          {it.variantNameSnapshot}
                        </div>
                      ) : null}
                      <div className="font-mono text-[10.5px] text-black/60">
                        {it.quantity} × {formatBRL(it.priceInCentsSnapshot)}
                      </div>
                    </td>
                    <td className="whitespace-nowrap py-1.5 text-right font-mono font-semibold tabular-nums">
                      {formatBRL(it.priceInCentsSnapshot * it.quantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* Totais — breakdown completo. Quando há descontos por linha,
              mostra subtotal bruto → descontos por item → subtotal líquido
              → desconto geral → acréscimo → total. Garante que a soma
              fecha matematicamente (auditoria 2026-05-21 — antes recibo
              mostrava subtotal bruto e total líquido sem explicar o
              delta). */}
          <section className="mt-3 space-y-0.5 text-[12px]">
            <div className="flex justify-between">
              <span className="text-black/60">
                {hasItemDiscounts ? "Subtotal bruto" : "Subtotal"}
                {" · "}
                {itemCount} {itemCount === 1 ? "item" : "itens"}
              </span>
              <span className="font-mono tabular-nums">
                {formatBRL(subtotalGross)}
              </span>
            </div>
            {hasItemDiscounts ? (
              <>
                <div className="flex justify-between">
                  <span className="text-black/60">Descontos por item</span>
                  <span className="font-mono tabular-nums">
                    −{formatBRL(itemDiscountsTotal)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-black/60">Subtotal líquido</span>
                  <span className="font-mono tabular-nums">
                    {formatBRL(subtotalNet)}
                  </span>
                </div>
              </>
            ) : null}
            {discount > 0 ? (
              <div className="flex justify-between">
                <span className="text-black/60">
                  {hasItemDiscounts ? "Desconto geral" : "Desconto"}
                </span>
                <span className="font-mono tabular-nums">
                  −{formatBRL(discount)}
                </span>
              </div>
            ) : null}
            {surcharge > 0 ? (
              <div className="flex justify-between">
                <span className="text-black/60">Acréscimo</span>
                <span className="font-mono tabular-nums">
                  +{formatBRL(surcharge)}
                </span>
              </div>
            ) : null}
            <div className="mt-1 flex justify-between border-t border-black/30 pt-1 text-[14px]">
              <span className="font-bold">Total</span>
              <span className="font-mono text-[16px] font-bold tabular-nums">
                {formatBRL(order.totalInCents)}
              </span>
            </div>
          </section>

          {/* Pagamento — Onda 1.3: lista cada linha real de order_payment.
              Venda mista (R$80 cash + R$50 pix) mostra 2 linhas. Troco
              só aparece quando alguma linha de cash recebeu acima do
              valor da linha. */}
          {paymentLines.length > 0 ? (
            <section className="mt-3 space-y-0.5 text-[12px]">
              <div className="flex justify-between">
                <span className="text-black/60">
                  {hasMultiplePayments ? "Pagamentos" : "Pagamento"}
                </span>
                {!hasMultiplePayments ? (
                  <span className="font-medium">
                    {formatPaymentLabel(paymentLines[0]!)}
                  </span>
                ) : null}
              </div>
              {hasMultiplePayments
                ? paymentLines.map((p) => (
                    <div key={p.id} className="flex justify-between">
                      <span className="text-black/70 pl-2">
                        · {formatPaymentLabel(p)}
                      </span>
                      <span className="font-mono tabular-nums">
                        {formatBRL(p.amountInCents)}
                      </span>
                    </div>
                  ))
                : null}
              {paymentLines.map((p) =>
                p.method === "cash" && p.cashReceivedInCents !== null ? (
                  <div key={`recv-${p.id}`} className="flex justify-between">
                    <span className="text-black/60">
                      {hasMultiplePayments
                        ? "Recebido em dinheiro"
                        : "Recebido"}
                    </span>
                    <span className="font-mono tabular-nums">
                      {formatBRL(p.cashReceivedInCents)}
                    </span>
                  </div>
                ) : null,
              )}
              {trocoTotal > 0 ? (
                <div className="flex justify-between">
                  <span className="text-black/60">Troco</span>
                  <span className="font-mono font-semibold tabular-nums">
                    {formatBRL(trocoTotal)}
                  </span>
                </div>
              ) : null}
            </section>
          ) : null}

          {order.customerNotes ? (
            <section className="mt-3 text-[11px]">
              <p className="text-black/60">Observação:</p>
              <p className="whitespace-pre-wrap">{order.customerNotes}</p>
            </section>
          ) : null}

          <footer className="mt-5 border-t border-black/20 pt-2 text-center text-[10px] text-black/50">
            <p>Obrigada pela preferência!</p>
            {/* Sprint 4.8 — rodapé universal: gerado em / operador. */}
            <p className="mt-1">
              Gerado em{" "}
              {new Date().toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              por {session.user.name ?? "operador"}
            </p>
          </footer>
        </article>

        {/* Ações — só em tela */}
        <div className="mt-4 grid gap-2 print:hidden">
          <Link
            href="/admin/pdv"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-foreground text-background font-medium text-sm hover:opacity-90"
          >
            <ShoppingCartIcon className="size-4" />
            Nova venda
          </Link>
        </div>
      </div>
    </>
  );
}
