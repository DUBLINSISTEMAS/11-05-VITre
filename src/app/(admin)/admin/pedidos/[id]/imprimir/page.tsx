/**
 * Visualização imprimível do pedido — Onda 7 (2026-05-13).
 *
 * Rota auth-gated. Lojista abre daqui (novo tab) a partir do modal de
 * detalhe e clica em Imprimir. Layout otimizado pra papel:
 *   - sem chrome do admin (oculta sidebar/topbar via root segment override
 *     com CSS print-only no <head>)
 *   - mono em códigos, sans em texto
 *   - quebra de página controlada por seção
 *   - cores neutras (sem brand) — economia de tinta
 *
 * Auto-fire window.print() on mount via PrintTrigger client component.
 * Lojista pode imprimir de novo ou cancelar e voltar.
 */
import { and, asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { PrintStoreHeader } from "@/components/admin/print/print-store-header";
import { orderItemTable, orderPaymentTable, orderTable } from "@/db/schema";
import { requireSession } from "@/lib/auth-server";
import { formatBRL } from "@/lib/pricing";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

import { PrintTrigger } from "./print-trigger";

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Dinheiro",
  pix: "PIX",
  debit: "Débito",
  credit: "Crédito",
  other: "Outro",
};

export const dynamic = "force-dynamic";

interface ImprimirPageProps {
  params: Promise<{ id: string }>;
}

const STATUS_LABELS: Record<string, string> = {
  quote: "Orçamento",
  awaiting_whatsapp: "Aguardando contato",
  confirmed: "Confirmado",
  fulfilled: "Concluído",
  canceled: "Cancelado",
  expired: "Expirado",
};

export default async function ImprimirPedidoPage({
  params,
}: ImprimirPageProps) {
  const { id } = await params;

  const session = await requireSession();
  const store = await getCurrentStore(session.user.id);
  if (!store) {
    throw new Error("UNREACHABLE: imprimir pedido sem loja");
  }

  const result = await withTenant(store.id, session.user.id, async (tx) => {
    const order = await tx.query.orderTable.findFirst({
      where: and(eq(orderTable.id, id), eq(orderTable.storeId, store.id)),
    });
    if (!order) return null;

    const items = await tx
      .select()
      .from(orderItemTable)
      .where(eq(orderItemTable.orderId, order.id))
      .orderBy(asc(orderItemTable.id));

    // Onda 1.3 — multi-pagamento real.
    const payments = await tx
      .select({
        id: orderPaymentTable.id,
        method: orderPaymentTable.method,
        amountInCents: orderPaymentTable.amountInCents,
        cashReceivedInCents: orderPaymentTable.cashReceivedInCents,
      })
      .from(orderPaymentTable)
      .where(
        and(
          eq(orderPaymentTable.orderId, order.id),
          eq(orderPaymentTable.storeId, store.id),
        ),
      )
      .orderBy(asc(orderPaymentTable.createdAt));

    return { order, items, payments };
  });

  if (!result) notFound();

  const { order, items, payments } = result;
  const itemCount = items.reduce((s, it) => s + it.quantity, 0);
  const statusLabel = STATUS_LABELS[order.status] ?? order.status;
  // Breakdown coerente com server (audit 2026-05-21): subtotal bruto −
  // descontos por linha = subtotal líquido. Aplicar desconto geral +
  // acréscimo em cima do líquido fecha matematicamente com totalInCents.
  const subtotalGross = items.reduce(
    (s, it) => s + it.priceInCentsSnapshot * it.quantity,
    0,
  );
  const itemDiscountsTotal = items.reduce(
    (s, it) => s + (it.discountInCents ?? 0),
    0,
  );
  const subtotalNet = subtotalGross - itemDiscountsTotal;
  const orderDiscount = order.discountInCents ?? 0;
  const orderSurcharge = order.surchargeInCents ?? 0;
  const hasItemDiscounts = itemDiscountsTotal > 0;
  const hasAnyAdjustment =
    hasItemDiscounts || orderDiscount > 0 || orderSurcharge > 0;

  // Onda 1.3 — pagamento real (com fallback legacy pra pedidos antigos).
  type PrintPaymentLine = {
    id: string;
    method: string;
    amountInCents: number;
    cashReceivedInCents: number | null;
  };
  const paymentLines: PrintPaymentLine[] =
    payments.length > 0
      ? payments
      : order.paymentMethod
        ? [
            {
              id: "legacy",
              method: order.paymentMethod,
              amountInCents: order.totalInCents,
              cashReceivedInCents: order.cashReceivedInCents,
            },
          ]
        : [];
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

  return (
    <>
      {/*
        CSS print: oculta layout do admin (header/sidebar/bottom nav)
        e força background branco. Inline porque é específico a esta
        rota e não justifica entrada em globals.css.
      */}
      <style>{`
        @media print {
          @page { margin: 1.5cm; }
          html, body { background: white !important; color: black !important; }
          [data-admin-chrome] { display: none !important; }
        }
      `}</style>

      <PrintTrigger />

      <article className="mx-auto max-w-[700px] bg-white px-6 py-8 text-black print:px-0 print:py-0">
        {/* Onda 2.7 — cabeçalho universal (logo + CNPJ + endereço + tel) */}
        <div className="border-b border-black/20 pb-4">
          <PrintStoreHeader store={store} variant="a4" />
        </div>

        {/* Cabeçalho do documento — Sprint 1A Fase 4: orçamento diferenciado */}
        <header className="border-b border-black/20 pb-3 pt-4">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-lg font-bold tracking-tight">
              {order.status === "quote" ? "ORÇAMENTO" : "Venda"} #{order.shortCode}
            </h2>
            <span className="font-mono text-[12px] uppercase tracking-wider">
              {statusLabel}
            </span>
          </div>
          <p className="mt-1 text-[12.5px] text-black/70">
            {order.createdAt.toLocaleString("pt-BR", {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </p>
          {order.status === "quote" && order.quoteValidUntil ? (
            <p className="mt-1 text-[12.5px] font-medium text-black/70">
              Validade:{" "}
              {order.quoteValidUntil.toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
            </p>
          ) : null}
        </header>

        {/* Cliente */}
        <section className="mt-5 break-inside-avoid">
          <h2 className="font-mono text-[10.5px] uppercase tracking-[0.5px] text-black/60">
            Cliente
          </h2>
          <dl className="mt-2 grid grid-cols-[120px_1fr] gap-y-1 text-[13px]">
            <dt className="text-black/60">Nome</dt>
            <dd className="font-medium">{order.customerName}</dd>
            <dt className="text-black/60">WhatsApp</dt>
            <dd className="font-mono">{order.customerPhone ?? "—"}</dd>
            {order.customerNotes ? (
              <>
                <dt className="text-black/60">Observações</dt>
                <dd className="whitespace-pre-wrap">{order.customerNotes}</dd>
              </>
            ) : null}
          </dl>
        </section>

        {/* Itens */}
        <section className="mt-6 break-inside-avoid">
          <h2 className="font-mono text-[10.5px] uppercase tracking-[0.5px] text-black/60">
            Itens
          </h2>
          {/* Tabela ganha coluna "Desc." quando há descontos por linha
              em qualquer item — assim a soma de cada linha bate com a
              soma geral. Quando não há, mantém 4 colunas (compacto). */}
          <table className="mt-2 w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-black/30 text-left text-[11.5px] uppercase tracking-wider text-black/60">
                <th className="py-1.5 font-semibold">Produto</th>
                <th className="py-1.5 text-right font-semibold">Qtd</th>
                <th className="py-1.5 text-right font-semibold">Unit.</th>
                {hasItemDiscounts ? (
                  <th className="py-1.5 text-right font-semibold">Desc.</th>
                ) : null}
                <th className="py-1.5 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const lineGross = it.priceInCentsSnapshot * it.quantity;
                const lineDiscount = it.discountInCents ?? 0;
                const lineNet = lineGross - lineDiscount;
                return (
                  <tr key={it.id} className="border-b border-black/10">
                    <td className="py-2">
                      <div className="font-medium">
                        {it.productNameSnapshot}
                      </div>
                      {it.variantNameSnapshot ? (
                        <div className="text-[11.5px] text-black/60">
                          {it.variantNameSnapshot}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums">
                      {it.quantity}
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums">
                      {formatBRL(it.priceInCentsSnapshot)}
                    </td>
                    {hasItemDiscounts ? (
                      <td className="py-2 text-right font-mono tabular-nums">
                        {lineDiscount > 0 ? `−${formatBRL(lineDiscount)}` : "—"}
                      </td>
                    ) : null}
                    <td className="py-2 text-right font-mono font-semibold tabular-nums">
                      {formatBRL(lineNet)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              {/* Breakdown se houver descontos por item / desconto geral /
                  acréscimo. Cada linha do breakdown ocupa 2 cols (label +
                  valor). Sem nenhum ajuste, mostra só Total compacto. */}
              {hasAnyAdjustment ? (
                <>
                  <tr className="border-t border-black/30 text-[12px]">
                    <td className="pt-3" colSpan={hasItemDiscounts ? 3 : 2}>
                      <span className="font-mono text-[11px] uppercase tracking-wider text-black/60">
                        {itemCount} {itemCount === 1 ? "item" : "itens"}
                      </span>
                    </td>
                    <td className="pt-3 text-right text-black/60">
                      {hasItemDiscounts ? "Subtotal bruto" : "Subtotal"}
                    </td>
                    <td className="pt-3 text-right font-mono tabular-nums">
                      {formatBRL(subtotalGross)}
                    </td>
                  </tr>
                  {hasItemDiscounts ? (
                    <>
                      <tr className="text-[12px]">
                        <td colSpan={3} />
                        <td className="text-right text-black/60">
                          Descontos por item
                        </td>
                        <td className="text-right font-mono tabular-nums">
                          −{formatBRL(itemDiscountsTotal)}
                        </td>
                      </tr>
                      <tr className="text-[12px]">
                        <td colSpan={3} />
                        <td className="text-right text-black/60">
                          Subtotal líquido
                        </td>
                        <td className="text-right font-mono tabular-nums">
                          {formatBRL(subtotalNet)}
                        </td>
                      </tr>
                    </>
                  ) : null}
                  {orderDiscount > 0 ? (
                    <tr className="text-[12px]">
                      <td colSpan={hasItemDiscounts ? 3 : 2} />
                      <td className="text-right text-black/60">
                        {hasItemDiscounts ? "Desconto geral" : "Desconto"}
                      </td>
                      <td className="text-right font-mono tabular-nums">
                        −{formatBRL(orderDiscount)}
                      </td>
                    </tr>
                  ) : null}
                  {orderSurcharge > 0 ? (
                    <tr className="text-[12px]">
                      <td colSpan={hasItemDiscounts ? 3 : 2} />
                      <td className="text-right text-black/60">Acréscimo</td>
                      <td className="text-right font-mono tabular-nums">
                        +{formatBRL(orderSurcharge)}
                      </td>
                    </tr>
                  ) : null}
                  <tr className="border-t border-black/30 text-[14px]">
                    <td colSpan={hasItemDiscounts ? 3 : 2} />
                    <td className="pt-1 text-right font-mono uppercase tracking-wider text-black/60">
                      Total
                    </td>
                    <td className="pt-1 text-right font-mono text-[16px] font-bold tabular-nums">
                      {formatBRL(order.totalInCents)}
                    </td>
                  </tr>
                </>
              ) : (
                <tr className="border-t border-black/30 text-[14px]">
                  <td className="pt-3" colSpan={2}>
                    <span className="font-mono text-[11px] uppercase tracking-wider text-black/60">
                      {itemCount} {itemCount === 1 ? "item" : "itens"}
                    </span>
                  </td>
                  <td className="pt-3 text-right font-mono uppercase tracking-wider text-black/60">
                    Total
                  </td>
                  <td className="pt-3 text-right font-mono text-[16px] font-bold tabular-nums">
                    {formatBRL(order.totalInCents)}
                  </td>
                </tr>
              )}
            </tfoot>
          </table>
        </section>

        {/* Pagamento — Onda 1.3. Antes do rodapé, só exibe quando há
            linha de pagamento (orçamento sem método ainda fica vazio). */}
        {paymentLines.length > 0 ? (
          <section className="mt-6 break-inside-avoid">
            <h2 className="font-mono text-[10.5px] uppercase tracking-[0.5px] text-black/60">
              {paymentLines.length > 1 ? "Pagamentos" : "Pagamento"}
            </h2>
            <table className="mt-2 w-full border-collapse text-[13px]">
              <tbody>
                {paymentLines.map((p) => (
                  <tr key={p.id} className="border-b border-black/10">
                    <td className="py-1.5">
                      <span className="font-medium">
                        {PAYMENT_LABELS[p.method] ?? p.method}
                      </span>
                      {p.method === "cash" &&
                      p.cashReceivedInCents !== null &&
                      p.cashReceivedInCents > p.amountInCents ? (
                        <span className="text-[11.5px] text-black/60 ml-2">
                          (recebido {formatBRL(p.cashReceivedInCents)})
                        </span>
                      ) : null}
                    </td>
                    <td className="py-1.5 text-right font-mono tabular-nums">
                      {formatBRL(p.amountInCents)}
                    </td>
                  </tr>
                ))}
                {trocoTotal > 0 ? (
                  <tr>
                    <td className="pt-2 text-right text-[12px] text-black/60">
                      Troco
                    </td>
                    <td className="pt-2 text-right font-mono font-semibold tabular-nums">
                      {formatBRL(trocoTotal)}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </section>
        ) : null}

        {/* Rodapé */}
        <footer className="mt-8 border-t border-black/20 pt-3 text-[11px] text-black/50">
          {order.status === "quote" ? (
            <p className="mb-1 font-medium text-black/70">
              Este documento é apenas orçamento. Não tem valor fiscal.
            </p>
          ) : null}
          Mangos Pay · {store.name} · mangospay.app/{store.slug}
        </footer>
      </article>
    </>
  );
}
