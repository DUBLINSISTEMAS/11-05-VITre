"use client";

import { CheckIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import type { PaymentMethod } from "@/actions/order/balcao/schema";
import { markPurchasePaid } from "@/actions/purchase";
import type { PurchaseDetail } from "@/actions/purchase/types";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatBRL } from "@/lib/pricing";

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Dinheiro" },
  { value: "pix", label: "PIX" },
  { value: "debit", label: "Cartão débito" },
  { value: "credit", label: "Cartão crédito" },
  { value: "other", label: "Outro" },
];

const PAYMENT_LABEL: Record<string, string> = Object.fromEntries(
  PAYMENT_METHODS.map((m) => [m.value, m.label]),
);

export function PurchaseDetailView({ detail }: { detail: PurchaseDetail }) {
  const { purchase, items } = detail;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [payMethod, setPayMethod] = useState<PaymentMethod>("pix");
  const [paidAt, setPaidAt] = useState<Date | null>(purchase.paidAt);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(
    (purchase.paymentMethod as PaymentMethod | null) ?? null,
  );
  const [isPending, startTransition] = useTransition();

  function handleMarkPaid() {
    startTransition(async () => {
      const res = await markPurchasePaid({ id: purchase.id, paymentMethod: payMethod });
      if (!res.ok) {
        toast.error(res.error ?? "Falha ao marcar como pago.");
        return;
      }
      toast.success("Compra marcada como paga.");
      setPaidAt(new Date());
      setPaymentMethod(payMethod);
      setDialogOpen(false);
    });
  }

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <section className="b3-card b3-card-pad space-y-3">
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="Itens" value={String(items.length)} />
          <Stat label="Total" value={formatBRL(purchase.totalInCents)} bold />
          <Stat
            label="Status"
            value={paidAt ? "Pago" : "A pagar"}
            tone={paidAt ? "ok" : "warn"}
          />
          <Stat
            label="Forma de pagamento"
            value={
              paymentMethod
                ? PAYMENT_LABEL[paymentMethod] ?? paymentMethod
                : "—"
            }
          />
        </div>

        {paidAt ? (
          <div className="text-ink-4 text-[12px]">
            Pago em{" "}
            {paidAt.toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })}
            {" "}às{" "}
            {paidAt.toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="b3-btn b3-btn--cta gap-2"
            disabled={isPending}
          >
            <CheckIcon size={13} /> Marcar como pago
          </button>
        )}

        {purchase.notes ? (
          <div className="border-line border-t pt-3">
            <div className="text-ink-4 text-[11px] font-bold uppercase tracking-[0.06em] mb-1">
              Observações
            </div>
            <p className="text-ink-2 whitespace-pre-wrap text-[13px]">
              {purchase.notes}
            </p>
          </div>
        ) : null}
      </section>

      {/* Items */}
      <section className="b3-card overflow-hidden">
        <table className="b3-tbl w-full">
          <thead>
            <tr>
              <th>Produto</th>
              <th style={{ textAlign: "right" }}>Qtd</th>
              <th style={{ textAlign: "right" }}>Custo unit.</th>
              <th style={{ textAlign: "right" }}>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id}>
                <td>
                  <div className="text-ink-1 text-[13px] font-medium">
                    {it.productNameSnapshot}
                  </div>
                  {it.variantNameSnapshot ? (
                    <div className="text-ink-4 text-[11.5px]">
                      {it.variantNameSnapshot}
                    </div>
                  ) : null}
                </td>
                <td className="mono" style={{ textAlign: "right" }}>
                  {it.quantity}
                </td>
                <td className="mono" style={{ textAlign: "right" }}>
                  {formatBRL(it.unitCostInCents)}
                </td>
                <td
                  className="mono"
                  style={{ textAlign: "right", fontWeight: 600 }}
                >
                  {formatBRL(it.totalCostInCents)}
                </td>
              </tr>
            ))}
            <tr style={{ borderTop: "1.5px solid var(--line)" }}>
              <td
                colSpan={3}
                style={{ textAlign: "right", fontWeight: 600 }}
              >
                Total
              </td>
              <td
                className="mono"
                style={{
                  textAlign: "right",
                  fontWeight: 700,
                  fontSize: "14px",
                }}
              >
                {formatBRL(purchase.totalInCents)}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <p className="text-ink-4 text-[11px] leading-relaxed">
        Compras são append-only — não podem ser editadas após o registro.
        Para corrigir, lance uma compra reversa.
      </p>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar compra como paga</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-ink-2 block text-[12.5px] font-medium">
              Forma de pagamento
            </label>
            <select
              value={payMethod}
              onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
              className="b3-input w-full"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <p className="text-ink-4 text-[11px]">
              Se houver caixa aberto, será gerada uma saída automática
              (pay_supplier) no fechamento Z.
            </p>
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setDialogOpen(false)}
              className="b3-btn"
              disabled={isPending}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleMarkPaid}
              className="b3-btn b3-btn--cta"
              disabled={isPending}
            >
              {isPending ? "Salvando…" : "Marcar como pago"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface StatProps {
  label: string;
  value: string;
  bold?: boolean;
  tone?: "ok" | "warn";
}

function Stat({ label, value, bold, tone }: StatProps) {
  const toneClass =
    tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : "text-ink-1";
  return (
    <div>
      <div className="text-ink-4 text-[11px] font-bold uppercase tracking-[0.06em]">
        {label}
      </div>
      <div
        className={`mt-1 text-[15px] ${bold ? "font-bold" : "font-medium"} ${toneClass}`}
      >
        {value}
      </div>
    </div>
  );
}
