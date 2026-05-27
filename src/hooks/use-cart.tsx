"use client";

/**
 * Hook + Provider do carrinho client-side.
 *
 * Estado vive em memória (useState) + sincroniza com localStorage via
 * `lib/cart/storage`. Hidratação é deferida pro client (SSR renderiza
 * vazio até `useEffect` montar) — `isHydrated` flag permite componentes
 * mostrar skeleton/0 durante o flash.
 *
 * Actions garantem consistência (qty=0 remove item; mesma combinação
 * productId+variantId acumula em vez de duplicar linhas).
 *
 * Este Provider envolve a árvore do storefront via `StoreShell`. Páginas
 * fora do shell (admin, auth, /p/[code]) NÃO têm acesso — o que é
 * correto: o carrinho é local à loja visitada.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  type AddItemPayload,
  addItemToItems,
  capCartQuantity,
  sameCartLine,
} from "@/lib/cart/reducer";
import { clearCart as clearStorage, readCart, writeCart } from "@/lib/cart/storage";
import { type CartState, EMPTY_CART } from "@/lib/cart/types";

type AddItemInput = Omit<AddItemPayload, "quantity"> & { quantity?: number };

interface CartContextValue {
  /** True após primeiro mount no client. False durante SSR e primeira render client. */
  isHydrated: boolean;
  state: CartState;
  /** Soma de quantidades — pra badge no header/bottom-nav. */
  count: number;
  /** Soma de cachedPriceCents × qty (UI only — server recalcula). */
  subtotalCents: number;
  addItem: (input: AddItemInput) => void;
  removeItem: (productId: string, variantId: string | null) => void;
  updateQty: (
    productId: string,
    variantId: string | null,
    qty: number,
  ) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export interface CartProviderProps {
  storeSlug: string;
  children: React.ReactNode;
}

export function CartProvider({ storeSlug, children }: CartProviderProps) {
  const [state, setState] = useState<CartState>(EMPTY_CART);
  const [isHydrated, setIsHydrated] = useState(false);
  const slugRef = useRef(storeSlug);

  // Hidratação: lê do localStorage no mount.
  useEffect(() => {
    slugRef.current = storeSlug;
    setState(readCart(storeSlug));
    setIsHydrated(true);
  }, [storeSlug]);

  // Persiste após qualquer mudança (mas só depois de hidratar pra não
  // sobrescrever o estado lido com o EMPTY_CART inicial).
  // Onda 31 (2026-05-27): se writeCart falhar (quota cheia / privacy
  // mode), avisa cliente UMA vez via toast — antes era fail silent e
  // cliente perdia carrinho ao recarregar sem entender o porquê.
  // O ref evita repetir o toast a cada mudança seguinte (já avisou).
  const persistFailedRef = useRef(false);
  useEffect(() => {
    if (!isHydrated) return;
    const ok = writeCart(slugRef.current, state);
    if (!ok && !persistFailedRef.current && state.items.length > 0) {
      persistFailedRef.current = true;
      // Import dinâmico pra evitar inflar bundle com sonner em rotas
      // que não usam useCart.
      void import("sonner").then(({ toast }) => {
        toast.warning("Não foi possível salvar a sacola", {
          description:
            "Seu navegador pode estar com armazenamento cheio ou em modo privado. A sacola some se você fechar a aba.",
          duration: 6000,
        });
      });
    }
  }, [state, isHydrated]);

  const addItem = useCallback((input: AddItemInput) => {
    setState((prev) => {
      const payload: AddItemPayload = {
        productId: input.productId,
        variantId: input.variantId,
        productSlug: input.productSlug,
        productName: input.productName,
        variantName: input.variantName,
        imageUrl: input.imageUrl,
        cachedPriceCents: input.cachedPriceCents,
        cachedStockQty: input.cachedStockQty,
        quantity: input.quantity ?? 1,
      };
      const items = addItemToItems(prev.items, payload);
      return { ...prev, items, savedAt: new Date().toISOString() };
    });
    // Sinaliza pra UI (minicart drawer) abrir automaticamente após add.
    // Evento custom evita acoplar use-cart com sacola-drawer; qualquer
    // listener interessado (ex: animação de feedback) pode reagir.
    if (typeof window !== "undefined") {
      const lineKey = `${input.productId}:${input.variantId ?? "_"}`;
      window.dispatchEvent(
        new CustomEvent("Mangos Pay:cart-added", { detail: { lineKey } }),
      );
    }
  }, []);

  const removeItem = useCallback(
    (productId: string, variantId: string | null) => {
      setState((prev) => {
        const nextItems = prev.items.filter(
          (it) => !sameCartLine(it, { productId, variantId }),
        );
        return {
          ...prev,
          items: nextItems,
          savedAt: new Date().toISOString(),
        };
      });
    },
    [],
  );

  const updateQty = useCallback(
    (productId: string, variantId: string | null, qty: number) => {
      if (qty <= 0) {
        removeItem(productId, variantId);
        return;
      }
      setState((prev) => {
        const idx = prev.items.findIndex((it) =>
          sameCartLine(it, { productId, variantId }),
        );
        if (idx < 0) return prev;
        const next = [...prev.items];
        const item = next[idx];
        next[idx] = {
          ...item,
          quantity: capCartQuantity(qty, item.cachedStockQty),
        };
        return { ...prev, items: next, savedAt: new Date().toISOString() };
      });
    },
    [removeItem],
  );

  const clearCart = useCallback(() => {
    setState(EMPTY_CART);
    clearStorage(slugRef.current);
  }, []);

  const value = useMemo<CartContextValue>(() => {
    const count = state.items.reduce((acc, it) => acc + it.quantity, 0);
    const subtotalCents = state.items.reduce(
      (acc, it) => acc + it.cachedPriceCents * it.quantity,
      0,
    );
    return {
      isHydrated,
      state,
      count,
      subtotalCents,
      addItem,
      removeItem,
      updateQty,
      clearCart,
    };
  }, [state, isHydrated, addItem, removeItem, updateQty, clearCart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart só pode ser usado dentro de <CartProvider>");
  }
  return ctx;
}
