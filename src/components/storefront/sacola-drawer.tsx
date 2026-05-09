"use client";

/**
 * Drawer da sacola — visual portado do sistema original (bewear).
 *
 * Estética: Sheet abrindo da direita com SheetTitle "Carrinho",
 * lista vertical de items (imagem 78x78 rounded-lg, qty selector
 * compacto w-[100px] border p-1, trash icon outline, preço bold).
 * Footer com Subtotal/Entrega: GRÁTIS/Total separados por linha,
 * botão "Finalizar compra" rounded-full.
 *
 * Diferenças vs bewear: dados vêm do localStorage (não API), checkout
 * navega para /sacola que conclui via WhatsApp (não Stripe).
 */
import { MinusIcon, PlusIcon, ShoppingBasketIcon, TrashIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {
  createContext,
  type CSSProperties,
  useContext,
  useMemo,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useCart } from "@/hooks/use-cart";
import { formatBRL } from "@/lib/pricing";

interface DrawerContextValue {
  open: () => void;
}

const DrawerContext = createContext<DrawerContextValue | null>(null);

export function useSacolaDrawerTrigger(): DrawerContextValue {
  const ctx = useContext(DrawerContext);
  if (!ctx) {
    throw new Error(
      "useSacolaDrawerTrigger só pode ser usado dentro de <SacolaDrawer>",
    );
  }
  return ctx;
}

export interface SacolaDrawerProps {
  storeSlug: string;
  brandStyle?: CSSProperties;
  children: React.ReactNode;
}

export function SacolaDrawer({
  storeSlug,
  brandStyle,
  children,
}: SacolaDrawerProps) {
  const [open, setOpen] = useState(false);
  const { state, count, subtotalCents, isHydrated } = useCart();

  const value = useMemo<DrawerContextValue>(
    () => ({ open: () => setOpen(true) }),
    [],
  );

  const checkoutHref = `/${storeSlug}/sacola`;
  const isEmpty = isHydrated && count === 0;

  return (
    <DrawerContext.Provider value={value}>
      {children}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="flex w-full max-w-md flex-col gap-0 bg-background p-0"
          style={brandStyle}
        >
          <SheetHeader className="px-5 pt-5">
            <SheetTitle>Carrinho</SheetTitle>
          </SheetHeader>

          <div className="flex h-full flex-col px-5 pb-5">
            <div className="flex h-full max-h-full flex-col overflow-hidden">
              <div className="h-full overflow-y-auto [scrollbar-width:thin]">
                {!isHydrated ? (
                  <div className="py-12 text-center">
                    <div className="mx-auto size-8 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                  </div>
                ) : isEmpty ? (
                  <EmptyState
                    storeSlug={storeSlug}
                    onClose={() => setOpen(false)}
                  />
                ) : (
                  <div className="flex h-full flex-col gap-8 pr-1">
                    {state.items.map((item) => (
                      <CartItemRow
                        key={`${item.productId}:${item.variantId ?? "_"}`}
                        item={item}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {!isEmpty && isHydrated && (
              <div className="flex flex-col gap-4">
                <Separator />

                <div className="flex items-center justify-between text-xs font-medium">
                  <p>Subtotal</p>
                  <p className="tabular-nums">{formatBRL(subtotalCents)}</p>
                </div>

                <Separator />

                <div className="flex items-center justify-between text-xs font-medium">
                  <p>Entrega</p>
                  <p>GRÁTIS</p>
                </div>

                <Separator />

                <div className="flex items-center justify-between text-xs font-medium">
                  <p>Total</p>
                  <p className="tabular-nums">{formatBRL(subtotalCents)}</p>
                </div>

                <Button className="mt-5 rounded-full" asChild>
                  <Link href={checkoutHref} onClick={() => setOpen(false)}>
                    Finalizar compra
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </DrawerContext.Provider>
  );
}

interface CartItemRowProps {
  item: import("@/lib/cart/types").CartItem;
}

function CartItemRow({ item }: CartItemRowProps) {
  const { updateQty, removeItem } = useCart();
  const stockCap = item.cachedStockQty;
  const canIncrement = stockCap === null || item.quantity < stockCap;

  const handleDecrease = () => {
    updateQty(item.productId, item.variantId, item.quantity - 1);
  };
  const handleIncrease = () => {
    if (!canIncrement) return;
    updateQty(item.productId, item.variantId, item.quantity + 1);
  };
  const handleRemove = () => {
    removeItem(item.productId, item.variantId);
  };

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-4">
        <div className="relative size-[78px] shrink-0 overflow-hidden rounded-lg bg-muted">
          {item.imageUrl ? (
            <Image
              src={item.imageUrl}
              alt={item.productName}
              fill
              sizes="78px"
              className="object-cover"
            />
          ) : (
            <div className="text-muted-foreground/60 grid size-full place-items-center text-[10px]">
              Sem foto
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold">{item.productName}</p>
          {item.variantName && (
            <p className="text-muted-foreground text-xs font-medium">
              {item.variantName}
            </p>
          )}
          <div className="flex w-[100px] items-center justify-between rounded-lg border p-1">
            <Button
              className="h-4 w-4"
              variant="ghost"
              size="icon"
              onClick={handleDecrease}
              aria-label={`Diminuir quantidade de ${item.productName}`}
            >
              <MinusIcon />
            </Button>
            <p className="text-xs font-medium tabular-nums">{item.quantity}</p>
            <Button
              className="h-4 w-4"
              variant="ghost"
              size="icon"
              onClick={handleIncrease}
              disabled={!canIncrement}
              aria-label={`Aumentar quantidade de ${item.productName}`}
            >
              <PlusIcon />
            </Button>
          </div>
        </div>
      </div>
      <div className="flex flex-col items-end justify-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={handleRemove}
          aria-label={`Remover ${item.productName}`}
        >
          <TrashIcon />
        </Button>
        <p className="text-sm font-bold tabular-nums">
          {formatBRL(item.cachedPriceCents * item.quantity)}
        </p>
      </div>
    </div>
  );
}

function EmptyState({
  storeSlug,
  onClose,
}: {
  storeSlug: string;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
      <div className="mb-6 flex size-20 items-center justify-center rounded-full bg-muted">
        <ShoppingBasketIcon
          className="size-10 text-muted-foreground"
          aria-hidden
        />
      </div>
      <p className="text-foreground text-base font-semibold">
        Sua sacola está vazia
      </p>
      <p className="text-muted-foreground mt-2 max-w-[240px] text-sm leading-relaxed">
        Adicione produtos e finalize seu pedido pelo WhatsApp.
      </p>
      <Button asChild className="mt-6 rounded-full" onClick={onClose}>
        <Link href={`/${storeSlug}`}>Ver catálogo</Link>
      </Button>
    </div>
  );
}
