"use client";

/**
 * Painel de compra do produto — redesign estilo app de moda premium.
 *
 * Features:
 * - Nome + categoria + preço grande
 * - Seletor de tamanho em pills com animação
 * - Descrição colapsável
 * - Barra fixa no bottom com share + Add to Cart
 * - Loading states + toast feedback
 * - Textos em PT-BR via i18n
 */
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Loader2, Share2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { useToast } from "@/components/storefront/toast";
import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/use-cart";
import {
  buildAddToCartSnapshot,
  isVariantSoldOut,
  resolveVariantPriceState,
  type VariantForSelection,
} from "@/lib/cart/variant-selection";
import { formatBRL,t } from "@/lib/storefront/i18n";
import type { ProductDetail } from "@/lib/storefront/products-loader";
import { cn } from "@/lib/utils";

export interface ProductPurchasePanelProps {
  product: ProductDetail;
  storeSlug: string;
}

type ButtonState = "idle" | "loading" | "success";

export function ProductPurchasePanel({
  product,
  storeSlug,
}: ProductPurchasePanelProps) {
  const [quantity, setQuantity] = useState(1);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    null,
  );
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [buttonState, setButtonState] = useState<ButtonState>("idle");
  const { addItem } = useCart();
  const { addToast } = useToast();

  const hasVariants = product.variants.length > 0;

  const selectedVariant: VariantForSelection | null = useMemo(() => {
    if (!hasVariants || !selectedVariantId) return null;
    const v = product.variants.find((it) => it.id === selectedVariantId);
    return v ?? null;
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
    productIsSoldOut || selectionRequired || selectedVariantSoldOut || buttonState !== "idle";

  const handleSelectVariant = (variantId: string) => {
    setSelectedVariantId(variantId);
    setQuantity(1);
  };

  const addCurrentToCart = useCallback(() => {
    if (ctaDisabled) return;
    const snapshot = buildAddToCartSnapshot({
      product,
      variant: selectedVariant,
      quantity,
      imageUrl: product.images[0]?.url ?? null,
      now: new Date(),
    });
    addItem(snapshot);
  }, [addItem, ctaDisabled, product, quantity, selectedVariant]);

  const handleAddToCart = useCallback(() => {
    if (ctaDisabled) return;

    // Adição instantânea — sem delay artificial
    addCurrentToCart();

    // Show success state
    setButtonState("success");
    
    // Show toast with product image
    addToast({
      type: "cart",
      title: t.cart.title,
      description: selectedVariant
        ? `${product.name} — ${selectedVariant.name}`
        : product.name,
      image: product.images[0]?.url,
    });
    
    // Reset after delay
    setTimeout(() => {
      setButtonState("idle");
    }, 1500);
  }, [addCurrentToCart, addToast, ctaDisabled, product, selectedVariant]);

  const handleShare = async () => {
    const url = `${window.location.origin}/${storeSlug}/produto/${product.slug}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: product.name,
          text: product.description || `Confira ${product.name}`,
          url,
        });
      } catch {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(url);
      addToast({
        type: "success",
        title: t.actions.copied,
        duration: 2000,
      });
    }
  };

  const ctaLabel = useMemo(() => {
    if (productIsSoldOut || selectedVariantSoldOut) return t.product.outOfStock;
    if (buttonState === "loading") return t.product.adding;
    if (buttonState === "success") return t.product.added;
    return t.product.addToCart;
  }, [productIsSoldOut, selectedVariantSoldOut, buttonState]);

  const descriptionPreview = product.description?.slice(0, 120);
  const hasMoreDescription =
    product.description && product.description.length > 120;

  return (
    <>
      {/* Scrollable content area */}
      <div className="space-y-5 pb-28">
        {/* Product info */}
        <div className="space-y-1 px-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-foreground text-balance">
                {product.name}
              </h2>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold tabular-nums text-foreground">
                {formatBRL(priceState.effectivePriceInCents)}
              </p>
              {priceState.isOnPromo && (
                <p className="text-sm text-muted-foreground line-through">
                  {formatBRL(priceState.basePriceInCents)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Size selector */}
        {hasVariants && (
          <div className="space-y-3 px-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">{t.product.selectSize}</h3>
              <button
                type="button"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {t.product.sizeChart}
              </button>
            </div>
            <div
              role="radiogroup"
              aria-label="Selecione um tamanho"
              className="flex flex-wrap gap-2"
            >
              {product.variants.map((variant) => {
                const soldOut = isVariantSoldOut(product, variant);
                const isSelected = selectedVariantId === variant.id;
                return (
                  <motion.button
                    key={variant.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    aria-label={
                      soldOut ? `${variant.name} (${t.product.outOfStock})` : variant.name
                    }
                    disabled={soldOut}
                    onClick={() => handleSelectVariant(variant.id)}
                    whileTap={{ scale: 0.95 }}
                    className={cn(
                      "min-w-12 rounded-full border-2 px-4 py-2.5 text-sm font-semibold tabular-nums transition-all outline-none",
                      "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      isSelected
                        ? "border-foreground bg-foreground text-background shadow-md"
                        : "border-gray-200 bg-white text-foreground hover:border-gray-300 hover:shadow-sm",
                      soldOut &&
                        "cursor-not-allowed border-gray-100 text-gray-300 line-through opacity-60 hover:border-gray-100 hover:shadow-none",
                    )}
                  >
                    {variant.name}
                  </motion.button>
                );
              })}
            </div>
            {selectionRequired && (
              <p className="text-xs text-muted-foreground">
                {t.product.selectVariant}
              </p>
            )}
          </div>
        )}

        {/* Description */}
        {product.description && (
          <div className="space-y-2 px-5">
            <p className="text-sm leading-relaxed text-muted-foreground">
              {showFullDescription ? product.description : descriptionPreview}
              {hasMoreDescription && !showFullDescription && "..."}
            </p>
            {hasMoreDescription && (
              <button
                type="button"
                onClick={() => setShowFullDescription(!showFullDescription)}
                className="flex items-center gap-1 text-sm font-medium text-foreground hover:text-muted-foreground transition-colors"
              >
                {showFullDescription ? "Mostrar menos" : t.product.learnMore}
                <ChevronDown
                  className={cn(
                    "size-4 transition-transform",
                    showFullDescription && "rotate-180"
                  )}
                />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Fixed bottom action bar */}
      <div 
        className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-100 bg-white/95 backdrop-blur-lg px-5 py-4 lg:relative lg:border-0 lg:bg-transparent lg:backdrop-blur-none lg:px-0 lg:py-0 lg:mt-6"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto flex max-w-screen-xl items-center gap-3">
          {/* Share button */}
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-14 shrink-0 rounded-full border-gray-200 shadow-sm hover:shadow-md transition-shadow"
            onClick={handleShare}
            aria-label={t.product.share}
          >
            <Share2 className="size-5" />
          </Button>

          {/* Add to cart button */}
          <motion.button
            type="button"
            onClick={handleAddToCart}
            disabled={ctaDisabled}
            whileTap={{ scale: ctaDisabled ? 1 : 0.98 }}
            className={cn(
              "relative flex-1 flex items-center justify-center gap-2 rounded-full py-4 text-base font-bold transition-all overflow-hidden",
              "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              ctaDisabled && buttonState === "idle"
                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                : buttonState === "success"
                ? "bg-success text-success-foreground"
                : "bg-foreground text-background shadow-lg hover:shadow-xl hover:brightness-110 active:brightness-95"
            )}
          >
            <AnimatePresence mode="wait">
              {buttonState === "loading" ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="flex items-center gap-2"
                >
                  <Loader2 className="size-5 animate-spin" />
                  <span>{ctaLabel}</span>
                </motion.div>
              ) : buttonState === "success" ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="flex items-center gap-2"
                >
                  <Check className="size-5" />
                  <span>{ctaLabel}</span>
                </motion.div>
              ) : (
                <motion.span
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {ctaLabel}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </div>
    </>
  );
}
