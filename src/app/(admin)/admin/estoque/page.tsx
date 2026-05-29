import {
  BoxesIcon,
  ClipboardListIcon,
  InfoIcon,
  SearchXIcon,
  TicketPercentIcon,
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
import { loadStockAging } from "@/actions/stock/load-aging";
import { loadExpiringBatches } from "@/actions/stock/load-expiring";
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
import { formatBRL } from "@/lib/pricing";
import {
  dateOrNullSchema,
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

// PP9 (handoff 2026-05-25) — "alertas" volta como tab dedicada.
// Onda L4 (2026-05-29): +parado +vencendo. Eram rotas separadas
// (/admin/estoque/parado, /admin/estoque/vencendo) — viraram tabs.
const VIEW_VALUES = [
  "saldo",
  "historico",
  "alertas",
  "parado",
  "vencendo",
] as const;

const estoqueSearchSchema = z.object({
  view: z.enum(VIEW_VALUES).catch("saldo"),
  q: searchTextSchema,
  type: enumOrNull(MOVEMENT_TYPES),
  status: enumOrNull(SNAPSHOT_STATUS_VALUES),
  categoryId: idOrNullSchema,
  sort: enumOrNull(SNAPSHOT_SORT_VALUES),
  page: pageNumberSchema,
  // Audit 2026-05-26 — filtro de data no feed (mesmos params que orders).
  de: dateOrNullSchema,
  ate: dateOrNullSchema,
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
  const isParked = params.view === "parado";
  const isExpiring = params.view === "vencendo";

  // KPIs sempre — visão geral fica em cima das views.
  const kpis = await loadStockKpis();

  // Counts pras pills das tabs. Tres queries leves (paralelas porque sao
  // metodos diferentes). Onda L4: parked+expiring vem dos loaders deles.
  const [snapshotCounts, parkedData, expiringData] = await Promise.all([
    loadStockSnapshotCounts(),
    loadStockAging(),
    loadExpiringBatches(60),
  ]);
  const alertCount =
    (snapshotCounts.zero ?? 0) + (snapshotCounts.low ?? 0);
  const parkedCount = parkedData.rows.length;
  const expiringCount = expiringData.rows.length;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="b3-page-title">Estoque</h1>
          <p className="b3-page-sub">
            Saldo, movimentações, alertas, capital parado e lotes vencendo
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

      {/* Tabs primárias — Onda L4: 5 views (Saldo / Movimentações /
          Alertas / Parado / Vencendo). */}
      <Suspense fallback={<div className="b3-tabs h-12" />}>
        <EstoqueViewTabs
          alertCount={alertCount}
          parkedCount={parkedCount}
          expiringCount={expiringCount}
        />
      </Suspense>

      {isFeed ? (
        <FeedView
          page={params.page}
          q={params.q}
          typeFilter={params.type}
          dateFrom={params.de}
          dateTo={params.ate}
        />
      ) : isAlerts ? (
        <AlertsView
          page={params.page}
          q={params.q}
          categoryId={params.categoryId}
          sort={params.sort ?? "stock-asc"}
        />
      ) : isParked ? (
        <ParkedView data={parkedData} />
      ) : isExpiring ? (
        <ExpiringView data={expiringData} />
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
  // Audit 2026-05-26 — usa `status: "alerts"` (bucket combinado zero+low
  // server-side). Antes carregava 2 buckets paginados e fazia merge local
  // → total = items.length da página, pill divergia da tabela, segunda
  // página inacessível. Agora é 1 query paginada honesta.
  const { items, total } = await loadStockSnapshot({
    q: q.trim() || undefined,
    status: "alerts",
    categoryId,
    sort,
    page,
    pageSize: PAGE_SIZE,
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const offset = (page - 1) * PAGE_SIZE;
  const rangeStart = total === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(offset + PAGE_SIZE, total);

  const buildHref = (nextPage: number) => {
    const usp = new URLSearchParams();
    usp.set("view", "alertas");
    if (q.trim()) usp.set("q", q.trim());
    if (categoryId) usp.set("categoryId", categoryId);
    if (sort !== "stock-asc") usp.set("sort", sort);
    if (nextPage > 1) usp.set("page", String(nextPage));
    return `?${usp.toString()}`;
  };

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
            cadastrado.
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
      <div className="border-t border-line px-4 py-2 text-[12px] text-ink-4">
        {rangeStart} – {rangeEnd} de {total}
      </div>
      <StockSnapshotTable rows={items} currentSort={sort} />
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
// View: FEED (histórico de movimentações — comportamento anterior)
// ============================================================
async function FeedView({
  page,
  q,
  typeFilter,
  dateFrom,
  dateTo,
}: {
  page: number;
  q: string;
  typeFilter: StockMovement["movementType"] | null;
  dateFrom: Date | null;
  dateTo: Date | null;
}) {
  // Range inclusivo: `ate` vai pro fim do dia (23:59:59.999) — espelha
  // o tratamento de orders/page.tsx.
  const dateToEnd = dateTo
    ? new Date(
        dateTo.getFullYear(),
        dateTo.getMonth(),
        dateTo.getDate(),
        23,
        59,
        59,
        999,
      )
    : null;
  const dateFromIso = dateFrom ? toIsoDate(dateFrom) : null;
  const dateToIso = dateTo ? toIsoDate(dateTo) : null;

  const { items, total } = await listStockMovements({
    q: q.trim() || undefined,
    movementType: typeFilter,
    page,
    pageSize: PAGE_SIZE,
    fromDate: dateFrom,
    toDate: dateToEnd,
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const offset = (page - 1) * PAGE_SIZE;
  const rangeStart = total === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(offset + PAGE_SIZE, total);
  const rangeLabel =
    total === 0
      ? "0 de 0"
      : `${rangeStart} – ${rangeEnd} de ${total}`;

  const hasDateFilter = dateFromIso !== null || dateToIso !== null;
  const hasAllFilters =
    q.trim() !== "" || typeFilter !== null || hasDateFilter;

  const buildHref = (nextPage: number) => {
    const usp = new URLSearchParams();
    usp.set("view", "historico");
    if (q.trim()) usp.set("q", q.trim());
    if (typeFilter) usp.set("type", typeFilter);
    if (dateFromIso) usp.set("de", dateFromIso);
    if (dateToIso) usp.set("ate", dateToIso);
    if (nextPage > 1) usp.set("page", String(nextPage));
    return `?${usp.toString()}`;
  };

  if (items.length === 0 && !hasAllFilters) {
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
        <StockToolbar
          rangeLabel={rangeLabel}
          dateFromIso={dateFromIso}
          dateToIso={dateToIso}
        />
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

/** YYYY-MM-DD em horário local — echo na URL e refletido pro toolbar.
 *  Audit 2026-05-26: copiado de orders-toolbar.tsx (mesma régua). */
function toIsoDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
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
        href="/admin/produtos?edit=new"
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

// ============================================================
// View: PARADO (Onda L4 — antes era rota separada /estoque/parado)
// Capital empatado em produto sem venda ha 60+ dias.
// ============================================================

const PARKED_COHORT_LABEL = {
  "60-90": "60 a 90 dias",
  "90-180": "90 a 180 dias",
  "180+": "Mais de 180 dias",
} as const;

function ParkedView({
  data,
}: {
  data: Awaited<ReturnType<typeof loadStockAging>>;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="b3-card p-4">
          <p className="text-ink-3 text-xs">Total parado 60d+</p>
          <p className="text-ink-1 mt-1 text-2xl font-semibold">
            {formatBRL(data.kpi.parked60PlusInCents)}
          </p>
        </div>
        <div className="b3-card p-4">
          <p className="text-ink-3 text-xs">60 a 90 dias</p>
          <p className="text-ink-1 mt-1 text-2xl font-semibold">
            {formatBRL(data.kpi.parked60to90InCents)}
          </p>
        </div>
        <div className="b3-card p-4">
          <p className="text-ink-3 text-xs">90 a 180 dias</p>
          <p className="text-ink-1 mt-1 text-2xl font-semibold">
            {formatBRL(data.kpi.parked90to180InCents)}
          </p>
        </div>
        <div className="b3-card p-4">
          <p className="text-ink-3 text-xs">+ de 180 dias</p>
          <p className="text-destructive mt-1 text-2xl font-semibold">
            {formatBRL(data.kpi.parked180PlusInCents)}
          </p>
        </div>
      </div>

      {data.rows.length === 0 ? (
        <div className="b3-card p-8 text-center">
          <p className="text-ink-3 text-sm">
            Nenhum produto parado há 60+ dias.
          </p>
          <p className="text-ink-4 mt-1 text-xs">
            Tudo que tem estoque está girando — ótimo sinal.
          </p>
        </div>
      ) : (
        <div className="b3-card overflow-x-auto">
          <table className="b3-table w-full">
            <thead>
              <tr>
                <th className="text-left">Produto</th>
                <th className="text-right">Estoque</th>
                <th className="text-right">Custo unit.</th>
                <th className="text-right">Capital parado</th>
                <th className="text-right">Última venda</th>
                <th className="text-left">Faixa</th>
                <th className="text-center" style={{ width: 120 }}>
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.productId}>
                  <td>
                    <Link
                      href={`/admin/produtos?edit=${r.productId}`}
                      className="text-ink-1 text-sm hover:underline"
                    >
                      {r.productName}
                    </Link>
                  </td>
                  <td className="text-ink-2 mono text-right text-sm">
                    {r.stockQuantity}
                  </td>
                  <td className="text-ink-2 mono text-right text-sm">
                    {r.unitCostInCents !== null
                      ? formatBRL(r.unitCostInCents)
                      : "—"}
                  </td>
                  <td className="text-ink-1 mono text-right text-sm font-semibold">
                    {r.parkedValueInCents !== null
                      ? formatBRL(r.parkedValueInCents)
                      : "—"}
                  </td>
                  <td className="text-ink-3 text-right text-sm">
                    {r.daysSinceLastSale === null
                      ? "nunca"
                      : `${r.daysSinceLastSale}d atrás`}
                  </td>
                  <td>
                    <span
                      className={`b3-pill inline-flex items-center ${
                        r.cohort === "180+"
                          ? "b3-pill--danger"
                          : r.cohort === "90-180"
                            ? "b3-pill--warn"
                            : "b3-pill--brand"
                      }`}
                    >
                      {PARKED_COHORT_LABEL[r.cohort]}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center justify-center">
                      <Link
                        href={`/admin/promocoes/cupons?produto=${r.productId}`}
                        prefetch={false}
                        className="b3-btn b3-btn--sm"
                        title={`Criar código de desconto pra liquidar ${r.productName}`}
                      >
                        <TicketPercentIcon size={12} aria-hidden /> Promo
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================================
// View: VENCENDO (Onda L4 — antes era rota separada /estoque/vencendo)
// Lotes vencendo em ate 60 dias (FEFO — perfumaria/cosmetico).
// ============================================================

function ExpiringView({
  data,
}: {
  data: Awaited<ReturnType<typeof loadExpiringBatches>>;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="b3-card border-destructive/50 p-4">
          <p className="text-ink-3 text-xs">Já vencidos</p>
          <p className="text-destructive mt-1 text-2xl font-semibold">
            {data.kpi.expiredCount}
          </p>
          <p className="text-ink-4 mt-1 text-[11px]">
            Capital: {formatBRL(data.kpi.expiredValueInCents)} — descarte ou
            doação
          </p>
        </div>
        <div className="b3-card p-4">
          <p className="text-ink-3 text-xs">Vencem em 30 dias</p>
          <p className="text-ink-1 mt-1 text-2xl font-semibold">
            {data.kpi.expiringIn30Count}
          </p>
          <p className="text-ink-4 mt-1 text-[11px]">
            Capital: {formatBRL(data.kpi.expiringIn30ValueInCents)} — promo
            urgente
          </p>
        </div>
        <div className="b3-card p-4">
          <p className="text-ink-3 text-xs">Vencem em 60 dias</p>
          <p className="text-ink-1 mt-1 text-2xl font-semibold">
            {data.kpi.expiringIn60Count}
          </p>
          <p className="text-ink-4 mt-1 text-[11px]">
            Capital: {formatBRL(data.kpi.expiringIn60ValueInCents)} — vender
            primeiro
          </p>
        </div>
      </div>

      {data.rows.length === 0 ? (
        <div className="b3-card p-8 text-center">
          <p className="text-ink-3 text-sm">
            Nenhum lote vencendo em 60 dias.
          </p>
          <p className="text-ink-4 mt-1 text-xs">
            Esta view mostra lotes de produtos comprados via{" "}
            <Link href="/admin/compras" className="font-medium underline">
              Compras
            </Link>{" "}
            que tenham lote e validade. Faz sentido pra perfumaria, cosmético,
            alimento. Marque a categoria como &ldquo;rastrear lote&rdquo; no
            cadastro pra os campos aparecerem na próxima compra.
          </p>
        </div>
      ) : (
        <div className="b3-card overflow-x-auto">
          <table className="b3-table w-full">
            <thead>
              <tr>
                <th className="text-left">Produto</th>
                <th className="text-left">Lote</th>
                <th className="text-left">Vencimento</th>
                <th className="text-right">Quantidade</th>
                <th className="text-right">Valor</th>
                <th className="text-left">Situação</th>
                <th className="text-center" style={{ width: 120 }}>
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.purchaseItemId}>
                  <td>
                    <Link
                      href={`/admin/produtos?edit=${r.productId}`}
                      className="text-ink-1 text-sm hover:underline"
                    >
                      {r.productName}
                    </Link>
                  </td>
                  <td className="text-ink-2 mono text-sm">
                    {r.batchNumber ?? "—"}
                  </td>
                  <td className="text-ink-2 mono text-sm">
                    {new Date(r.expiresAt).toLocaleDateString("pt-BR", {
                      timeZone: "UTC",
                    })}
                  </td>
                  <td className="text-ink-2 mono text-right text-sm">
                    {r.quantityPurchased}
                  </td>
                  <td className="text-ink-1 mono text-right text-sm font-medium">
                    {formatBRL(r.parkedValueInCents)}
                  </td>
                  <td>
                    {r.daysToExpiry < 0 ? (
                      <span className="b3-pill b3-pill--danger inline-flex items-center">
                        Vencido há {-r.daysToExpiry}d
                      </span>
                    ) : r.daysToExpiry <= 30 ? (
                      <span className="b3-pill b3-pill--warn inline-flex items-center">
                        Vence em {r.daysToExpiry}d
                      </span>
                    ) : (
                      <span className="b3-pill b3-pill--brand inline-flex items-center">
                        Vence em {r.daysToExpiry}d
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="flex items-center justify-center">
                      <Link
                        href={`/admin/promocoes/cupons?produto=${r.productId}`}
                        prefetch={false}
                        className="b3-btn b3-btn--sm"
                        title={`Criar código de desconto pra liquidar ${r.productName} antes do vencimento`}
                      >
                        <TicketPercentIcon size={12} aria-hidden /> Promo
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
