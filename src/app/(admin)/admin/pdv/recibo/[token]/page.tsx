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
import {
  customerTable,
  orderItemTable,
  orderTable,
} from "@/db/schema";
import { requireSession } from "@/lib/auth-server";
import { formatBRL } from "@/lib/pricing";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

interface ReciboPageProps {
  params: Promise<{ token: string }>;
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Dinheiro",
  pix: "PIX",
  debit: "Débito",
  credit: "Crédito",
  other: "Outro",
};

export default async function ReciboBalcaoPage({ params }: ReciboPageProps) {
  const { token } = await params;

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

    const linkedCustomer = order.customerId
      ? await tx.query.customerTable.findFirst({
          where: eq(customerTable.id, order.customerId),
          columns: { name: true, phone: true },
        })
      : null;

    return { order, items, linkedCustomer };
  });

  if (!result) notFound();

  const { order, items, linkedCustomer } = result;
  const itemCount = items.reduce((s, it) => s + it.quantity, 0);
  const subtotal = items.reduce(
    (s, it) => s + it.priceInCentsSnapshot * it.quantity,
    0,
  );
  const discount = order.discountInCents ?? 0;
  const troco =
    order.paymentMethod === "cash" &&
    order.cashReceivedInCents !== null &&
    order.cashReceivedInCents >= order.totalInCents
      ? order.cashReceivedInCents - order.totalInCents
      : null;
  const paymentLabel = order.paymentMethod
    ? PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod
    : "—";

  return (
    <>
      <style>{`
        @media print {
          @page { margin: 1cm; }
          html, body { background: white !important; color: black !important; }
          [data-admin-chrome] { display: none !important; }
        }
      `}</style>

      <div className="mx-auto max-w-[420px] px-4 py-6 print:px-0 print:py-0">
        {/* Banner de sucesso — só em tela */}
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-900 print:hidden">
          <CheckCircle2Icon className="size-5 shrink-0 text-green-600" />
          <span className="font-medium">Venda registrada</span>
        </div>

        <PrintTrigger />

        <article className="bg-white px-4 py-5 text-black">
          <header className="border-b border-black/20 pb-3 text-center">
            <h1 className="text-base font-bold tracking-tight">{store.name}</h1>
            <p className="mt-0.5 text-[11.5px] text-black/60">
              vitre.site/{store.slug}
            </p>
            <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-black/70">
              Venda balcão · #{order.shortCode}
            </p>
            <p className="text-[11px] text-black/60">
              {order.createdAt.toLocaleString("pt-BR", {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </p>
          </header>

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

          {/* Totais */}
          <section className="mt-3 space-y-0.5 text-[12px]">
            <div className="flex justify-between">
              <span className="text-black/60">
                Subtotal · {itemCount} {itemCount === 1 ? "item" : "itens"}
              </span>
              <span className="font-mono tabular-nums">
                {formatBRL(subtotal)}
              </span>
            </div>
            {discount > 0 ? (
              <div className="flex justify-between">
                <span className="text-black/60">Desconto</span>
                <span className="font-mono tabular-nums">
                  −{formatBRL(discount)}
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

          {/* Pagamento */}
          <section className="mt-3 space-y-0.5 text-[12px]">
            <div className="flex justify-between">
              <span className="text-black/60">Pagamento</span>
              <span className="font-medium">{paymentLabel}</span>
            </div>
            {order.cashReceivedInCents !== null ? (
              <div className="flex justify-between">
                <span className="text-black/60">Recebido</span>
                <span className="font-mono tabular-nums">
                  {formatBRL(order.cashReceivedInCents)}
                </span>
              </div>
            ) : null}
            {troco !== null ? (
              <div className="flex justify-between">
                <span className="text-black/60">Troco</span>
                <span className="font-mono font-semibold tabular-nums">
                  {formatBRL(troco)}
                </span>
              </div>
            ) : null}
          </section>

          {order.customerNotes ? (
            <section className="mt-3 text-[11px]">
              <p className="text-black/60">Observação:</p>
              <p className="whitespace-pre-wrap">{order.customerNotes}</p>
            </section>
          ) : null}

          <footer className="mt-5 border-t border-black/20 pt-2 text-center text-[10px] text-black/50">
            Obrigada pela preferência!
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
