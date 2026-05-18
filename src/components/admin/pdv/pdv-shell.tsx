"use client";

// PDV / venda balcão — port Dublin v3 (ADR-0019, Onda A.11).
// REWRITE estético do shell mantendo TODA a lógica funcional (cart state,
// F-keys, debounced search, advisory lock no server, troco, etc.) — só
// substitui shadcn Button/Input/Label/Textarea por primitivos `b3-*` e
// adota layout do handoff B3PDVScreen (left scroll + right fixed panel).
//
// Decisões pixel-perfect vs handoff:
// - Search 56px com badge mono "F2" absolute right (handoff é literal)
// - Grid produtos: repeat(auto-fill, minmax(160px, 1fr)) gap 10
// - Cards: padding 12 + border line + rounded 12; img placeholder 80px;
//   estoque como `b3-pill b3-pill--ok` (ou warn se baixo, danger se zero)
// - Right column: padding 18 nas seções, header "CLIENTE" 11px upper,
//   empty cart com círculo 60×60 bg-app, footer fixed com total mono 22px
// - Payment grid: 5 botões usando b3-btn (selected = b3-btn--cta)
// - Tabs categoria do handoff NÃO implementadas (sem dados de "mais
//   vendidos" ainda — placeholder vazio ou omitir)

import {
  BanknoteIcon,
  CreditCardIcon,
  MinusIcon,
  PackageIcon,
  PlusIcon,
  ReceiptIcon,
  SearchIcon,
  ShoppingBagIcon,
  Trash2Icon,
  UserIcon,
  XIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";

import {
  type CustomerSearchHit,
  searchCustomers,
} from "@/actions/customer/search";
import { createBalcaoSale } from "@/actions/order/balcao/create-balcao-sale";
import type {
  CreateBalcaoSaleInput,
  PaymentMethod,
} from "@/actions/order/balcao/schema";
import {
  type PdvProductHit,
  type PdvProductVariantHit,
  searchProductsForPdv,
} from "@/actions/product/search-for-pdv";
import { formatBRL, getEffectivePrice } from "@/lib/pricing";
import { cn } from "@/lib/utils";

interface CartItem {
  productId: string;
  variantId: string | null;
  productName: string;
  variantName: string | null;
  priceInCents: number;
  quantity: number;
  thumbUrl: string | null;
  trackStock: boolean;
  stockQuantity: number | null;
}

interface PaymentMethodOption {
  value: PaymentMethod;
  label: string;
  Icon: typeof BanknoteIcon;
}

const PAYMENT_METHODS: PaymentMethodOption[] = [
  { value: "cash", label: "Dinheiro", Icon: BanknoteIcon },
  { value: "pix", label: "PIX", Icon: ReceiptIcon },
  { value: "debit", label: "Débito", Icon: CreditCardIcon },
  { value: "credit", label: "Crédito", Icon: CreditCardIcon },
  { value: "other", label: "Outro", Icon: PackageIcon },
];

function inputToCents(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const sanitized = trimmed.replace(/\./g, "").replace(",", ".");
  const num = Number(sanitized);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round(num * 100);
}

function inputToPct(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const num = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(num) || num < 0) return null;
  return num;
}

/** Formata centavos como "12,34" pra input pt-BR. Null/zero → string vazia. */
function centsToInput(cents: number | null): string {
  if (cents === null || cents === 0) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

/** Calcula porcentagem de cents sobre base. Retorna string limpa ou vazia. */
function pctFromCents(cents: number, base: number): string {
  if (base === 0 || cents === 0) return "";
  const pct = (cents / base) * 100;
  // 2 casas decimais, remove .00 trailing
  const fixed = pct.toFixed(2);
  const cleaned = fixed.replace(/\.?0+$/, "");
  return cleaned.replace(".", ",");
}

export function PdvShell() {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(
    null,
  );
  // ADR-0020 — desconto e acréscimo duais (R$ ou %). R$ é canônico no DB; %
  // é UX. `lastEdit` evita stomp quando o subtotal muda: se usuário digitou
  // em %, manter % e recomputar R$; se digitou em R$, manter R$ e recomputar %.
  const [discountAmountInput, setDiscountAmountInput] = useState("");
  const [discountPctInput, setDiscountPctInput] = useState("");
  const [lastDiscountEdit, setLastDiscountEdit] = useState<
    "amount" | "pct" | null
  >(null);
  const [surchargeAmountInput, setSurchargeAmountInput] = useState("");
  const [surchargePctInput, setSurchargePctInput] = useState("");
  const [lastSurchargeEdit, setLastSurchargeEdit] = useState<
    "amount" | "pct" | null
  >(null);

  const [cashReceivedInput, setCashReceivedInput] = useState("");
  const [notes, setNotes] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerLabel, setCustomerLabel] = useState<string>("");
  const [isSubmitting, startSubmit] = useTransition();

  const subtotalInCents = useMemo(
    () => cart.reduce((s, it) => s + it.priceInCents * it.quantity, 0),
    [cart],
  );

  // R$ canônico — sempre lê do AmountInput (que é sincronizado tanto por
  // edição direta quanto pela edição em %).
  const discountInCents = inputToCents(discountAmountInput) ?? 0;
  const surchargeInCents = inputToCents(surchargeAmountInput) ?? 0;

  // Reconcile com subtotal: se usuário digitou em %, mantém % e recomputa R$;
  // se digitou em R$, recomputa % a partir de R$. Executa quando subtotal muda.
  useEffect(() => {
    if (lastDiscountEdit === "pct") {
      const pct = inputToPct(discountPctInput);
      const newCents =
        pct === null ? 0 : Math.round((pct / 100) * subtotalInCents);
      setDiscountAmountInput(centsToInput(newCents));
    } else if (lastDiscountEdit === "amount") {
      setDiscountPctInput(pctFromCents(discountInCents, subtotalInCents));
    }
    if (lastSurchargeEdit === "pct") {
      const pct = inputToPct(surchargePctInput);
      const newCents =
        pct === null ? 0 : Math.round((pct / 100) * subtotalInCents);
      setSurchargeAmountInput(centsToInput(newCents));
    } else if (lastSurchargeEdit === "amount") {
      setSurchargePctInput(pctFromCents(surchargeInCents, subtotalInCents));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotalInCents]);

  const totalInCents = Math.max(
    0,
    subtotalInCents - discountInCents + surchargeInCents,
  );
  const cashReceivedInCents = inputToCents(cashReceivedInput);
  const troco =
    paymentMethod === "cash" &&
    cashReceivedInCents !== null &&
    cashReceivedInCents >= totalInCents
      ? cashReceivedInCents - totalInCents
      : null;

  // Handlers de mudança bidirecional —————————————————————————————
  const onDiscountAmountChange = (v: string) => {
    setLastDiscountEdit("amount");
    setDiscountAmountInput(v);
    const cents = inputToCents(v) ?? 0;
    setDiscountPctInput(pctFromCents(cents, subtotalInCents));
  };
  const onDiscountPctChange = (v: string) => {
    setLastDiscountEdit("pct");
    setDiscountPctInput(v);
    const pct = inputToPct(v);
    const cents =
      pct === null ? 0 : Math.round((pct / 100) * subtotalInCents);
    setDiscountAmountInput(centsToInput(cents));
  };
  const onSurchargeAmountChange = (v: string) => {
    setLastSurchargeEdit("amount");
    setSurchargeAmountInput(v);
    const cents = inputToCents(v) ?? 0;
    setSurchargePctInput(pctFromCents(cents, subtotalInCents));
  };
  const onSurchargePctChange = (v: string) => {
    setLastSurchargeEdit("pct");
    setSurchargePctInput(v);
    const pct = inputToPct(v);
    const cents =
      pct === null ? 0 : Math.round((pct / 100) * subtotalInCents);
    setSurchargeAmountInput(centsToInput(cents));
  };

  const addToCart = useCallback(
    (
      product: PdvProductHit,
      variant: PdvProductVariantHit | null,
      effectivePrice: number,
    ) => {
      setCart((prev) => {
        const existing = prev.find(
          (it) =>
            it.productId === product.id &&
            it.variantId === (variant?.id ?? null),
        );
        if (existing) {
          const trackStock = variant?.trackStock ?? product.trackStock;
          const stockQuantity =
            variant?.stockQuantity ?? product.stockQuantity;
          if (
            trackStock &&
            stockQuantity !== null &&
            existing.quantity >= stockQuantity
          ) {
            toast.error(
              `Estoque insuficiente — só tem ${stockQuantity} em estoque.`,
            );
            return prev;
          }
          return prev.map((it) =>
            it === existing ? { ...it, quantity: it.quantity + 1 } : it,
          );
        }
        return [
          ...prev,
          {
            productId: product.id,
            variantId: variant?.id ?? null,
            productName: product.name,
            variantName: variant?.name ?? null,
            priceInCents: effectivePrice,
            quantity: 1,
            thumbUrl: product.thumbUrl,
            trackStock: variant?.trackStock ?? product.trackStock,
            stockQuantity: variant?.stockQuantity ?? product.stockQuantity,
          },
        ];
      });
    },
    [],
  );

  const updateQty = (idx: number, delta: number) => {
    setCart((prev) => {
      const item = prev[idx];
      if (!item) return prev;
      const next = item.quantity + delta;
      if (next <= 0) return prev.filter((_, i) => i !== idx);
      if (
        item.trackStock &&
        item.stockQuantity !== null &&
        next > item.stockQuantity
      ) {
        toast.error(`Estoque insuficiente — só tem ${item.stockQuantity}.`);
        return prev;
      }
      return prev.map((it, i) => (i === idx ? { ...it, quantity: next } : it));
    });
  };

  const removeItem = (idx: number) =>
    setCart((prev) => prev.filter((_, i) => i !== idx));

  const reset = useCallback(() => {
    setCart([]);
    setPaymentMethod(null);
    setDiscountAmountInput("");
    setDiscountPctInput("");
    setLastDiscountEdit(null);
    setSurchargeAmountInput("");
    setSurchargePctInput("");
    setLastSurchargeEdit(null);
    setCashReceivedInput("");
    setNotes("");
    setCustomerId(null);
    setCustomerLabel("");
  }, []);

  const canSubmit =
    cart.length > 0 &&
    paymentMethod !== null &&
    !isSubmitting &&
    discountInCents <= subtotalInCents &&
    (paymentMethod !== "cash" ||
      cashReceivedInCents === null ||
      cashReceivedInCents >= totalInCents);

  const handleSubmit = () => {
    if (!paymentMethod) {
      toast.error("Escolha o método de pagamento.");
      return;
    }
    if (cart.length === 0) {
      toast.error("Adicione pelo menos um item.");
      return;
    }
    if (discountInCents > subtotalInCents) {
      toast.error("Desconto maior que o subtotal.");
      return;
    }

    const payload: CreateBalcaoSaleInput = {
      items: cart.map((it) => ({
        productId: it.productId,
        variantId: it.variantId,
        quantity: it.quantity,
      })),
      customerId,
      paymentMethod,
      discountInCents: discountInCents > 0 ? discountInCents : null,
      surchargeInCents: surchargeInCents > 0 ? surchargeInCents : null,
      cashReceivedInCents:
        paymentMethod === "cash" ? cashReceivedInCents : null,
      notes: notes.trim() || null,
    };

    startSubmit(async () => {
      const result = await createBalcaoSale(payload);
      if (!result.ok) {
        toast.error(result.errorMessage ?? "Falha ao registrar venda.");
        return;
      }
      toast.success("Venda registrada!");
      if (result.publicToken) {
        router.push(`/admin/pdv/recibo/${result.publicToken}`);
      } else {
        reset();
        router.refresh();
      }
    });
  };

  // Atalhos de teclado (follow-up Fase 5 — ADR-0016)
  //   F2 = busca produto, F3 = busca cliente, F4 = finalizar, ESC = limpar
  // Refs evitam rebind do listener a cada keystroke.
  const handleSubmitRef = useRef(handleSubmit);
  const canSubmitRef = useRef(canSubmit);
  const cartLengthRef = useRef(cart.length);
  useEffect(() => {
    handleSubmitRef.current = handleSubmit;
    canSubmitRef.current = canSubmit;
    cartLengthRef.current = cart.length;
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      switch (e.key) {
        case "F2": {
          e.preventDefault();
          const el = document.getElementById(
            "pdv-product-search",
          ) as HTMLInputElement | null;
          el?.focus();
          el?.select();
          return;
        }
        case "F3": {
          e.preventDefault();
          const el = document.getElementById(
            "pdv-customer-search",
          ) as HTMLInputElement | null;
          el?.focus();
          el?.select();
          return;
        }
        case "F4": {
          e.preventDefault();
          if (canSubmitRef.current) handleSubmitRef.current();
          return;
        }
        case "Escape": {
          if (
            document.activeElement === document.body &&
            cartLengthRef.current > 0
          ) {
            e.preventDefault();
            if (window.confirm("Limpar a venda atual?")) {
              reset();
            }
          }
          return;
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [reset]);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_400px] lg:gap-6">
      {/* Coluna esquerda: busca + grid de produtos */}
      <section className="space-y-4">
        <ProductSearchPicker onAdd={addToCart} />
      </section>

      {/* Coluna direita: cliente + carrinho + pagamento + finalizar */}
      <aside className="b3-card flex flex-col overflow-hidden lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)]">
        <CustomerComboboxLight
          customerId={customerId}
          customerLabel={customerLabel}
          onPick={(c) => {
            setCustomerId(c?.id ?? null);
            setCustomerLabel(c ? `${c.name} · ${c.phone}` : "");
          }}
        />

        <CartPanel
          items={cart}
          updateQty={updateQty}
          removeItem={removeItem}
        />

        {cart.length > 0 ? (
          <div className="border-t border-line bg-bg-app">
            <PaymentSection
              paymentMethod={paymentMethod}
              setPaymentMethod={setPaymentMethod}
              cashReceivedInput={cashReceivedInput}
              setCashReceivedInput={setCashReceivedInput}
              troco={troco}
              discountAmountInput={discountAmountInput}
              discountPctInput={discountPctInput}
              onDiscountAmountChange={onDiscountAmountChange}
              onDiscountPctChange={onDiscountPctChange}
              surchargeAmountInput={surchargeAmountInput}
              surchargePctInput={surchargePctInput}
              onSurchargeAmountChange={onSurchargeAmountChange}
              onSurchargePctChange={onSurchargePctChange}
              notes={notes}
              setNotes={setNotes}
            />
          </div>
        ) : null}

        <div className="border-t border-line bg-bg-app p-[18px]">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[14px] font-bold text-ink-1">Total</span>
            <span
              className={cn(
                "mono text-[22px] font-bold tracking-[-0.02em]",
                cart.length === 0 ? "text-ink-4" : "text-ink-1",
              )}
            >
              {formatBRL(totalInCents)}
            </span>
          </div>
          {discountInCents > 0 || surchargeInCents > 0 ? (
            <div className="mb-2 space-y-1 text-xs text-ink-4">
              <div className="flex items-center justify-between">
                <span>Subtotal</span>
                <span className="mono">{formatBRL(subtotalInCents)}</span>
              </div>
              {discountInCents > 0 ? (
                <div className="flex items-center justify-between">
                  <span>Desconto</span>
                  <span className="mono text-danger">
                    −{formatBRL(discountInCents)}
                  </span>
                </div>
              ) : null}
              {surchargeInCents > 0 ? (
                <div className="flex items-center justify-between">
                  <span>Acréscimo</span>
                  <span className="mono text-warn">
                    +{formatBRL(surchargeInCents)}
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}
          <button
            id="pdv-submit"
            type="button"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className={cn(
              "b3-btn b3-btn--cta w-full",
              !canSubmit && "cursor-not-allowed opacity-50",
            )}
            style={{ height: 44 }}
          >
            {isSubmitting
              ? "Registrando…"
              : cart.length === 0
                ? "Adicione produtos pra finalizar"
                : "Finalizar venda (F4)"}
          </button>
          {cart.length > 0 ? (
            <button
              type="button"
              onClick={reset}
              className="mt-2 w-full text-[12px] text-ink-4 hover:text-ink-1"
            >
              Limpar venda
            </button>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------------
// Subcomponentes
// ---------------------------------------------------------------------

function ProductSearchPicker({
  onAdd,
}: {
  onAdd: (
    product: PdvProductHit,
    variant: PdvProductVariantHit | null,
    effectivePrice: number,
  ) => void;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<PdvProductHit[]>([]);
  const [isSearching, startSearch] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [expandedVariants, setExpandedVariants] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      startSearch(async () => {
        const results = await searchProductsForPdv(q);
        setHits(results);
      });
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q]);

  const toggleVariants = (productId: string) =>
    setExpandedVariants((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });

  return (
    <div className="space-y-4">
      {/* Search bar 56px com badge F2 mono */}
      <div className="relative">
        <SearchIcon
          aria-hidden
          size={18}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-4"
        />
        <input
          id="pdv-product-search"
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar produto · nome…"
          className="border-line bg-surface focus:border-brand focus:ring-brand/20 h-14 w-full rounded-[12px] border pl-12 pr-16 text-[15px] outline-none transition focus:ring-2"
        />
        {q ? (
          <button
            type="button"
            onClick={() => setQ("")}
            className="text-ink-4 hover:text-ink-1 absolute right-12 top-1/2 -translate-y-1/2"
            aria-label="Limpar busca"
          >
            <XIcon size={14} />
          </button>
        ) : null}
        <span className="mono bg-bg-app text-ink-4 absolute right-4 top-1/2 -translate-y-1/2 rounded px-2 py-[2px] text-[11px]">
          F2
        </span>
      </div>

      {isSearching && hits.length === 0 ? (
        <div className="grid grid-cols-2 gap-[10px] sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="bg-bg-app aspect-[0.8] animate-pulse rounded-[12px]"
            />
          ))}
        </div>
      ) : hits.length === 0 ? (
        <EmptyHits hasQuery={q.trim() !== ""} />
      ) : (
        <div className="grid grid-cols-2 gap-[10px] sm:grid-cols-3 lg:grid-cols-4">
          {hits.map((p) => {
            const effectivePrice = getEffectivePrice({
              basePriceInCents: p.basePriceInCents,
              promoPriceInCents: p.promoPriceInCents,
              promoStartsAt: p.promoStartsAt,
              promoEndsAt: p.promoEndsAt,
            });
            const expanded = expandedVariants.has(p.id);
            const hasVariants = p.variants.length > 0;
            const isOutOfStock =
              p.trackStock &&
              p.stockQuantity !== null &&
              p.stockQuantity <= 0 &&
              !hasVariants;
            const stockTone =
              !p.trackStock || p.stockQuantity === null
                ? "b3-pill"
                : p.stockQuantity <= 0
                  ? "b3-pill b3-pill--danger"
                  : p.stockQuantity <= 3
                    ? "b3-pill b3-pill--warn"
                    : "b3-pill b3-pill--ok";
            return (
              <div
                key={p.id}
                className={cn(
                  "border-line bg-surface flex flex-col gap-2 overflow-hidden rounded-[12px] border p-3 transition",
                  isOutOfStock && "opacity-50",
                )}
              >
                <button
                  type="button"
                  disabled={isOutOfStock}
                  onClick={() => {
                    if (hasVariants) toggleVariants(p.id);
                    else onAdd(p, null, effectivePrice);
                  }}
                  className="hover:bg-bg-app flex w-full flex-col gap-2 rounded text-left disabled:cursor-not-allowed"
                >
                  <div className="bg-brand-wash text-brand flex h-20 w-full items-center justify-center overflow-hidden rounded-[8px]">
                    {p.thumbUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.thumbUrl}
                        alt={p.name}
                        className="size-full object-cover"
                      />
                    ) : (
                      <PackageIcon size={22} />
                    )}
                  </div>
                  <span className="line-clamp-2 text-[12.5px] font-medium leading-tight">
                    {p.name}
                  </span>
                  <div className="flex items-center justify-between">
                    <span className="mono text-[13px] font-bold">
                      {formatBRL(effectivePrice)}
                    </span>
                    {p.trackStock && p.stockQuantity !== null ? (
                      <span
                        className={stockTone}
                        style={{ fontFamily: "var(--mono)" }}
                      >
                        {p.stockQuantity}
                      </span>
                    ) : null}
                  </div>
                  {hasVariants ? (
                    <span className="text-brand text-[11px]">
                      {expanded ? "▲ ocultar" : "▼"} {p.variants.length}{" "}
                      variantes
                    </span>
                  ) : null}
                </button>

                {hasVariants && expanded ? (
                  <div className="bg-bg-app -mx-3 -mb-3 mt-1 space-y-1 border-t border-line p-2">
                    {p.variants.map((v) => {
                      const vPrice = v.priceInCents ?? effectivePrice;
                      const vOut =
                        v.trackStock &&
                        v.stockQuantity !== null &&
                        v.stockQuantity <= 0;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          disabled={vOut}
                          onClick={() => onAdd(p, v, vPrice)}
                          className="hover:bg-surface flex w-full items-center justify-between rounded px-2 py-1 text-xs disabled:opacity-50"
                        >
                          <span className="truncate">{v.name}</span>
                          <span className="mono">{formatBRL(vPrice)}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EmptyHits({ hasQuery }: { hasQuery: boolean }) {
  return (
    <div className="border-line text-ink-4 flex flex-col items-center gap-2 rounded-[12px] border-2 border-dashed p-8 text-center">
      <PackageIcon size={32} />
      <p className="text-sm">
        {hasQuery
          ? "Nenhum produto encontrado."
          : "Cadastre produtos pra começar a vender no balcão."}
      </p>
    </div>
  );
}

function CartPanel({
  items,
  updateQty,
  removeItem,
}: {
  items: CartItem[];
  updateQty: (idx: number, delta: number) => void;
  removeItem: (idx: number) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="text-ink-4 flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
        <span className="bg-bg-app inline-flex size-[60px] items-center justify-center rounded-full">
          <ShoppingBagIcon size={26} />
        </span>
        <div>
          <div className="text-ink-2 text-sm font-semibold">
            Carrinho vazio
          </div>
          <div className="mt-1 text-xs">Busque um produto pra começar</div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex-1 overflow-y-auto">
      <header className="border-line bg-surface sticky top-0 z-10 flex items-center justify-between border-b px-[18px] py-3">
        <h3 className="text-ink-1 text-[13.5px] font-semibold tracking-tight">
          Carrinho · {items.length} {items.length === 1 ? "item" : "itens"}
        </h3>
      </header>
      <ul className="divide-line divide-y">
        {items.map((it, idx) => (
          <li key={`${it.productId}-${it.variantId ?? "p"}`} className="p-3">
            <div className="flex gap-2">
              <div className="bg-bg-app size-12 shrink-0 overflow-hidden rounded">
                {it.thumbUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={it.thumbUrl}
                    alt={it.productName}
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center">
                    <PackageIcon className="text-ink-4 size-4" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-sm font-medium">
                  {it.productName}
                </p>
                {it.variantName ? (
                  <p className="text-ink-4 text-xs">{it.variantName}</p>
                ) : null}
                <p className="mono text-xs">{formatBRL(it.priceInCents)}</p>
              </div>
              <button
                type="button"
                onClick={() => removeItem(idx)}
                className="text-ink-4 hover:text-danger"
                aria-label="Remover"
              >
                <Trash2Icon className="size-4" />
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => updateQty(idx, -1)}
                  className="b3-btn b3-btn--sm size-8 justify-center p-0"
                  aria-label="Diminuir"
                >
                  <MinusIcon className="size-3" />
                </button>
                <span className="w-8 text-center text-sm font-medium">
                  {it.quantity}
                </span>
                <button
                  type="button"
                  onClick={() => updateQty(idx, 1)}
                  className="b3-btn b3-btn--sm size-8 justify-center p-0"
                  aria-label="Aumentar"
                >
                  <PlusIcon className="size-3" />
                </button>
              </div>
              <span className="mono text-sm font-semibold">
                {formatBRL(it.priceInCents * it.quantity)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PaymentSection({
  paymentMethod,
  setPaymentMethod,
  cashReceivedInput,
  setCashReceivedInput,
  troco,
  discountAmountInput,
  discountPctInput,
  onDiscountAmountChange,
  onDiscountPctChange,
  surchargeAmountInput,
  surchargePctInput,
  onSurchargeAmountChange,
  onSurchargePctChange,
  notes,
  setNotes,
}: {
  paymentMethod: PaymentMethod | null;
  setPaymentMethod: (m: PaymentMethod) => void;
  cashReceivedInput: string;
  setCashReceivedInput: (v: string) => void;
  troco: number | null;
  discountAmountInput: string;
  discountPctInput: string;
  onDiscountAmountChange: (v: string) => void;
  onDiscountPctChange: (v: string) => void;
  surchargeAmountInput: string;
  surchargePctInput: string;
  onSurchargeAmountChange: (v: string) => void;
  onSurchargePctChange: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
}) {
  const inputCls =
    "border-line bg-surface focus:border-brand h-9 w-full rounded-[8px] border px-3 text-[13px] outline-none transition";
  return (
    <div className="space-y-3 p-[18px]">
      <div className="text-ink-4 text-[11px] font-bold uppercase tracking-[0.06em]">
        Pagamento
      </div>
      <div className="grid grid-cols-2 gap-2">
        {PAYMENT_METHODS.map((m) => {
          const selected = paymentMethod === m.value;
          return (
            <button
              key={m.value}
              type="button"
              onClick={() => setPaymentMethod(m.value)}
              className={cn(
                "b3-btn justify-start gap-2",
                selected && "b3-btn--cta",
              )}
              style={{ height: 40 }}
            >
              <m.Icon size={14} />
              {m.label}
            </button>
          );
        })}
      </div>

      {paymentMethod === "cash" ? (
        <div className="space-y-1">
          <label
            htmlFor="cash-received"
            className="text-ink-4 text-[11px] font-medium"
          >
            Valor recebido (opcional — pra calcular troco)
          </label>
          <input
            id="cash-received"
            inputMode="decimal"
            placeholder="0,00"
            value={cashReceivedInput}
            onChange={(e) => setCashReceivedInput(e.target.value)}
            className={inputCls}
          />
          {troco !== null ? (
            <p className="text-ink-4 text-xs">
              Troco:{" "}
              <span className="text-ink-1 font-semibold">
                {formatBRL(troco)}
              </span>
            </p>
          ) : null}
        </div>
      ) : null}

      {/* ADR-0020 — desconto + acréscimo 2x2 com auto-cálculo bidirecional R$/% */}
      <div className="space-y-2">
        <div className="text-ink-4 text-[11px] font-medium">
          Ajustes (opcional)
        </div>
        <div className="grid grid-cols-2 gap-2">
          {/* Desconto R$ */}
          <div className="space-y-1">
            <label
              htmlFor="discount-amount"
              className="text-ink-3 text-[10px] font-medium uppercase tracking-[0.04em]"
            >
              Desconto R$
            </label>
            <input
              id="discount-amount"
              inputMode="decimal"
              placeholder="0,00"
              value={discountAmountInput}
              onChange={(e) => onDiscountAmountChange(e.target.value)}
              className={inputCls}
            />
          </div>
          {/* Desconto % */}
          <div className="space-y-1">
            <label
              htmlFor="discount-pct"
              className="text-ink-3 text-[10px] font-medium uppercase tracking-[0.04em]"
            >
              Desconto %
            </label>
            <input
              id="discount-pct"
              inputMode="decimal"
              placeholder="0"
              value={discountPctInput}
              onChange={(e) => onDiscountPctChange(e.target.value)}
              className={inputCls}
            />
          </div>
          {/* Acréscimo R$ */}
          <div className="space-y-1">
            <label
              htmlFor="surcharge-amount"
              className="text-ink-3 text-[10px] font-medium uppercase tracking-[0.04em]"
            >
              Acréscimo R$
            </label>
            <input
              id="surcharge-amount"
              inputMode="decimal"
              placeholder="0,00"
              value={surchargeAmountInput}
              onChange={(e) => onSurchargeAmountChange(e.target.value)}
              className={inputCls}
            />
          </div>
          {/* Acréscimo % */}
          <div className="space-y-1">
            <label
              htmlFor="surcharge-pct"
              className="text-ink-3 text-[10px] font-medium uppercase tracking-[0.04em]"
            >
              Acréscimo %
            </label>
            <input
              id="surcharge-pct"
              inputMode="decimal"
              placeholder="0"
              value={surchargePctInput}
              onChange={(e) => onSurchargePctChange(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="notes" className="text-ink-4 text-[11px] font-medium">
          Observação (opcional)
        </label>
        <textarea
          id="notes"
          placeholder="Ex: cheque #123, vale, fiado…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          maxLength={500}
          className="border-line bg-surface focus:border-brand w-full resize-none rounded-[8px] border px-3 py-2 text-[13px] outline-none transition"
        />
      </div>
    </div>
  );
}

function CustomerComboboxLight({
  customerId,
  customerLabel,
  onPick,
}: {
  customerId: string | null;
  customerLabel: string;
  onPick: (customer: CustomerSearchHit | null) => void;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<CustomerSearchHit[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isSearching, startSearch] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      startSearch(async () => {
        const results = await searchCustomers(q);
        setHits(results);
      });
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (customerId) {
    return (
      <div className="border-b border-line p-[18px]">
        <div className="text-ink-4 mb-2 text-[11px] font-bold uppercase tracking-[0.06em]">
          Cliente
        </div>
        <div className="bg-bg-app flex items-center justify-between rounded-[10px] p-3">
          <div className="flex items-center gap-2">
            <UserIcon className="text-ink-4 size-4" />
            <div>
              <p className="text-sm font-medium">{customerLabel}</p>
              <p className="text-ink-4 text-xs">Vinculado a esta venda</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onPick(null)}
            className="text-ink-4 hover:text-ink-1 text-xs"
          >
            Trocar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative border-b border-line p-[18px]">
      <div className="text-ink-4 mb-2 text-[11px] font-bold uppercase tracking-[0.06em]">
        Cliente
      </div>
      <div className="relative">
        <SearchIcon
          aria-hidden
          size={14}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-4"
        />
        <input
          id="pdv-customer-search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setShowResults(true);
          }}
          onFocus={() => setShowResults(true)}
          placeholder="Adicionar cliente · opcional (F3)"
          className="bg-bg-app border-line-2 placeholder:text-ink-3 focus:border-brand h-10 w-full rounded-[10px] border border-dashed pl-9 pr-3 text-[13px] outline-none transition"
        />
      </div>
      {showResults ? (
        <div className="border-line bg-popover absolute left-[18px] right-[18px] top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-[10px] border shadow-md">
          {hits.length === 0 ? (
            <p className="text-ink-4 p-3 text-xs">
              {isSearching ? "Buscando…" : "Nenhum cliente encontrado."}
            </p>
          ) : (
            <ul>
              {hits.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onPick(c);
                      setShowResults(false);
                      setQ("");
                    }}
                    className="hover:bg-bg-app flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left"
                  >
                    <span className="text-sm">{c.name}</span>
                    <span className="mono text-ink-4 text-[11px]">
                      {c.phone}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
