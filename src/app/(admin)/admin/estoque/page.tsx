import {
  BoxesIcon,
  ClipboardListIcon,
  InfoIcon,
  SearchXIcon,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { z } from "zod";

import { loadCategoriesForPdv } from "@/actions/category/load-for-pdv";
import {
  listStockMovements,
  loadStockKpis,
  loadStockSnapshot,
  loadStockSnapshotCounts,
} from "@/actions/stock/load";
import type {
  StockMovement,
  StockSnapshotSort,
  StockSnapshotStatus,
} from "@/actions/stock/types";
import { EstoqueViewTabs } from "@/components/admin/estoque-view-tabs";
import { StockKpiCards } from "@/components/admin/stock-kpis";
import { StockMovementsTable } from "@/components/admin/stock-movements-table";
import { StockSnapshotStatusChips } from "@/components/admin/stock-snapshot-status-chips";
import { StockSnapshotTable } from "@/components/admin/stock-snapshot-table";
import { StockSnapshotToolbar } from "@/components/admin/stock-snapshot-toolbar";
import { StockToolbar } from "@/components/admin/stock-toolbar";
import { Pagination } from "@/components/common/pagination";
import {
  enumOrNull,
  idOrNullSchema,
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

const SNAPSHOT_STATUS_VALUES = [
  "with-stock",
  "zero",
  "low",
  "no-tracking",
] as const satisfies ReadonlyArray<Exclude<StockSnapshotStatus, "all">>;

const SNAPSHOT_SORT_VALUES = [
  "name-asc",
  "name-desc",
  "stock-asc",
  "stock-desc",
  "min-asc",
  "min-desc",
] as const satisfies ReadonlyArray<StockSnapshotSort>;

// PP9 (handoff 2026-05-25) — "alertas" volta como tab dedicada (handoff
// tem 3 tabs: Saldo / Movimentações / Alertas).
const VIEW_VALUES = ["saldo", "historico", "alertas"] as const;

const estoqueSearchSchema = z.object({
  view: z.enum(VIEW_VALUES).catch("saldo"),
  q: searchTextSchema,
  type: enumOrNull(MOVEMENT_TYPES),
  status: enumOrNull(SNAPSHOT_STATUS_VALUES),
  categoryId: idOrNullSchema,
  sort: enumOrNull(SNAPSHOT_SORT_VALUES),
  page: pageNumberSchema,
});

interface EstoquePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * `/admin/estoque` — Onda 1.4 (2026-05-24).
 *
 * Duas views, URL-driven via `?view=saldo|historico`:
 *
 *   - "saldo" (default): SNAPSHOT por produto (saldo + min + status).
 *     Mental model do lojista — planilha-tipo-contador. Antes era escondido
 *     em /admin/estoque/relatorio; agora vira a porta de entrada.
 *
 *   - "historico": FEED event-sourced de movimentações (era a única view
 *     anterior). Útil pra auditoria forense: "quem moveu o quê quando?".
 *
 * Filtros são por view (snapshot tem chips de status, feed tem chips de
 * type). Trocar de view limpa o param do outro pra não confundir.
 *
 * KPIs em cima são compartilhados (sempre carregados) — saldo atual,
 * entradas/saídas/ajustes do mês.
 *
 * Read-only — movimentações nascem de:
 *   - Backfill SQL 25 (saldo inicial)
 *   - Checkout WhatsApp / PDV (sale)
 *   - Cancelamento/expiração de pedido (return)
 *   - Action `recordStockMovement` via dialog (no editor de produto OU
 *     no botão "+" inline da tabela snapshot)
 */
export default async function EstoquePage({ searchParams }: EstoquePageProps) {
  const params = estoqueSearchSchema.parse(await searchParams);
  const isFeed = params.view === "historico";
  const isAlerts = params.view === "alertas";

  // KPIs sempre — visão geral fica em cima das três views.
  const kpis = await loadStockKpis();

  // PP9 — count de alertas (zerados + abaixo do min) pra pill na tab.
  // Usa loadStockSnapshotCounts (já existente — retorna { all, zero, low,
  // ... }) — sem query nova.
  const snapshotCounts = await loadStockSnapshotCounts();
  const alertCount =
    (snapshotCounts.zero ?? 0) + (snapshotCounts.low ?? 0);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* H1 + sub + CTAs. S6 (handoff pixel-perfect 2026-05-25): vira
          `.b3-page-title` + `.b3-page-sub` (handoff estoque.jsx:12-13). */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="b3-page-title">Estoque</h1>
          <p className="b3-page-sub">
            Saldo atual, movimentações e alertas de produtos abaixo do mínimo
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Onda 1.4 (2026-05-24): CTA "Nova entrada (compra)" REMOVIDO
              da tela de estoque. Founder reportou que confundia ("por que
              compra na tela de estoque?"). Pra movimentação rápida, agora
              tem botão "+" inline em cada linha de produto. Compra de
              fornecedor continua disponível no menu (Gestão → Compras). */}
          <Link
            href="/admin/estoque/contagem"
            className="b3-btn"
            prefetch
            title="Ajuste em massa por contagem física (planilha-de-papel)"
          >
            <ClipboardListIcon size={14} aria-hidden />
            <span className="hidden sm:inline">Contagem física</span>
            <span className="sm:hidden">Contagem</span>
          </Link>
          <Link
            href="/admin/estoque/relatorio"
            className="b3-btn"
            prefetch
            title="Gera relatório A4 imprimível com logo e dados da loja"
          >
            <span className="hidden sm:inline">Imprimir / Exportar</span>
            <span className="sm:hidden">Imprimir</span>
          </Link>
        </div>
      </div>

      {/* KPIs sempre visíveis */}
      <StockKpiCards kpis={kpis} />

      {/* Tabs primárias — Saldo (default) | Movimentações | Alertas (PP9) */}
      <Suspense fallback={<div className="b3-tabs h-12" />}>
        <EstoqueViewTabs alertCount={alertCount} />
      </Suspense>

      {isFeed ? (
        <FeedView page={params.page} q={params.q} typeFilter={params.type} />
      ) : isAlerts ? (
        <AlertsView
          page={params.page}
          q={params.q}
          categoryId={params.categoryId}
          sort={params.sort ?? "stock-asc"}
        />
      ) : (
        <SnapshotView
          page={params.page}
          q={params.q}
          status={params.status}
          categoryId={params.categoryId}
          sort={params.sort ?? "name-asc"}
        />
      )}
    </div>
  );
}

// ============================================================
// View: SNAPSHOT (default — saldo por produto)
// ============================================================
async function SnapshotView({
  page,
  q,
  status,
  categoryId,
  sort,
}: {
  page: number;
  q: string;
  status: StockSnapshotStatus | null;
  categoryId: string | null;
  sort: StockSnapshotSort;
}) {
  const effectiveStatus: StockSnapshotStatus =
    status === null ? "all" : status;

  const [{ items, total }, counts, categories] = await Promise.all([
    loadStockSnapshot({
      q: q.trim() || undefined,
      status: effectiveStatus,
      categoryId,
      sort,
      page,
      pageSize: PAGE_SIZE,
    }),
    loadStockSnapshotCounts(),
    // Sprint flash 2026-05-24 (Bloco 4) — categorias pro Select do toolbar.
    // Reusa loadCategoriesForPdv (mesmo retorno; o count de produtos a
    // gente ignora aqui pra não estressar a UI).
    loadCategoriesForPdv(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters =
    q.trim() !== "" || status !== null || categoryId !== null;
  const offset = (page - 1) * PAGE_SIZE;
  const rangeStart = total === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(offset + PAGE_SIZE, total);
  const rangeLabel =
    total === 0
      ? "0 de 0"
      : `${rangeStart} – ${rangeEnd} de ${total}`;

  const buildHref = (nextPage: number) => {
    const usp = new URLSearchParams();
    if (q.trim()) usp.set("q", q.trim());
    if (status !== null) usp.set("status", status);
    if (categoryId) usp.set("categoryId", categoryId);
    if (sort !== "name-asc") usp.set("sort", sort);
    if (nextPage > 1) usp.set("page", String(nextPage));
    const qs = usp.toString();
    return qs ? `?${qs}` : "?";
  };

  // Empty state quando loja ainda não tem produto.
  if (items.length === 0 && !hasFilters) {
    return <EmptySnapshot />;
  }

  return (
    <div className="b3-card overflow-hidden">
      <div className="b3-helpbar" style={{ borderRadius: "12px 12px 0 0" }}>
        <span className="b3-helpbar-ico">
          <InfoIcon className="size-3.5" aria-hidden />
        </span>
        <span className="b3-helpbar-text">
          Saldo atualizado a cada venda, devolução ou ajuste. Use &ldquo;+&rdquo;
          pra lançar entrada/saída rápida sem sair desta tela.
        </span>
      </div>
      <Suspense fallback={<div className="b3-tabs h-12" />}>
        <StockSnapshotStatusChips counts={counts} />
      </Suspense>
      <Suspense fallback={<div className="b3-toolbar h-14" />}>
        <StockSnapshotToolbar
          categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        />
      </Suspense>
      <div className="border-t border-line px-4 py-2 text-[12px] text-ink-4">
        {rangeLabel}
      </div>
      {items.length === 0 ? (
        <NoResults />
      ) : (
        <StockSnapshotTable rows={items} currentSort={sort} />
      )}
      {totalPages > 1 ? (
        <div className="border-t border-line p-3">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            buildHref={buildHref}
          />
        </div>
      ) : null}
    </div>
  );
}

// ============================================================
// View: ALERTAS (PP9 — handoff 2026-05-25)
// Atalho dedicado pros produtos zerados ou abaixo do min. Reusa o
// snapshot loader forçando status="low" (que inclui "zero" no agrupador).
// Helpbar amarelo-soft com call-to-action "Criar pedido de compra".
// ============================================================
async function AlertsView({
  page,
  q,
  categoryId,
  sort,
}: {
  page: number;
  q: string;
  categoryId: string | null;
  sort: StockSnapshotSort;
}) {
  // Carrega 2 buckets em paralelo: zerados + abaixo do min. Não usa
  // status="low" sozinho porque a lib trata "low" como SÓ low (sem
  // zerados). Carregamos os dois e mesclamos pra view de alertas.
  const [zeroResult, lowResult] = await Promise.all([
    loadStockSnapshot({
      q: q.trim() || undefined,
      status: "zero",
      categoryId,
      sort,
      page,
      pageSize: PAGE_SIZE,
    }),
    loadStockSnapshot({
      q: q.trim() || undefined,
      status: "low",
      categoryId,
      sort,
      page,
      pageSize: PAGE_SIZE,
    }),
  ]);

  // Merge: zerados primeiro (mais urgentes), depois low. Dedup por id.
  const seen = new Set<string>();
  const items = [...zeroResult.items, ...lowResult.items].filter((r) => {
    if (seen.has(r.productId)) return false;
    seen.add(r.productId);
    return true;
  });
  const total = items.length;

  if (total === 0) {
    return (
      <div className="b3-card overflow-hidden">
        <div className="flex flex-col items-center gap-3 p-8 text-center sm:p-12">
          <div className="bg-ok/10 text-ok flex size-12 items-center justify-center rounded-full">
            <BoxesIcon className="size-6" />
          </div>
          <h2 className="text-lg font-semibold text-ink-1">
            Sem alertas de estoque
          </h2>
          <p className="text-ink-4 max-w-sm text-sm">
            Todos os produtos com controle ativo estão acima do mínimo
            cadastrado. Lojista relax 🌱
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="b3-card overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{
          background: "var(--mangos-yellow-soft)",
          borderBottom: "1px solid var(--brand-line)",
        }}
      >
        <span
          className="grid size-7 shrink-0 place-items-center rounded-full"
          style={{
            background: "var(--mangos-yellow)",
            color: "var(--mangos-green-950)",
          }}
        >
          <InfoIcon className="size-3.5" aria-hidden />
        </span>
        <p
          className="flex-1 text-[13.5px] leading-snug"
          style={{ color: "var(--mangos-yellow-deep)" }}
        >
          <strong>{total}</strong>{" "}
          {total === 1 ? "produto" : "produtos"} no ou abaixo do estoque
          mínimo. Bora{" "}
          <Link
            href="/admin/compras"
            className="font-semibold underline"
            style={{ color: "var(--mangos-green-800)" }}
          >
            criar pedido de compra
          </Link>
          ?
        </p>
      </div>
      <StockSnapshotTable rows={items} currentSort={sort} />
    </div>
  );
}

// ============================================================
// View: FEED (histórico de movimentações — comportamento anterior)
// ============================================================
async function FeedView({
  page,
  q,
  typeFilter,
}: {
  page: number;
  q: string;
  typeFilter: StockMovement["movementType"] | null;
}) {
  const { items, total } = await listStockMovements({
    q: q.trim() || undefined,
    movementType: typeFilter,
    page,
    pageSize: PAGE_SIZE,
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = q.trim() !== "" || typeFilter !== null;
  const offset = (page - 1) * PAGE_SIZE;
  const rangeStart = total === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(offset + PAGE_SIZE, total);
  const rangeLabel =
    total === 0
      ? "0 de 0"
      : `${rangeStart} – ${rangeEnd} de ${total}`;

  const buildHref = (nextPage: number) => {
    const usp = new URLSearchParams();
    usp.set("view", "historico");
    if (q.trim()) usp.set("q", q.trim());
    if (typeFilter) usp.set("type", typeFilter);
    if (nextPage > 1) usp.set("page", String(nextPage));
    return `?${usp.toString()}`;
  };

  if (items.length === 0 && !hasFilters) {
    return <EmptyFeed />;
  }

  return (
    <div className="b3-card overflow-hidden">
      <div className="b3-helpbar" style={{ borderRadius: "12px 12px 0 0" }}>
        <span className="b3-helpbar-ico">
          <InfoIcon className="size-3.5" aria-hidden />
        </span>
        <span className="b3-helpbar-text">
          Cada venda, devolução ou ajuste vira uma linha aqui — histórico
          completo e auditável.
        </span>
      </div>
      <Suspense fallback={<div className="bg-bg-app h-14 animate-pulse" />}>
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
  );
}

function EmptySnapshot() {
  return (
    <div className="border-line flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center sm:p-12">
      <div className="bg-brand-wash text-brand flex size-12 items-center justify-center rounded-full">
        <BoxesIcon className="size-6" />
      </div>
      <h2 className="text-lg font-semibold text-ink-1">
        Sem produtos cadastrados ainda
      </h2>
      <p className="text-ink-4 max-w-sm text-sm">
        Cadastre seu primeiro produto pra ver o saldo aqui. Cada venda,
        compra ou ajuste mantém a contagem atualizada automaticamente.
      </p>
      <Link
        href="/admin/produtos/novo"
        className="b3-btn b3-btn--cta mt-2"
        prefetch
      >
        Cadastrar produto
      </Link>
    </div>
  );
}

function EmptyFeed() {
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
      <h2 className="text-lg font-semibold text-ink-1">Nada encontrado</h2>
      <p className="text-ink-4 max-w-sm text-sm">
        Confira o filtro ou limpe a busca.
      </p>
    </div>
  );
}
