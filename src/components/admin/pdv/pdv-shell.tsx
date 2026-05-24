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
  ChevronDownIcon,
  CreditCardIcon,
  HandCoinsIcon,
  MinusIcon,
  PackageIcon,
  PercentIcon,
  PlusIcon,
  ReceiptIcon,
  ScanBarcodeIcon,
  SearchIcon,
  ShoppingBagIcon,
  Trash2Icon,
  TriangleAlertIcon,
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
  type PickerSelection,
  ProductPickerDialog,
} from "@/components/admin/pdv/product-picker-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDocument } from "@/lib/document";
import { logger } from "@/lib/logger";
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
  /**
   * Desconto por linha em centavos (Fase 4 / 2026-05-21). NULL ou 0 = sem
   * desconto. Source of truth em cents — % é só UX. Validação server-side
   * garante `<= priceInCents × quantity`. Persiste em
   * `order_item.discount_in_cents`.
   */
  discountInCents: number | null;
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

/**
 * Auto-ajuste LIFO de paymentLines pra match um novo total.
 *
 * Audit 2026-05-21 — sênior administração/varejo: lojista de balcão NÃO
 * quer fazer matemática. Quando o total muda (item adicionado, qty,
 * desconto, acréscimo), o valor da forma de pagamento auto-ajusta pra
 * fechar a conta. Estratégia LIFO — desconta/adiciona da ÚLTIMA linha
 * primeiro (foi a última coisa que o lojista preencheu, ajuste vem por
 * lá com menor surpresa). Se zera, propaga pra anterior.
 *
 * NÃO mexe em cashReceivedInput (valor recebido em dinheiro) — esse o
 * lojista digitou separadamente quando cliente entregou cédula. Troco
 * recalcula sozinho.
 *
 * Pure function — chamada via useEffect que dispara só quando
 * totalInCents OU creditAmountInCents mudam. Como setPaymentLines NÃO
 * muda total/credit, não há loop infinito.
 */
function rebalancePaymentLines(
  newTotal: number,
  creditAmount: number,
  lines: PaymentLineState[],
): PaymentLineState[] {
  // Valor que deve estar em payments[] (excluído fiado parcial).
  const targetSum = Math.max(0, newTotal - creditAmount);
  const currentSum = lines.reduce(
    (acc, l) => acc + (inputToCents(l.amountInput) ?? 0),
    0,
  );
  const delta = targetSum - currentSum;
  if (delta === 0) return lines;
  if (lines.length === 0) return lines;

  const next = lines.map((l) => ({ ...l }));
  let remaining = delta;

  // LIFO: ajusta da última pra primeira linha.
  for (let i = next.length - 1; i >= 0; i--) {
    if (remaining === 0) break;
    const current = inputToCents(next[i].amountInput) ?? 0;
    const desired = current + remaining;
    if (desired >= 0) {
      // Cabe na linha — set e termina.
      next[i].amountInput = desired === 0 ? "" : centsToInput(desired);
      remaining = 0;
    } else {
      // delta negativo grande — zera linha atual e propaga restante.
      next[i].amountInput = "";
      remaining = desired; // ainda negativo, propaga pra próxima iter.
    }
  }
  return next;
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
  // Sprint 4C — saldo a virar fiado dentro de mode='sale'. String BRL pro
  // input ("100,00"); conversão pra cents no submit. Vazio = sem fiado.
  const [creditAmountInput, setCreditAmountInput] = useState("");
  // Redesign PDV — dialog modal pra escolher produtos. Substitui o picker
  // inline da coluna esquerda. Lojista clica "+ Adicionar produto" no
  // carrinho, escolhe N itens com checkbox, confirma → vão pro cart.
  const [pickerOpen, setPickerOpen] = useState(false);
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
  // Sprint 3.2 — notas internas do cliente vinculado. Renderiza badge
  // "📝 anotação" no card. Set quando onPick recebe hit com notes.
  const [customerNotes, setCustomerNotes] = useState<string | null>(null);
  // Sprint 5.4 — tier de pricing do grupo do cliente. 'wholesale' faz
  // addToCart usar product.wholesalePriceInCents quando disponível.
  // Items JÁ no carrinho não são recalculados (ver toast no onPick) —
  // lojista re-adiciona se quiser ajustar.
  const [customerPricingTier, setCustomerPricingTier] = useState<
    "regular" | "wholesale" | null
  >(null);
  const [customerGroupLabel, setCustomerGroupLabel] = useState<string | null>(
    null,
  );
  // Venda rápida (Frente A.2): nome/tel direto no order, sem cadastro de
  // customer. Só usados quando customerId === null.
  const [walkInName, setWalkInName] = useState<string>("");
  const [walkInPhone, setWalkInPhone] = useState<string>("");
  const [isSubmitting, startSubmit] = useTransition();
  const [lastSale, setLastSale] = useState<LastSale | null>(null);

  // Subtotal LÍQUIDO de descontos por linha. O subtotal bruto (sem
  // item discounts) é exposto separado pra UI mostrar breakdown
  // "Subtotal bruto → descontos por item → subtotal líquido".
  const subtotalGrossInCents = useMemo(
    () => cart.reduce((s, it) => s + it.priceInCents * it.quantity, 0),
    [cart],
  );
  const itemDiscountsTotalInCents = useMemo(
    () => cart.reduce((s, it) => s + (it.discountInCents ?? 0), 0),
    [cart],
  );
  const subtotalInCents = subtotalGrossInCents - itemDiscountsTotalInCents;

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
  // Sprint 4C — saldo a virar fiado (creditAmountInCents). Conta na soma
  // do total (paymentsSum + creditAmount === total) e na quantia restante.
  const creditAmountInCents = inputToCents(creditAmountInput) ?? 0;
  const paymentsRemainingInCents =
    totalInCents - paymentsSumInCents - creditAmountInCents;
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

  // Audit 2026-05-21 — auto-ajuste do valor da forma de pagamento ao
  // mudar totalInCents (cart/desconto/acréscimo) ou creditAmountInCents
  // (fiado parcial). Lojista de balcão não precisa refazer matemática:
  // o sistema fecha a conta sozinho via LIFO (rebalancePaymentLines).
  //
  // Dep array intencionalmente SÓ [totalInCents, creditAmountInCents] —
  // se entrasse paymentLines no array, viraria loop (setPaymentLines
  // dispara o effect que chama setPaymentLines de novo). Como total/credit
  // NÃO derivam de paymentLines, mudar paymentLines não retriggera
  // o effect → comportamento estável.
  useEffect(() => {
    setPaymentLines((prev) =>
      rebalancePaymentLines(totalInCents, creditAmountInCents, prev),
    );
     
  }, [totalInCents, creditAmountInCents]);

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

  // Sprint 5.4 — quando o cliente vinculado é tier 'wholesale' E o
  // produto tem wholesalePriceInCents cadastrado, substitui o preço
  // efetivo. Variante NÃO tem campo wholesale (decisão atual: tier é
  // a nível produto). Fallback: se cliente é atacado mas produto não
  // tem preço atacado, mantém o preço normal (lojista sabe — ou ajusta
  // depois com desconto manual).
  const applyPricingTier = useCallback(
    (product: PdvProductHit, fallbackPrice: number): number => {
      if (
        customerPricingTier === "wholesale" &&
        product.wholesalePriceInCents !== null &&
        product.wholesalePriceInCents > 0
      ) {
        return product.wholesalePriceInCents;
      }
      return fallbackPrice;
    },
    [customerPricingTier],
  );

  const addToCart = useCallback(
    (
      product: PdvProductHit,
      variant: PdvProductVariantHit | null,
      effectivePrice: number,
    ) => {
      // Sprint 5.4 — aplica tier ANTES de inserir no carrinho.
      const finalPrice = applyPricingTier(product, effectivePrice);
      // Audit 2026-05-21 — limpa banner "Venda registrada" da venda
      // ANTERIOR ao começar a próxima venda. Antes, lojista finalizava,
      // adicionava produto novo e ainda via "Total R$ X" da venda
      // anterior por cima do carrinho atual. Confuso.
      setLastSale(null);
      setCart((prev) => {
        const trackStock = variant?.trackStock ?? product.trackStock;
        const stockQuantity =
          variant?.stockQuantity ?? product.stockQuantity;
        const existing = prev.find(
          (it) =>
            it.productId === product.id &&
            it.variantId === (variant?.id ?? null),
        );
        if (existing) {
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
        // Audit 2026-05-21 — primeiro add também precisa checar stock.
        // Antes, o check só rodava quando o item já existia no carrinho
        // (path "existing"). Item esgotado escapava no primeiro add e
        // só o servidor pegava com OUT_OF_STOCK. UX melhor rejeitar
        // antes da venda inteira ser montada.
        if (trackStock && stockQuantity !== null && stockQuantity < 1) {
          toast.error(
            stockQuantity === 0
              ? "Produto sem estoque."
              : `Estoque insuficiente — só tem ${stockQuantity}.`,
          );
          return prev;
        }
        return [
          ...prev,
          {
            productId: product.id,
            variantId: variant?.id ?? null,
            productName: product.name,
            variantName: variant?.name ?? null,
            priceInCents: finalPrice,
            quantity: 1,
            thumbUrl: product.thumbUrl,
            trackStock,
            stockQuantity,
            discountInCents: null,
          },
        ];
      });
    },
    [applyPricingTier],
  );

  // Redesign — adapter do ProductPickerDialog. Cada item selecionado
  // entra como qty=1; ajuste fino no carrinho. Reusa addToCart pra
  // herdar lógica de stock check + merge de duplicatas.
  const addItemsFromPicker = useCallback(
    (items: PickerSelection[]) => {
      for (const it of items) {
        addToCart(it.product, it.variant, it.effectivePrice);
      }
    },
    [addToCart],
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

  /**
   * Define desconto da linha (Fase 4). `discountInCents = null` ou 0 limpa.
   * Server faz validação final (CHECK constraint + action), aqui só clamp
   * defensivo no UI pra evitar request rejeitado por valor negativo OU
   * acima do bruto da linha.
   */
  const updateItemDiscount = (idx: number, discountInCents: number | null) => {
    setCart((prev) => {
      const item = prev[idx];
      if (!item) return prev;
      const lineGross = item.priceInCents * item.quantity;
      let clamped: number | null = discountInCents;
      if (clamped !== null) {
        if (clamped <= 0) clamped = null;
        else if (clamped > lineGross) clamped = lineGross;
      }
      return prev.map((it, i) =>
        i === idx ? { ...it, discountInCents: clamped } : it,
      );
    });
  };

  const reset = useCallback(() => {
    setCart([]);
    setPaymentLines([makeDefaultPaymentLine()]);
    setCreditAmountInput("");
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

  // Sprint 1A + Sprint 4C — canSubmit cobre pagamento dividido + saldo fiado:
  //   - carrinho não vazio + não está submetendo + desconto válido
  //   - paymentsSum + creditAmount === total
  //   - todas as linhas válidas (amount > 0; cash com recv não pode ser < amount)
  //   - se creditAmount > 0: customerId obrigatório
  //   - se creditAmount === total: payments vazio é OK (caminho 100% fiado);
  //     senão, payments não pode estar vazio
  const hasCreditAmount = creditAmountInCents > 0;
  const isFullyOnCredit = creditAmountInCents === totalInCents && totalInCents > 0;
  const paymentsValidForCheckout = isFullyOnCredit
    ? true
    : paymentLinesAllValid &&
      paymentLines.length > 0 &&
      paymentLines.length <= MAX_PAYMENT_LINES;

  const canSubmit =
    cart.length > 0 &&
    !isSubmitting &&
    discountInCents <= subtotalInCents &&
    paymentsValidForCheckout &&
    paymentsSumInCents + creditAmountInCents === totalInCents &&
    (!hasCreditAmount || !!customerId);

  const handleSubmit = () => {
    if (cart.length === 0) {
      toast.error("Adicione pelo menos um item.");
      return;
    }
    if (discountInCents > subtotalInCents) {
      toast.error("Desconto maior que o subtotal.");
      return;
    }
    // Sprint 4C — quando NÃO é 100% fiado, payments[] é obrigatório.
    if (!isFullyOnCredit) {
      if (paymentLines.length === 0) {
        toast.error("Adicione pelo menos uma forma de pagamento.");
        return;
      }
      if (!paymentLinesAllValid) {
        toast.error("Linha de pagamento inválida — confira valores e troco.");
        return;
      }
    }
    if (paymentsSumInCents + creditAmountInCents !== totalInCents) {
      const diff = totalInCents - paymentsSumInCents - creditAmountInCents;
      toast.error(
        diff > 0
          ? `Falta R$ ${(diff / 100).toFixed(2)} (pagamento + fiado abaixo do total).`
          : `Sobra R$ ${(Math.abs(diff) / 100).toFixed(2)} (pagamento + fiado acima do total).`,
      );
      return;
    }
    if (hasCreditAmount && !customerId) {
      toast.error("Selecione um cliente para registrar o saldo a fiado.");
      return;
    }

    // Quando 100% fiado, mande payments=[] (ações suporta isso pelo
    // creditAmountInCents). Caso contrário, mande as linhas digitadas.
    const payloadPayments = isFullyOnCredit
      ? []
      : paymentLines.map((line) => ({
          method: line.method,
          amountInCents: inputToCents(line.amountInput) ?? 0,
          cashReceivedInCents:
            line.method === "cash" ? inputToCents(line.cashReceivedInput) : null,
          notes: line.method === "other" ? line.notes.trim() || null : null,
        }));

    const payload: CreateBalcaoSaleInput = {
      items: cart.map((it) => ({
        productId: it.productId,
        variantId: it.variantId,
        quantity: it.quantity,
        discountInCents: it.discountInCents,
      })),
      customerId,
      walkInName: customerId ? null : walkInName.trim() || null,
      walkInPhone: customerId ? null : walkInPhone.trim() || null,
      payments: payloadPayments,
      creditAmountInCents:
        creditAmountInCents > 0 ? creditAmountInCents : null,
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
        discountInCents: it.discountInCents,
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
        discountInCents: it.discountInCents,
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

      // Audit 2026-05-21 — F-keys (F2/F3/F4/F8/F9) DEVEM skipar quando o
      // foco está num sub-dialog (ProductPicker, QuickSale, FullCreate).
      // Antes, F4 podia disparar handleSubmit enquanto picker tava aberto
      // → state inconsistente (selecionados não confirmados). Estratégia:
      // o modal "Nova Venda" tem data-pdv-modal="true"; F-keys disparam
      // dentro dele OU fora de modais. Sub-dialogs sem esse marker bloqueiam.
      const isFkey = ["F2", "F3", "F4", "F8", "F9"].includes(e.key);
      if (isFkey) {
        const ae = document.activeElement;
        const closestModal = ae?.closest(
          '[role="dialog"][data-state="open"]',
        );
        // Se foco está num dialog que NÃO é o modal Nova Venda, abortar.
        // Quando PdvShell está standalone (/admin/pdv), closestModal=null
        // → handler segue. Quando dentro do modal Nova Venda,
        // closestModal=esse modal (tem data-pdv-modal) → handler segue.
        // Quando dentro de sub-dialog (picker etc), closestModal=picker
        // (sem data-pdv-modal) → handler aborta.
        if (
          closestModal &&
          !closestModal.hasAttribute("data-pdv-modal")
        ) {
          return;
        }
      }

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
          // Atalho de desconto: foca o input R$ (não o %). Audit 2026-05-21
          // — F9 SEMPRE foca o campo em R$ pra evitar confusão "digitei
          // achando reais mas estava em %".
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
    <div className="flex h-[calc(100vh-4rem)] flex-col lg:h-[calc(100vh-2.5rem)]">
      {/* Layout 2-col (rebalance 2026-05-21 audit). Coluna ESQUERDA
          empilha Cliente + Search + Carrinho. Coluna DIREITA é o
          painel de Pagamento — ocupa do TOPO do modal até o final,
          alinhado com a linha de Cliente do outro lado. Cliente fica
          flush com o carrinho abaixo (mesma largura de coluna), sem
          deslocamento horizontal. Proporção 1:1.1 — pagamento ligeiramente
          maior porque é onde lojista gasta mais tempo. */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 lg:grid-cols-[1fr_1.1fr]">
        {/* ─── Coluna esquerda: Cliente + Search + Cart ─── */}
        <div className="flex min-h-0 flex-col gap-2">
          {/* Cliente — linha fina no topo da coluna esquerda */}
          <div className="b3-card shrink-0">
            <CustomerComboboxLight
              customerId={customerId}
              customerLabel={customerLabel}
              customerNotes={customerNotes}
              customerGroupLabel={customerGroupLabel}
              customerPricingTier={customerPricingTier}
              walkInName={walkInName}
              walkInPhone={walkInPhone}
              setWalkInName={setWalkInName}
              setWalkInPhone={setWalkInPhone}
              onPick={(c) => {
                setCustomerId(c?.id ?? null);
                setCustomerLabel(c ? `${c.name} · ${c.phone}` : "");
                setCustomerNotes(c?.notes ?? null);
                // Sprint 5.4 — pricing tier do grupo. Quando cliente é
                // de grupo 'wholesale' E carrinho já tem itens, avisa
                // que itens novos virão em preço atacado (existentes
                // ficam como estão; lojista reposiciona se quiser).
                const tier = c?.groupPricingTier ?? null;
                setCustomerPricingTier(tier);
                setCustomerGroupLabel(c?.groupName ?? null);
                if (tier === "wholesale" && cart.length > 0) {
                  toast.info(
                    "Cliente atacado vinculado — novos itens virão em preço de atacado. Os itens atuais ficam no preço original.",
                  );
                }
                if (c) {
                  setWalkInName("");
                  setWalkInPhone("");
                }
              }}
            />
          </div>

          {/* Carrinho: search bar + lista de items (scroll interno) */}
          <section className="b3-card flex min-h-0 flex-1 flex-col overflow-hidden">
            <CartToolbar
              onScanResult={(hit) => {
                const effectivePrice = getEffectivePrice({
                  basePriceInCents: hit.basePriceInCents,
                  promoPriceInCents: hit.promoPriceInCents,
                  promoStartsAt: hit.promoStartsAt,
                  promoEndsAt: hit.promoEndsAt,
                });
                addToCart(hit, null, effectivePrice);
              }}
              onOpenPicker={() => setPickerOpen(true)}
              cartCount={cart.length}
            />

            {/* Lista de items — scroll interno */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              <CartPanel
              items={cart}
              updateQty={updateQty}
              updateItemDiscount={updateItemDiscount}
              removeItem={removeItem}
              onOpenPicker={() => setPickerOpen(true)}
            />
          </div>
        </section>
        </div>
        {/* fim da coluna esquerda */}

        {/* ─── Coluna direita: Pagamento + Total + Finalizar ───
            Ocupa do topo do modal até o final, alinhada com Cliente
            do outro lado. Painel inteiro num único card branco. */}
        <aside className="b3-card flex min-h-0 flex-col overflow-hidden">
          {/* Pagamento scroll interno */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {cart.length > 0 ? (
              <PaymentSection
                paymentLines={paymentLines}
                setPaymentLines={setPaymentLines}
                totalInCents={totalInCents}
                paymentsSumInCents={paymentsSumInCents}
                paymentsRemainingInCents={paymentsRemainingInCents}
                troco={troco}
                creditAmountInput={creditAmountInput}
                setCreditAmountInput={setCreditAmountInput}
                creditAmountInCents={creditAmountInCents}
                hasCustomerSelected={customerId !== null}
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
            ) : (
              <div className="text-ink-4 flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-xs">
                <span>Adicione produtos pra ver as formas de pagamento.</span>
              </div>
            )}
          </div>

          {/* Footer — total + botões SEMPRE visíveis. Densificação
              2026-05-21: padding p-3→p-2.5, mb-2→mb-1.5, total
              text-[22px]→text-[19px] (menos "grosso"), breakdown
              text-[11px]→text-[10.5px], banner lastSale menor. */}
          <div className="border-line bg-bg-app shrink-0 border-t p-2.5">
            {lastSale ? (
              <div className="border-brand-line bg-brand-wash mb-1.5 rounded-md border p-2">
                <div className="text-brand text-[10.5px] font-bold uppercase tracking-[0.06em]">
                  Venda registrada
                </div>
                <div className="text-ink-2 mt-0.5 text-[11.5px]">
                  Total {formatBRL(lastSale.totalInCents)}
                </div>
                <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    className="b3-btn b3-btn--sm h-8"
                    onClick={() => setLastSale(null)}
                  >
                    Nova venda
                  </button>
                  {lastSale.publicToken ? (
                    <button
                      type="button"
                      className="b3-btn b3-btn--sm b3-btn--cta h-8"
                      onClick={() => {
                        window.open(
                          `/admin/pdv/recibo/${lastSale.publicToken}`,
                          "_blank",
                          "noopener,noreferrer",
                        );
                      }}
                    >
                      Imprimir
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-ink-1 text-[12.5px] font-semibold">Total</span>
              <span
                className={cn(
                  "mono text-[19px] font-bold tracking-[-0.02em]",
                  cart.length === 0 ? "text-ink-4" : "text-ink-1",
                )}
              >
                {formatBRL(totalInCents)}
              </span>
            </div>
            {itemDiscountsTotalInCents > 0 ||
            discountInCents > 0 ||
            surchargeInCents > 0 ? (
              <div className="text-ink-4 mb-1.5 space-y-0 text-[10.5px] leading-snug">
                {/* Subtotal BRUTO antes de qualquer desconto. Só aparece se
                    houver descontos pra evitar redundância com Subtotal líquido. */}
                {itemDiscountsTotalInCents > 0 ? (
                  <div className="flex justify-between">
                    <span>Subtotal bruto</span>
                    <span className="mono">
                      {formatBRL(subtotalGrossInCents)}
                    </span>
                  </div>
                ) : null}
                {/* Soma dos descontos por linha (cada item editou individualmente) */}
                {itemDiscountsTotalInCents > 0 ? (
                  <div className="flex justify-between">
                    <span>Descontos por item</span>
                    <span className="mono text-mangos-orange">
                      −{formatBRL(itemDiscountsTotalInCents)}
                    </span>
                  </div>
                ) : null}
                {/* Subtotal LÍQUIDO de item discounts (entrada do desconto geral) */}
                <div className="flex justify-between">
                  <span>
                    {itemDiscountsTotalInCents > 0
                      ? "Subtotal líquido"
                      : "Subtotal"}
                  </span>
                  <span className="mono">{formatBRL(subtotalInCents)}</span>
                </div>
                {discountInCents > 0 ? (
                  <div className="flex justify-between">
                    <span>Desconto geral</span>
                    <span className="mono text-danger">
                      −{formatBRL(discountInCents)}
                    </span>
                  </div>
                ) : null}
                {surchargeInCents > 0 ? (
                  <div className="flex justify-between">
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
                "b3-btn b3-btn--cta h-10 w-full",
                !canSubmit && "cursor-not-allowed opacity-50",
              )}
            >
              {isSubmitting
                ? "Registrando…"
                : cart.length === 0
                  ? "Adicione produtos pra finalizar"
                  : "Finalizar venda (F4)"}
            </button>

            {/* Salvar como orçamento + Lançar como fiado — lado a lado */}
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              <button
                type="button"
                disabled={cart.length === 0 || isSubmitting}
                onClick={handleSubmitQuote}
                className={cn(
                  "b3-btn h-8 text-[11.5px]",
                  (cart.length === 0 || isSubmitting) &&
                    "cursor-not-allowed opacity-50",
                )}
              >
                Orçamento
              </button>
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
                  "b3-btn h-8 text-[11.5px]",
                  (cart.length === 0 || isSubmitting || !customerId) &&
                    "cursor-not-allowed opacity-50",
                )}
              >
                Fiado
              </button>
            </div>

            {cart.length > 0 ? (
              <button
                type="button"
                onClick={reset}
                className="text-ink-4 hover:text-ink-1 mt-1.5 w-full text-[11px]"
              >
                Limpar venda
              </button>
            ) : null}
          </div>
        </aside>
      </div>

      {/* Picker dialog — substitui a coluna esquerda inteira */}
      <ProductPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onAdd={addItemsFromPicker}
      />

      {/* FKeys discreta no rodapé */}
      <div className="shrink-0">
        <FKeysLegend />
      </div>
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


/**
 * Toolbar fina no topo do CartPanel — Redesign PDV:
 * - Input GTIN scanner (compacto, focável via F2)
 * - Botão "+ Adicionar produto" que abre o ProductPickerDialog
 * - Contador "X itens" à direita
 *
 * Scanner busca direto via searchProductsForPdv. Match exato em
 * GTIN + 1 hit + sem variantes → adiciona automático e limpa input.
 * Outros casos → toast pra usar o picker.
 */
function CartToolbar({
  onScanResult,
  onOpenPicker,
  cartCount,
}: {
  onScanResult: (hit: PdvProductHit) => void;
  onOpenPicker: () => void;
  cartCount: number;
}) {
  const [scanValue, setScanValue] = useState("");
  const [scanning, setScanning] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const trimmed = scanValue.trim();
    if (!trimmed) return;
    setScanning(true);
    void searchProductsForPdv(trimmed)
      .then((hits) => {
        // Match exato GTIN + sem variantes → adiciona direto.
        const exact = hits.find(
          (h) => h.gtin === trimmed && h.variants.length === 0,
        );
        if (exact) {
          onScanResult(exact);
          setScanValue("");
          return;
        }
        // Senão: abre picker com hint pra escolher manualmente.
        toast.info(
          hits.length === 0
            ? "Nada encontrado. Use 'Adicionar produto' pra buscar."
            : "Múltiplos resultados — abrindo busca completa.",
        );
        onOpenPicker();
      })
      .catch((err) => {
        logger.error("admin.pdv.scanner_search_failed", { err });
        toast.error("Não foi possível buscar o código.", {
          description: "Verifique a conexão e tente novamente.",
        });
      })
      .finally(() => {
        setScanning(false);
      });
  };

  return (
    // Fundo cinza sidebar (audit 2026-05-21) — destaca a área de "ações
    // rápidas" (busca + adicionar) do resto do card branco do carrinho.
    // Input dentro fica em branco (bg-surface) contrastando com o cinza
    // ao redor. Badge F2 vira branco pra ficar legível sobre o cinza.
    <div className="border-line flex shrink-0 items-center gap-2 border-b bg-[var(--mangos-side-bg)] px-3 py-2">
      <div className="relative flex-1">
        <ScanBarcodeIcon
          aria-hidden
          size={14}
          className="text-ink-4 pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
        />
        <input
          id="pdv-product-search"
          autoFocus
          value={scanValue}
          onChange={(e) => setScanValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Bipe código (Enter)"
          disabled={scanning}
          className="border-line focus:border-brand bg-surface h-9 w-full rounded-md border pr-12 pl-9 text-[13px] outline-none transition"
        />
        <span className="mono bg-surface text-ink-4 border-line absolute top-1/2 right-2 -translate-y-1/2 rounded border px-1.5 py-[1px] text-[10px]">
          F2
        </span>
      </div>
      <button
        type="button"
        onClick={onOpenPicker}
        className="b3-btn b3-btn--cta h-9 shrink-0 text-[12.5px]"
      >
        <PlusIcon size={13} />
        Adicionar produto
      </button>
      <div className="text-ink-4 hidden shrink-0 text-[11px] sm:block">
        {cartCount === 0 ? (
          "Carrinho vazio"
        ) : (
          <>
            <strong className="text-ink-1">{cartCount}</strong>{" "}
            {cartCount === 1 ? "item" : "itens"}
          </>
        )}
      </div>
    </div>
  );
}

function CartPanel({
  items,
  updateQty,
  updateItemDiscount,
  removeItem,
  onOpenPicker,
}: {
  items: CartItem[];
  updateQty: (idx: number, delta: number) => void;
  updateItemDiscount: (idx: number, discountInCents: number | null) => void;
  removeItem: (idx: number) => void;
  onOpenPicker: () => void;
}) {
  // Desconto per-item escondido por padrão atrás de um ícone "%" por linha
  // (rebalance 2026-05-21 — conselho dos 5 agentes). Decisão sênior de
  // PDV: 90% das vendas balcão não usam desconto por item; quando o
  // lojista quer dar, clica no "%" da linha e o input expande embaixo.
  // Set indexado por `productId-variantId` (estável a reordenações) em
  // vez de índice numérico do array (que muda quando o lojista remove
  // itens). Limpa quando carrinho zera.
  const itemKey = (it: CartItem) =>
    `${it.productId}-${it.variantId ?? "p"}`;
  const [discountOpen, setDiscountOpen] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (items.length === 0 && discountOpen.size > 0) {
      setDiscountOpen(new Set());
    }
  }, [items.length, discountOpen.size]);

  const toggleDiscountRow = (key: string) => {
    setDiscountOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (items.length === 0) {
    return (
      <div className="text-ink-4 flex h-full flex-col items-center justify-center gap-3 p-10 text-center">
        <span className="bg-bg-app inline-flex size-[60px] items-center justify-center rounded-full">
          <ShoppingBagIcon size={26} />
        </span>
        <div>
          <div className="text-ink-2 text-sm font-semibold">
            Carrinho vazio
          </div>
          <div className="text-ink-4 mt-1 text-xs">
            Bipe um código ou
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenPicker}
          className="b3-btn b3-btn--cta mt-1"
        >
          <PlusIcon size={13} />
          Adicionar produto
        </button>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────────
  // Carrinho estilo planilha — 5 colunas (rebalance 2026-05-21).
  //
  // Header: PRODUTO · QTD · PREÇO UN · SUBTOTAL · (ações)
  // Ações: botão "%" (toggle de desconto da linha) + "×" (remover).
  // Sub-row de desconto aparece EMBAIXO da linha quando lojista clica
  // no "%". Default colapsado = 90% das vendas não usa per-item.
  // Quando desconto > 0, o "%" fica destacado em mangos-orange como
  // sinalização permanente de que há desconto aplicado ali.
  //
  // Mobile (< lg): mantém layout denso flex-wrap.
  // ──────────────────────────────────────────────────────────────────
  const GRID_TEMPLATE = "lg:grid-cols-[1fr_92px_88px_104px_64px]";

  return (
    <>
      {/* Header da "planilha" — só em lg+. Sticky pra não sumir no scroll. */}
      <div
        aria-hidden
        className={cn(
          "border-line bg-bg-app sticky top-0 z-10 hidden border-b lg:grid",
          GRID_TEMPLATE,
          "gap-2 px-3 py-2",
          "text-ink-4 text-[10px] font-bold uppercase tracking-[0.06em]",
        )}
      >
        <span>Produto</span>
        <span className="text-center">Qtd</span>
        <span className="text-right">Preço un.</span>
        <span className="text-right">Subtotal</span>
        <span />
      </div>

      <ul className="divide-line divide-y">
        {items.map((it, idx) => {
          const key = itemKey(it);
          const lineGross = it.priceInCents * it.quantity;
          const lineDiscount = it.discountInCents ?? 0;
          const lineNet = lineGross - lineDiscount;
          const hasDiscount = lineDiscount > 0;
          const showDiscountInput = discountOpen.has(key);
          return (
            <li
              key={key}
              className={cn(
                "hover:bg-bg-app/40 transition",
                hasDiscount && "bg-mangos-cream-soft/40",
              )}
            >
              {/* Linha principal — 5 cols em lg+, flex denso em mobile. */}
              <div
                className={cn(
                  "px-3 py-2 flex flex-wrap items-center gap-2",
                  "lg:grid",
                  GRID_TEMPLATE,
                  "lg:gap-2",
                )}
              >
                {/* Produto: thumb + nome */}
                <div className="flex min-w-0 flex-1 items-center gap-2 lg:flex-initial">
                  <div className="bg-bg-app size-9 shrink-0 overflow-hidden rounded">
                    {it.thumbUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={it.thumbUrl}
                        alt={it.productName}
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center">
                        <PackageIcon className="text-ink-4 size-3.5" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-ink-1 truncate text-[13px] font-medium">
                      {it.productName}
                      {it.variantName ? (
                        <span className="text-ink-4 ml-1.5 font-normal">
                          · {it.variantName}
                        </span>
                      ) : null}
                    </p>
                    {/* Preço un na linha mobile (em desktop fica em coluna própria) */}
                    <p className="text-ink-4 mono text-[11px] lg:hidden">
                      {formatBRL(it.priceInCents)} cada
                    </p>
                  </div>
                </div>

                {/* Qty stepper */}
                <div className="flex shrink-0 items-center justify-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => updateQty(idx, -1)}
                    className="text-ink-2 hover:bg-bg-app size-6 rounded transition"
                    aria-label="Diminuir"
                  >
                    <MinusIcon className="mx-auto size-3" />
                  </button>
                  <span className="w-7 text-center text-[13px] font-medium tabular-nums">
                    {it.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateQty(idx, 1)}
                    className="text-ink-2 hover:bg-bg-app size-6 rounded transition"
                    aria-label="Aumentar"
                  >
                    <PlusIcon className="mx-auto size-3" />
                  </button>
                </div>

                {/* Preço un. — só desktop (mobile mostra abaixo do nome) */}
                <span className="mono hidden text-right text-[12.5px] tabular-nums text-ink-2 lg:inline">
                  {formatBRL(it.priceInCents)}
                </span>

                {/* Subtotal (líquido) + label "−R$ X" laranja quando há desconto */}
                <div className="shrink-0 text-right">
                  <span className="mono text-ink-1 text-[13px] font-semibold tabular-nums">
                    {formatBRL(lineNet)}
                  </span>
                  {hasDiscount ? (
                    <div className="text-mangos-orange mono text-[10.5px] tabular-nums">
                      −{formatBRL(lineDiscount)}
                    </div>
                  ) : null}
                </div>

                {/* Ações: % (toggle desconto da linha) + × (remover) */}
                <div className="flex shrink-0 items-center justify-end gap-0.5">
                  <button
                    type="button"
                    onClick={() => toggleDiscountRow(key)}
                    aria-expanded={showDiscountInput}
                    aria-label={
                      hasDiscount
                        ? "Editar desconto da linha"
                        : "Aplicar desconto na linha"
                    }
                    title={
                      hasDiscount
                        ? "Editar desconto desta linha"
                        : "Aplicar desconto nesta linha"
                    }
                    className={cn(
                      "inline-flex size-6 items-center justify-center rounded transition",
                      hasDiscount
                        ? "bg-mangos-orange/12 text-mangos-orange hover:bg-mangos-orange/20"
                        : "text-ink-4 hover:bg-bg-app hover:text-ink-2",
                    )}
                  >
                    <PercentIcon className="size-3" strokeWidth={2.2} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    aria-label="Remover item"
                    title="Remover item"
                    className="text-ink-4 hover:text-danger inline-flex size-6 items-center justify-center rounded transition hover:bg-bg-app"
                  >
                    <Trash2Icon className="size-3.5" />
                  </button>
                </div>
              </div>

              {/* Sub-row de desconto — aparece quando lojista clica no "%".
                  Fica visualmente "encostada" na linha pai via borda lateral
                  amarela mangos e fundo creme suave. Apenas o input
                  DiscountCell + label + botão "Pronto" pra fechar. */}
              {showDiscountInput ? (
                <div
                  className={cn(
                    "border-l-2 border-mangos-yellow bg-mangos-cream-soft",
                    "flex items-center gap-3 px-3 py-2 pl-[44px]",
                    "border-b border-b-line/50",
                  )}
                >
                  <span className="text-ink-4 text-[11px] font-medium uppercase tracking-wide">
                    Desconto nesta linha
                  </span>
                  <div className="w-[120px]">
                    <DiscountCell
                      lineGross={lineGross}
                      discountInCents={it.discountInCents}
                      onChange={(cents) => updateItemDiscount(idx, cents)}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleDiscountRow(key)}
                    className="text-ink-4 hover:text-ink-1 ml-auto text-[12px] font-medium transition"
                  >
                    Pronto
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </>
  );
}

function DiscountCell({
  lineGross,
  discountInCents,
  onChange,
}: {
  /** Subtotal bruto da linha (priceInCents × quantity) — pra calcular % */
  lineGross: number;
  /** Valor atual em cents. null = sem desconto. */
  discountInCents: number | null;
  /** Callback ao mudar — null limpa, número é cents validados (clamped no PdvShell). */
  onChange: (cents: number | null) => void;
}) {
  // Mode controla o formato do input: '%' digita percentual, 'amount' digita R$.
  // Source of truth é sempre cents (vem do parent). Toggle muda só a interpretação.
  const [mode, setMode] = useState<"pct" | "amount">("pct");
  // Display local pra preservar o que o lojista digitou (ex: "10,5" enquanto
  // ele ainda não terminou). Sincroniza quando o parent muda OU o modo muda.
  const [display, setDisplay] = useState<string>("");

  // Reconcile display ↔ discountInCents quando o modo muda ou o parent atualiza.
  // Usa ref pra não re-renderizar em loop quando o setDisplay dispara.
  const lastSeenRef = useRef<{ cents: number | null; mode: "pct" | "amount" }>({
    cents: discountInCents,
    mode,
  });
  useEffect(() => {
    const last = lastSeenRef.current;
    const centsChanged = last.cents !== discountInCents;
    const modeChanged = last.mode !== mode;
    if (!centsChanged && !modeChanged) return;
    lastSeenRef.current = { cents: discountInCents, mode };
    if (discountInCents === null || discountInCents === 0) {
      setDisplay("");
      return;
    }
    if (mode === "pct") {
      const pct = (discountInCents / lineGross) * 100;
      // 1 casa decimal; sem zero à direita ("10" em vez de "10,0")
      const formatted = pct.toFixed(1).replace(/\.0$/, "").replace(".", ",");
      setDisplay(formatted);
    } else {
      setDisplay((discountInCents / 100).toFixed(2).replace(".", ","));
    }
  }, [discountInCents, lineGross, mode]);

  const handleInput = (raw: string) => {
    // Aceita só dígitos, vírgula e ponto. Limpa outros chars.
    const cleaned = raw.replace(/[^\d.,]/g, "");
    setDisplay(cleaned);
    const parsed = parseFloat(cleaned.replace(",", "."));
    if (!isFinite(parsed) || parsed <= 0) {
      onChange(null);
      return;
    }
    if (mode === "pct") {
      // % → cents (round-to-nearest pra não perder centavo)
      const cents = Math.round((parsed / 100) * lineGross);
      onChange(cents);
    } else {
      const cents = Math.round(parsed * 100);
      onChange(cents);
    }
  };

  const toggleMode = () => {
    setMode((m) => (m === "pct" ? "amount" : "pct"));
  };

  return (
    <div className="relative flex items-center">
      <input
        type="text"
        inputMode="decimal"
        value={display}
        onChange={(e) => handleInput(e.target.value)}
        placeholder={mode === "pct" ? "0" : "0,00"}
        aria-label={
          mode === "pct" ? "Desconto em porcentagem" : "Desconto em reais"
        }
        className={cn(
          "b3-input mono tabular-nums",
          "h-7 w-full pr-8 text-right text-[12px]",
        )}
      />
      <button
        type="button"
        onClick={toggleMode}
        className={cn(
          "absolute right-1 rounded px-1.5 py-0.5 text-[10px] font-bold",
          "text-ink-4 hover:bg-bg-app hover:text-ink-1 transition",
        )}
        title={
          mode === "pct"
            ? "Mudar pra valor em R$"
            : "Mudar pra porcentagem"
        }
        aria-label="Trocar entre % e R$"
      >
        {mode === "pct" ? "%" : "R$"}
      </button>
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
  creditAmountInput,
  setCreditAmountInput,
  creditAmountInCents,
  hasCustomerSelected,
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
  creditAmountInput: string;
  setCreditAmountInput: (v: string) => void;
  creditAmountInCents: number;
  hasCustomerSelected: boolean;
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
  // Audit 2026-05-21 — densificado: h-9→h-8, text-[13px]→text-[12.5px]
  // pra caber sem scroll quando Mais opções expandido.
  const inputCls =
    "border-line bg-surface focus:border-brand h-8 w-full rounded-[8px] border px-3 text-[12.5px] outline-none transition";

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
    <div className="space-y-2.5 p-3">
      {/* Layout 2-col interno (audit 2026-05-21): Pagamento esquerda
          (1fr) + Desconto direita (200px) lado a lado. Densificação
          sênior: paddings menores, labels 10px, gaps mínimos — tudo
          cabe sem scroll mesmo com Mais opções expandido. */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_200px]">
        {/* ─── Coluna esquerda: Pagamento (forma + valor + recebido) ─── */}
        <div className="flex flex-col gap-1.5">
          <div className="text-ink-4 text-[10px] font-bold uppercase tracking-[0.06em]">
            Pagamento
          </div>

          {/* Lista de linhas de pagamento (Sprint 1A) */}
          <div className="flex flex-col gap-1.5">
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
              className="rounded-[8px] border border-line bg-surface p-2"
            >
              <div className="flex items-center gap-1.5">
                <select
                  aria-label="Forma de pagamento"
                  className="b3-select h-8 text-[12px]"
                  style={{ width: 120 }}
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
                    "flex size-8 shrink-0 items-center justify-center rounded-[8px] border border-line text-ink-4 transition",
                    paymentLines.length > 1
                      ? "hover:border-danger hover:text-danger"
                      : "cursor-not-allowed opacity-30",
                  )}
                >
                  <XIcon className="size-3.5" />
                </button>
              </div>

              {line.method === "cash" ? (
                <div className="mt-1.5 grid grid-cols-[120px_1fr] items-center gap-1.5">
                  <label
                    htmlFor={`cash-recv-${line.id}`}
                    className="text-ink-4 text-[10.5px]"
                  >
                    Recebido
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
                    <p className="col-span-2 text-ink-4 text-[10.5px]">
                      Troco:{" "}
                      <span className="text-ink-1 font-semibold">
                        {formatBRL(lineTroco)}
                      </span>
                    </p>
                  ) : null}
                  {lineInvalid ? (
                    <p className="col-span-2 text-danger text-[10.5px]">
                      Recebido menor que o valor.
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
            className="b3-btn b3-btn--sm h-7 self-start gap-1.5 px-2 text-[11.5px]"
          >
            <PlusIcon className="size-3" /> Adicionar forma
          </button>
        ) : null}

        {/* Card de fiado parcial movido pra <MoreOptionsDisclosure>
            (rebalance 2026-05-21). Era visível por default mas 90% das
            vendas balcão não usam — escondido reduz ruído. */}

        {/* Indicador Falta / Sobra / Completo (considera fiado também) */}
        <div className="text-[11px]">
          {paymentsRemainingInCents === 0 &&
          (paymentsSumInCents > 0 || creditAmountInCents > 0) ? (
            <span className="text-ok font-semibold">
              Total fechado ({formatBRL(paymentsSumInCents + creditAmountInCents)}
              {creditAmountInCents > 0
                ? ` · fiado ${formatBRL(creditAmountInCents)}`
                : ""}
              )
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
        </div>
        {/* fim da coluna esquerda (Pagamento) */}

        {/* ─── Coluna direita: Desconto compacto ─── */}
        <div className="flex flex-col gap-1.5">
          <div className="text-ink-4 text-[10px] font-bold uppercase tracking-[0.06em]">
            Desconto
          </div>
          {/* 2 inputs R$ + % empilhados verticalmente (coluna estreita
              de 200px não comporta horizontal). Reconcile bidirecional
              vive no PdvShell (lastDiscountEdit + useEffect). F9 foca
              o R$ direto. */}
          <div className="space-y-1.5">
            <div className="relative">
              <span className="text-ink-4 absolute top-1/2 left-2.5 -translate-y-1/2 text-[11px] font-medium">
                R$
              </span>
              <input
                id="pdv-discount-amount"
                inputMode="decimal"
                placeholder="0,00"
                value={discountAmountInput}
                onChange={(e) => onDiscountAmountChange(e.target.value)}
                aria-label="Desconto em reais"
                className={cn(inputCls, "pl-8 tabular-nums")}
              />
            </div>
            <div className="relative">
              <input
                id="pdv-discount-pct"
                inputMode="decimal"
                placeholder="0"
                value={discountPctInput}
                onChange={(e) => onDiscountPctChange(e.target.value)}
                aria-label="Desconto em porcentagem"
                className={cn(inputCls, "pr-7 tabular-nums")}
              />
              <span className="text-ink-4 absolute top-1/2 right-2.5 -translate-y-1/2 text-[11px] font-medium">
                %
              </span>
            </div>
          </div>
        </div>
        {/* fim da coluna direita (Desconto) */}
      </div>
      {/* fim do grid 2-col Pagamento|Desconto */}

      {/* Mais opções — esconde acréscimo, fiado parcial e observação atrás
          de um disclosure. 90% das vendas balcão não tocam nesses campos. */}
      <MoreOptionsDisclosure
        creditAmountInput={creditAmountInput}
        setCreditAmountInput={setCreditAmountInput}
        creditAmountInCents={creditAmountInCents}
        totalInCents={totalInCents}
        paymentsSumInCents={paymentsSumInCents}
        hasCustomerSelected={hasCustomerSelected}
        surchargeAmountInput={surchargeAmountInput}
        surchargePctInput={surchargePctInput}
        onSurchargeAmountChange={onSurchargeAmountChange}
        onSurchargePctChange={onSurchargePctChange}
        notes={notes}
        setNotes={setNotes}
        inputCls={inputCls}
      />
    </div>
  );
}

// Component OrderDiscountField removido em audit 2026-05-21 — desconto
// virou inline na coluna direita do PaymentSection (2-col interno com
// pagamento + desconto lado a lado).

/**
 * Disclosure "Mais opções" — esconde acréscimo + fiado parcial + observação.
 * Default fechado. Lojista clica pra expandir quando precisa. Bookmark
 * acessível via `<details><summary>` nativo (zero JS extra, keyboard-friendly).
 */
function MoreOptionsDisclosure({
  creditAmountInput,
  setCreditAmountInput,
  creditAmountInCents,
  totalInCents,
  paymentsSumInCents,
  hasCustomerSelected,
  surchargeAmountInput,
  surchargePctInput,
  onSurchargeAmountChange,
  onSurchargePctChange,
  notes,
  setNotes,
  inputCls,
}: {
  creditAmountInput: string;
  setCreditAmountInput: (v: string) => void;
  creditAmountInCents: number;
  totalInCents: number;
  paymentsSumInCents: number;
  hasCustomerSelected: boolean;
  surchargeAmountInput: string;
  surchargePctInput: string;
  onSurchargeAmountChange: (v: string) => void;
  onSurchargePctChange: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  inputCls: string;
}) {
  // Abre automaticamente se algum campo "avançado" já tem valor — evita
  // esconder dado que o lojista já preencheu (ex: reabrir orçamento que
  // tinha acréscimo). defaultOpen vira true uma única vez no mount.
  const defaultOpen =
    creditAmountInCents > 0 ||
    !!surchargeAmountInput ||
    !!surchargePctInput ||
    !!notes.trim();

  return (
    <details className="group" {...(defaultOpen ? { open: true } : {})}>
      <summary
        className={cn(
          "list-none cursor-pointer select-none",
          "flex items-center gap-1.5",
          "text-ink-4 hover:text-ink-2 text-[12px] font-medium transition",
          "[&::-webkit-details-marker]:hidden",
        )}
      >
        <ChevronDownIcon
          size={14}
          strokeWidth={2.2}
          className="transition-transform duration-200 group-open:rotate-180"
          aria-hidden
        />
        Mais opções
        <span className="text-ink-4/70 text-[11px] font-normal">
          (acréscimo, fiado parcial, observação)
        </span>
      </summary>

      {/* Layout 2-col interno (audit 2026-05-21 — densificação sênior):
          Acréscimo (R$+%) esquerda, Fiado parcial direita. Observação
          full-width abaixo. Tudo cabe sem scroll, mesmo expandido. */}
      <div className="mt-2 space-y-2">
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          {/* Acréscimo — sub-bloco R$/% lado a lado */}
          <div>
            <div className="text-ink-4 mb-1 text-[10px] font-bold uppercase tracking-[0.06em]">
              Acréscimo
            </div>
            <div className="grid grid-cols-[1fr_60px] gap-1.5">
              <div className="relative">
                <span className="text-ink-4 absolute top-1/2 left-2.5 -translate-y-1/2 text-[10.5px] font-medium">
                  R$
                </span>
                <input
                  id="surcharge-amount"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={surchargeAmountInput}
                  onChange={(e) => onSurchargeAmountChange(e.target.value)}
                  className={cn(inputCls, "pl-7 tabular-nums")}
                />
              </div>
              <div className="relative">
                <input
                  id="surcharge-pct"
                  inputMode="decimal"
                  placeholder="0"
                  value={surchargePctInput}
                  onChange={(e) => onSurchargePctChange(e.target.value)}
                  className={cn(inputCls, "pr-6 tabular-nums")}
                />
                <span className="text-ink-4 absolute top-1/2 right-2 -translate-y-1/2 text-[10.5px] font-medium">
                  %
                </span>
              </div>
            </div>
          </div>

          {/* Fiado parcial — sub-bloco compacto (input + "Saldo restante") */}
          <div>
            <div className="text-ink-4 mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.06em]">
              <HandCoinsIcon size={11} aria-hidden />
              Fiado parcial
            </div>
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <span className="text-ink-4 absolute top-1/2 left-2.5 -translate-y-1/2 text-[10.5px] font-medium">
                  R$
                </span>
                <input
                  aria-label="Saldo a virar fiado"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={creditAmountInput}
                  onChange={(e) => setCreditAmountInput(e.target.value)}
                  className={cn(inputCls, "pl-7 tabular-nums")}
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  const remainingNow =
                    totalInCents - paymentsSumInCents - creditAmountInCents;
                  if (remainingNow <= 0) return;
                  const newCredit = creditAmountInCents + remainingNow;
                  setCreditAmountInput(
                    (newCredit / 100).toFixed(2).replace(".", ","),
                  );
                }}
                className="b3-btn b3-btn--sm h-8 whitespace-nowrap px-2 text-[11px]"
                title="Atribuir o saldo restante ao fiado"
              >
                Restante
              </button>
            </div>
            {creditAmountInCents > 0 && !hasCustomerSelected ? (
              <div className="text-danger mt-1 flex items-center gap-1 text-[10.5px]">
                <TriangleAlertIcon size={10} />
                Selecione um cliente cadastrado.
              </div>
            ) : null}
          </div>
        </div>

        {/* Observação — full width abaixo, 1 linha visível (expansível) */}
        <div>
          <label
            htmlFor="notes"
            className="text-ink-4 mb-1 block text-[10px] font-bold uppercase tracking-[0.06em]"
          >
            Observação
          </label>
          <textarea
            id="notes"
            placeholder="Ex: cheque #123, vale, fiado…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={1}
            maxLength={500}
            className="border-line bg-surface focus:border-brand w-full resize-y rounded-[8px] border px-3 py-1.5 text-[12.5px] outline-none transition"
          />
        </div>
      </div>
    </details>
  );
}

function CustomerComboboxLight({
  customerId,
  customerLabel,
  customerNotes,
  customerGroupLabel,
  customerPricingTier,
  walkInName,
  walkInPhone,
  setWalkInName,
  setWalkInPhone,
  onPick,
}: {
  customerId: string | null;
  customerLabel: string;
  customerNotes: string | null;
  customerGroupLabel: string | null;
  customerPricingTier: "regular" | "wholesale" | null;
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
        <div className="bg-bg-app rounded-[10px] p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserIcon className="text-ink-4 size-4" />
              <div>
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  {customerLabel}
                  {/* Sprint 5.4 — badge "Atacado" quando grupo tier wholesale. */}
                  {customerPricingTier === "wholesale" ? (
                    <span className="bg-brand-wash text-brand rounded px-1.5 py-px text-[10px] font-bold uppercase tracking-wide">
                      Atacado
                    </span>
                  ) : null}
                </p>
                <p className="text-ink-4 text-xs">
                  Cadastrado · vinculado à venda
                  {customerGroupLabel ? ` · ${customerGroupLabel}` : ""}
                </p>
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

          {/* Sprint 3.2 — anotação do cliente visível antes de liberar
              fiado. <details> nativo: badge clicável que expande o texto.
              Operadora vê "deve há 3 meses" sem precisar abrir /admin/clientes. */}
          {customerNotes && customerNotes.trim().length > 0 ? (
            <details className="group mt-2 rounded-md border border-warn/40 bg-warn/10 p-2 text-[11.5px] leading-snug">
              <summary className="text-warn flex cursor-pointer items-center gap-1.5 font-semibold list-none">
                <span aria-hidden>📝</span>
                <span>Anotação sobre este cliente</span>
                <span className="text-ink-4 ml-auto text-[10px] group-open:hidden">
                  toque pra ver
                </span>
              </summary>
              <p className="text-ink-2 mt-1.5 whitespace-pre-wrap break-words">
                {customerNotes}
              </p>
            </details>
          ) : null}
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
            placeholder="Buscar por nome, telefone ou CPF/CNPJ (F3) · opcional"
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
            o nome fica salvo apenas nesta venda.
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
        // Cliente recém-criado pelo PDV não passa notes no form de
        // cadastro rápido — sai sem anotação. Pode editar depois em
        // /admin/clientes.
        notes: notes.trim() || null,
        // Sprint 5.4 — cadastro rápido sai sem grupo. Lojista que quer
        // tier atacado linka via /admin/clientes depois.
        groupPricingTier: null,
        groupName: null,
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
