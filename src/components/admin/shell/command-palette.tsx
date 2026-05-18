"use client";

/**
 * Command palette do admin (B.7).
 *
 * Atalho ⌘K (Mac) / Ctrl+K (Win) abre o overlay. Busca debounced 200ms chama
 * `globalSearch` server action e renderiza hits agrupados por kind. Setas ↑↓
 * navegam, Enter abre, Esc fecha. Sem deps externas (sem cmdk).
 *
 * Atalhos rápidos (sem query) listam ações estáticas — novo produto, novo
 * cliente, ir pra PDV etc.
 */
import {
  PackageIcon,
  PlusIcon,
  SearchIcon,
  ShoppingBagIcon,
  StoreIcon,
  UserIcon,
  UsersIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { globalSearch, type SearchHit } from "@/actions/search/global";

type QuickAction = {
  label: string;
  href: string;
  hint: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    label: "Novo produto",
    href: "/admin/produtos/novo",
    hint: "Cadastrar produto novo",
    icon: PlusIcon,
  },
  {
    label: "Novo cliente",
    href: "/admin/clientes?novo=1",
    hint: "Cadastrar cliente no admin",
    icon: UserIcon,
  },
  {
    label: "Abrir PDV",
    href: "/admin/pdv",
    hint: "Venda de balcão",
    icon: ShoppingBagIcon,
  },
  {
    label: "Pedidos",
    href: "/admin/pedidos",
    hint: "Lista de pedidos",
    icon: PackageIcon,
  },
  {
    label: "Clientes",
    href: "/admin/clientes",
    hint: "Lista de clientes",
    icon: UsersIcon,
  },
  {
    label: "Configurações da loja",
    href: "/admin/configuracoes",
    hint: "Nome, logo, redes",
    icon: StoreIcon,
  },
];

function kindLabel(k: SearchHit["kind"]) {
  if (k === "product") return "Produtos";
  if (k === "customer") return "Clientes";
  return "Pedidos";
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Atalho global ⌘K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Listener no botão de busca da topbar (custom event)
  useEffect(() => {
    const opener = () => setOpen(true);
    window.addEventListener("admin:open-palette", opener);
    return () => window.removeEventListener("admin:open-palette", opener);
  }, []);

  // Reset state ao fechar
  useEffect(() => {
    if (!open) {
      setQuery("");
      setHits([]);
      setActiveIndex(0);
      return;
    }
    // foco no input ao abrir
    const id = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(id);
  }, [open]);

  // Debounced search
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const id = setTimeout(() => {
      globalSearch({ q: trimmed })
        .then((r) => {
          setHits(r);
          setActiveIndex(0);
        })
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(id);
  }, [query]);

  // Items combinados (quick actions OR hits)
  const items = useMemo(() => {
    if (query.trim()) return hits;
    return QUICK_ACTIONS.map<SearchHit & { _quick: true }>((a) => ({
      kind: "product",
      id: a.href,
      label: a.label,
      sublabel: a.hint,
      href: a.href,
      _quick: true,
    }));
  }, [query, hits]);

  const grouped = useMemo(() => {
    if (!query.trim()) return null;
    const map = new Map<string, SearchHit[]>();
    for (const h of hits) {
      const k = kindLabel(h.kind);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(h);
    }
    return Array.from(map.entries());
  }, [query, hits]);

  const navigate = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(items.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = items[activeIndex];
      if (target) navigate(target.href);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  if (!open) return null;

  let flatIndex = -1;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 px-4 pt-[10vh]"
      onClick={() => setOpen(false)}
      role="presentation"
    >
      <div
        className="bg-surface w-full max-w-xl overflow-hidden rounded-xl border shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal
        aria-label="Buscar no Vitrê"
      >
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <SearchIcon size={18} className="text-ink-3" aria-hidden />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Buscar produto, cliente, pedido… ou ação rápida"
            className="text-ink-1 placeholder:text-ink-4 flex-1 bg-transparent text-[14px] outline-none"
            aria-label="Buscar"
          />
          <kbd className="text-ink-4 hidden text-[10px] sm:inline">ESC</kbd>
        </div>

        <div className="max-h-[420px] overflow-y-auto py-2">
          {loading && (
            <div className="text-ink-4 px-4 py-2 text-[12px]">Buscando…</div>
          )}
          {!loading && query.trim() && hits.length === 0 && (
            <div className="text-ink-3 px-4 py-6 text-center text-[13px]">
              Nada encontrado para {`"${query}"`}.
            </div>
          )}

          {!query.trim() && (
            <>
              <div className="text-ink-4 px-4 pt-1 pb-1 text-[10px] font-semibold tracking-wider uppercase">
                Ações rápidas
              </div>
              {QUICK_ACTIONS.map((a, i) => {
                flatIndex++;
                const isActive = flatIndex === activeIndex;
                const Icon = a.icon;
                return (
                  <button
                    key={a.href}
                    type="button"
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => navigate(a.href)}
                    className={`flex w-full items-center gap-3 px-4 py-2 text-left text-[13px] ${
                      isActive ? "bg-ink-1/5" : ""
                    }`}
                  >
                    <Icon size={16} className="text-ink-3" />
                    <div className="flex-1">
                      <div className="text-ink-1">{a.label}</div>
                      <div className="text-ink-4 text-[11px]">{a.hint}</div>
                    </div>
                  </button>
                );
              })}
            </>
          )}

          {grouped?.map(([groupLabel, groupHits]) => (
            <div key={groupLabel}>
              <div className="text-ink-4 px-4 pt-2 pb-1 text-[10px] font-semibold tracking-wider uppercase">
                {groupLabel}
              </div>
              {groupHits.map((h) => {
                flatIndex++;
                const isActive = flatIndex === activeIndex;
                const idx = flatIndex;
                return (
                  <button
                    key={`${h.kind}:${h.id}`}
                    type="button"
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => navigate(h.href)}
                    className={`flex w-full items-center gap-3 px-4 py-2 text-left text-[13px] ${
                      isActive ? "bg-ink-1/5" : ""
                    }`}
                  >
                    <div className="flex-1">
                      <div className="text-ink-1">{h.label}</div>
                      <div className="text-ink-4 text-[11px]">{h.sublabel}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="bg-ink-1/[0.03] text-ink-4 flex items-center justify-between border-t px-4 py-2 text-[10px]">
          <span>↑↓ navegar · ↵ abrir · ESC fechar</span>
          <span>⌘K / Ctrl+K</span>
        </div>
      </div>
    </div>
  );
}
