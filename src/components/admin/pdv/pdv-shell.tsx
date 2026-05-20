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
  ScanBarcodeIcon,
  SearchIcon,
  ShoppingBagIcon,
  Trash2Icon,
  UserIcon,
  XIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";

import { createCustomer } from "@/actions/customer/create";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDocument } from "@/lib/document";
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

interface LastSale {
  publicToken: string | null;
  totalInCents: number;
}

const PAYMENT_METHODS: PaymentMethodOption[] = [
  { value: "cash", label: "Dinheiro", Icon: BanknoteIcon },
  { value: "pix", label: "PIX", Icon: ReceiptIcon },
  { value: "debit", label: "Cartão débito", Icon: CreditCardIcon },
  { value: "credit", label: "Cartão crédito", Icon: CreditCardIcon },
  { value: "other", label: "Outro", Icon: PackageIcon },
];

const MAX_PAYMENT_LINES = 5;

/**
 * Sprint 1A — uma linha do pagamento dividido no form do PDV.
 * Strings em vez de cents pra acomodar UX de digitação (vírgula, vazio).
 * Conversão pra cents acontece no submit.
 */
interface PaymentLineState {
  id: string;
  method: PaymentMethod;
  amountInput: string;
  cashReceivedInput: string;
  notes: string;
}

function nextPaymentLineId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `pline-${Math.random().toString(36).slice(2, 11)}`;
}

function makeDefaultPaymentLine(): PaymentLineState {
  return {
    id: nextPaymentLineId(),
    method: "cash",
    amountInput: "",
    cashReceivedInput: "",
    notes: "",
  };
}

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
  // Sprint 1A — pagamento dividido. Lista de 1..5 linhas. Substitui o
  // antigo state `paymentMethod` + `cashReceivedInput`.
  const [paymentLines, setPaymentLines] = useState<PaymentLineState[]>(() => [
    makeDefaultPaymentLine(),
  ]);
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

  const [notes, setNotes] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerLabel, setCustomerLabel] = useState<string>("");
  // Venda rápida (Frente A.2): nome/tel direto no order, sem cadastro de
  // customer. Só usados quando customerId === null.
  const [walkInName, setWalkInName] = useState<string>("");
  const [walkInPhone, setWalkInPhone] = useState<string>("");
  const [isSubmitting, startSubmit] = useTransition();
  const [lastSale, setLastSale] = useState<LastSale | null>(null);

  const subtotalInCents = useMemo(
    () => cart.reduce((s, it) => s + it.priceInCents * it.quantity, 0),
    [cart],
  );

  // R$ canônico — sempre lê do AmountInput (que é sincronizado tanto por
  // edição direta quanto pela edição em %).
  const discountInCents = inputToCents(discountAmountInput) ?? 0;
  const surchargeInCents = inputToCents(surchargeAmountInput) ?? 0;

  // Reconcile com subtotal: se usuário digitou em %, mantém % e recomputa R$;
  // se digitou em R$, recomputa % a partir de R$. Executa SÓ quando subtotal
  // muda (delta de carrinho). Inputs/edits lidos via ref pra não disparar
  // re-execução em loop — se eles entrassem no dep array, cada keystroke
  // re-rodaria este efeito (que chama setX desses mesmos inputs → loop).
  const reconcileRefs = useRef({
    discountPctInput,
    discountInCents,
    lastDiscountEdit,
    surchargePctInput,
    surchargeInCents,
    lastSurchargeEdit,
  });
  reconcileRefs.current = {
    discountPctInput,
    discountInCents,
    lastDiscountEdit,
    surchargePctInput,
    surchargeInCents,
    lastSurchargeEdit,
  };
  useEffect(() => {
    const r = reconcileRefs.current;
    if (r.lastDiscountEdit === "pct") {
      const pct = inputToPct(r.discountPctInput);
      const newCents =
        pct === null ? 0 : Math.round((pct / 100) * subtotalInCents);
      setDiscountAmountInput(centsToInput(newCents));
    } else if (r.lastDiscountEdit === "amount") {
      setDiscountPctInput(pctFromCents(r.discountInCents, subtotalInCents));
    }
    if (r.lastSurchargeEdit === "pct") {
      const pct = inputToPct(r.surchargePctInput);
      const newCents =
        pct === null ? 0 : Math.round((pct / 100) * subtotalInCents);
      setSurchargeAmountInput(centsToInput(newCents));
    } else if (r.lastSurchargeEdit === "amount") {
      setSurchargePctInput(pctFromCents(r.surchargeInCents, subtotalInCents));
    }
  }, [subtotalInCents]);

  const totalInCents = Math.max(
    0,
    subtotalInCents - discountInCents + surchargeInCents,
  );
  // Sprint 1A — derivação do pagamento dividido.
  // Cada linha tem amountInput (string) → centavos para soma/comparação.
  const paymentsSumInCents = paymentLines.reduce(
    (acc, line) => acc + (inputToCents(line.amountInput) ?? 0),
    0,
  );
  const paymentsRemainingInCents = totalInCents - paymentsSumInCents;
  // Troco total: soma dos (cashReceived - amount) das linhas cash onde
  // cashReceived > amount. Visualmente mostrado per-linha; aqui é só
  // pra exibir num só lugar abaixo da lista (preserva UX antiga).
  const trocoTotalInCents = paymentLines.reduce((acc, line) => {
    if (line.method !== "cash") return acc;
    const amt = inputToCents(line.amountInput) ?? 0;
    const recv = inputToCents(line.cashReceivedInput);
    if (recv === null || amt === 0) return acc;
    const diff = recv - amt;
    return diff > 0 ? acc + diff : acc;
  }, 0);
  const troco = trocoTotalInCents > 0 ? trocoTotalInCents : null;
  // Validação per-linha de cash com recebido < amount (bloqueia submit).
  const paymentLinesAllValid = paymentLines.every((line) => {
    const amt = inputToCents(line.amountInput) ?? 0;
    if (amt <= 0) return false;
    if (line.method === "cash") {
      const recv = inputToCents(line.cashReceivedInput);
      if (recv !== null && recv < amt) return false;
    }
    return true;
  });

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
    setPaymentLines([makeDefaultPaymentLine()]);
    setDiscountAmountInput("");
    setDiscountPctInput("");
    setLastDiscountEdit(null);
    setSurchargeAmountInput("");
    setSurchargePctInput("");
    setLastSurchargeEdit(null);
    setNotes("");
    setCustomerId(null);
    setCustomerLabel("");
    setWalkInName("");
    setWalkInPhone("");
  }, []);

  // Sprint 1A — canSubmit cobre pagamento dividido:
  //   - carrinho não vazio + não está submetendo + desconto válido
  //   - soma dos pagamentos === total
  //   - todas as linhas válidas (amount > 0; cash com recv não pode ser < amount)
  const canSubmit =
    cart.length > 0 &&
    !isSubmitting &&
    discountInCents <= subtotalInCents &&
    paymentLinesAllValid &&
    paymentLines.length > 0 &&
    paymentLines.length <= MAX_PAYMENT_LINES &&
    paymentsSumInCents === totalInCents;

  const handleSubmit = () => {
    if (cart.length === 0) {
      toast.error("Adicione pelo menos um item.");
      return;
    }
    if (discountInCents > subtotalInCents) {
      toast.error("Desconto maior que o subtotal.");
      return;
    }
    if (paymentLines.length === 0) {
      toast.error("Adicione pelo menos uma forma de pagamento.");
      return;
    }
    if (!paymentLinesAllValid) {
      toast.error("Linha de pagamento inválida — confira valores e troco.");
      return;
    }
    if (paymentsSumInCents !== totalInCents) {
      const diff = totalInCents - paymentsSumInCents;
      toast.error(
        diff > 0
          ? `Falta R$ ${(diff / 100).toFixed(2)} no pagamento.`
          : `Sobra R$ ${(Math.abs(diff) / 100).toFixed(2)} no pagamento.`,
      );
      return;
    }

    const payload: CreateBalcaoSaleInput = {
      items: cart.map((it) => ({
        productId: it.productId,
        variantId: it.variantId,
        quantity: it.quantity,
      })),
      customerId,
      walkInName: customerId ? null : walkInName.trim() || null,
      walkInPhone: customerId ? null : walkInPhone.trim() || null,
      payments: paymentLines.map((line) => ({
        method: line.method,
        amountInCents: inputToCents(line.amountInput) ?? 0,
        cashReceivedInCents:
          line.method === "cash" ? inputToCents(line.cashReceivedInput) : null,
        notes: line.method === "other" ? line.notes.trim() || null : null,
      })),
      discountInCents: discountInCents > 0 ? discountInCents : null,
      surchargeInCents: surchargeInCents > 0 ? surchargeInCents : null,
      notes: notes.trim() || null,
    };

    startSubmit(async () => {
      const result = await createBalcaoSale(payload);
      if (!result.ok) {
        toast.error(result.errorMessage ?? "Falha ao registrar venda.");
        return;
      }
      toast.success("Venda registrada!");
      setLastSale({
        publicToken: result.publicToken ?? null,
        totalInCents,
      });
      reset();
      router.refresh();
    });
  };

  // Sprint 1A Fase 5 — Lançar como fiado.
  // Exige customerId (cliente identificado). Desconta estoque (cliente
  // levou a peça). Cria receivable com due_date = now + 30 days.
  const handleSubmitFiado = () => {
    if (cart.length === 0) {
      toast.error("Adicione pelo menos um item.");
      return;
    }
    if (!customerId) {
      toast.error("Selecione um cliente cadastrado para venda fiada.");
      return;
    }
    if (discountInCents > subtotalInCents) {
      toast.error("Desconto maior que o subtotal.");
      return;
    }
    if (
      !window.confirm(
        `Lançar venda fiada para o cliente selecionado? Total ${formatBRL(totalInCents)}. Vencimento em 30 dias. ESTOQUE SERÁ DESCONTADO.`,
      )
    ) {
      return;
    }

    const payload: CreateBalcaoSaleInput = {
      mode: "fiado",
      dueDaysFromNow: 30,
      items: cart.map((it) => ({
        productId: it.productId,
        variantId: it.variantId,
        quantity: it.quantity,
      })),
      customerId,
      walkInName: null,
      walkInPhone: null,
      // Fiado: sem payments, sem paymentMethod legado.
      discountInCents: discountInCents > 0 ? discountInCents : null,
      surchargeInCents: surchargeInCents > 0 ? surchargeInCents : null,
      notes: notes.trim() || null,
    };

    startSubmit(async () => {
      const result = await createBalcaoSale(payload);
      if (!result.ok) {
        toast.error(result.errorMessage ?? "Falha ao registrar fiado.");
        return;
      }
      toast.success(
        `Fiado ${result.shortCode ?? ""} registrado. Vencimento em 30 dias.`,
      );
      setLastSale({
        publicToken: result.publicToken ?? null,
        totalInCents,
      });
      reset();
      router.refresh();
    });
  };

  // Sprint 1A Fase 4 — Salvar como orçamento.
  // Não exige payments[] válido. Confirma antes via window.confirm
  // (substituível por Dialog dedicado quando UX pedir).
  const handleSubmitQuote = () => {
    if (cart.length === 0) {
      toast.error("Adicione pelo menos um item.");
      return;
    }
    if (
      !window.confirm(
        "Salvar como orçamento? Validade 7 dias. Não desconta estoque.",
      )
    ) {
      return;
    }

    const payload: CreateBalcaoSaleInput = {
      mode: "quote",
      quoteValidityDays: 7,
      items: cart.map((it) => ({
        productId: it.productId,
        variantId: it.variantId,
        quantity: it.quantity,
      })),
      customerId,
      walkInName: customerId ? null : walkInName.trim() || null,
      walkInPhone: customerId ? null : walkInPhone.trim() || null,
      // Orçamento: NÃO inclui payments (schema .min(1) rejeita []);
      // superRefine de mode='quote' rejeita se payments vier preenchido.
      discountInCents: discountInCents > 0 ? discountInCents : null,
      surchargeInCents: surchargeInCents > 0 ? surchargeInCents : null,
      notes: notes.trim() || null,
    };

    startSubmit(async () => {
      const result = await createBalcaoSale(payload);
      if (!result.ok) {
        toast.error(result.errorMessage ?? "Falha ao salvar orçamento.");
        return;
      }
      toast.success(
        `Orçamento ${result.shortCode ?? ""} salvo. Validade 7 dias.`,
      );
      setLastSale({
        publicToken: result.publicToken ?? null,
        totalInCents,
      });
      reset();
      router.refresh();
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
        case "F8": {
          // Sprint 1A — busca avançada: por enquanto é alias de F2
          // (mesmo input). Quando dialog de filtros avançados existir,
          // F8 vai abri-lo.
          e.preventDefault();
          const el = document.getElementById(
            "pdv-product-search",
          ) as HTMLInputElement | null;
          el?.focus();
          el?.select();
          return;
        }
        case "F9": {
          // Sprint 1A — abrir input de desconto manual (R$).
          e.preventDefault();
          const el = document.getElementById(
            "pdv-discount-amount",
          ) as HTMLInputElement | null;
          el?.focus();
          el?.select();
          return;
        }
        case "Escape": {
          // Skip se há dialog/modal aberto — deixa o componente consumir
          // o ESC (QuickSale/FullCreate, shadcn Dialog em DialogContent etc).
          const openDialog = document.querySelector(
            '[role="dialog"][aria-modal="true"], [role="dialog"][data-state="open"]',
          );
          if (openDialog) return;
          // Skip se foco em textarea (não roubar ESC do campo de observação).
          const ae = document.activeElement;
          if (ae instanceof HTMLTextAreaElement) return;
          if (cartLengthRef.current === 0) return;
          e.preventDefault();
          if (window.confirm("Limpar a venda atual?")) {
            reset();
          }
          return;
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [reset]);

  return (
    <div className="flex flex-col gap-4">
    <div className="grid gap-4 lg:grid-cols-[1fr_400px] lg:gap-6">
      {/* Coluna esquerda: busca + grid de produtos */}
      <section className="space-y-4">
        <ProductSearchPicker onAdd={addToCart} />
      </section>

      {/* Coluna direita: cliente + carrinho + pagamento + finalizar.
          FIX 2026-05-19 ("campos sumindo"): a aside era flex-col com
          overflow-hidden + max-h. Cliente + Cart + PaymentSection + Footer
          (Total+Submit) somavam >viewport quando user preenchia desconto +
          acréscimo + observação. Como TODOS os filhos tinham flex-shrink:1
          default, o footer (último) era encolhido a 0 — botão Finalizar
          sumia. Fix: middle scrollable (Cart + PaymentSection num wrapper
          flex-1 overflow-y-auto min-h-0); Customer e Footer marcados
          shrink-0; CartPanel perde overflow próprio (parent agora cuida). */}
      <aside className="b3-card flex flex-col overflow-hidden lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)]">
        <div className="shrink-0">
          <CustomerComboboxLight
            customerId={customerId}
            customerLabel={customerLabel}
            walkInName={walkInName}
            walkInPhone={walkInPhone}
            setWalkInName={setWalkInName}
            setWalkInPhone={setWalkInPhone}
            onPick={(c) => {
              setCustomerId(c?.id ?? null);
              setCustomerLabel(c ? `${c.name} · ${c.phone}` : "");
              if (c) {
                setWalkInName("");
                setWalkInPhone("");
              }
            }}
          />
        </div>

        {/* Scrollable middle — Cart + PaymentSection rolam juntos quando
            extrapolam altura. Footer (Total + Submit) FICA SEMPRE VISÍVEL. */}
        <div className="flex flex-1 min-h-0 flex-col overflow-y-auto">
          <CartPanel
            items={cart}
            updateQty={updateQty}
            removeItem={removeItem}
          />

          {cart.length > 0 ? (
            <div className="border-t border-line bg-bg-app">
              <PaymentSection
                paymentLines={paymentLines}
                setPaymentLines={setPaymentLines}
                totalInCents={totalInCents}
                paymentsSumInCents={paymentsSumInCents}
                paymentsRemainingInCents={paymentsRemainingInCents}
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
        </div>

        <div className="shrink-0 border-t border-line bg-bg-app p-[18px]">
          {lastSale ? (
            <div className="mb-3 rounded-[10px] border border-brand-line bg-brand-wash p-3">
              <div className="text-[12px] font-bold uppercase tracking-[0.06em] text-brand">
                Venda registrada
              </div>
              <div className="mt-1 text-sm text-ink-2">
                Total {formatBRL(lastSale.totalInCents)}. Pronto para nova venda.
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="b3-btn b3-btn--sm"
                  onClick={() => setLastSale(null)}
                >
                  Nova venda
                </button>
                {lastSale.publicToken ? (
                  <button
                    type="button"
                    className="b3-btn b3-btn--sm b3-btn--brand"
                    onClick={() => {
                      window.open(
                        `/admin/pdv/recibo/${lastSale.publicToken}`,
                        "_blank",
                        "noopener,noreferrer",
                      );
                    }}
                  >
                    Imprimir recibo
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
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

          {/* Sprint 1A Fase 4 — Salvar como orçamento. Habilitado quando
              há pelo menos 1 item no carrinho (não exige pagamento). */}
          <button
            type="button"
            disabled={cart.length === 0 || isSubmitting}
            onClick={handleSubmitQuote}
            className={cn(
              "b3-btn mt-2 w-full",
              (cart.length === 0 || isSubmitting) &&
                "cursor-not-allowed opacity-50",
            )}
            style={{ height: 40 }}
          >
            Salvar como orçamento
          </button>

          {/* Sprint 1A Fase 5 — Lançar como fiado. Desabilitado quando
              sem customerId (tooltip explicativo). */}
          <button
            type="button"
            disabled={
              cart.length === 0 || isSubmitting || !customerId
            }
            onClick={handleSubmitFiado}
            title={
              !customerId
                ? "Selecione um cliente cadastrado pra lançar fiado"
                : undefined
            }
            className={cn(
              "b3-btn mt-2 w-full",
              (cart.length === 0 || isSubmitting || !customerId) &&
                "cursor-not-allowed opacity-50",
            )}
            style={{ height: 40 }}
          >
            Lançar como fiado
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

      {/* Sprint 1A — barra de F-keys (legenda discreta no rodapé). */}
      <FKeysLegend />
    </div>
  );
}

function FKeysLegend() {
  const keys: Array<{ key: string; label: string }> = [
    { key: "F2", label: "Buscar produto" },
    { key: "F3", label: "Buscar cliente" },
    { key: "F4", label: "Finalizar venda" },
    { key: "F8", label: "Busca avançada" },
    { key: "F9", label: "Desconto manual" },
    { key: "ESC", label: "Limpar venda" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line pt-3 text-[11px] text-ink-4 lg:px-1">
      {keys.map((k) => (
        <span key={k.key} className="inline-flex items-center gap-1.5">
          <kbd className="mono inline-block rounded border border-line bg-bg-app px-1.5 py-[1px] text-[10.5px] font-semibold text-ink-2">
            {k.key}
          </kbd>
          <span>{k.label}</span>
        </span>
      ))}
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

  // Sprint 1A — scanner GTIN: Enter no input checa match exato em
  // product.gtin. Se encontrar 1 produto e ele NÃO tem variantes,
  // adiciona direto + limpa input. Útil pra fluxo de bipagem (scanner
  // físico envia caracteres + Enter no fim).
  //
  // Critérios pra add direto:
  //   - 1 hit retornado pela busca
  //   - hit.gtin === input.trim() (match exato — defesa contra busca por
  //     nome retornar 1 resultado e disparar add automático)
  //   - hit sem variantes (com variantes precisa o lojista escolher)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    const trimmed = q.trim();
    if (!trimmed) return;
    const exactGtinMatch = hits.find(
      (h) => h.gtin && h.gtin === trimmed && h.variants.length === 0,
    );
    if (!exactGtinMatch) return;
    e.preventDefault();
    const effectivePrice = getEffectivePrice({
      basePriceInCents: exactGtinMatch.basePriceInCents,
      promoPriceInCents: exactGtinMatch.promoPriceInCents,
      promoStartsAt: exactGtinMatch.promoStartsAt,
      promoEndsAt: exactGtinMatch.promoEndsAt,
    });
    onAdd(exactGtinMatch, null, effectivePrice);
    setQ("");
    setHits([]);
  };

  const toggleVariants = (productId: string) =>
    setExpandedVariants((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });

  return (
    <div className="space-y-4">
      {/* Search bar 56px com badge F2 mono + scanner GTIN (Sprint 1A) */}
      <div className="relative">
        <ScanBarcodeIcon
          aria-hidden
          size={18}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-4"
        />
        <input
          id="pdv-product-search"
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Bipe ou digite código / nome"
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
  // FIX 2026-05-19: removido `flex-1 overflow-y-auto` (era scroll próprio).
  // Wrapper na aside agora cuida do scroll do middle (Cart + PaymentSection).
  // Sem isso, duplicava scroll e empurrava footer pra fora do viewport.
  if (items.length === 0) {
    return (
      <div className="text-ink-4 flex min-h-[180px] flex-col items-center justify-center gap-3 p-10 text-center">
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
    <div>
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
  paymentLines,
  setPaymentLines,
  totalInCents,
  paymentsSumInCents,
  paymentsRemainingInCents,
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
  paymentLines: PaymentLineState[];
  setPaymentLines: React.Dispatch<React.SetStateAction<PaymentLineState[]>>;
  totalInCents: number;
  paymentsSumInCents: number;
  paymentsRemainingInCents: number;
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

  const updateLine = (id: string, patch: Partial<PaymentLineState>) => {
    setPaymentLines((prev) =>
      prev.map((line) => (line.id === id ? { ...line, ...patch } : line)),
    );
  };
  const removeLine = (id: string) => {
    setPaymentLines((prev) =>
      prev.length <= 1 ? prev : prev.filter((line) => line.id !== id),
    );
  };
  const addLine = () => {
    setPaymentLines((prev) => {
      if (prev.length >= MAX_PAYMENT_LINES) return prev;
      // Sugere a forma com saldo restante na nova linha pra ajudar lojista.
      const remaining = totalInCents - prev.reduce(
        (acc, l) => acc + (inputToCents(l.amountInput) ?? 0),
        0,
      );
      const newLine: PaymentLineState = {
        ...makeDefaultPaymentLine(),
        method: "pix",
        amountInput: remaining > 0 ? centsToInput(remaining) : "",
      };
      return [...prev, newLine];
    });
  };

  return (
    <div className="space-y-3 p-[18px]">
      <div className="text-ink-4 text-[11px] font-bold uppercase tracking-[0.06em]">
        Pagamento
      </div>

      {/* Lista de linhas de pagamento (Sprint 1A) */}
      <div className="flex flex-col gap-2">
        {paymentLines.map((line, idx) => {
          const amt = inputToCents(line.amountInput) ?? 0;
          const recv = inputToCents(line.cashReceivedInput);
          const lineTroco =
            line.method === "cash" && recv !== null && recv > amt
              ? recv - amt
              : null;
          const lineInvalid =
            line.method === "cash" && recv !== null && recv < amt;
          return (
            <div
              key={line.id}
              className="rounded-[10px] border border-line bg-surface p-2.5"
            >
              <div className="flex items-center gap-2">
                <select
                  aria-label="Forma de pagamento"
                  className="b3-select h-9 text-[12.5px]"
                  style={{ width: 140 }}
                  value={line.method}
                  onChange={(e) =>
                    updateLine(line.id, {
                      method: e.target.value as PaymentMethod,
                      // Limpa cash/notes ao mudar de método
                      cashReceivedInput:
                        e.target.value === "cash"
                          ? line.cashReceivedInput
                          : "",
                      notes: e.target.value === "other" ? line.notes : "",
                    })
                  }
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <input
                  aria-label="Valor desta forma de pagamento"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={line.amountInput}
                  onChange={(e) =>
                    updateLine(line.id, { amountInput: e.target.value })
                  }
                  className={inputCls}
                />
                <button
                  type="button"
                  onClick={() => removeLine(line.id)}
                  disabled={paymentLines.length <= 1}
                  aria-label="Remover forma de pagamento"
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-[8px] border border-line text-ink-4 transition",
                    paymentLines.length > 1
                      ? "hover:border-danger hover:text-danger"
                      : "cursor-not-allowed opacity-30",
                  )}
                >
                  <XIcon className="size-3.5" />
                </button>
              </div>

              {line.method === "cash" ? (
                <div className="mt-2 grid grid-cols-[140px_1fr] items-center gap-2">
                  <label
                    htmlFor={`cash-recv-${line.id}`}
                    className="text-ink-4 text-[11px]"
                  >
                    Recebido (pra troco)
                  </label>
                  <input
                    id={`cash-recv-${line.id}`}
                    inputMode="decimal"
                    placeholder="0,00"
                    value={line.cashReceivedInput}
                    onChange={(e) =>
                      updateLine(line.id, {
                        cashReceivedInput: e.target.value,
                      })
                    }
                    className={cn(
                      inputCls,
                      lineInvalid && "border-danger",
                    )}
                  />
                  {lineTroco !== null ? (
                    <p className="col-span-2 text-ink-4 text-[11px]">
                      Troco desta linha:{" "}
                      <span className="text-ink-1 font-semibold">
                        {formatBRL(lineTroco)}
                      </span>
                    </p>
                  ) : null}
                  {lineInvalid ? (
                    <p className="col-span-2 text-danger text-[11px]">
                      Valor recebido menor que o valor da linha.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {line.method === "other" ? (
                <div className="mt-2">
                  <input
                    aria-label="Descrição da forma (TED, vale, cheque, etc)"
                    placeholder="TED, vale, cheque #..."
                    value={line.notes}
                    onChange={(e) =>
                      updateLine(line.id, { notes: e.target.value })
                    }
                    maxLength={60}
                    className={inputCls}
                  />
                </div>
              ) : null}

              {idx === paymentLines.length - 1 ? null : (
                <></>
              )}
            </div>
          );
        })}

        {paymentLines.length < MAX_PAYMENT_LINES ? (
          <button
            type="button"
            onClick={addLine}
            className="b3-btn b3-btn--sm self-start gap-2"
          >
            <PlusIcon className="size-3" /> Adicionar forma
          </button>
        ) : null}

        {/* Indicador Falta / Sobra / Completo */}
        <div className="mt-1 text-[12px]">
          {paymentsRemainingInCents === 0 && paymentsSumInCents > 0 ? (
            <span className="text-ok font-semibold">
              ✓ Pagamento completo ({formatBRL(paymentsSumInCents)})
            </span>
          ) : paymentsRemainingInCents > 0 ? (
            <span className="text-warn font-semibold">
              Falta {formatBRL(paymentsRemainingInCents)}
            </span>
          ) : (
            <span className="text-danger font-semibold">
              Sobra {formatBRL(Math.abs(paymentsRemainingInCents))} —
              ajuste os valores
            </span>
          )}
          {troco !== null && paymentsRemainingInCents === 0 ? (
            <span className="text-ink-4 ml-2">
              · Troco total {formatBRL(troco)}
            </span>
          ) : null}
        </div>
      </div>

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
              id="pdv-discount-amount"
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
  walkInName,
  walkInPhone,
  setWalkInName,
  setWalkInPhone,
  onPick,
}: {
  customerId: string | null;
  customerLabel: string;
  walkInName: string;
  walkInPhone: string;
  setWalkInName: (v: string) => void;
  setWalkInPhone: (v: string) => void;
  onPick: (customer: CustomerSearchHit | null) => void;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<CustomerSearchHit[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isSearching, startSearch] = useTransition();
  const [showQuickSale, setShowQuickSale] = useState(false);
  const [showFullCreate, setShowFullCreate] = useState(false);
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

  // 1) Cliente cadastrado vinculado
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
              <p className="text-ink-4 text-xs">Cadastrado · vinculado à venda</p>
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

  // 2) Venda rápida com nome preenchido (sem cadastro)
  if (walkInName.trim()) {
    return (
      <div className="border-b border-line p-[18px]">
        <div className="text-ink-4 mb-2 text-[11px] font-bold uppercase tracking-[0.06em]">
          Cliente
        </div>
        <div className="bg-bg-app flex items-center justify-between rounded-[10px] p-3">
          <div className="flex items-center gap-2">
            <UserIcon className="text-ink-4 size-4" />
            <div>
              <p className="text-sm font-medium">{walkInName}</p>
              <p className="text-ink-4 text-xs">
                Venda rápida · {walkInPhone || "sem telefone"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setWalkInName("");
              setWalkInPhone("");
            }}
            className="text-ink-4 hover:text-ink-1 text-xs"
          >
            Trocar
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        ref={containerRef}
        className="relative border-b border-line p-[18px]"
      >
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
            placeholder="Buscar cliente cadastrado (F3) · opcional"
            className="bg-bg-app border-line-2 placeholder:text-ink-3 focus:border-brand h-10 w-full rounded-[10px] border border-dashed pl-9 pr-3 text-[13px] outline-none transition"
          />
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowQuickSale(true)}
            className="text-ink-2 hover:text-brand text-[12px] underline-offset-2 hover:underline"
          >
            + Venda rápida (só nome)
          </button>
          <span className="text-ink-4 text-[12px]">·</span>
          <button
            type="button"
            onClick={() => setShowFullCreate(true)}
            className="text-ink-2 hover:text-brand text-[12px] underline-offset-2 hover:underline"
          >
            + Cadastrar cliente completo
          </button>
        </div>

        {showResults && q.trim().length > 0 ? (
          <div className="border-line bg-popover absolute left-[18px] right-[18px] top-[78px] z-20 mt-1 max-h-64 overflow-y-auto rounded-[10px] border shadow-md">
            {hits.length === 0 ? (
              <div className="p-3 text-xs">
                <p className="text-ink-4 mb-2">
                  {isSearching ? "Buscando…" : `Nenhum cliente "${q}".`}
                </p>
                {!isSearching && (
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setWalkInName(q.trim());
                        setShowResults(false);
                        setQ("");
                      }}
                      className="text-brand text-left hover:underline"
                    >
                      Usar &quot;{q}&quot; como venda rápida
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowFullCreate(true);
                        setShowResults(false);
                      }}
                      className="text-brand text-left hover:underline"
                    >
                      Cadastrar cliente completo
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <ul>
                {hits.map((c) => {
                  const docFmt = c.document
                    ? formatDocument(c.document, c.type)
                    : "";
                  return (
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
                        <span className="flex items-center gap-1.5 text-sm">
                          {c.type === "company" ? (
                            <span className="bg-brand-wash text-brand rounded px-1 py-px text-[9px] font-bold leading-[1] tracking-wide">
                              PJ
                            </span>
                          ) : null}
                          {c.name}
                        </span>
                        <span className="mono text-ink-4 text-[11px]">
                          {c.phone}
                          {docFmt ? ` · ${docFmt}` : ""}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}
      </div>

      {showQuickSale && (
        <QuickSaleDialog
          initialName={q}
          onClose={() => setShowQuickSale(false)}
          onConfirm={(name, phone) => {
            setWalkInName(name);
            setWalkInPhone(phone);
            setShowQuickSale(false);
            setQ("");
          }}
        />
      )}

      {showFullCreate && (
        <FullCustomerCreateDialog
          initialName={q}
          onClose={() => setShowFullCreate(false)}
          onCreated={(c) => {
            onPick(c);
            setShowFullCreate(false);
            setQ("");
          }}
        />
      )}
    </>
  );
}

// =========================================================================
// Frente A — diálogos de cadastro do cliente no PDV
// =========================================================================

function QuickSaleDialog({
  initialName,
  onClose,
  onConfirm,
}: {
  initialName: string;
  onClose: () => void;
  onConfirm: (name: string, phone: string) => void;
}) {
  const [name, setName] = useState(initialName.trim());
  const [phone, setPhone] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const canConfirm = name.trim().length > 0;

  // shadcn Dialog (radix) já gerencia focus-trap, ESC pra fechar, e
  // aria-labelledby/describedby via DialogTitle/Description. Auto-focus
  // no input principal via onOpenAutoFocus pra não roubar focus do trigger.
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="sm:max-w-md"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          inputRef.current?.focus();
          inputRef.current?.select();
        }}
      >
        <DialogHeader>
          <DialogTitle>Venda rápida</DialogTitle>
          <DialogDescription>
            Só o nome é obrigatório. O cliente NÃO será cadastrado no sistema —
            o nome fica salvo apenas neste pedido.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canConfirm) onConfirm(name.trim(), phone.trim());
          }}
          className="space-y-3"
        >
          <div>
            <label
              htmlFor="quicksale-name"
              className="text-ink-2 mb-1 block text-[12px] font-medium"
            >
              Nome do cliente *
            </label>
            <input
              id="quicksale-name"
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Maria · José Silva"
              className="border-line bg-surface focus:border-brand h-10 w-full rounded-[8px] border px-3 text-[13px] outline-none"
              maxLength={120}
              required
            />
          </div>
          <div>
            <label
              htmlFor="quicksale-phone"
              className="text-ink-2 mb-1 block text-[12px] font-medium"
            >
              Telefone (opcional)
            </label>
            <input
              id="quicksale-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+5511999999999"
              className="border-line bg-surface focus:border-brand h-10 w-full rounded-[8px] border px-3 text-[13px] outline-none"
            />
            <p className="text-ink-4 mt-1 text-[10.5px]">
              Use formato internacional. Em branco se não tiver.
            </p>
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={onClose}
              className="border-line text-ink-2 hover:bg-bg-app h-9 rounded-[8px] border px-3 text-[12px]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!canConfirm}
              className="bg-brand h-9 rounded-[8px] px-3 text-[12px] font-semibold text-white disabled:opacity-50"
            >
              Usar este nome
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FullCustomerCreateDialog({
  initialName,
  onClose,
  onCreated,
}: {
  initialName: string;
  onClose: () => void;
  onCreated: (c: CustomerSearchHit) => void;
}) {
  const [name, setName] = useState(initialName.trim());
  const [phone, setPhone] = useState("");
  const [type, setType] = useState<"individual" | "company">("individual");
  const [document, setDocument] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, startSubmit] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    startSubmit(async () => {
      const result = await createCustomer({
        name: name.trim(),
        phone: phone.trim(),
        type,
        document: document.trim() || undefined,
        email: email.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success("Cliente cadastrado.");
      onCreated({
        id: result.customer.id,
        name: result.customer.name,
        phone: result.customer.phone,
        document: null,
        type,
      });
    });
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="sm:max-w-lg"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>Cadastrar cliente completo</DialogTitle>
          <DialogDescription>
            Cliente fica salvo na base e pode ser vinculado a futuras vendas.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex gap-2">
            <label
              className={`flex-1 cursor-pointer rounded-[8px] border px-3 py-2 text-center text-[12px] ${
                type === "individual"
                  ? "border-brand text-brand"
                  : "border-line text-ink-3"
              }`}
            >
              <input
                type="radio"
                name="type"
                value="individual"
                checked={type === "individual"}
                onChange={() => setType("individual")}
                className="sr-only"
              />
              Pessoa Física
            </label>
            <label
              className={`flex-1 cursor-pointer rounded-[8px] border px-3 py-2 text-center text-[12px] ${
                type === "company"
                  ? "border-brand text-brand"
                  : "border-line text-ink-3"
              }`}
            >
              <input
                type="radio"
                name="type"
                value="company"
                checked={type === "company"}
                onChange={() => setType("company")}
                className="sr-only"
              />
              Pessoa Jurídica
            </label>
          </div>
          <FieldText
            ref={inputRef}
            label={type === "company" ? "Razão social *" : "Nome *"}
            value={name}
            onChange={setName}
            error={errors.name}
            required
          />
          <FieldText
            label="Telefone *"
            value={phone}
            onChange={setPhone}
            placeholder="+5511999999999"
            error={errors.phone}
            required
          />
          <FieldText
            label={type === "company" ? "CNPJ" : "CPF"}
            value={document}
            onChange={setDocument}
            placeholder={type === "company" ? "00.000.000/0000-00" : "000.000.000-00"}
            error={errors.document}
          />
          <FieldText
            label="E-mail"
            value={email}
            onChange={setEmail}
            placeholder="cliente@example.com"
            error={errors.email}
            type="email"
          />
          <div>
            <label className="text-ink-2 mb-1 block text-[12px] font-medium">
              Observações
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="border-line bg-surface focus:border-brand w-full resize-none rounded-[8px] border px-3 py-2 text-[13px] outline-none"
              maxLength={1000}
            />
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={onClose}
              className="border-line text-ink-2 hover:bg-bg-app h-9 rounded-[8px] border px-3 text-[12px]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim() || !phone.trim()}
              className="bg-brand h-9 rounded-[8px] px-3 text-[12px] font-semibold text-white disabled:opacity-50"
            >
              {submitting ? "Salvando…" : "Cadastrar e vincular"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const FieldText = forwardRef<
  HTMLInputElement,
  {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    error?: string;
    required?: boolean;
    type?: string;
  }
>(function FieldText(
  { label, value, onChange, placeholder, error, required, type = "text" },
  ref,
) {
  return (
    <div>
      <label className="text-ink-2 mb-1 block text-[12px] font-medium">
        {label}
      </label>
      <input
        ref={ref}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className={`bg-surface h-10 w-full rounded-[8px] border px-3 text-[13px] outline-none ${
          error ? "border-red-500" : "border-line focus:border-brand"
        }`}
      />
      {error && (
        <p className="mt-1 text-[10.5px] text-red-600">{error}</p>
      )}
    </div>
  );
});
