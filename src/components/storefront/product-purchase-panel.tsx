"use client";

/**
 * Painel de compra do produto — fiel ao canvas-v1 (`_vitre-storefront.jsx:241-358`).
 *
 *  ┌──────────────────────────────────────┐
 *  │ Nome do produto                       │  display 22px
 *  │ R$ X,XX  R$ Y,YY  −25%               │  preço-row
 *  │ ou 3× de R$ Z,ZZ sem juros           │  sub 11px
 *  ├──────────────────────────────────────┤
 *  │ Tamanho                               │
 *  │ [PP] [P] [M̲] [G] [G̶G̶]                │  pills 46×38 rounded-8
 *  ├──────────────────────────────────────┤
 *  │ Cor — Cru                             │
 *  │ ⬤  ⚫  ⬤  ⬤                            │  swatches 34×34 anel duplo
 *  ├──────────────────────────────────────┤
 *  │ Descrição                             │
 *  │ <texto pretty 12px>                   │
 *  ├──────────────────────────────────────┤
 *  │ ── COMPOSIÇÃO  ── MODELAGEM            │  meta grid 2-col border-top
 *  │ 100% linho     Evasê midi              │
 *  ├──────────────────────────────────────┤
 *  │ [♥] Adicionar à sacola · R$ X,XX      │  sticky CTA preto rounded-12
 *  └──────────────────────────────────────┘
 *
 * Variantes têm `axis: "size" | "color"` (schema canvas-v1, migration 0008):
 *  - axis="size" renderiza no bloco de pills
 *  - axis="color" renderiza no bloco de swatches usando `colorHex`
 *
 * Premissa Lote 2: produto tem variantes em UM eixo predominante (ou
 * size, ou color). Combinatorial size×color é Lote 3+.
 *
 * Lógica preservada do anterior (intocada): useCart, useToast, isVariantSoldOut,
 * resolveVariantPriceState, buildAddToCartSnapshot. UX simplificada: sem qty
 * stepper (qty=1 implícito; cliente ajusta na sacola), sem share, sem
 * descrição colapsável (canvas mostra completa), sem framer-motion.
 */
import { MessageCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { useToast } from "@/components/storefront/toast";
import { useCart } from "@/hooks/use-cart";
import {
  buildAddToCartSnapshot,
  isVariantSoldOut,
  resolveVariantPriceState,
  type VariantForSelection,
} from "@/lib/cart/variant-selection";
import {
  formatBRL,
  formatCashDiscount,
  formatInstallments,
  type PaymentConfig,
  resolveCashDiscountBps,
} from "@/lib/pricing";
import type { ProductDetail } from "@/lib/storefront/products-loader";
import { cn } from "@/lib/utils";

export interface ProductPurchasePanelProps {
  product: ProductDetail;
  /** Slug da loja — usado pelo botão "Adicionar e voltar pra loja". */
  storeSlug: string;
  /**
   * Configuração de pagamento da loja (Fase 2 — ADR-0013). Vem do
   * loader do PDP (`store` já é carregado pro BrandProvider). Subset
   * dedicado pra não acoplar este componente ao shape inteiro de Store.
   */
  storePayment: PaymentConfig;
  /**
   * Desconto à vista em basis points (`store.cashDiscountBps`). 0 =
   * sem desconto. Separado de `storePayment` porque não entra nos
   * gates de parcelamento — é uma label independente.
   */
  cashDiscountBps: number;
  /**
   * Texto livre de "como pagar" (`store.paymentMethodsNote`). Quando
   * preenchido, renderiza bloco "Como pagar" abaixo do trust block.
   */
  paymentMethodsNote: string | null;
  /**
   * Variante selecionada (controlado pelo parent pra coordenar com a
   * gallery — quando a variante tem `featuredImageId`, a gallery rola
   * pra foto correspondente). Quando ausente, usa estado interno.
   */
  selectedVariantId?: string | null;
  onSelectVariant?: (variantId: string | null) => void;
  /**
   * Número do WhatsApp da loja (E.164: +5599...) — usado pelo CTA
   * "Tirar dúvida no WhatsApp" na sticky bar. Passo 16 redesign.
   */
  whatsappNumber: string;
  /** Nome da loja — usado na mensagem pré-preenchida do WhatsApp. */
  storeName: string;
}

const META_FIELDS = [
  ["COMPOSIÇÃO", "composition"],
  ["MODELAGEM", "modeling"],
  ["FORRO", "lining"],
  ["LAVAGEM", "washing"],
] as const;

export function ProductPurchasePanel({
  product,
  storeSlug,
  storePayment,
  cashDiscountBps,
  paymentMethodsNote,
  selectedVariantId: controlledVariantId,
  onSelectVariant,
  whatsappNumber,
  storeName,
}: ProductPurchasePanelProps) {
  const router = useRouter();
  const [internalVariantId, setInternalVariantId] = useState<string | null>(null);
  // Controlled vs uncontrolled: parent pode passar selectedVariantId pra
  // coordenar com a galeria (Onda 4); senão usa state interno.
  const selectedVariantId =
    controlledVariantId !== undefined ? controlledVariantId : internalVariantId;
  const setSelectedVariantId = useCallback(
    (id: string | null) => {
      if (onSelectVariant) onSelectVariant(id);
      else setInternalVariantId(id);
    },
    [onSelectVariant],
  );
  const [recentlyAdded, setRecentlyAdded] = useState(false);

  const { addItem } = useCart();
  const { addToast } = useToast();

  // Separa variantes por eixo. Lote 2 trata size/color como mutuamente
  // exclusivos por produto — se admin criou ambos, renderiza ambos blocos
  // e cliente seleciona um (mas combinatorial não é resolvido aqui).
  const sizeVariants = useMemo(
    () => product.variants.filter((v) => v.axis === "size" && v.isActive),
    [product.variants],
  );
  const colorVariants = useMemo(
    () => product.variants.filter((v) => v.axis === "color" && v.isActive),
    [product.variants],
  );
  const hasVariants = sizeVariants.length + colorVariants.length > 0;

  const selectedVariant: VariantForSelection | null = useMemo(() => {
    if (!hasVariants || !selectedVariantId) return null;
    return product.variants.find((v) => v.id === selectedVariantId) ?? null;
  }, [hasVariants, selectedVariantId, product.variants]);

  const now = useMemo(() => new Date(), []);
  const priceState = useMemo(
    () => resolveVariantPriceState(product, selectedVariant, now),
    [product, selectedVariant, now],
  );

  const productIsSoldOut = !hasVariants && isVariantSoldOut(product, null);
  const selectionRequired = hasVariants && !selectedVariant;
  const selectedVariantSoldOut = selectedVariant
    ? isVariantSoldOut(product, selectedVariant)
    : false;

  const ctaDisabled =
    productIsSoldOut || selectionRequired || selectedVariantSoldOut || recentlyAdded;

  const ctaPriceWithVariant = priceState.effectivePriceInCents;

  const discountPercent = priceState.isOnPromo
    ? Math.round((1 - priceState.effectivePriceInCents / priceState.basePriceInCents) * 100)
    : null;

  const installmentLabel = formatInstallments({
    basePriceInCents: priceState.basePriceInCents,
    effectivePriceInCents: priceState.effectivePriceInCents,
    storePayment,
    productInstallmentsOverride: product.installmentsOverride,
  });
  const effectiveCashDiscountBps = resolveCashDiscountBps(
    cashDiscountBps,
    product.cashDiscountOverrideBps,
  );
  const cashDiscount = formatCashDiscount(
    priceState.effectivePriceInCents,
    effectiveCashDiscountBps,
  );

  // Meta grid só renderiza se pelo menos 1 dos 4 campos tem valor.
  const metaPairs = useMemo(() => {
    const pairs: Array<readonly [string, string]> = [];
    for (const [label, key] of META_FIELDS) {
      const value = product[key];
      if (typeof value === "string" && value.trim() !== "") {
        pairs.push([label, value.trim()]);
      }
    }
    return pairs;
  }, [product]);

  // Cor ativa pro header "Cor — {nome}". Se nada selecionado mas há
  // colorVariants, mostra o primeiro pra UX coerente com o canvas.
  const activeColorName =
    colorVariants.find((v) => v.id === selectedVariantId)?.name ?? colorVariants[0]?.name ?? null;

  const handleAddToCart = useCallback(() => {
    if (ctaDisabled) return;
    const snapshot = buildAddToCartSnapshot({
      product,
      variant: selectedVariant,
      quantity: 1,
      imageUrl: product.images[0]?.url ?? null,
      now: new Date(),
    });
    addItem(snapshot);
    // Toast com ação "Ver sacola" substitui o drawer auto-open
    // (Onda 2 redesign 2026-05-26). Cliente que quer continuar comprando
    // simplesmente ignora — toast some em 2s. Cliente que quer revisar
    // toca em "Ver sacola" e navega para /sacola.
    addToast({
      type: "cart",
      title: "Adicionado à sacola",
      description: selectedVariant
        ? `${product.name} — ${selectedVariant.name}`
        : product.name,
      image: product.images[0]?.url,
      action: {
        label: "Ver sacola",
        onClick: () => router.push(`/${storeSlug}/sacola`),
      },
    });
    setRecentlyAdded(true);
    setTimeout(() => setRecentlyAdded(false), 1500);
  }, [addItem, addToast, ctaDisabled, product, router, selectedVariant, storeSlug]);

  const ctaLabel = useMemo(() => {
    if (productIsSoldOut || selectedVariantSoldOut) return "Esgotado";
    if (selectionRequired) {
      if (sizeVariants.length > 0 && colorVariants.length > 0) return "Selecione tamanho e cor";
      if (sizeVariants.length > 0) return "Selecione um tamanho";
      return "Selecione uma cor";
    }
    if (recentlyAdded) return "Adicionado!";
    return `Adicionar à sacola · ${formatBRL(ctaPriceWithVariant)}`;
  }, [
    productIsSoldOut,
    selectedVariantSoldOut,
    selectionRequired,
    sizeVariants.length,
    colorVariants.length,
    recentlyAdded,
    ctaPriceWithVariant,
  ]);

  return (
    <>
      {/*
        Scrollable content — sem pb-24 mobile a partir de 2026-05-27
        (founder review). Antes criava 96px de espaço em branco entre
        o final do bloco do produto e a section "Você pode gostar"
        que vem logo abaixo. A safe-zone pra CTA sticky (fixed
        bottom-0, ~88px de altura) é coberta agora pelo `pb-32`
        aplicado no wrapper da relatedSection (product-detail-view).
        Quando NÃO há related, a tela termina no CTA e ninguém vê
        ausência do safe-zone porque não há conteúdo a esconder.
      */}
      <div className="lg:pb-0">
        {/* Title block — canvas linhas 261-271.
            Desktop scaling 2026-05-26 (Onda 6): mobile mantém canvas
            22px; desktop sobe pra 30px (h1) e 26px (preço) — produto
            premium precisa de presença em tela grande, 22px parece
            "mobile esticado". Tracking mais apertado em desktop pra
            compensar o peso visual maior. */}
        <div className="px-4 pt-4 lg:pt-2">
          <h1 className="text-[22px] font-semibold leading-[1.15] tracking-[-0.5px] text-foreground [text-wrap:pretty] lg:text-[30px] lg:leading-[1.1] lg:tracking-[-0.8px]">
            {product.name}
          </h1>
          {/* Onda 3 (2026-05-27): preço sai do font-mono (cara de planilha
              financeira) e usa font-sans com tabular-nums. Mantém o
              alinhamento de dígitos sem o aspecto técnico. Padrão Zara/
              Aritzia/Mango — nenhuma loja de moda séria usa mono no preço.
              Discount badge mantém mono porque é label técnico (-25%). */}
          <div className="mt-2.5 flex flex-wrap items-baseline gap-2 lg:mt-4 lg:gap-3">
            <span className="text-[22px] font-semibold tracking-[-0.5px] tabular-nums text-foreground lg:text-[26px] lg:tracking-[-0.6px]">
              {formatBRL(priceState.effectivePriceInCents)}
            </span>
            {priceState.isOnPromo && (
              <>
                <span className="text-[13px] tabular-nums text-gray-400 line-through">
                  {formatBRL(priceState.basePriceInCents)}
                </span>
                {discountPercent !== null && (
                  <span className="rounded-[4px] bg-success-soft px-1.5 py-[3px] font-mono text-[10px] font-semibold uppercase text-success">
                    −{discountPercent}%
                  </span>
                )}
              </>
            )}
          </div>
          {installmentLabel && (
            <div className="mt-1.5 text-[11px] text-gray-500">{installmentLabel}</div>
          )}
          {cashDiscount && (
            <div className="mt-0.5 text-[11px] text-success">
              {cashDiscount.label}
            </div>
          )}
        </div>

        {/* Size selector — canvas linhas 273-298 */}
        {sizeVariants.length > 0 && (
          <div className="px-4 pt-5">
            <div className="mb-2.5 flex items-baseline justify-between">
              <span className="text-[12px] font-semibold text-foreground">Tamanho</span>
            </div>
            <div
              role="radiogroup"
              aria-label="Selecione um tamanho"
              className="flex flex-wrap gap-2"
            >
              {sizeVariants.map((v) => {
                const soldOut = isVariantSoldOut(product, v);
                const selected = selectedVariantId === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={soldOut ? `${v.name} (esgotado)` : v.name}
                    disabled={soldOut}
                    onClick={() => setSelectedVariantId(v.id)}
                    className={cn(
                      "h-[38px] w-[46px] rounded-[8px] border text-[12px] font-semibold tabular-nums transition-colors outline-none",
                      "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      selected
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-background text-foreground hover:border-gray-400",
                      soldOut && "cursor-not-allowed text-gray-300 line-through opacity-60",
                    )}
                  >
                    {v.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Color selector — canvas linhas 300-315 */}
        {colorVariants.length > 0 && (
          <div className="px-4 pt-[18px]">
            <div className="mb-2.5 text-[12px] font-semibold text-foreground">
              Cor{activeColorName ? ` — ${activeColorName}` : ""}
            </div>
            <div
              role="radiogroup"
              aria-label="Selecione uma cor"
              className="flex flex-wrap gap-2"
            >
              {colorVariants.map((v) => {
                const soldOut = isVariantSoldOut(product, v);
                const selected = selectedVariantId === v.id;
                // Anel duplo (active): border-2 fg + outline 2 bg negativo
                // simula o "ring + halo" do canvas (linhas 309-311).
                return (
                  <button
                    key={v.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={soldOut ? `${v.name} (esgotado)` : v.name}
                    disabled={soldOut}
                    onClick={() => setSelectedVariantId(v.id)}
                    style={{ background: v.colorHex ?? "var(--gray-200)" }}
                    className={cn(
                      "size-[34px] rounded-full transition-shadow outline-none",
                      "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      selected
                        ? "border-2 border-foreground outline outline-2 outline-background -outline-offset-4"
                        : "border border-border",
                      soldOut && "cursor-not-allowed opacity-40",
                    )}
                  />
                );
              })}
            </div>
          </div>
        )}

        {selectionRequired && (
          <div className="px-4 pt-2 text-[11px] text-gray-500">
            Escolha uma opção pra adicionar à sacola.
          </div>
        )}

        {/* Descrição — canvas linhas 318-323 */}
        {product.description && (
          <div className="px-4 pt-5">
            <div className="mb-2 text-[12px] font-semibold text-foreground">Descrição</div>
            <p className="text-[12px] leading-[1.55] text-gray-700 [text-wrap:pretty]">
              {product.description}
            </p>
          </div>
        )}

        {/* Meta grid — canvas linhas 326-338 */}
        {metaPairs.length > 0 && (
          <div className="grid grid-cols-2 gap-2 px-4 pt-[18px]">
            {metaPairs.map(([label, value]) => (
              <div key={label} className="border-t border-border pt-2">
                <div className="font-mono text-[9.5px] uppercase tracking-[0.4px] text-gray-400">
                  {label}
                </div>
                <div className="mt-0.5 text-[11.5px] font-medium text-foreground">{value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Trust block REMOVIDO (2026-05-27 — founder review):
            os 3 cards "Entrega ou retirada", "Pagamento combinado",
            "Atendimento no WhatsApp" eram ruído ocupando espaço entre
            o produto e a section de relacionados. A informação já
            estava implícita no CTA "Comprar pelo WhatsApp" e na seção
            "Como pagar" da loja (que segue abaixo quando preenchida). */}

        {/* "Como pagar" — paymentMethodsNote da loja (Fase 2 / ADR-0013).
            Renderiza só quando o lojista preencheu o campo em
            /admin/configuracoes. Sem o trust block acima agora ele é
            standalone e respira sozinho com px-4 pb-4 (era pb-6 da
            soma com o trust). */}
        {paymentMethodsNote && paymentMethodsNote.trim() !== "" && (
          <div className="px-4 pt-4 pb-4">
            <div className="rounded-xl border border-border bg-background p-3">
              <div className="text-[11.5px] font-semibold text-foreground">
                Como pagar
              </div>
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground [text-wrap:pretty]">
                {paymentMethodsNote}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Sticky CTA — Onda 2 (2026-05-27) — Heart saiu pro overlay da
          gallery (Fitts: CTA principal não pode dividir alvo com microação
          rara). "Adicionar e voltar" removido (régua funciona-ou-esconde —
          micro otimização não justificava 32px de altura sub-touch-target).
          "Tirar dúvida" PROMOVIDO de link 11.5px pra CTA secundário pleno
          h-11 com cor whatsapp (canal próprio, identidade clara) — agora
          alvo legítimo de Fitts e comunica explicitamente o moat (loja +
          WhatsApp) ao cliente em dúvida pré-compra. */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-30 flex flex-col gap-2 border-t border-border bg-background px-3.5 py-3",
          "lg:relative lg:px-0 lg:py-4",
        )}
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        {/* Add-to-cart pleno full-width */}
        <button
          type="button"
          onClick={handleAddToCart}
          disabled={ctaDisabled && !recentlyAdded}
          className={cn(
            "inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-[12px] border-0 text-[14px] font-semibold outline-none transition-colors",
            "focus-visible:ring-2 focus-visible:ring-ring",
            ctaDisabled && !recentlyAdded
              ? "cursor-not-allowed bg-gray-200 text-gray-400"
              : recentlyAdded
                ? "bg-success text-success-foreground"
                : "bg-foreground text-background hover:bg-foreground/90 active:bg-foreground/85",
          )}
        >
          {ctaLabel}
        </button>

        {/* CTA secundário "Tirar dúvida no WhatsApp" — h-10 ghost com
            tint whatsapp. Não compete com o primário (visualmente claro
            que é alternativa pra cliente em dúvida) mas é alvo legítimo. */}
        <a
          href={`https://wa.me/${whatsappNumber.replace(/^\+/, "")}?text=${encodeURIComponent(`Oi! Vi este produto na ${storeName} e queria tirar uma dúvida: ${product.name}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-[12px] border border-whatsapp/40 bg-whatsapp/10 text-whatsapp text-[13px] font-semibold outline-none transition-colors hover:bg-whatsapp/15 active:bg-whatsapp/20 focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Tirar dúvida sobre este produto no WhatsApp"
        >
          <MessageCircleIcon className="size-4" strokeWidth={1.8} aria-hidden />
          Tirar dúvida no WhatsApp
        </a>
      </div>
    </>
  );
}
