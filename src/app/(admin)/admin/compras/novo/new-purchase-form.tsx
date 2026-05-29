"use client";

import { Loader2Icon, SaveIcon, ScanBarcodeIcon, XIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
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
  // Bloco H UX (2026-05-29) — custo atual do produto pra mostrar "anterior
  // R$X → R$Y (+Z%)" debaixo do input. NULL quando produto sem custo
  // cadastrado.
  lastCostInCents: number | null;
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
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [supplierId, setSupplierId] = useState<string>("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<PurchaseLineUI[]>([]);
  const [paidNow, setPaidNow] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix");

  // Bloco H UX (2026-05-29) — agregados da NF.
  const [freightInputBRL, setFreightInputBRL] = useState("");
  const [discountInputBRL, setDiscountInputBRL] = useState("");
  const [taxesInputBRL, setTaxesInputBRL] = useState("");
  // Parcelado: 1 = à vista. > 1 = N parcelas com firstDueDate + intervalo.
  const [installmentsCount, setInstallmentsCount] = useState(1);
  // Default firstDueDate = hoje + 30 dias (formatado YYYY-MM-DD).
  const [firstDueDateInput, setFirstDueDateInput] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [installmentIntervalDays, setInstallmentIntervalDays] = useState(30);

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

  // Bloco G UX (2026-05-29) — quando lojista vem da tela de estoque pelo
  // link "Comprar mais" (ShoppingCartIcon na linha do snapshot), URL traz
  // `?productId=X`. Pré-popula o form adicionando linha automaticamente,
  // limpando o param da URL pra não duplicar em refresh. Executa 1 vez.
  const prepopulatedRef = useRef(false);
  useEffect(() => {
    if (prepopulatedRef.current) return;
    const productId = searchParams.get("productId");
    if (!productId) return;
    prepopulatedRef.current = true;
    startSearch(async () => {
      const results = await searchProductsForPdv("", { ids: [productId] });
      const hit = results[0];
      if (!hit) {
        toast.error(
          "Produto não encontrado. Pode estar arquivado ou inativo.",
        );
      } else {
        addLine(hit, null);
        toast.success(`"${hit.name}" adicionado à compra.`);
      }
      // Limpa o param sem reload — refresh não duplica o item.
      const next = new URLSearchParams(searchParams.toString());
      next.delete("productId");
      const qs = next.toString();
      router.replace(qs ? `/admin/compras/novo?${qs}` : "/admin/compras/novo");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addLine(
    product: PdvProductHit,
    variant: PdvProductVariantHit | null,
  ) {
    // Bloco H UX (2026-05-29) — usa o costPriceInCents atual da loja como
    // sugestão visual ("anterior R$ X") pra lojista ver delta. Não pré-
    // popula o input pq custo da nota mudou na maioria dos casos.
    // Atualmente PdvProductHit não traz costPriceInCents — extensão futura
    // do hit. Por enquanto fica null e a UI esconde o badge.
    setLines((prev) => [
      ...prev,
      {
        uiId: uiId(),
        productId: product.id,
        productName: product.name,
        variantId: variant?.id ?? null,
        variantName: variant?.name ?? null,
        quantity: 1,
        unitCostInputBRL: "",
        batchNumber: "",
        expiresAtInput: "",
        lastCostInCents: null,
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

  // Bloco H UX (2026-05-29) — total = subtotal + frete + impostos − desconto.
  const subtotalInCents = lines.reduce((acc, l) => {
    const unit = parseBRLToCents(l.unitCostInputBRL) ?? 0;
    return acc + unit * l.quantity;
  }, 0);
  const freightInCents = parseBRLToCents(freightInputBRL) ?? 0;
  const taxesInCents = parseBRLToCents(taxesInputBRL) ?? 0;
  const discountInCents = parseBRLToCents(discountInputBRL) ?? 0;
  const totalInCents = Math.max(
    0,
    subtotalInCents + freightInCents + taxesInCents - discountInCents,
  );
  const discountOverflow =
    discountInCents > subtotalInCents + freightInCents + taxesInCents;

  // Bloco H UX (2026-05-29) — gera parcelas dinamicamente a partir do
  // installmentsCount + firstDueDate + intervalo. Distribui em centavos:
  // primeira parcela absorve a sobra (totalInCents - (N-1) * floor).
  const installmentsPreview: Array<{ dueDate: string; amountInCents: number }> =
    (() => {
      if (installmentsCount <= 1) return [];
      const base = new Date(firstDueDateInput);
      if (Number.isNaN(base.getTime())) return [];
      const perInstallment = Math.floor(totalInCents / installmentsCount);
      const remainder = totalInCents - perInstallment * installmentsCount;
      const out: Array<{ dueDate: string; amountInCents: number }> = [];
      for (let i = 0; i < installmentsCount; i++) {
        const d = new Date(base);
        d.setDate(d.getDate() + i * installmentIntervalDays);
        out.push({
          dueDate: d.toISOString().slice(0, 10),
          amountInCents: i === 0 ? perInstallment + remainder : perInstallment,
        });
      }
      return out;
    })();

  const canSubmit =
    !isPending &&
    lines.length > 0 &&
    !discountOverflow &&
    totalInCents > 0 &&
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
        // Bloco H UX (2026-05-29) — agregados da NF + parcelado.
        freightInCents,
        discountInCents,
        taxesInCents,
        installments: installmentsPreview,
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
              placeholder="Ex: chegou com divergência de quantidade, etc"
              disabled={isPending}
            />
          </div>

          {/* Bloco H UX (2026-05-29) — agregados da NF. Antes lojista
              era forçado a embutir frete no custo unitário; agora os 3
              campos do header carregam tudo separado. */}
          <div className="border-t border-line/60 pt-3">
            <div className="text-ink-4 text-[11px] font-bold uppercase tracking-[0.06em] mb-2">
              Frete, desconto e impostos (da NF)
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <label className="text-ink-2 block text-[12.5px] font-medium">
                  Frete
                </label>
                <div className="flex items-center gap-1">
                  <span className="text-ink-4 text-[11px]">R$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={freightInputBRL}
                    onChange={(e) => setFreightInputBRL(e.target.value)}
                    placeholder="0,00"
                    className="b3-input mono w-full"
                    disabled={isPending}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-ink-2 block text-[12.5px] font-medium">
                  Desconto
                </label>
                <div className="flex items-center gap-1">
                  <span className="text-ink-4 text-[11px]">R$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={discountInputBRL}
                    onChange={(e) => setDiscountInputBRL(e.target.value)}
                    placeholder="0,00"
                    className="b3-input mono w-full"
                    disabled={isPending}
                  />
                </div>
                {discountOverflow ? (
                  <p className="text-destructive text-[11px]">
                    Desconto maior que subtotal + frete + impostos.
                  </p>
                ) : null}
              </div>
              <div className="space-y-1">
                <label className="text-ink-2 block text-[12.5px] font-medium">
                  Impostos
                </label>
                <div className="flex items-center gap-1">
                  <span className="text-ink-4 text-[11px]">R$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={taxesInputBRL}
                    onChange={(e) => setTaxesInputBRL(e.target.value)}
                    placeholder="0,00"
                    className="b3-input mono w-full"
                    disabled={isPending}
                  />
                </div>
              </div>
            </div>
            <p className="text-ink-4 mt-2 text-[10.5px] leading-snug">
              Frete e impostos somam ao total. Desconto subtrai. Custo
              unitário dos itens fica &ldquo;limpo&rdquo; — sem precisar
              ratear no Excel.
            </p>
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

      {/* Coluna direita: resumo + pagamento + submit */}
      <aside className="b3-card flex h-fit flex-col gap-4 p-[18px] lg:sticky lg:top-4">
        <div className="text-ink-4 text-[11px] font-bold uppercase tracking-[0.06em]">
          Resumo
        </div>

        {/* Bloco H UX (2026-05-29) — breakdown honesto. Antes era só
            "Total" sem mostrar como chegou nele. */}
        <div className="space-y-1 text-[12.5px]">
          <div className="text-ink-3 flex justify-between">
            <span>Subtotal dos itens</span>
            <span className="mono tabular-nums">
              {formatBRL(subtotalInCents)}
            </span>
          </div>
          {freightInCents > 0 ? (
            <div className="text-ink-3 flex justify-between">
              <span>+ Frete</span>
              <span className="mono tabular-nums">
                {formatBRL(freightInCents)}
              </span>
            </div>
          ) : null}
          {taxesInCents > 0 ? (
            <div className="text-ink-3 flex justify-between">
              <span>+ Impostos</span>
              <span className="mono tabular-nums">
                {formatBRL(taxesInCents)}
              </span>
            </div>
          ) : null}
          {discountInCents > 0 ? (
            <div className="text-ink-3 flex justify-between">
              <span>− Desconto</span>
              <span className="mono tabular-nums">
                {formatBRL(discountInCents)}
              </span>
            </div>
          ) : null}
        </div>

        <div className="border-line flex items-baseline justify-between border-t pt-3">
          <span className="text-ink-3 text-[14px] font-semibold">Total</span>
          <span className="mono text-ink-1 text-[24px] font-bold tabular-nums">
            {formatBRL(totalInCents)}
          </span>
        </div>

        <div className="text-ink-4 text-[12px]">
          {lines.length} {lines.length === 1 ? "item" : "itens"}
        </div>

        {/* Bloco H UX (2026-05-29) — parcelado: dropdown 1/2/3/6/12×,
            data inicial, intervalo em dias. Lojista com cartão parcelado
            tem N contas a pagar reais com vencimento separado. Quando
            parcelas = 1, comportamento legacy (à vista ou a pagar
            sem data). */}
        <div className="border-line border-t pt-3 space-y-2">
          <label className="text-ink-2 block text-[12.5px] font-medium">
            Parcelamento
          </label>
          <select
            className="b3-input w-full"
            value={installmentsCount}
            onChange={(e) => setInstallmentsCount(Number(e.target.value))}
            disabled={isPending}
          >
            <option value={1}>À vista (1×)</option>
            <option value={2}>2 parcelas</option>
            <option value={3}>3 parcelas</option>
            <option value={4}>4 parcelas</option>
            <option value={6}>6 parcelas</option>
            <option value={12}>12 parcelas</option>
          </select>
          {installmentsCount > 1 ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-ink-3 block text-[11px]">
                    1ª parcela vence
                  </label>
                  <input
                    type="date"
                    value={firstDueDateInput}
                    onChange={(e) => setFirstDueDateInput(e.target.value)}
                    className="b3-input mono w-full text-[12px]"
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-ink-3 block text-[11px]">
                    Intervalo (dias)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={installmentIntervalDays}
                    onChange={(e) =>
                      setInstallmentIntervalDays(
                        Math.max(1, Math.min(120, Number(e.target.value) || 30)),
                      )
                    }
                    className="b3-input mono w-full text-[12px]"
                    disabled={isPending}
                  />
                </div>
              </div>
              {installmentsPreview.length > 0 ? (
                <div className="bg-bg-app rounded-md p-2 text-[11px]">
                  <p className="text-ink-4 mb-1">Resumo das parcelas:</p>
                  <ul className="text-ink-2 space-y-0.5">
                    {installmentsPreview.map((p, i) => (
                      <li
                        key={p.dueDate + i}
                        className="flex justify-between tabular-nums"
                      >
                        <span>
                          {i + 1}/{installmentsCount} ·{" "}
                          {new Date(p.dueDate).toLocaleDateString("pt-BR", {
                            timeZone: "UTC",
                          })}
                        </span>
                        <span className="mono font-medium">
                          {formatBRL(p.amountInCents)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : null}
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
            <span>
              {installmentsCount > 1
                ? "Já paguei integralmente"
                : "Pagar agora"}
            </span>
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
