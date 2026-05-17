"use client";

// Hide-values toggle do dashboard — port Dublin v3 (ADR-0019, Onda A.5).
// Botão eye/eye-off no header do card de vendas que esconde TODOS os valores
// monetários do dashboard. Persiste em localStorage key
// `vitre.dashboard.hide-values`.
//
// Implementação leve via Context — provider envolve o SalesSummaryCard,
// consumers (5 stats) leem `hidden` e renderizam "•••••" em vez do valor.
//
// SSR-safe: começa hidden=false; useEffect lê localStorage e sincroniza.
// Pequeno flicker possível na primeira pintura — aceitável trade-off (não
// vale renderizar tudo blurred no server pra evitar 1 frame).

import { EyeIcon, EyeOffIcon } from "lucide-react";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

const STORAGE_KEY = "vitre.dashboard.hide-values";

interface HideValuesContextValue {
  hidden: boolean;
  toggle: () => void;
}

const HideValuesContext = createContext<HideValuesContextValue | null>(null);

export function HideValuesProvider({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") {
        setHidden(true);
      }
    } catch {
      // private mode — segue silencioso
    }
  }, []);

  const toggle = () => {
    setHidden((h) => {
      const next = !h;
      try {
        if (typeof window !== "undefined") {
          if (next) localStorage.setItem(STORAGE_KEY, "1");
          else localStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        // ignore
      }
      return next;
    });
  };

  return (
    <HideValuesContext.Provider value={{ hidden, toggle }}>
      {children}
    </HideValuesContext.Provider>
  );
}

export function useHideValues(): HideValuesContextValue {
  const ctx = useContext(HideValuesContext);
  if (!ctx) {
    // Fora do provider: comporta-se como "sempre visível". Não throw —
    // permite reutilizar HiddenValue em outras telas sem provider.
    return { hidden: false, toggle: () => {} };
  }
  return ctx;
}

/**
 * Botão eye/eye-off. Usado no header do card de vendas.
 * Pequeno (28px), sem borda, ink-4 → ink-1 no hover.
 */
export function HideValuesToggle() {
  const { hidden, toggle } = useHideValues();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={hidden}
      aria-label={hidden ? "Mostrar valores" : "Esconder valores"}
      title={hidden ? "Mostrar valores" : "Esconder valores"}
      className="inline-flex size-7 items-center justify-center rounded-md text-ink-4 outline-none transition-colors hocus:bg-bg-app hocus:text-ink-1 focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      {hidden ? <EyeOffIcon size={15} /> : <EyeIcon size={15} />}
    </button>
  );
}

/**
 * Wrapper de valor monetário. Quando `hidden`, renderiza "••••••" no lugar
 * do conteúdo mas preserva o aria-label original pra acessibilidade.
 */
export function HiddenValue({
  children,
  fallback = "••••••",
  className,
}: {
  children: ReactNode;
  fallback?: string;
  className?: string;
}) {
  const { hidden } = useHideValues();
  if (hidden) {
    return (
      <span aria-hidden className={className}>
        {fallback}
      </span>
    );
  }
  return <span className={className}>{children}</span>;
}
