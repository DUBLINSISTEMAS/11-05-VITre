"use client";

/**
 * Hook + Provider de favoritos client-side.
 *
 * Estado vive em memória (useState) + sincroniza com localStorage.
 * Hidratação é deferida pro client (SSR renderiza vazio até `useEffect`
 * montar) — `isHydrated` flag permite componentes mostrar skeleton/0
 * durante o flash.
 *
 * Este Provider envolve a árvore do storefront via `StoreShell`. Páginas
 * fora do shell (admin, auth) NÃO têm acesso.
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

export interface FavoriteItem {
  productId: string;
  productSlug: string;
  productName: string;
  imageUrl: string | null;
  priceCents: number;
  addedAt: string;
}

interface FavoritesState {
  items: FavoriteItem[];
  savedAt: string | null;
}

const EMPTY_STATE: FavoritesState = {
  items: [],
  savedAt: null,
};

function storageKey(storeSlug: string): string {
  return `vitre-favorites-${storeSlug}`;
}

function readFavorites(storeSlug: string): FavoritesState {
  if (typeof window === "undefined") return EMPTY_STATE;
  try {
    const raw = localStorage.getItem(storageKey(storeSlug));
    if (!raw) return EMPTY_STATE;
    const parsed = JSON.parse(raw) as FavoritesState;
    if (!Array.isArray(parsed.items)) return EMPTY_STATE;
    return parsed;
  } catch {
    return EMPTY_STATE;
  }
}

function writeFavorites(storeSlug: string, state: FavoritesState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(storeSlug), JSON.stringify(state));
  } catch {
    // localStorage cheio ou indisponível — ignora silenciosamente
  }
}

export interface AddFavoriteInput {
  productId: string;
  productSlug: string;
  productName: string;
  imageUrl: string | null;
  priceCents: number;
}

interface FavoritesContextValue {
  /** True após primeiro mount no client. False durante SSR e primeira render client. */
  isHydrated: boolean;
  items: FavoriteItem[];
  /** Contagem de favoritos — para badges. */
  count: number;
  /** Verifica se um produto está nos favoritos. */
  isFavorite: (productId: string) => boolean;
  /** Adiciona um produto aos favoritos. */
  addFavorite: (input: AddFavoriteInput) => void;
  /** Remove um produto dos favoritos. */
  removeFavorite: (productId: string) => void;
  /** Toggle — adiciona se não está, remove se está. */
  toggleFavorite: (input: AddFavoriteInput) => void;
  /** Limpa todos os favoritos. */
  clearFavorites: () => void;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export interface FavoritesProviderProps {
  storeSlug: string;
  children: React.ReactNode;
}

export function FavoritesProvider({
  storeSlug,
  children,
}: FavoritesProviderProps) {
  const [state, setState] = useState<FavoritesState>(EMPTY_STATE);
  const [isHydrated, setIsHydrated] = useState(false);
  const slugRef = useRef(storeSlug);

  // Hidratação: lê do localStorage no mount.
  useEffect(() => {
    slugRef.current = storeSlug;
    setState(readFavorites(storeSlug));
    setIsHydrated(true);
  }, [storeSlug]);

  // Persiste após qualquer mudança (mas só depois de hidratar pra não
  // sobrescrever o estado lido com o EMPTY_STATE inicial).
  useEffect(() => {
    if (!isHydrated) return;
    writeFavorites(slugRef.current, state);
  }, [state, isHydrated]);

  const isFavorite = useCallback(
    (productId: string) => {
      return state.items.some((item) => item.productId === productId);
    },
    [state.items]
  );

  const addFavorite = useCallback((input: AddFavoriteInput) => {
    setState((prev) => {
      // Já está nos favoritos? Não duplica.
      if (prev.items.some((item) => item.productId === input.productId)) {
        return prev;
      }
      const newItem: FavoriteItem = {
        ...input,
        addedAt: new Date().toISOString(),
      };
      return {
        items: [...prev.items, newItem],
        savedAt: new Date().toISOString(),
      };
    });
  }, []);

  const removeFavorite = useCallback((productId: string) => {
    setState((prev) => ({
      items: prev.items.filter((item) => item.productId !== productId),
      savedAt: new Date().toISOString(),
    }));
  }, []);

  const toggleFavorite = useCallback(
    (input: AddFavoriteInput) => {
      if (isFavorite(input.productId)) {
        removeFavorite(input.productId);
      } else {
        addFavorite(input);
      }
    },
    [isFavorite, addFavorite, removeFavorite]
  );

  const clearFavorites = useCallback(() => {
    setState(EMPTY_STATE);
    if (typeof window !== "undefined") {
      localStorage.removeItem(storageKey(slugRef.current));
    }
  }, []);

  const value = useMemo<FavoritesContextValue>(() => {
    return {
      isHydrated,
      items: state.items,
      count: state.items.length,
      isFavorite,
      addFavorite,
      removeFavorite,
      toggleFavorite,
      clearFavorites,
    };
  }, [
    state.items,
    isHydrated,
    isFavorite,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    clearFavorites,
  ]);

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) {
    throw new Error(
      "useFavorites só pode ser usado dentro de <FavoritesProvider>"
    );
  }
  return ctx;
}
