import { BoxesIcon, InfoIcon, PackageIcon, SearchXIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { z } from "zod";

import {
  listStockMovements,
  loadStockKpis,
} from "@/actions/stock/load";
import type { StockMovement } from "@/actions/stock/types";
import { StockKpiCards } from "@/components/admin/stock-kpis";
import { StockMovementsTable } from "@/components/admin/stock-movements-table";
import { StockToolbar } from "@/components/admin/stock-toolbar";
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
 * Listagem de movimentações de estoque — port Dublin v3 (ADR-0019, Onda A.10).
 * Continua URL-driven (CLAUDE.md #11). Filtros: q (nome de produto), type
 * (enum), page. Ordenação fixa por createdAt desc.
 *
 * Decisões pixel-perfect vs handoff (B3EstoqueScreen):
 * - H1 inline 24px font-bold tracking -0.025em (substitui AdminPageHeader)
 * - CTA "Nova movimentação" → Link pra /admin/produtos com hint (movimentação
 *   nasce per-produto via dialog em /admin/produtos/[id])
 * - KPI cards (StockKpiCards) PRESERVADOS acima da tabela (snapshot Vitrê)
 * - `b3-card` wrapping helpbar + toolbar + tabela + pager
 * - Handoff mostra SNAPSHOT por produto (saldo+min+status), Vitrê mostra
 *   FEED de movimentações (event-sourced). Mantemos semântica + visual Dublin
 *   (memory `handoff-vs-schema-respect-data-model`).
 *
 * Read-only. Movimentações nascem de:
 *   - Backfill SQL 25 (saldo inicial)
 *   - Checkout WhatsApp / PDV (sale)
 *   - Cancelamento/expiração de pedido (return)
 *   - Action `recordStockMovement` via dialog no editor de produto
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
  const offset = (page - 1) * PAGE_SIZE;
  const rangeStart = total === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(offset + PAGE_SIZE, total);
  const rangeLabel =
    total === 0 ? "0 de 0" : `${rangeStart} – ${rangeEnd} de ${total}`;

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
      {/* H1 + CTAs Dublin v3 (substitui AdminPageHeader) */}
      <div className="flex items-end justify-between gap-4">
        <h1 className="text-[24px] font-bold tracking-[-0.025em] text-ink-1">
          Estoque
        </h1>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/estoque/relatorio"
            className="b3-btn"
            prefetch
            title="Gera relatório A4 imprimível com logo e dados da loja"
          >
            <span className="hidden sm:inline">Gerar relatório</span>
            <span className="sm:hidden">Relatório</span>
          </Link>
          <Link
            href="/admin/produtos"
            className="b3-btn b3-btn--cta"
            prefetch
            title="Selecione um produto pra lançar movimentação manual"
          >
            <PackageIcon size={14} aria-hidden />
            <span className="hidden sm:inline">Nova movimentação</span>
            <span className="sm:hidden">Nova</span>
          </Link>
        </div>
      </div>

      {/* KPI cards Vitrê — preservados sobre layout BAGY */}
      <StockKpiCards kpis={kpis} />

      {items.length === 0 && !hasFilters ? (
        <EmptyState />
      ) : (
        <div className="b3-card overflow-hidden">
          {/* Helpbar topo */}
          <div className="b3-helpbar" style={{ borderRadius: "12px 12px 0 0" }}>
            <span className="b3-helpbar-ico">
              <InfoIcon className="size-3.5" aria-hidden />
            </span>
            <span className="b3-helpbar-text">
              Cada venda, devolução ou ajuste vira uma linha aqui — histórico
              completo e auditável.
            </span>
          </div>

          {/* Toolbar: busca + tipo + counter */}
          <Suspense
            fallback={<div className="bg-bg-app h-14 animate-pulse" />}
          >
            <StockToolbar rangeLabel={rangeLabel} />
          </Suspense>

          {items.length === 0 ? (
            <NoResults />
          ) : (
            <StockMovementsTable movements={items} />
          )}

          {items.length > 0 ? (
            <div className="border-t border-line p-3">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                buildHref={buildHref}
              />
            </div>
          ) : null}
        </div>
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
    <div className="flex flex-col items-center gap-3 p-8 text-center sm:p-12">
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
