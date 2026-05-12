"use client";

/**
 * Painel de compra do produto — fiel ao canvas-v1 (`_vitre-storefront.jsx:241-358`).
 *
 *  ┌──────────────────────────────────────┐
 *  │ SKU  (mono 9.5px)                    │
 *  │ Nome do produto                       │  display 22px
 *  │ R$ X,XX  R$ Y,YY  −25%               │  preço-row
 *  │ ou 3× de R$ Z,ZZ sem juros           │  sub 11px
 *  ├──────────────────────────────────────┤
 *  │ Tamanho       guia de medidas         │
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
import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { useToast } from "@/components/storefront/toast";
import { useCart } from "@/hooks/use-cart";
import { useFavorites } from "@/hooks/use-favorites";
import {
  buildAddToCartSnapshot,
  isVariantSoldOut,
  resolveVariantPriceState,
  type VariantForSelection,
} from "@/lib/cart/variant-selection";
import { formatBRL, formatInstallments, getEffectivePrice } from "@/lib/pricing";
import type { ProductDetail } from "@/lib/storefront/products-loader";
import { cn } from "@/lib/utils";

export interface ProductPurchasePanelProps {
  product: ProductDetail;
  /** Slug da loja — usado pelo botão "Adicionar e voltar pra loja". */
  storeSlug: string;
  /**
   * Variante selecionada (controlado pelo parent pra coordenar com a
   * gallery — quando a variante tem `featuredImageId`, a gallery rola
   * pra foto correspondente). Quando ausente, usa estado interno.
   */
  selectedVariantId?: string | null;
  onSelectVariant?: (variantId: string | null) => void;
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
  selectedVariantId: controlledVariantId,
  onSelectVariant,
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
  const { isFavorite, toggleFavorite, isHydrated } = useFavorites();

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

  const ctaPrice = getEffectivePrice(product, now); // preço de catálogo (sem variant) pro label do CTA
  const ctaPriceWithVariant = priceState.effectivePriceInCents;

  // SKU placeholder: primeiros 8 chars do ID em uppercase. Quando schema
  // ganhar campo `sku` dedicado no produto, swap aqui.
  const sku = product.id.slice(0, 8).toUpperCase();

  const discountPercent = priceState.isOnPromo
    ? Math.round((1 - priceState.effectivePriceInCents / priceState.basePriceInCents) * 100)
    : null;

  const installmentLabel = formatInstallments(priceState.effectivePriceInCents, 3);

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
    addToast({
      type: "cart",
      title: "Adicionado à sacola",
      description: selectedVariant
        ? `${product.name} — ${selectedVariant.name}`
        : product.name,
      image: product.images[0]?.url,
    });
    setRecentlyAdded(true);
    setTimeout(() => setRecentlyAdded(false), 1500);
  }, [addItem, addToast, ctaDisabled, product, selectedVariant]);

  // "Adicionar e voltar pra loja": atalho pra quem está comprando vários
  // itens e quer manter o fluxo de descoberta sem ficar preso no PDP.
  const handleAddAndContinue = useCallback(() => {
    if (ctaDisabled) return;
    handleAddToCart();
    router.push(`/${storeSlug}`);
  }, [ctaDisabled, handleAddToCart, router, storeSlug]);

  const isFav = isHydrated && isFavorite(product.id);

  const handleToggleFavorite = useCallback(() => {
    toggleFavorite({
      productId: product.id,
      productSlug: product.slug,
      productName: product.name,
      imageUrl: product.images[0]?.url ?? null,
      priceCents: ctaPrice,
    });
  }, [toggleFavorite, product, ctaPrice]);

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
      {/* Scrollable content */}
      <div className="pb-24 lg:pb-0">
        {/* Title block — canvas linhas 261-271 */}
        <div className="px-4 pt-4">
          <div className="font-mono text-[9.5px] uppercase tracking-[0.5px] text-gray-400">
            {sku}
          </div>
          <h1 className="mt-1.5 text-[22px] font-semibold leading-[1.15] tracking-[-0.5px] text-foreground [text-wrap:pretty]">
            {product.name}
          </h1>
          <div className="mt-2.5 flex flex-wrap items-baseline gap-2">
            <span className="font-mono text-[22px] font-semibold tracking-[-0.5px] tabular-nums text-foreground">
              {formatBRL(priceState.effectivePriceInCents)}
            </span>
            {priceState.isOnPromo && (
              <>
                <span className="font-mono text-[13px] tabular-nums text-gray-400 line-through">
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
        </div>

        {/* Size selector — canvas linhas 273-298 */}
        {sizeVariants.length > 0 && (
          <div className="px-4 pt-5">
            <div className="mb-2.5 flex items-baseline justify-between">
              <span className="text-[12px] font-semibold text-foreground">Tamanho</span>
              <span className="font-mono text-[10px] text-gray-500">guia de medidas</span>
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
          <div className="grid grid-cols-2 gap-2 px-4 pt-[18px] pb-6">
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
      </div>

      {/* Sticky CTA — canvas linhas 342-353 */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-30 flex flex-col gap-1.5 border-t border-border bg-background px-3.5 py-3",
          "lg:relative lg:px-0 lg:py-4",
        )}
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center gap-2">
          {/* Heart button 44×44 rounded-12 (canvas é "save" mas reuso favoritos) */}
          <button
            type="button"
            onClick={handleToggleFavorite}
            aria-label={isFav ? "Remover dos favoritos" : "Adicionar aos favoritos"}
            aria-pressed={isFav}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-[12px] border border-border bg-background text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Heart
              className={cn("size-5", isFav && "fill-rose-500 text-rose-500")}
              strokeWidth={1.6}
            />
          </button>

          {/* Add-to-cart 44 rounded-12 bg-foreground */}
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={ctaDisabled && !recentlyAdded}
            className={cn(
              "inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-[12px] border-0 text-[13.5px] font-semibold outline-none transition-colors",
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
        </div>

        {/* Secundário: adiciona e volta pra loja, evita ficar preso no PDP. */}
        <button
          type="button"
          onClick={handleAddAndContinue}
          disabled={ctaDisabled && !recentlyAdded}
          className={cn(
            "h-8 w-full rounded-md text-[11.5px] font-medium outline-none transition-colors",
            "focus-visible:ring-2 focus-visible:ring-ring",
            ctaDisabled && !recentlyAdded
              ? "cursor-not-allowed text-gray-300"
              : "text-muted-foreground hocus:text-foreground hocus:underline",
          )}
        >
          Adicionar e voltar pra loja
        </button>
      </div>
    </>
  );
}
