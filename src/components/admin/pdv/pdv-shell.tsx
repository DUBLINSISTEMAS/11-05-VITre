"use client";

import {
  BanknoteIcon,
  ChevronRightIcon,
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

export function PdvShell() {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(
    null,
  );
  const [discountInput, setDiscountInput] = useState("");
  const [cashReceivedInput, setCashReceivedInput] = useState("");
  const [notes, setNotes] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerLabel, setCustomerLabel] = useState<string>("");
  const [isSubmitting, startSubmit] = useTransition();

  const subtotalInCents = useMemo(
    () => cart.reduce((s, it) => s + it.priceInCents * it.quantity, 0),
    [cart],
  );
  const discountInCents = inputToCents(discountInput) ?? 0;
  const totalInCents = Math.max(0, subtotalInCents - discountInCents);
  const cashReceivedInCents = inputToCents(cashReceivedInput);
  const troco =
    paymentMethod === "cash" &&
    cashReceivedInCents !== null &&
    cashReceivedInCents >= totalInCents
      ? cashReceivedInCents - totalInCents
      : null;

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
          // Aumenta qty se já está no carrinho
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
            stockQuantity:
              variant?.stockQuantity ?? product.stockQuantity,
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
      return prev.map((it, i) =>
        i === idx ? { ...it, quantity: next } : it,
      );
    });
  };

  const removeItem = (idx: number) =>
    setCart((prev) => prev.filter((_, i) => i !== idx));

  const reset = useCallback(() => {
    setCart([]);
    setPaymentMethod(null);
    setDiscountInput("");
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
  //
  // F2 = busca produto, F3 = busca cliente, F4 = finalizar, ESC = limpar.
  // Refs nas closures (handleSubmit/canSubmit/cart) pra evitar listener
  // rebind a cada keystroke; dep array só contém o que muda raramente.
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
      // Ignora se modifier pressionado — não pisar em atalhos do sistema
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
          // Só zera se foco está no body (fora de inputs) E carrinho > 0
          // — ESC dentro de um input fecha popovers/dropdowns nativamente.
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

      {/* Coluna direita: carrinho + cliente + pagamento + finalizar */}
      <aside className="space-y-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
        <CartPanel
          items={cart}
          updateQty={updateQty}
          removeItem={removeItem}
        />

        <CustomerComboboxLight
          customerId={customerId}
          customerLabel={customerLabel}
          onPick={(c) => {
            setCustomerId(c?.id ?? null);
            setCustomerLabel(c ? `${c.name} · ${c.phone}` : "");
          }}
        />

        <section className="b3-card space-y-3 p-4">
          <h3 className="text-[13.5px] font-semibold tracking-tight text-ink-1">
            Pagamento
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {PAYMENT_METHODS.map((m) => (
              <Button
                key={m.value}
                type="button"
                variant={paymentMethod === m.value ? "default" : "outline"}
                onClick={() => setPaymentMethod(m.value)}
                className="justify-start gap-2 h-11"
              >
                <m.Icon className="size-4" />
                {m.label}
              </Button>
            ))}
          </div>

          {paymentMethod === "cash" ? (
            <div className="space-y-1">
              <Label htmlFor="cash-received" className="text-xs">
                Valor recebido (opcional — pra calcular troco)
              </Label>
              <Input
                id="cash-received"
                inputMode="decimal"
                placeholder="0,00"
                value={cashReceivedInput}
                onChange={(e) => setCashReceivedInput(e.target.value)}
              />
              {troco !== null ? (
                <p className="text-xs text-ink-4">
                  Troco:{" "}
                  <span className="font-semibold text-ink-1">
                    {formatBRL(troco)}
                  </span>
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-1">
            <Label htmlFor="discount" className="text-xs">
              Desconto manual (opcional)
            </Label>
            <Input
              id="discount"
              inputMode="decimal"
              placeholder="0,00"
              value={discountInput}
              onChange={(e) => setDiscountInput(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="notes" className="text-xs">
              Observação (opcional)
            </Label>
            <Textarea
              id="notes"
              placeholder="Ex: cheque #123, vale, fiado..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={500}
            />
          </div>
        </section>

        <section className="b3-card space-y-2 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-4">Subtotal</span>
            <span className="font-mono text-ink-1">{formatBRL(subtotalInCents)}</span>
          </div>
          {discountInCents > 0 ? (
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-4">Desconto</span>
              <span className="font-mono text-danger">
                −{formatBRL(discountInCents)}
              </span>
            </div>
          ) : null}
          <div className="flex items-center justify-between border-t border-line pt-2 text-base">
            <span className="font-semibold text-ink-1">Total</span>
            <span className="font-mono text-lg font-bold text-ink-1">
              {formatBRL(totalInCents)}
            </span>
          </div>

          <Button
            id="pdv-submit"
            type="button"
            size="lg"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="w-full h-12 text-base"
          >
            {isSubmitting ? "Registrando..." : "Finalizar venda (F4)"}
            <ChevronRightIcon className="size-4" />
          </Button>

          {cart.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={reset}
              className="w-full"
            >
              Limpar venda
            </Button>
          ) : null}
        </section>
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
    <div className="space-y-3">
      <div className="relative">
        <SearchIcon
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-4"
        />
        <Input
          id="pdv-product-search"
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar produto por nome... (F2)"
          className="pl-9 h-12 text-base"
        />
        {q ? (
          <button
            type="button"
            onClick={() => setQ("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-4 hover:text-ink-1"
            aria-label="Limpar busca"
          >
            <XIcon className="size-4" />
          </button>
        ) : null}
      </div>

      {isSearching && hits.length === 0 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square animate-pulse rounded-lg bg-bg-app"
            />
          ))}
        </div>
      ) : hits.length === 0 ? (
        <EmptyHits hasQuery={q.trim() !== ""} />
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
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
            return (
              <div
                key={p.id}
                className={cn(
                  "group relative flex flex-col overflow-hidden rounded-lg border border-line bg-surface transition",
                  isOutOfStock && "opacity-50",
                )}
              >
                <button
                  type="button"
                  disabled={isOutOfStock}
                  onClick={() => {
                    if (hasVariants) {
                      toggleVariants(p.id);
                    } else {
                      onAdd(p, null, effectivePrice);
                    }
                  }}
                  className="flex flex-1 flex-col items-start gap-1 p-2 text-left hover:bg-bg-app disabled:cursor-not-allowed"
                >
                  <div className="relative aspect-square w-full overflow-hidden rounded bg-bg-app">
                    {p.thumbUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.thumbUrl}
                        alt={p.name}
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center text-ink-4">
                        <PackageIcon className="size-6" />
                      </div>
                    )}
                  </div>
                  <span className="line-clamp-2 text-xs font-medium">
                    {p.name}
                  </span>
                  <span className="font-mono text-[13px] font-semibold">
                    {formatBRL(effectivePrice)}
                  </span>
                  {p.trackStock ? (
                    <span className="text-[11px] text-ink-4">
                      {p.stockQuantity ?? 0} em estoque
                    </span>
                  ) : null}
                  {hasVariants ? (
                    <span className="text-[11px] text-brand">
                      {expanded ? "▲ ocultar" : "▼"} {p.variants.length}{" "}
                      variantes
                    </span>
                  ) : null}
                </button>

                {hasVariants && expanded ? (
                  <div className="border-t border-line bg-bg-app p-2 space-y-1">
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
                          className="flex w-full items-center justify-between rounded px-2 py-1 text-xs hover:bg-bg-app disabled:opacity-50"
                        >
                          <span className="truncate">{v.name}</span>
                          <span className="font-mono">
                            {formatBRL(vPrice)}
                          </span>
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
    <div className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-line p-8 text-center">
      <PackageIcon className="size-8 text-ink-4" />
      <p className="text-sm text-ink-4">
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
      <section className="b3-card p-4">
        <div className="flex items-center gap-2 text-sm text-ink-4">
          <ShoppingBagIcon className="size-4" />
          Carrinho vazio
        </div>
      </section>
    );
  }
  return (
    <section className="b3-card">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <h3 className="text-[13.5px] font-semibold tracking-tight text-ink-1">
          Carrinho · {items.length} {items.length === 1 ? "item" : "itens"}
        </h3>
      </header>
      <ul className="divide-y divide-line">
        {items.map((it, idx) => (
          <li key={`${it.productId}-${it.variantId ?? "p"}`} className="p-3">
            <div className="flex gap-2">
              <div className="size-12 shrink-0 overflow-hidden rounded bg-bg-app">
                {it.thumbUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={it.thumbUrl}
                    alt={it.productName}
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center">
                    <PackageIcon className="size-4 text-ink-4" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium line-clamp-1">
                  {it.productName}
                </p>
                {it.variantName ? (
                  <p className="text-xs text-ink-4">
                    {it.variantName}
                  </p>
                ) : null}
                <p className="font-mono text-xs">
                  {formatBRL(it.priceInCents)}
                </p>
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
                <Button
                  size="icon"
                  variant="outline"
                  className="size-8"
                  onClick={() => updateQty(idx, -1)}
                >
                  <MinusIcon className="size-3" />
                </Button>
                <span className="w-8 text-center text-sm font-medium">
                  {it.quantity}
                </span>
                <Button
                  size="icon"
                  variant="outline"
                  className="size-8"
                  onClick={() => updateQty(idx, 1)}
                >
                  <PlusIcon className="size-3" />
                </Button>
              </div>
              <span className="font-mono text-sm font-semibold">
                {formatBRL(it.priceInCents * it.quantity)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
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
      <section className="b3-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserIcon className="size-4 text-ink-4" />
            <div>
              <p className="text-sm font-medium">{customerLabel}</p>
              <p className="text-xs text-ink-4">
                Cliente vinculado
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onPick(null)}
          >
            Trocar
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section ref={containerRef} className="b3-card relative p-4">
      <Label className="text-[13.5px] font-semibold tracking-tight text-ink-1">
        Cliente (opcional)
      </Label>
      <div className="relative mt-2">
        <SearchIcon
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-4"
        />
        <Input
          id="pdv-customer-search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setShowResults(true);
          }}
          onFocus={() => setShowResults(true)}
          placeholder="Buscar por nome ou telefone... (F3)"
          className="pl-9"
        />
      </div>
      {showResults ? (
        <div className="absolute left-4 right-4 top-full z-10 mt-1 max-h-64 overflow-y-auto rounded-lg border border-line bg-popover shadow-md">
          {hits.length === 0 ? (
            <p className="p-3 text-xs text-ink-4">
              {isSearching ? "Buscando..." : "Nenhum cliente encontrado."}
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
                    className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-bg-app"
                  >
                    <span className="text-sm">{c.name}</span>
                    <span className="font-mono text-[11px] text-ink-4">
                      {c.phone}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
