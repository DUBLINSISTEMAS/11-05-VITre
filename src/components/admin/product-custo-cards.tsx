"use client";

/**
 * Bloco F (2026-05-29) — `ProductCustoCards`.
 *
 * Wrapper da nova tela `/admin/produtos/custos`:
 *   - Header com contadores (Total / Com custo / Sem custo) + Quick Add
 *   - Filtros (busca, categoria, status, tipo)
 *   - Grid de <ProductCustoCard/> (1 coluna mobile, 2 colunas desktop)
 *   - Banner "Mostrando N de M" + dica pra refinar filtro
 *
 * Filtros viram URL params (?q=, ?categoria=, ?status=, ?tipo=). Mudanças
 * disparam `router.replace` — server re-fetch via `loadCustoProducts`.
 * Busca debounced 350ms pra não bombardear o server.
 */

import {
  PackagePlusIcon,
  SearchIcon,
  SlidersHorizontalIcon,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import type {
  CustoKind,
  CustoProductRow,
  CustoStatus,
} from "@/actions/product/load-for-custo";
import { ProductCustoCard } from "@/components/admin/product-custo-card";
import { ProductQuickAddDialog } from "@/components/admin/product-quick-add-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { StoreFeeConfig } from "@/lib/pricing/net-profit";

interface ProductCustoCardsProps {
  products: CustoProductRow[];
  storeFees: StoreFeeConfig;
  categories: Array<{ id: string; name: string }>;
  filters: {
    search: string;
    categoryId: string;
    status: CustoStatus;
    kind: CustoKind;
  };
  totals: {
    total: number;
    totalAll: number;
    withCost: number;
    withoutCost: number;
    truncated: boolean;
  };
}

const KIND_OPTIONS: Array<{ value: CustoKind; label: string }> = [
  { value: "finished_good", label: "Produtos pra venda" },
  { value: "raw_material", label: "Itens de gestão (matéria-prima)" },
  { value: "service", label: "Serviços" },
  { value: "all", label: "Todos os tipos" },
];

const STATUS_OPTIONS: Array<{ value: CustoStatus; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "without_cost", label: "Sem custo" },
  { value: "with_cost", label: "Com custo" },
];

const NO_CATEGORY = "__all__";

export function ProductCustoCards({
  products,
  storeFees,
  categories,
  filters,
  totals,
}: ProductCustoCardsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [searchInput, setSearchInput] = useState(filters.search);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateParams = useMemo(
    () => (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "") next.delete(k);
        else next.set(k, v);
      }
      const qs = next.toString();
      startTransition(() => {
        router.replace(qs ? `/admin/produtos/custos?${qs}` : "/admin/produtos/custos");
      });
    },
    [router, searchParams],
  );

  // Busca debounced — atualiza URL 350ms após o lojista parar de digitar.
  useEffect(() => {
    if (searchInput === filters.search) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateParams({ q: searchInput.trim() || null });
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput, filters.search, updateParams]);

  return (
    <div className="space-y-4">
      {/* Header — contadores + Quick Add */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4 text-[12px] tabular-nums">
          <div className="flex flex-col">
            <span className="text-ink-4 text-[10.5px] uppercase tracking-wide">
              Total
            </span>
            <span className="text-ink-1 font-semibold">{totals.totalAll}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-ink-4 text-[10.5px] uppercase tracking-wide">
              Com custo
            </span>
            <span className="font-semibold text-emerald-700 dark:text-emerald-300">
              {totals.withCost}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-ink-4 text-[10.5px] uppercase tracking-wide">
              Sem custo
            </span>
            <span className="font-semibold text-amber-700 dark:text-amber-300">
              {totals.withoutCost}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setQuickAddOpen(true)}
          className="b3-btn b3-btn--cta"
        >
          <PackagePlusIcon className="size-3.5" aria-hidden /> Novo produto
        </button>
      </header>

      {/* Filtros */}
      <div className="b3-card flex flex-wrap items-center gap-2 rounded-[10px] p-3">
        <div className="relative min-w-[200px] flex-1">
          <SearchIcon
            size={13}
            className="text-ink-4 pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
            aria-hidden
          />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar nome ou código interno"
            className="b3-input h-9 w-full pl-9"
            aria-label="Buscar produto"
          />
        </div>
        <Select
          value={filters.kind}
          onValueChange={(v) => updateParams({ tipo: v === "finished_good" ? null : v })}
        >
          <SelectTrigger className="h-9 min-w-[200px]">
            <SlidersHorizontalIcon className="size-3.5" aria-hidden />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {KIND_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.status}
          onValueChange={(v) =>
            updateParams({ status: v === "all" ? null : v })
          }
        >
          <SelectTrigger className="h-9 min-w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {categories.length > 0 ? (
          <Select
            value={filters.categoryId || NO_CATEGORY}
            onValueChange={(v) =>
              updateParams({ categoria: v === NO_CATEGORY ? null : v })
            }
          >
            <SelectTrigger className="h-9 min-w-[160px]">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_CATEGORY}>Todas categorias</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      {/* Banner — mostrando N de M */}
      {totals.truncated ? (
        <div className="rounded-lg border border-amber-400/30 bg-amber-50 px-3 py-2 text-[12px] text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
          Mostrando os primeiros {products.length} de {totals.total} produtos.
          Use os filtros acima pra cortar o universo.
        </div>
      ) : null}

      {/* Grid de cards OU empty state */}
      {products.length === 0 ? (
        <EmptyState
          hasFilters={
            filters.search.length > 0 ||
            filters.categoryId.length > 0 ||
            filters.status !== "all" ||
            filters.kind !== "finished_good"
          }
          onClearFilters={() =>
            updateParams({
              q: null,
              categoria: null,
              status: null,
              tipo: null,
            })
          }
          onQuickAdd={() => setQuickAddOpen(true)}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {products.map((p) => (
            <ProductCustoCard key={p.id} product={p} storeFees={storeFees} />
          ))}
        </div>
      )}

      <ProductQuickAddDialog
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        categories={categories}
      />
    </div>
  );
}

function EmptyState({
  hasFilters,
  onClearFilters,
  onQuickAdd,
}: {
  hasFilters: boolean;
  onClearFilters: () => void;
  onQuickAdd: () => void;
}) {
  if (hasFilters) {
    return (
      <div className="b3-card flex flex-col items-center gap-3 rounded-[14px] p-10 text-center">
        <p className="text-ink-2 text-[14px] font-medium">
          Nenhum produto bate com esses filtros.
        </p>
        <button
          type="button"
          onClick={onClearFilters}
          className="b3-btn b3-btn--sm"
        >
          Limpar filtros
        </button>
      </div>
    );
  }
  return (
    <div className="b3-card flex flex-col items-center gap-4 rounded-[14px] p-12 text-center">
      <div className="space-y-1">
        <p className="text-ink-1 text-[15px] font-semibold">
          Nenhum produto cadastrado ainda.
        </p>
        <p className="text-ink-4 max-w-sm text-[12.5px] leading-snug">
          Comece cadastrando o primeiro produto — cadastro mínimo (Nome +
          Preço) leva 10 segundos.
        </p>
      </div>
      <button
        type="button"
        onClick={onQuickAdd}
        className="b3-btn b3-btn--cta b3-btn--lg"
      >
        <PackagePlusIcon className="size-4" aria-hidden />
        Cadastrar primeiro produto
      </button>
    </div>
  );
}
