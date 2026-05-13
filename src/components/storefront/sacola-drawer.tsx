"use client";

/**
 * Drawer da sacola — mini-preview canvas-v1.
 *
 * Decisão Lote 2: drawer vira preview compacto com link "Ver sacola
 * completa". Stepper, remoção e form de checkout vivem na página
 * `/sacola` (canvas VTSacola completo). Aqui só damos o preview rápido
 * pra o usuário decidir se já quer finalizar ou continuar comprando.
 *
 * Estrutura:
 *  - Sheet abre da direita (mobile/desktop), `max-w-sm` compacto.
 *  - Título "Sacola" + counter "{N} ITENS" mono.
 *  - Lista enxuta: thumbnail 56×56, nome line-clamp-2, variante 10px,
 *    qty mono "x{N}" + total da linha alinhado à direita. SEM stepper
 *    nem trash — visual limpo como preview.
 *  - Footer: subtotal mono + 2 CTAs (Continuar / Ver sacola completa).
 *  - Empty state preserva o pattern original.
 *
 * Diferença vs versão drawer-completo: ações destrutivas e checkout
 * movidos pra `/sacola`. Drawer só comunica "tem isso aqui, quer ir?".
 */
import { ShoppingBasketIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {
  createContext,
  type CSSProperties,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
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
  close: () => void;
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
  const [recentLineKey, setRecentLineKey] = useState<string | null>(null);
  const { state, count, subtotalCents, isHydrated } = useCart();

  const value = useMemo<DrawerContextValue>(
    () => ({ open: () => setOpen(true), close: () => setOpen(false) }),
    [],
  );

  // Auto-open on addItem: escuta evento global do use-cart e abre o drawer.
  // Padrão Shopify/Nuvemshop — cliente vê confirmação visual imediata.
  useEffect(() => {
    function handler(e: Event) {
      const detail = (e as CustomEvent<{ lineKey?: string }>).detail;
      const key = detail?.lineKey ?? null;
      setOpen(true);
      setRecentLineKey(key);
      // Highlight desaparece após 1.5s (alinhado com toast).
      window.setTimeout(() => setRecentLineKey(null), 1500);
    }
    window.addEventListener("vitre:cart-added", handler);
    return () => window.removeEventListener("vitre:cart-added", handler);
  }, []);

  const checkoutHref = `/${storeSlug}/sacola`;
  const isEmpty = isHydrated && count === 0;

  return (
    <DrawerContext.Provider value={value}>
      {children}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="bg-background flex w-full max-w-sm flex-col gap-0 p-0"
          style={brandStyle}
        >
          {/*
            Header só com "Sacola". O counter "{N} ITENS" foi removido
            em 2026-05-13: founder considerou ruidoso e redundante com
            o total no footer e o badge no botão da sacola.
          */}
          <SheetHeader className="border-border border-b px-5 py-4">
            <SheetTitle className="text-[18px] font-semibold tracking-tight">
              Sacola
            </SheetTitle>
          </SheetHeader>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto px-5 py-4 [scrollbar-width:thin]">
              {!isHydrated ? (
                <div className="py-12 text-center">
                  <div className="border-muted-foreground mx-auto size-8 animate-spin rounded-full border-2 border-t-transparent" />
                </div>
              ) : isEmpty ? (
                <EmptyState
                  storeSlug={storeSlug}
                  onClose={() => setOpen(false)}
                />
              ) : (
                <ul className="divide-border divide-y" role="list">
                  {state.items.map((item) => {
                    const key = `${item.productId}:${item.variantId ?? "_"}`;
                    return (
                      <li
                        key={key}
                        className="py-3 first:pt-0 last:pb-0"
                      >
                        <PreviewRow item={item} highlighted={recentLineKey === key} />
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {!isEmpty && isHydrated && (
              <div className="border-border bg-background sticky bottom-0 border-t px-5 py-4">
                <div className="mb-3 flex items-baseline justify-between">
                  <span className="text-[12.5px] font-semibold">Total</span>
                  <span className="text-[18px] font-semibold tabular-nums tracking-tight">
                    {formatBRL(subtotalCents)}
                  </span>
                </div>
                <Button
                  asChild
                  className="h-11 w-full rounded-xl text-[14px] font-semibold"
                >
                  <Link href={checkoutHref} onClick={() => setOpen(false)}>
                    Finalizar pedido
                  </Link>
                </Button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-muted-foreground hocus:text-foreground mt-2 w-full py-2 text-center text-[12px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                >
                  Continuar comprando
                </button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </DrawerContext.Provider>
  );
}

interface PreviewRowProps {
  item: import("@/lib/cart/types").CartItem;
  highlighted?: boolean;
}

function PreviewRow({ item, highlighted = false }: PreviewRowProps) {
  const lineTotal = item.cachedPriceCents * item.quantity;

  return (
    <div
      className={
        "flex gap-3 transition-colors " +
        (highlighted ? "-mx-2 rounded-md bg-success-soft/40 px-2 py-1" : "")
      }
    >
      <div className="bg-muted relative size-14 shrink-0 overflow-hidden rounded-lg">
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt={item.productName}
            fill
            sizes="56px"
            className="object-cover"
          />
        ) : (
          <div className="text-muted-foreground/60 grid size-full place-items-center text-[10px]">
            Sem foto
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="line-clamp-2 text-[12.5px] font-medium leading-tight">
          {item.productName}
        </p>
        {item.variantName && (
          <p className="text-muted-foreground text-[10.5px] font-medium">
            {item.variantName}
          </p>
        )}
        {highlighted ? (
          <span className="mt-0.5 inline-flex w-fit items-center rounded-sm bg-success/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.4px] text-success">
            Adicionado
          </span>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-muted-foreground font-mono text-[10px]">
          ×{item.quantity}
        </span>
        <span className="text-[12.5px] font-semibold tabular-nums">
          {formatBRL(lineTotal)}
        </span>
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
      <div className="bg-muted mb-6 flex size-20 items-center justify-center rounded-full">
        <ShoppingBasketIcon
          className="text-muted-foreground size-10"
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
        <Link href={`/${storeSlug}`}>Ver vitrine</Link>
      </Button>
    </div>
  );
}
