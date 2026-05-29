"use client";

/**
 * Sprint 4B — dialog "Receber pagamento" de fiado.
 *
 * Funciona como hub: form de novo pagamento no topo + histórico de
 * payments embaixo. Lojista vê tudo num só lugar (anti-clique-cego).
 *
 * Fluxo:
 *   1. Componente recebe `receivableId` e busca detalhe via
 *      loadReceivableDetail (lazy: só quando abre)
 *   2. Mostra saldo + form (valor já vem preenchido com saldo total
 *      pra atalho "quitar tudo"; preset "metade" também disponível)
 *   3. Submit chama recordReceivablePayment; sucesso = recarrega detalhe
 *      ou fecha + invoca onClose pra parent re-fetch
 */

import {
  CheckCircle2Icon,
  ClockIcon,
  Loader2Icon,
  ReceiptIcon,
  RotateCcwIcon,
  TriangleAlertIcon,
  Undo2Icon,
  XIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  loadReceivableDetail,
  type ReceivableDetail,
} from "@/actions/receivable/load-detail";
import { recordReceivablePayment } from "@/actions/receivable/record-payment";
import { reverseReceivablePayment } from "@/actions/receivable/reverse-payment";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { logger } from "@/lib/logger";
import { formatBRL } from "@/lib/pricing";

const PAYMENT_METHODS: {
  value: "cash" | "pix" | "debit" | "credit" | "other";
  label: string;
}[] = [
  { value: "cash", label: "Dinheiro" },
  { value: "pix", label: "PIX" },
  { value: "debit", label: "Cartão débito" },
  { value: "credit", label: "Cartão crédito" },
  { value: "other", label: "Outro" },
];

const METHOD_LABEL: Record<string, string> = {
  cash: "Dinheiro",
  pix: "PIX",
  debit: "Débito",
  credit: "Crédito",
  other: "Outro",
};

function parseBRLToCents(input: string): number | null {
  const t = input.trim();
  if (!t) return null;
  const sanitized = t.replace(/\./g, "").replace(",", ".");
  const n = Number(sanitized);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function centsToBRLInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

interface ReceivablePaymentDialogProps {
  receivableId: string;
  /** Saldo inicial pra preencher o input (vem do load-pending). */
  initialRemainingInCents: number;
  customerName: string;
  /** Chamado quando dialog fecha — parent pode re-fetch. */
  onClose: (didChange: boolean) => void;
  /**
   * Bloco C UX (2026-05-28) — quando fiado está vencido, expor multa e
   * juros calculados (do load-pending) pra que o lojista NÃO esqueça de
   * cobrar. Aviso visual; o servidor hoje aceita só principal (cobra de
   * multa/juros vai por fora — PIX adicional, ajuste manual). Implementação
   * completa exige snapshot em `receivable_payment.late_fee_applied` +
   * `interest_applied` (colunas já existem em SQL 82) — ficou marcada
   * como dívida pra próxima onda.
   */
  lateFeeInCents?: number;
  interestInCents?: number;
  totalDueInCents?: number;
  daysLate?: number;
}

export function ReceivablePaymentDialog({
  receivableId,
  initialRemainingInCents,
  customerName,
  onClose,
  lateFeeInCents = 0,
  interestInCents = 0,
  totalDueInCents,
  daysLate = 0,
}: ReceivablePaymentDialogProps) {
  const hasOverdueFees =
    (lateFeeInCents ?? 0) + (interestInCents ?? 0) > 0;
  const [detail, setDetail] = useState<ReceivableDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [amountInput, setAmountInput] = useState(
    centsToBRLInput(initialRemainingInCents),
  );
  const [method, setMethod] = useState<
    "cash" | "pix" | "debit" | "credit" | "other"
  >("cash");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [didChange, setDidChange] = useState(false);
  /** Pre-Sprint-6 B: id da linha sendo estornada (pra mostrar loading). */
  const [reversingId, setReversingId] = useState<string | null>(null);
  /**
   * S4.3 (2026-05-26) — substituiu window.prompt (CLAUDE.md proíbe).
   * Mantém pagamento alvo + razão controlada num AlertDialog.
   */
  const [reverseTarget, setReverseTarget] = useState<{
    paymentId: string;
    paymentAmount: number;
  } | null>(null);
  const [reverseReason, setReverseReason] = useState("");
  const [reverseReasonError, setReverseReasonError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const d = await loadReceivableDetail(receivableId);
      setDetail(d);
      if (d) setAmountInput(centsToBRLInput(d.remainingInCents));
    } catch (err) {
      logger.error("admin.receivable.detail_load_failed", {
        err,
        receivableId,
      });
      setDetail(null);
      toast.error("Não foi possível carregar o fiado.", {
        description: "Verifique a conexão e tente novamente.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receivableId]);

  const remainingInCents = detail?.remainingInCents ?? initialRemainingInCents;
  const amountInCents = useMemo(
    () => parseBRLToCents(amountInput),
    [amountInput],
  );

  const inputInvalid =
    amountInput.trim() !== "" &&
    (amountInCents === null || amountInCents <= 0);
  const overSaldo =
    amountInCents !== null && amountInCents > remainingInCents;

  const handleSubmit = async () => {
    if (amountInCents === null || amountInCents <= 0) {
      toast.error("Digite um valor válido.");
      return;
    }
    if (amountInCents > remainingInCents) {
      toast.error("Valor maior que o saldo restante.");
      return;
    }
    setSubmitting(true);
    try {
      const r = await recordReceivablePayment({
        receivableId,
        amountInCents,
        method,
        notes: notes.trim() || null,
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setDidChange(true);
      toast.success(
        r.fullyPaid
          ? r.cashAdjustmentId
            ? "Fiado quitado. Entrada registrada no caixa."
            : "Fiado quitado."
          : r.cashAdjustmentId
          ? "Pagamento registrado. Entrada no caixa aberto."
          : "Pagamento registrado.",
      );
      setNotes("");
      if (r.fullyPaid) {
        // Quitação total — fecha auto pra parent re-fetch.
        onClose(true);
      } else {
        // Parcial — recarrega detalhe pra mostrar saldo novo + payment
        // adicionado no histórico.
        await refresh();
      }
    } catch (err) {
      logger.error("admin.receivable.payment_submit_failed", {
        err,
        receivableId,
      });
      toast.error("Não foi possível registrar o pagamento.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReverse = (paymentId: string, paymentAmount: number) => {
    setReverseReason("");
    setReverseReasonError(null);
    setReverseTarget({ paymentId, paymentAmount });
  };

  const confirmReverse = async () => {
    if (!reverseTarget) return;
    const reason = reverseReason.trim();
    if (reason.length < 3) {
      setReverseReasonError("Motivo precisa ter pelo menos 3 caracteres.");
      return;
    }
    const { paymentId } = reverseTarget;
    setReverseTarget(null);
    setReversingId(paymentId);
    try {
      const r = await reverseReceivablePayment({
        paymentId,
        reason: reason.trim(),
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setDidChange(true);
      toast.success(
        r.reopenedReceivable
          ? "Estorno registrado. Fiado voltou a pendente."
          : "Estorno registrado.",
      );
      await refresh();
    } catch (err) {
      logger.error("admin.receivable.payment_reverse_failed", {
        err,
        paymentId,
      });
      toast.error("Não foi possível registrar o estorno.");
    } finally {
      setReversingId(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rp-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting && !reversingId)
          onClose(didChange);
      }}
    >
      <div className="bg-surface border-line w-full max-w-lg overflow-hidden rounded-xl border shadow-xl">
        {/* Header */}
        <div className="border-line flex items-start justify-between gap-4 border-b px-5 py-4">
          <div>
            <h3
              id="rp-dialog-title"
              className="text-ink-1 text-base font-semibold"
            >
              Receber pagamento
            </h3>
            <p className="text-ink-4 mt-0.5 text-xs">{customerName}</p>
          </div>
          <button
            type="button"
            onClick={() => onClose(didChange)}
            disabled={submitting}
            className="text-ink-4 hover:text-ink-1 disabled:opacity-40"
            aria-label="Fechar"
          >
            <XIcon size={18} />
          </button>
        </div>

        {/* Saldo + form */}
        <div className="px-5 py-4">
          <div className="bg-bg-app mb-4 grid grid-cols-3 gap-2 rounded-md px-3 py-3 text-xs">
            <div>
              <div className="text-ink-4">Total do fiado</div>
              <div className="text-ink-1 mt-0.5 font-semibold tabular-nums">
                {detail ? formatBRL(detail.amountInCents) : "—"}
              </div>
            </div>
            <div>
              <div className="text-ink-4">Já pago</div>
              <div className="text-state-success mt-0.5 font-semibold tabular-nums">
                {detail ? formatBRL(detail.paidInCents) : "—"}
              </div>
            </div>
            <div>
              <div className="text-ink-4">Saldo restante</div>
              <div className="text-ink-1 mt-0.5 font-semibold tabular-nums">
                {detail ? formatBRL(detail.remainingInCents) : "—"}
              </div>
            </div>
          </div>

          {/* Bloco C UX (2026-05-28) — fiado vencido com multa+juros do
              SQL 78. Aviso visual pra lojista NÃO esquecer de cobrar.
              Sistema hoje registra só o principal — combine os extras com
              o cliente por fora (ajuste manual / PIX adicional). */}
          {hasOverdueFees && totalDueInCents !== undefined ? (
            <div className="border-state-warning/30 bg-state-warning/5 mb-4 rounded-md border px-3 py-2.5 text-xs">
              <div className="text-ink-1 flex items-baseline justify-between gap-3 font-semibold">
                <span className="flex items-center gap-1.5">
                  <TriangleAlertIcon
                    size={12}
                    className="text-state-warning"
                  />
                  Vencido há {daysLate}{" "}
                  {daysLate === 1 ? "dia" : "dias"} — Total devido
                </span>
                <span className="tabular-nums">
                  {formatBRL(totalDueInCents)}
                </span>
              </div>
              <div className="text-ink-3 mt-1 flex items-center gap-2 text-[11px]">
                <span>
                  Principal{" "}
                  <b className="text-ink-2">
                    {formatBRL(initialRemainingInCents)}
                  </b>
                </span>
                <span>·</span>
                <span>
                  Multa <b className="text-ink-2">{formatBRL(lateFeeInCents)}</b>
                </span>
                <span>·</span>
                <span>
                  Juros{" "}
                  <b className="text-ink-2">{formatBRL(interestInCents)}</b>
                </span>
              </div>
              <p className="text-ink-4 mt-1.5 text-[10.5px] leading-snug">
                O sistema registra apenas o principal abaixo. Cobre a multa
                e os juros à parte com o cliente (PIX adicional, próxima
                compra, etc.) — vai entrar como pagamento separado.
              </p>
            </div>
          ) : null}

          {detail?.paidAt ? (
            <div className="bg-state-success-wash text-state-success mb-3 flex items-center gap-2 rounded-md px-3 py-2 text-sm">
              <CheckCircle2Icon size={16} />
              <span>
                Fiado quitado em{" "}
                {detail.paidAt.toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
                {detail.paidMethod
                  ? ` · ${METHOD_LABEL[detail.paidMethod] ?? detail.paidMethod}`
                  : ""}
                .
              </span>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {/* Valor + presets */}
                <div className="space-y-1">
                  <label
                    htmlFor="rp-amount"
                    className="text-ink-2 text-xs font-medium"
                  >
                    Valor recebido
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <span className="text-ink-4 absolute top-1/2 left-3 -translate-y-1/2 text-sm">
                        R$
                      </span>
                      <Input
                        id="rp-amount"
                        value={amountInput}
                        onChange={(e) => setAmountInput(e.target.value)}
                        inputMode="decimal"
                        placeholder="0,00"
                        className={`h-9 pl-9 tabular-nums ${
                          inputInvalid || overSaldo
                            ? "border-state-error focus-visible:ring-state-error"
                            : ""
                        }`}
                        aria-invalid={inputInvalid || overSaldo}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setAmountInput(centsToBRLInput(remainingInCents))
                      }
                      className="b3-btn b3-btn--sm whitespace-nowrap"
                      title="Quitar saldo restante"
                    >
                      Quitar tudo
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setAmountInput(
                          centsToBRLInput(Math.floor(remainingInCents / 2)),
                        )
                      }
                      className="b3-btn b3-btn--sm whitespace-nowrap"
                      title="Receber metade do saldo"
                    >
                      Metade
                    </button>
                  </div>
                  {overSaldo ? (
                    <p className="text-state-error flex items-center gap-1 text-[11px]">
                      <TriangleAlertIcon size={11} />
                      Valor maior que o saldo restante.
                    </p>
                  ) : null}
                </div>

                {/* Método */}
                <div className="space-y-1">
                  <label className="text-ink-2 text-xs font-medium">
                    Forma de pagamento
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {PAYMENT_METHODS.map((m) => (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => setMethod(m.value)}
                        className={`rounded-md border px-3 py-1.5 text-xs transition ${
                          method === m.value
                            ? "bg-brand border-brand text-white"
                            : "border-line text-ink-2 hover:bg-bg-app"
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notas */}
                <div className="space-y-1">
                  <label
                    htmlFor="rp-notes"
                    className="text-ink-2 text-xs font-medium"
                  >
                    Observação (opcional)
                  </label>
                  <Input
                    id="rp-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ex: cheque #1234, vale, comprovante PIX…"
                    maxLength={500}
                  />
                </div>
              </div>

              {/* Submit */}
              <div className="mt-4 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onClose(didChange)}
                  disabled={submitting}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSubmit}
                  disabled={submitting || inputInvalid || overSaldo}
                >
                  {submitting ? (
                    <>
                      <Loader2Icon className="mr-1.5 size-4 animate-spin" />
                      Registrando…
                    </>
                  ) : (
                    <>Registrar pagamento</>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Histórico */}
        <div className="border-line border-t bg-bg-app px-5 py-3">
          <div className="text-ink-4 mb-2 flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase">
            <ReceiptIcon size={12} />
            Histórico
            {detail && detail.payments.length > 0 ? (
              <span className="text-ink-4 normal-case">
                · {detail.payments.length}{" "}
                {detail.payments.length === 1 ? "pagamento" : "pagamentos"}
              </span>
            ) : null}
          </div>
          {loading ? (
            <div className="text-ink-4 py-3 text-center text-xs">
              <Loader2Icon className="inline size-3.5 animate-spin" /> Carregando…
            </div>
          ) : detail && detail.payments.length > 0 ? (
            <ul className="divide-line divide-y text-sm">
              {detail.payments.map((p) => {
                const isReversalLine = p.reversalOfId !== null;
                const wasReversed = p.isReversed;
                const canReverse = !isReversalLine && !wasReversed;
                const isReversingThisOne = reversingId === p.id;
                return (
                  <li
                    key={p.id}
                    className={`flex items-center justify-between gap-3 py-2 ${
                      wasReversed ? "opacity-50" : ""
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-ink-1 flex items-center gap-1.5 text-xs font-medium">
                        {isReversalLine ? (
                          <span className="bg-state-error-wash text-state-error inline-flex items-center gap-0.5 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                            <Undo2Icon size={9} />
                            Estorno
                          </span>
                        ) : null}
                        {wasReversed ? (
                          <span className="text-ink-4 line-through">
                            {METHOD_LABEL[p.method] ?? p.method}
                          </span>
                        ) : (
                          <span>{METHOD_LABEL[p.method] ?? p.method}</span>
                        )}
                        {p.notes ? (
                          <span className="text-ink-4 ml-1 font-normal">
                            · {p.notes}
                          </span>
                        ) : null}
                      </div>
                      <div className="text-ink-4 mt-0.5 flex items-center gap-1 text-[11px]">
                        <ClockIcon size={10} />
                        {p.createdAt.toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}{" "}
                        {p.createdAt.toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className={`text-sm font-medium tabular-nums ${
                          p.amountInCents < 0
                            ? "text-state-error"
                            : wasReversed
                            ? "text-ink-4 line-through"
                            : "text-ink-1"
                        }`}
                      >
                        {p.amountInCents < 0 ? "−" : ""}
                        {formatBRL(Math.abs(p.amountInCents))}
                      </div>
                      {canReverse ? (
                        <button
                          type="button"
                          onClick={() => handleReverse(p.id, p.amountInCents)}
                          disabled={
                            isReversingThisOne ||
                            submitting ||
                            reversingId !== null
                          }
                          className="text-ink-4 hover:text-state-error disabled:opacity-30"
                          title="Estornar este pagamento"
                          aria-label="Estornar"
                        >
                          {isReversingThisOne ? (
                            <Loader2Icon size={12} className="animate-spin" />
                          ) : (
                            <RotateCcwIcon size={12} />
                          )}
                        </button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-ink-4 py-2 text-center text-xs">
              Sem pagamentos ainda.
            </p>
          )}
        </div>
      </div>

      {/* S4.3 (2026-05-26) — AlertDialog substitui window.prompt no estorno.
          CLAUDE.md proíbe window.prompt em fluxo financeiro. Input controlado
          + validação inline. */}
      <AlertDialog
        open={reverseTarget !== null}
        onOpenChange={(o) => !o && setReverseTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Estornar pagamento de{" "}
              {reverseTarget ? formatBRL(reverseTarget.paymentAmount) : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              O valor volta pro saldo aberto do fiado e fica registrado no
              histórico como estorno. Informe o motivo (mínimo 3 caracteres).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="reverse-reason" className="text-[12.5px]">
              Motivo
            </Label>
            <Input
              id="reverse-reason"
              value={reverseReason}
              onChange={(e) => {
                setReverseReason(e.target.value);
                if (reverseReasonError) setReverseReasonError(null);
              }}
              placeholder="Ex: cliente cancelou o cartão, lançamento duplicado…"
              maxLength={200}
              autoFocus
            />
            {reverseReasonError ? (
              <p className="text-destructive text-xs">{reverseReasonError}</p>
            ) : null}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReverse}>
              Estornar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
