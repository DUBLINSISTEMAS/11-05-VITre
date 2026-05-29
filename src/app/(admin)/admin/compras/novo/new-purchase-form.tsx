"use client";

import { Loader2Icon, SaveIcon, ScanBarcodeIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import type { PaymentMethod } from "@/actions/order/balcao/schema";
import {
  type PdvProductHit,
  type PdvProductVariantHit,
  searchProductsForPdv,
} from "@/actions/product/search-for-pdv";
import { createPurchase } from "@/actions/purchase";
import { formatBRL } from "@/lib/pricing";
import { cn } from "@/lib/utils";

interface SupplierOption {
  id: string;
  name: string;
}

interface PurchaseLineUI {
  uiId: string;
  productId: string;
  productName: string;
  variantId: string | null;
  variantName: string | null;
  quantity: number;
  unitCostInputBRL: string; // "12,50" no input
  // Bloco C UX (2026-05-28) — perfumaria/cosmético precisa rastrear validade
  // pra não vender vencido. Joalheria/roupa deixa em branco.
  batchNumber: string;
  expiresAtInput: string; // "YYYY-MM-DD" do <input type=date>
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Dinheiro" },
  { value: "pix", label: "PIX" },
  { value: "debit", label: "Cartão débito" },
  { value: "credit", label: "Cartão crédito" },
  { value: "other", label: "Outro" },
];

function uiId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `line-${Math.random().toString(36).slice(2, 11)}`;
}

function parseBRLToCents(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const sanitized = trimmed.replace(/\./g, "").replace(",", ".");
  const num = Number(sanitized);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round(num * 100);
}

interface NewPurchaseFormProps {
  suppliers: SupplierOption[];
}

export function NewPurchaseForm({ suppliers }: NewPurchaseFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [supplierId, setSupplierId] = useState<string>("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<PurchaseLineUI[]>([]);
  const [paidNow, setPaidNow] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix");

  // Busca de produto
  const [searchQ, setSearchQ] = useState("");
  const [hits, setHits] = useState<PdvProductHit[]>([]);
  const [searching, startSearch] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!searchQ.trim()) {
      setHits([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      startSearch(async () => {
        const results = await searchProductsForPdv(searchQ);
        setHits(results);
      });
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQ]);

  function addLine(
    product: PdvProductHit,
    variant: PdvProductVariantHit | null,
  ) {
    setLines((prev) => [
      ...prev,
      {
        uiId: uiId(),
        productId: product.id,
        productName: product.name,
        variantId: variant?.id ?? null,
        variantName: variant?.name ?? null,
        quantity: 1,
        // Sugere o custo atual do produto, se houver
        unitCostInputBRL: "",
        batchNumber: "",
        expiresAtInput: "",
      },
    ]);
    setSearchQ("");
    setHits([]);
    // Refocar busca pra encadear adições
    setTimeout(() => searchInputRef.current?.focus(), 50);
  }

  function updateLine(uiId: string, patch: Partial<PurchaseLineUI>) {
    setLines((prev) =>
      prev.map((l) => (l.uiId === uiId ? { ...l, ...patch } : l)),
    );
  }

  function removeLine(uiId: string) {
    setLines((prev) => prev.filter((l) => l.uiId !== uiId));
  }

  // Cálculo do total live
  const totalInCents = lines.reduce((acc, l) => {
    const unit = parseBRLToCents(l.unitCostInputBRL) ?? 0;
    return acc + unit * l.quantity;
  }, 0);

  const canSubmit =
    !isPending &&
    lines.length > 0 &&
    lines.every(
      (l) =>
        l.quantity > 0 &&
        parseBRLToCents(l.unitCostInputBRL) !== null,
    );

  function handleSubmit() {
    if (!canSubmit) {
      if (lines.length === 0) {
        toast.error("Adicione pelo menos um item.");
        return;
      }
      const invalid = lines.find(
        (l) =>
          l.quantity <= 0 || parseBRLToCents(l.unitCostInputBRL) === null,
      );
      if (invalid) {
        toast.error(`Preencha quantidade e custo unitário de ${invalid.productName}.`);
        return;
      }
      return;
    }

    if (paidNow && !paymentMethod) {
      toast.error("Selecione a forma de pagamento.");
      return;
    }

    startTransition(async () => {
      const result = await createPurchase({
        supplierId: supplierId || null,
        invoiceNumber: invoiceNumber.trim() || null,
        paymentMethod: paidNow ? paymentMethod : null,
        paidNow,
        notes: notes.trim() || null,
        items: lines.map((l) => ({
          productId: l.productId,
          variantId: l.variantId,
          quantity: l.quantity,
          unitCostInCents: parseBRLToCents(l.unitCostInputBRL) ?? 0,
          batchNumber: l.batchNumber.trim() === "" ? null : l.batchNumber.trim(),
          expiresAt: l.expiresAtInput === "" ? null : l.expiresAtInput,
        })),
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `Compra registrada (${result.itemCount} ${result.itemCount === 1 ? "item" : "itens"} · ${formatBRL(result.totalInCents)})`,
      );
      router.push(`/admin/compras/${result.purchaseId}`);
      router.refresh();
    });
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    // Se há GTIN match exato em hit sem variantes, adiciona direto.
    const trimmed = searchQ.trim();
    if (!trimmed) return;
    const exactGtin = hits.find(
      (h) => h.gtin && h.gtin === trimmed && h.variants.length === 0,
    );
    if (exactGtin) {
      e.preventDefault();
      addLine(exactGtin, null);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
      {/* Coluna esquerda: cabeçalho + busca + items */}
      <div className="space-y-4">
        {/* Cabeçalho */}
        <section className="b3-card b3-card-pad space-y-3">
          <div className="text-ink-4 text-[11px] font-bold uppercase tracking-[0.06em]">
            Cabeçalho da compra
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-ink-2 block text-[12.5px] font-medium">
                Fornecedor
              </label>
              <select
                className="b3-input w-full"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                disabled={isPending}
              >
                <option value="">— Sem fornecedor —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-ink-2 block text-[12.5px] font-medium">
                Nota fiscal (opcional)
              </label>
              <input
                type="text"
                className="b3-input mono w-full"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                maxLength={60}
                placeholder="Ex: 123456"
                disabled={isPending}
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-ink-2 block text-[12.5px] font-medium">
              Observações (opcional)
            </label>
            <textarea
              className="b3-input w-full"
              rows={2}
              maxLength={500}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: chegou com frete, divergência de quantidade, etc"
              disabled={isPending}
            />
          </div>
        </section>

        {/* Busca de produto */}
        <section className="b3-card b3-card-pad space-y-3">
          <div className="text-ink-4 text-[11px] font-bold uppercase tracking-[0.06em]">
            Adicionar items
          </div>
          <div className="relative">
            <ScanBarcodeIcon
              size={16}
              className="text-ink-4 pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
            />
            <input
              ref={searchInputRef}
              type="search"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Bipe ou digite código / nome do produto"
              className="b3-input mono w-full pl-9"
              disabled={isPending}
            />
          </div>
          {searching ? (
            <p className="text-ink-4 text-[12px]">Buscando…</p>
          ) : null}
          {hits.length > 0 ? (
            <ul className="border-line max-h-64 divide-y overflow-y-auto rounded-[8px] border">
              {hits.map((p) => (
                <li key={p.id}>
                  {p.variants.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => addLine(p, null)}
                      className="hover:bg-bg-app text-ink-1 flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[13px]"
                    >
                      <span>{p.name}</span>
                      <span className="text-ink-4 text-[11px]">
                        {p.gtin ? `GTIN ${p.gtin}` : "sem GTIN"}
                      </span>
                    </button>
                  ) : (
                    <div className="px-3 py-2">
                      <div className="text-ink-1 mb-1 text-[13px] font-medium">
                        {p.name}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {p.variants.map((v) => (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => addLine(p, v)}
                            className="b3-btn b3-btn--sm"
                          >
                            + {v.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : null}

          {/* Lista de items */}
          {lines.length > 0 ? (
            <div className="border-line overflow-x-auto rounded-[8px] border">
              <table className="b3-tbl w-full">
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th style={{ width: 90, textAlign: "right" }}>Qtd</th>
                    <th style={{ width: 130 }}>Custo unit.</th>
                    <th style={{ width: 130 }}>
                      Lote{" "}
                      <span className="text-ink-4 font-normal text-[10.5px]">
                        (opc.)
                      </span>
                    </th>
                    <th style={{ width: 140 }}>
                      Validade{" "}
                      <span className="text-ink-4 font-normal text-[10.5px]">
                        (opc.)
                      </span>
                    </th>
                    <th style={{ width: 110, textAlign: "right" }}>Subtotal</th>
                    <th style={{ width: 40 }} />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => {
                    const unitCents = parseBRLToCents(l.unitCostInputBRL) ?? 0;
                    const subtotal = unitCents * l.quantity;
                    return (
                      <tr key={l.uiId}>
                        <td>
                          <div className="text-ink-1 text-[13px] font-medium">
                            {l.productName}
                          </div>
                          {l.variantName ? (
                            <div className="text-ink-4 text-[11px]">
                              {l.variantName}
                            </div>
                          ) : null}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <input
                            type="number"
                            min={1}
                            step={1}
                            value={l.quantity}
                            onChange={(e) => {
                              const n = parseInt(e.target.value, 10);
                              updateLine(l.uiId, {
                                quantity: Number.isFinite(n) && n > 0 ? n : 1,
                              });
                            }}
                            className="b3-input mono w-full text-right"
                          />
                        </td>
                        <td>
                          <div className="flex items-center gap-1">
                            <span className="text-ink-4 text-[11px]">R$</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={l.unitCostInputBRL}
                              onChange={(e) =>
                                updateLine(l.uiId, {
                                  unitCostInputBRL: e.target.value,
                                })
                              }
                              placeholder="0,00"
                              className="b3-input mono w-full"
                            />
                          </div>
                        </td>
                        <td>
                          <input
                            type="text"
                            value={l.batchNumber}
                            onChange={(e) =>
                              updateLine(l.uiId, {
                                batchNumber: e.target.value,
                              })
                            }
                            placeholder="Nº lote"
                            maxLength={60}
                            className="b3-input mono w-full"
                          />
                        </td>
                        <td>
                          <input
                            type="date"
                            value={l.expiresAtInput}
                            onChange={(e) =>
                              updateLine(l.uiId, {
                                expiresAtInput: e.target.value,
                              })
                            }
                            className="b3-input mono w-full"
                          />
                        </td>
                        <td
                          className="mono"
                          style={{
                            textAlign: "right",
                            fontWeight: 600,
                          }}
                        >
                          {formatBRL(subtotal)}
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => removeLine(l.uiId)}
                            aria-label="Remover linha"
                            className="text-ink-4 hover:text-danger flex size-7 items-center justify-center rounded-md"
                          >
                            <XIcon size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-ink-4 text-[12px]">
              Use a busca acima pra adicionar produtos.
            </p>
          )}
        </section>
      </div>

      {/* Coluna direita: total + pagamento + submit */}
      <aside className="b3-card flex h-fit flex-col gap-4 p-[18px] lg:sticky lg:top-4">
        <div className="text-ink-4 text-[11px] font-bold uppercase tracking-[0.06em]">
          Resumo
        </div>

        <div className="flex items-baseline justify-between">
          <span className="text-ink-3 text-[14px]">Total</span>
          <span className="mono text-ink-1 text-[24px] font-bold tabular-nums">
            {formatBRL(totalInCents)}
          </span>
        </div>

        <div className="text-ink-4 text-[12px]">
          {lines.length} {lines.length === 1 ? "item" : "items"}
        </div>

        <div className="border-line border-t pt-3 space-y-2">
          <label className="flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              checked={paidNow}
              onChange={(e) => setPaidNow(e.target.checked)}
              className="b3-checkbox-box"
              disabled={isPending}
            />
            <span>Pagar agora</span>
          </label>
          <p className="text-ink-4 text-[11px]">
            Marca como pago no momento da criação. Se houver caixa aberto,
            gera entrada de pay_supplier no fechamento Z.
          </p>
          {paidNow ? (
            <select
              className="b3-input w-full"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              disabled={isPending}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          ) : null}
        </div>

        <button
          type="button"
          disabled={!canSubmit}
          onClick={handleSubmit}
          className={cn(
            "b3-btn b3-btn--cta w-full gap-2",
            !canSubmit && "cursor-not-allowed opacity-50",
          )}
          style={{ height: 44 }}
        >
          {isPending ? (
            <>
              <Loader2Icon className="animate-spin" size={14} /> Registrando…
            </>
          ) : (
            <>
              <SaveIcon size={14} /> Registrar compra
            </>
          )}
        </button>

        <p className="text-ink-4 text-[10.5px] leading-relaxed">
          Esta operação é definitiva. O custo médio do produto é
          recalculado e o estoque é incrementado. Para corrigir, registre
          uma compra reversa.
        </p>
      </aside>
    </div>
  );
}
