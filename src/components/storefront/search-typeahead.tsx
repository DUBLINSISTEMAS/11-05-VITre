"use client";

/**
 * SearchTypeahead — Onda 6 (2026-05-27).
 *
 * Combobox ARIA acoplado ao input principal de /buscar.
 *
 * UX:
 *  - Digitar 2+ chars dispara fetch (debounce 200ms).
 *  - Até 6 resultados no dropdown (thumb + nome + preço).
 *  - "Ver todos os {N}" no rodapé quando total > 6 (link pra /buscar?q=).
 *  - Enter sem item selecionado: submit do form (vai pra /buscar?q=).
 *  - Enter com item selecionado: navega pro PDP.
 *  - ↑↓ navega, Home/End extremos, Esc fecha, click fora fecha.
 *  - Estado loading mostra skeleton inline (não trocar o dropdown inteiro
 *    pra evitar flicker entre teclas).
 *
 * A11y: WAI-ARIA Combobox 1.2 pattern. role="combobox" no input com
 * aria-expanded, aria-controls e aria-activedescendant. role="listbox"
 * no container, role="option" nos itens. Cada option tem id estável
 * pra aria-activedescendant funcionar.
 *
 * Onda 6 NÃO substitui a página /buscar — é overlay sobre o input dela.
 * O cliente que ignora o dropdown e dá Enter continua indo pra listagem
 * cheia normalmente (caminho preservado).
 */
import { Loader2, Search as SearchIcon, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";

import {
  searchTypeahead,
  type TypeaheadHit,
} from "@/actions/storefront/search-typeahead";
import { formatBRL } from "@/lib/pricing";
import { cn } from "@/lib/utils";

const DEBOUNCE_MS = 200;
const MIN_CHARS = 2;

export interface SearchTypeaheadProps {
  storeSlug: string;
  /** Valor inicial do input (vem do searchParam `q` na SSR). */
  initialQuery?: string;
}

interface FetchState {
  query: string;
  items: TypeaheadHit[];
  total: number;
  loading: boolean;
  error: boolean;
}

const INITIAL_STATE: FetchState = {
  query: "",
  items: [],
  total: 0,
  loading: false,
  error: false,
};

export function SearchTypeahead({ storeSlug, initialQuery = "" }: SearchTypeaheadProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [query, setQuery] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [state, setState] = useState<FetchState>(INITIAL_STATE);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeqRef = useRef(0);

  const listboxId = useId();
  const optionId = (idx: number) => `${listboxId}-opt-${idx}`;

  /* ───────── fetch com debounce + cancelamento por sequência ──────── */
  useEffect(() => {
    const trimmed = query.trim();

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (trimmed.length < MIN_CHARS) {
      setState({ ...INITIAL_STATE, query: trimmed });
      return;
    }

    // Loading state imediato (skeleton aparece sem esperar debounce).
    setState((s) => ({ ...s, loading: true, error: false, query: trimmed }));

    debounceRef.current = setTimeout(() => {
      const seq = ++requestSeqRef.current;
      startTransition(() => {
        void (async () => {
          const result = await searchTypeahead(storeSlug, trimmed);
          // Descartar resposta stale (outra digitação saiu na frente).
          if (seq !== requestSeqRef.current) return;
          if (result.ok) {
            setState({
              query: trimmed,
              items: result.items,
              total: result.total,
              loading: false,
              error: false,
            });
          } else {
            setState({
              query: trimmed,
              items: [],
              total: 0,
              loading: false,
              error: true,
            });
          }
        })();
      });
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, storeSlug]);

  /* ──────────── click-outside fecha o dropdown ──────────── */
  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setHighlight(-1);
      }
    }
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  /* ──────────────── navegação ───────────────── */
  const navigateToProduct = useCallback(
    (slug: string) => {
      router.push(`/${storeSlug}/produto/${slug}`);
      setOpen(false);
      setHighlight(-1);
    },
    [router, storeSlug],
  );

  const trimmed = query.trim();
  const showDropdown =
    open &&
    trimmed.length >= MIN_CHARS &&
    (state.loading || state.error || state.items.length > 0 || state.query === trimmed);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const itemCount = state.items.length;

    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setHighlight(-1);
      inputRef.current?.blur();
      return;
    }

    if (!showDropdown || itemCount === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % itemCount);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h <= 0 ? itemCount - 1 : h - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setHighlight(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setHighlight(itemCount - 1);
    } else if (e.key === "Enter") {
      if (highlight >= 0 && highlight < itemCount) {
        // Item selecionado: navega pro PDP. Preventa o submit do form.
        e.preventDefault();
        navigateToProduct(state.items[highlight]!.slug);
      }
      // Senão: form submit padrão vai pra /buscar?q=
    } else if (e.key === "Tab") {
      // Tab natural pro próximo elemento, fecha dropdown sem interromper.
      setOpen(false);
      setHighlight(-1);
    }
  };

  const handleClear = (e: FormEvent) => {
    e.preventDefault();
    setQuery("");
    setHighlight(-1);
    inputRef.current?.focus();
  };

  return (
    <div ref={wrapperRef} className="relative flex-1">
      {/* Onda 18 (2026-05-27): texto do input agora bate EXATAMENTE com o
          trigger da home — text-[13px] font-medium tracking-[-0.1px].
          Antes era text-base (16px) mobile pra evitar zoom iOS no focus.
          Aceitamos o trade-off do zoom: paridade visual > micro-incomodo
          do zoom (cliente raramente digita; usa categorias visuais). */}
      <SearchIcon
        className="pointer-events-none absolute left-3.5 top-1/2 size-[17px] -translate-y-1/2 text-muted-foreground"
        strokeWidth={1.8}
        aria-hidden
      />
      <input
        ref={inputRef}
        type="search"
        name="q"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlight(-1);
        }}
        onFocus={() => {
          if (trimmed.length >= MIN_CHARS) setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        placeholder="Buscar produtos"
        className="h-10 w-full rounded-full bg-muted pl-10 pr-10 text-[13px] font-medium tracking-[-0.1px] text-foreground outline-none transition-colors placeholder:font-medium placeholder:text-muted-foreground hover:bg-muted/80 focus:bg-muted/70 focus:ring-2 focus:ring-ring"
        aria-label="Buscar produtos"
        autoComplete="off"
        enterKeyHint="search"
        role="combobox"
        aria-expanded={showDropdown}
        aria-controls={listboxId}
        aria-activedescendant={highlight >= 0 ? optionId(highlight) : undefined}
        aria-autocomplete="list"
      />
      {query && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
          aria-label="Limpar busca"
        >
          <X className="size-3.5" />
        </button>
      )}

      {showDropdown && (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Sugestões de produtos"
          className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 max-h-[60vh] overflow-y-auto rounded-xl border border-border bg-background shadow-lg"
        >
          {state.loading && state.items.length === 0 ? (
            <DropdownStatus>
              <Loader2 className="size-4 animate-spin" />
              <span>Buscando...</span>
            </DropdownStatus>
          ) : state.error ? (
            <DropdownStatus>
              <span className="text-destructive">Erro ao buscar. Tente novamente.</span>
            </DropdownStatus>
          ) : state.items.length === 0 ? (
            <DropdownStatus>
              <span>Nenhum produto encontrado para "{trimmed}".</span>
            </DropdownStatus>
          ) : (
            <>
              <ul className="py-1">
                {state.items.map((item, idx) => {
                  const isHighlighted = idx === highlight;
                  return (
                    <li key={item.id} role="option" id={optionId(idx)} aria-selected={isHighlighted}>
                      <Link
                        href={`/${storeSlug}/produto/${item.slug}`}
                        onPointerDown={(e) => {
                          // Previne o click-outside fechar antes da navegação
                          // (pointerdown dispara antes do click).
                          e.preventDefault();
                          navigateToProduct(item.slug);
                        }}
                        onMouseEnter={() => setHighlight(idx)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 text-left outline-none transition-colors",
                          isHighlighted && "bg-muted",
                        )}
                      >
                        <div className="relative size-12 shrink-0 overflow-hidden rounded-md bg-muted">
                          {item.thumbUrl ? (
                            <Image
                              src={item.thumbUrl}
                              alt=""
                              fill
                              sizes="48px"
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground/60">
                              sem foto
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {item.name}
                          </p>
                          <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                            {formatBRL(item.priceInCents)}
                          </p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              {state.total > state.items.length && (
                <Link
                  href={`/${storeSlug}/buscar?q=${encodeURIComponent(trimmed)}`}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    router.push(
                      `/${storeSlug}/buscar?q=${encodeURIComponent(trimmed)}`,
                    );
                    setOpen(false);
                  }}
                  className="flex items-center justify-center gap-1.5 border-t border-border px-3 py-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                >
                  Ver todos os {state.total} resultados
                </Link>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function DropdownStatus({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-muted-foreground">
      {children}
    </div>
  );
}
