"use client";

/**
 * Sprint 4D — dialog "Lançar fiado avulso".
 *
 * Lojista lança receivable SEM venda associada. Casos típicos:
 * empréstimo em dinheiro, adiantamento, débito histórico de caderneta
 * que não passou por venda Mangos Pay.
 *
 * Form:
 *   - Cliente (combobox com searchCustomers — exige cadastro prévio)
 *   - Valor (BRL)
 *   - Vencimento (date input opcional)
 *   - Observação livre (até 500 chars)
 *
 * Submit chama createStandaloneReceivable; sucesso fecha + router refresh.
 */

import {
  CheckCircle2Icon,
  HandCoinsIcon,
  Loader2Icon,
  SearchIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  type CustomerSearchHit,
  searchCustomers,
} from "@/actions/customer/search";
import { createStandaloneReceivable } from "@/actions/receivable/create-standalone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function parseBRLToCents(input: string): number | null {
  const t = input.trim();
  if (!t) return null;
  const sanitized = t.replace(/\./g, "").replace(",", ".");
  const n = Number(sanitized);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

interface StandaloneReceivableDialogProps {
  /** Chamado quando dialog fecha; `didCreate=true` se houve criação. */
  onClose: (didCreate: boolean) => void;
}

export function StandaloneReceivableDialog({
  onClose,
}: StandaloneReceivableDialogProps) {
  const [customer, setCustomer] = useState<CustomerSearchHit | null>(null);
  const [search, setSearch] = useState("");
  const [hits, setHits] = useState<CustomerSearchHit[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [amountInput, setAmountInput] = useState("");
  const [dueDateInput, setDueDateInput] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [didCreate, setDidCreate] = useState(false);

  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Debounce 200ms na busca.
  useEffect(() => {
    if (customer) return; // cliente já escolhido, não rebusca
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(async () => {
      const results = await searchCustomers(search);
      setHits(results);
    }, 200);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [search, customer]);

  const amountInCents = parseBRLToCents(amountInput);
  const amountInvalid = amountInput.trim() !== "" && amountInCents === null;

  const canSubmit =
    customer !== null && amountInCents !== null && amountInCents > 0;

  const handleSubmit = async () => {
    if (!customer || amountInCents === null || amountInCents <= 0) {
      toast.error("Selecione um cliente e informe o valor.");
      return;
    }
    setSubmitting(true);
    try {
      const r = await createStandaloneReceivable({
        customerId: customer.id,
        amountInCents,
        dueDate: dueDateInput.trim() || null,
        notes: notes.trim() || null,
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setDidCreate(true);
      toast.success("Fiado lançado.");
      onClose(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sr-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose(didCreate);
      }}
    >
      <div className="bg-surface border-line w-full max-w-lg overflow-hidden rounded-xl border shadow-xl">
        <div className="border-line flex items-start justify-between gap-4 border-b px-5 py-4">
          <div>
            <h3
              id="sr-dialog-title"
              className="text-ink-1 flex items-center gap-2 text-base font-semibold"
            >
              <HandCoinsIcon size={16} className="text-brand" />
              Lançar fiado avulso
            </h3>
            <p className="text-ink-4 mt-0.5 text-xs">
              Empréstimo, adiantamento ou débito histórico sem venda Mangos Pay.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onClose(didCreate)}
            disabled={submitting}
            className="text-ink-4 hover:text-ink-1 disabled:opacity-40"
            aria-label="Fechar"
          >
            <XIcon size={18} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {/* Cliente */}
          <div className="space-y-1">
            <label className="text-ink-2 text-xs font-medium">
              Cliente
            </label>
            {customer ? (
              <div className="border-line flex items-center justify-between rounded-md border bg-bg-app px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="text-ink-1 truncate text-sm font-medium">
                    {customer.name}
                  </div>
                  <div className="text-ink-4 text-[11px] tabular-nums">
                    {customer.phone}
                    {customer.document ? ` · ${customer.document}` : ""}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCustomer(null);
                    setSearch("");
                    setHits([]);
                    setSearchOpen(true);
                  }}
                  className="text-ink-4 hover:text-ink-1 text-xs underline-offset-2 hover:underline"
                >
                  Trocar
                </button>
              </div>
            ) : (
              <div className="relative">
                <SearchIcon
                  size={14}
                  className="text-ink-4 absolute top-1/2 left-3 -translate-y-1/2"
                  aria-hidden
                />
                <Input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  placeholder="Busque por nome, telefone ou documento…"
                  className="h-9 pl-9 text-sm"
                  autoFocus
                />
                {searchOpen && hits.length > 0 ? (
                  <div className="border-line absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-surface shadow-lg">
                    {hits.map((h) => (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => {
                          setCustomer(h);
                          setSearchOpen(false);
                        }}
                        className="hover:bg-bg-app block w-full px-3 py-2 text-left text-sm"
                      >
                        <div className="text-ink-1 font-medium">{h.name}</div>
                        <div className="text-ink-4 text-[11px]">
                          {h.phone}
                          {h.document ? ` · ${h.document}` : ""}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : null}
                {searchOpen && search.length > 0 && hits.length === 0 ? (
                  <div className="text-ink-4 mt-1 text-[11px]">
                    Nenhum cliente encontrado.{" "}
                    <Link
                      href="/admin/clientes"
                      className="text-brand underline-offset-2 hover:underline"
                      prefetch
                    >
                      Cadastrar
                    </Link>
                  </div>
                ) : null}
              </div>
            )}
            {!customer && search.trim() === "" ? (
              <p className="text-ink-4 flex items-center gap-1 text-[11px]">
                <TriangleAlertIcon size={11} />
                Fiado exige cliente cadastrado — não dá pra cobrar anônimo.
              </p>
            ) : null}
          </div>

          {/* Valor */}
          <div className="space-y-1">
            <label htmlFor="sr-amount" className="text-ink-2 text-xs font-medium">
              Valor
            </label>
            <div className="relative">
              <span className="text-ink-4 absolute top-1/2 left-3 -translate-y-1/2 text-sm">
                R$
              </span>
              <Input
                id="sr-amount"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                inputMode="decimal"
                placeholder="0,00"
                className={`h-9 pl-9 tabular-nums ${
                  amountInvalid
                    ? "border-state-error focus-visible:ring-state-error"
                    : ""
                }`}
                aria-invalid={amountInvalid}
              />
            </div>
            {amountInvalid ? (
              <p className="text-state-error text-[11px]">
                Valor inválido. Use formato 100,00.
              </p>
            ) : null}
          </div>

          {/* Vencimento */}
          <div className="space-y-1">
            <label htmlFor="sr-due" className="text-ink-2 text-xs font-medium">
              Vencimento (opcional)
            </label>
            <Input
              id="sr-due"
              type="date"
              value={dueDateInput}
              onChange={(e) => setDueDateInput(e.target.value)}
              className="h-9 text-sm"
            />
            <p className="text-ink-4 text-[11px]">
              Em branco = sem data marcada. Default em vendas fiadas: 30 dias.
            </p>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label htmlFor="sr-notes" className="text-ink-2 text-xs font-medium">
              Observação (opcional)
            </label>
            <Input
              id="sr-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder='Ex: "empréstimo em dinheiro", "saldo caderneta antiga"'
              maxLength={500}
            />
          </div>
        </div>

        <div className="border-line bg-bg-app border-t px-5 py-3">
          <div className="text-ink-4 mb-3 flex items-start gap-2 text-[11px]">
            <CheckCircle2Icon size={12} className="mt-0.5 shrink-0" />
            <span>
              Vai entrar em <code className="text-ink-2">/admin/financeiro</code>{" "}
              ao lado das vendas fiadas. Pagamento pode ser parcial pelo dialog
              de recebimento.
            </span>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onClose(didCreate)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSubmit}
              disabled={submitting || !canSubmit}
            >
              {submitting ? (
                <>
                  <Loader2Icon className="mr-1.5 size-4 animate-spin" />
                  Lançando…
                </>
              ) : (
                <>Lançar fiado</>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
