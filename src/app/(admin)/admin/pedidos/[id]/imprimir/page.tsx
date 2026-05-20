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

import { orderItemTable, orderTable } from "@/db/schema";
import { requireSession } from "@/lib/auth-server";
import { formatBRL } from "@/lib/pricing";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

import { PrintTrigger } from "./print-trigger";

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

    return { order, items };
  });

  if (!result) notFound();

  const { order, items } = result;
  const itemCount = items.reduce((s, it) => s + it.quantity, 0);
  const statusLabel = STATUS_LABELS[order.status] ?? order.status;

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
        {/* Cabeçalho — Sprint 1A Fase 4: header diferenciado pra orçamento */}
        <header className="border-b border-black/20 pb-4">
          <div className="flex items-baseline justify-between gap-4">
            <h1 className="text-xl font-bold tracking-tight">
              {order.status === "quote" ? "ORÇAMENTO" : "Venda"} #{order.shortCode}
            </h1>
            <span className="font-mono text-[12px] uppercase tracking-wider">
              {statusLabel}
            </span>
          </div>
          <p className="mt-1 text-[12.5px] text-black/70">
            {store.name} ·{" "}
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
          <table className="mt-2 w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-black/30 text-left text-[11.5px] uppercase tracking-wider text-black/60">
                <th className="py-1.5 font-semibold">Produto</th>
                <th className="py-1.5 text-right font-semibold">Qtd</th>
                <th className="py-1.5 text-right font-semibold">Unit.</th>
                <th className="py-1.5 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-b border-black/10">
                  <td className="py-2">
                    <div className="font-medium">{it.productNameSnapshot}</div>
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
                  <td className="py-2 text-right font-mono font-semibold tabular-nums">
                    {formatBRL(it.priceInCentsSnapshot * it.quantity)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
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
            </tfoot>
          </table>
        </section>

        {/* Rodapé */}
        <footer className="mt-8 border-t border-black/20 pt-3 text-[11px] text-black/50">
          {order.status === "quote" ? (
            <p className="mb-1 font-medium text-black/70">
              Este documento é apenas orçamento. Não tem valor fiscal.
            </p>
          ) : null}
          Vitrê · {store.name} · vitre.site/{store.slug}
        </footer>
      </article>
    </>
  );
}
