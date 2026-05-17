import { BoxesIcon, SearchXIcon } from "lucide-react";
import { Suspense } from "react";
import { z } from "zod";

import {
  listStockMovements,
  loadStockKpis,
  type StockMovement,
} from "@/actions/stock/load";
import { AdminPageHeader } from "@/components/admin/shell/page-header";
import { StockKpiCards } from "@/components/admin/stock-kpis";
import { StockMovementsFilters } from "@/components/admin/stock-movements-filters";
import { StockMovementsTable } from "@/components/admin/stock-movements-table";
import { Pagination } from "@/components/common/pagination";
import {
  enumOrNull,
  pageNumberSchema,
  searchTextSchema,
} from "@/lib/page-search-params";

const PAGE_SIZE = 30;

const MOVEMENT_TYPES = [
  "initial",
  "manual_in",
  "manual_out",
  "sale",
  "return",
  "adjustment",
] as const satisfies ReadonlyArray<StockMovement["movementType"]>;

const estoqueSearchSchema = z.object({
  q: searchTextSchema,
  type: enumOrNull(MOVEMENT_TYPES),
  page: pageNumberSchema,
});

interface EstoquePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Listagem de movimentações de estoque (Fase 4 — ADR-0015).
 *
 * URL-driven (convenção CLAUDE.md #11). Filtros: q (nome de produto),
 * type (enum), page. Ordenação fixa por createdAt desc — relatório
 * sempre mostra o mais recente primeiro.
 *
 * Read-only nesta versão. Movimentações nascem de:
 *   - Backfill SQL 25 (saldo inicial)
 *   - Checkout WhatsApp (sale)
 *   - Cancelamento/expiração de pedido (return)
 *   - Action `recordStockMovement` (manual_in/manual_out/adjustment) —
 *     UI standalone fica como follow-up (botão no editor de produto).
 */
export default async function EstoquePage({ searchParams }: EstoquePageProps) {
  const {
    q: rawQ,
    type: typeFilter,
    page,
  } = estoqueSearchSchema.parse(await searchParams);

  const [{ items, total }, kpis] = await Promise.all([
    listStockMovements({
      q: rawQ.trim() || undefined,
      movementType: typeFilter,
      page,
      pageSize: PAGE_SIZE,
    }),
    loadStockKpis(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = rawQ.trim() !== "" || typeFilter !== null;

  const buildHref = (nextPage: number) => {
    const usp = new URLSearchParams();
    if (rawQ.trim()) usp.set("q", rawQ.trim());
    if (typeFilter) usp.set("type", typeFilter);
    if (nextPage > 1) usp.set("page", String(nextPage));
    const qs = usp.toString();
    return qs ? `?${qs}` : "?";
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <AdminPageHeader
        title="Estoque"
        subtitle={
          total === 0
            ? hasFilters
              ? "Nenhuma movimentação bate com os filtros."
              : "As movimentações de estoque vão aparecer aqui (vendas, devoluções, ajustes)."
            : `${total} ${total === 1 ? "movimentação" : "movimentações"} registradas`
        }
      />

      <StockKpiCards kpis={kpis} />

      <Suspense
        fallback={<div className="bg-bg-app h-10 animate-pulse rounded-md" />}
      >
        <StockMovementsFilters />
      </Suspense>

      {items.length === 0 ? (
        hasFilters ? (
          <NoResults />
        ) : (
          <EmptyState />
        )
      ) : (
        <>
          <StockMovementsTable movements={items} />
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            buildHref={buildHref}
          />
        </>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="border-line flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center sm:p-12">
      <div className="bg-brand-wash text-brand flex size-12 items-center justify-center rounded-full">
        <BoxesIcon className="size-6" />
      </div>
      <h2 className="text-lg font-semibold text-ink-1">Sem movimentações ainda</h2>
      <p className="text-ink-4 max-w-sm text-sm">
        Conforme você for vendendo pelo WhatsApp ou cancelando pedidos,
        cada entrada e saída de estoque aparece aqui — com histórico
        completo e auditável.
      </p>
    </div>
  );
}

function NoResults() {
  return (
    <div className="border-line flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center sm:p-12">
      <div className="bg-bg-app text-ink-4 flex size-12 items-center justify-center rounded-full">
        <SearchXIcon className="size-6" />
      </div>
      <h2 className="text-lg font-semibold text-ink-1">Nenhuma movimentação encontrada</h2>
      <p className="text-ink-4 max-w-sm text-sm">
        Confira o filtro ou limpe a busca.
      </p>
    </div>
  );
}
