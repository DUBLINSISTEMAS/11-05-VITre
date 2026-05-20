"use client";

import { useRouter } from "next/navigation";

import type { PurchaseListRow } from "@/actions/purchase/types";
import { formatRelativeDate } from "@/lib/format";
import { formatBRL } from "@/lib/pricing";

const PAYMENT_LABEL: Record<string, string> = {
  cash: "Dinheiro",
  pix: "PIX",
  debit: "Cartão débito",
  credit: "Cartão crédito",
  other: "Outro",
};

export function PurchasesTable({
  purchases,
}: {
  purchases: ReadonlyArray<PurchaseListRow>;
}) {
  const router = useRouter();

  return (
    <div className="b3-card overflow-hidden">
      <table className="b3-tbl">
        <thead>
          <tr>
            <th>Data</th>
            <th>Fornecedor</th>
            <th>NF</th>
            <th style={{ textAlign: "right" }}>Itens</th>
            <th style={{ textAlign: "right" }}>Total</th>
            <th>Pagamento</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {purchases.map((p) => (
            <tr
              key={p.id}
              onClick={() => router.push(`/admin/compras/${p.id}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  router.push(`/admin/compras/${p.id}`);
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`Abrir compra ${p.invoiceNumber ?? p.id.slice(0, 8)}`}
              className="cursor-pointer outline-none focus-visible:bg-bg-app"
            >
              <td className="mono text-[12px]" style={{ color: "var(--ink-4)" }}>
                {formatRelativeDate(p.createdAt)}
              </td>
              <td style={{ fontWeight: 500 }}>
                {p.supplierName ?? (
                  <span className="text-ink-4 italic">Sem fornecedor</span>
                )}
              </td>
              <td className="mono text-[12px]">
                {p.invoiceNumber ?? (
                  <span className="text-ink-4">—</span>
                )}
              </td>
              <td className="mono" style={{ textAlign: "right" }}>
                {p.itemCount}
              </td>
              <td
                className="mono"
                style={{ textAlign: "right", fontWeight: 600 }}
              >
                {formatBRL(p.totalInCents)}
              </td>
              <td>
                {p.paymentMethod ? (
                  <span className="b3-pill">
                    {PAYMENT_LABEL[p.paymentMethod] ?? p.paymentMethod}
                  </span>
                ) : (
                  <span className="text-ink-4">—</span>
                )}
              </td>
              <td>
                {p.paidAt ? (
                  <span className="b3-pill b3-pill--ok">Pago</span>
                ) : (
                  <span className="b3-pill b3-pill--warn">A pagar</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
