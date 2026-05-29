import { and, count, desc, eq, gte, ilike, inArray, lte, or, type SQL, sql } from "drizzle-orm";
import { ReceiptIcon, SearchXIcon } from "lucide-react";
import { Suspense } from "react";
import { z } from "zod";

import { loadActiveCashSession } from "@/actions/cash-session/load";
import { ORDER_STATUS_VALUES } from "@/actions/order/schema";
import { NewSaleButton } from "@/components/admin/dashboard/new-sale-button";
import { OrdersExportCsvButton } from "@/components/admin/orders-export-csv-button";
import {
  type OrdersStatusCounts,
  OrdersStatusTabs,
} from "@/components/admin/orders-status-tabs";
import { OrdersTable, type OrderTableRow } from "@/components/admin/orders-table";
import {
  type OrdersPeriodSummary,
  OrdersToolbar,
} from "@/components/admin/orders-toolbar";
import { CashSessionStatus } from "@/components/admin/pdv/cash-session-status";
import { PdvPrefetcher } from "@/components/admin/pdv/pdv-prefetcher";
import { PrintPageButton } from "@/components/admin/print/print-page-button";
import { Pagination } from "@/components/common/pagination";
import {
  orderItemTable,
  orderPaymentTable,
  orderTable,
  receivablePaymentTable,
  receivableTable,
} from "@/db/schema";
import { requireSession } from "@/lib/auth-server";
import {
  dateOrNullSchema,
  enumOrNull,
  idOrNullSchema,
  pageNumberSchema,
  searchTextSchema,
} from "@/lib/page-search-params";
import {
  calculateNetProfit,
  type PaymentMethodCategory,
} from "@/lib/pricing/net-profit";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

const PAGE_SIZE = 20;

const ORDER_CHANNEL_VALUES = ["whatsapp", "balcao"] as const;

const pedidosSearchSchema = z.object({
  q: searchTextSchema,
  status: enumOrNull(ORDER_STATUS_VALUES),
  canal: enumOrNull(ORDER_CHANNEL_VALUES),
  page: pageNumberSchema,
  // Onda 1.4 — filtro de data (YYYY-MM-DD). Aplica ao mesmo escopo do
  // listing E dos agregados (soma + ticket + split por método).
  de: dateOrNullSchema,
  ate: dateOrNullSchema,
  // Onda 2.12 — auto-abrir modal de detalhe vindo de link externo
  // (dashboard "Vendas recentes", lista de fiados, etc).
  detail: idOrNullSchema,
  // Sprint 3.4 — toggle "só vendas com fiado pendente" no toolbar.
  // 'pendente' = orders com receivable cuja `paid_at` é NULL.
  // null = sem filtro de fiado (default).
  fiado: enumOrNull(["pendente"] as const),
});

interface PedidosPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PedidosPage({ searchParams }: PedidosPageProps) {
  const session = await requireSession();
  const store = await getCurrentStore(session.user.id);
  if (!store) {
    throw new Error("UNREACHABLE: pedidos page sem loja");
  }

  const {
    q: rawQ,
    status: statusFilter,
    canal: channelFilter,
    page,
    de: dateFrom,
    ate: dateTo,
    fiado: fiadoFilter,
    // `detail` permanece no schema pra validar o input do URL, mas é
    // consumido pelo OrderDetailDrawerListener global em admin-shell —
    // não precisa mais ser passado pra OrdersTable (handoff 2026-05-25).
  } = pedidosSearchSchema.parse(await searchParams);
  const q = rawQ.trim();

  // Range de data: `de` zera meia-noite; `ate` vai pro fim do dia (23:59:59.999).
  // Filtro aplica em created_at do pedido — mesma fonte usada nos relatórios.
  const dateFromStart = dateFrom;
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
  // ISO compact pra echo na URL (yyyy-mm-dd).
  const dateFromIso = dateFrom ? toIsoDate(dateFrom) : null;
  const dateToIso = dateTo ? toIsoDate(dateTo) : null;

  // Sessão de caixa ativa — renderizada como banner ACIMA do listing
  // (audit 2026-05-21: saiu do modal de Nova Venda, lojista vê status
  // na própria página de Vendas e pode abrir/fechar caixa daqui).
  const activeCashSession = await loadActiveCashSession();
  const cashSessionForBanner = activeCashSession
    ? {
        id: activeCashSession.session.id,
        openedAt: activeCashSession.session.openedAt,
        openingAmountInCents: activeCashSession.session.openingAmountInCents,
        expectedInCents: activeCashSession.expectedInCents,
        saleCount: activeCashSession.saleCount,
      }
    : null;

  // Condições "globais" — aplicadas em counts (sem status) e listing (com status)
  const baseConditions: SQL[] = [eq(orderTable.storeId, store.id)];
  if (channelFilter) {
    baseConditions.push(eq(orderTable.channel, channelFilter));
  }
  if (q) {
    // Auditoria I3 (2026-05-12): prefixo case-insensitive no shortCode OU
    // substring no nome. Escape de wildcards (`%` / `_`).
    const safeQ = q.replace(/[\\%_]/g, "\\$&");
    const condition = or(
      ilike(orderTable.shortCode, `${safeQ}%`),
      ilike(orderTable.customerName, `%${safeQ}%`),
    );
    if (condition) baseConditions.push(condition);
  }
  if (dateFromStart) {
    baseConditions.push(gte(orderTable.createdAt, dateFromStart));
  }
  if (dateToEnd) {
    baseConditions.push(lte(orderTable.createdAt, dateToEnd));
  }
  // Sprint 3.4 — toggle "só fiado pendente". EXISTS subquery em
  // receivable cujo paid_at IS NULL. `storeId` redundante (já vem
  // do baseConditions via order), mas mantém RLS explícito caso o
  // JOIN seja reescrito. Aplica em counts E listing.
  if (fiadoFilter === "pendente") {
    baseConditions.push(
      sql`EXISTS (
        SELECT 1 FROM ${receivableTable} r
        WHERE r.order_id = ${orderTable.id}
          AND r.store_id = ${orderTable.storeId}
          AND r.paid_at IS NULL
      )`,
    );
  }

  // Listing aplica status filter por cima
  const listConditions = statusFilter
    ? [...baseConditions, eq(orderTable.status, statusFilter)]
    : baseConditions;

  const whereList = and(...listConditions);
  const whereCounts = and(...baseConditions);

  const offset = (page - 1) * PAGE_SIZE;

  const {
    orders,
    total,
    statusCounts,
    paymentCountsByOrderId,
    creditOutstandingByOrderId,
    itemQtyByOrderId,
    costByOrderId,
    qtyWithCostByOrderId,
    commissionByOrderId,
    cardFeeByOrderId,
    periodSummary,
  } = await withTenant(
    store.id,
    session.user.id,
    async (tx) => {
      // SÉRIE — `pg` deprecou queries paralelas no mesmo client tx.
      const orders = await tx.query.orderTable.findMany({
        where: whereList,
        orderBy: [desc(orderTable.createdAt)],
        limit: PAGE_SIZE,
        offset,
        columns: {
          id: true,
          shortCode: true,
          customerName: true,
          customerPhone: true,
          totalInCents: true,
          status: true,
          channel: true,
          paymentMethod: true,
          // Audit 2026-05-26 — `customerNotes` na lista pra mostrar ícone
          // "tem obs" sem o lojista precisar abrir drawer. Campo é a
          // observação livre do pedido (nome herdado, persiste obs do
          // balcão também). Conteúdo completo continua só no detail.
          customerNotes: true,
          createdAt: true,
        },
      });
      const totalRows = await tx
        .select({ value: count() })
        .from(orderTable)
        .where(whereList);

      // Counts agregados por status — 1 query × 5 buckets via FILTER.
      // Respeita q + canal mas NÃO status (status é o eixo das tabs).
      const statusCountsRow = await tx
        .select({
          total: sql<number>`count(*)::int`,
          quote: sql<number>`count(*) filter (where ${orderTable.status} = 'quote')::int`,
          awaiting_whatsapp: sql<number>`count(*) filter (where ${orderTable.status} = 'awaiting_whatsapp')::int`,
          confirmed: sql<number>`count(*) filter (where ${orderTable.status} = 'confirmed')::int`,
          fulfilled: sql<number>`count(*) filter (where ${orderTable.status} = 'fulfilled')::int`,
          canceled: sql<number>`count(*) filter (where ${orderTable.status} = 'canceled')::int`,
        })
        .from(orderTable)
        .where(whereCounts);

      // Onda 1.3 — quantos pagamentos cada pedido tem. UMA query batch
      // pelos IDs visíveis. Permite mostrar "Misto" na coluna quando há
      // 2+ formas (R$80 cash + R$50 pix). Sem N+1.
      const orderIds = orders.map((o) => o.id);
      const paymentCountsByOrderId = new Map<string, number>();
      // Onda 2.13 — saldo fiado pendente por pedido (receivable.amount
      // − receivable_payment.amount, só pendentes). Permite badge "Fiado
      // R$X" na linha sem o lojista clicar.
      const creditOutstandingByOrderId = new Map<string, number>();
      // Audit 2026-05-26 — qty total de itens (sum quantity) por pedido,
      // pra exibir como coluna "Itens" sem N+1.
      const itemQtyByOrderId = new Map<string, number>();
      // Onda R3 — agregacoes pra lucro real por venda. Declaradas FORA do if
      // porque o return em ~393 referencia elas independente de orderIds vazio.
      const costByOrderId = new Map<string, number>();
      const qtyWithCostByOrderId = new Map<string, number>();
      const commissionByOrderId = new Map<string, number>();
      const cardFeeByOrderId = new Map<string, number>();
      if (orderIds.length > 0) {
        const rows = await tx
          .select({
            orderId: orderPaymentTable.orderId,
            cnt: sql<number>`count(*)::int`,
          })
          .from(orderPaymentTable)
          .where(inArray(orderPaymentTable.orderId, orderIds))
          .groupBy(orderPaymentTable.orderId);
        for (const r of rows) {
          paymentCountsByOrderId.set(r.orderId, Number(r.cnt));
        }

        // Soma quantity de order_item por order — 1 query batch agora
        // tambem agrega CUSTO + COMISSAO + COBERTURA pra cada venda
        // (Onda R3 — lucro real por venda inline). Snapshots ja gravados
        // no INSERT da venda (commission_snapshot_in_cents,
        // unit_cost_snapshot_in_cents) — calculateNetProfit consome.
        const itemRows = await tx
          .select({
            orderId: orderItemTable.orderId,
            qty: sql<number>`coalesce(sum(${orderItemTable.quantity}), 0)::int`,
            // CMV total: SUM(unit_cost_snapshot * quantity) WHERE snapshot NOT NULL
            costTotal: sql<number>`coalesce(sum(${orderItemTable.unitCostSnapshotInCents} * ${orderItemTable.quantity}) filter (where ${orderItemTable.unitCostSnapshotInCents} is not null), 0)::int`,
            // Qty com custo cadastrado / qty total = cobertura CMV
            qtyWithCost: sql<number>`coalesce(sum(${orderItemTable.quantity}) filter (where ${orderItemTable.unitCostSnapshotInCents} is not null), 0)::int`,
            // Comissao total ja calculada por linha no INSERT (snapshot fixo)
            commissionTotal: sql<number>`coalesce(sum(${orderItemTable.commissionSnapshotInCents}) filter (where ${orderItemTable.commissionSnapshotInCents} is not null), 0)::int`,
          })
          .from(orderItemTable)
          .where(inArray(orderItemTable.orderId, orderIds))
          .groupBy(orderItemTable.orderId);
        for (const r of itemRows) {
          itemQtyByOrderId.set(r.orderId, Number(r.qty));
          costByOrderId.set(r.orderId, Number(r.costTotal));
          qtyWithCostByOrderId.set(r.orderId, Number(r.qtyWithCost));
          commissionByOrderId.set(r.orderId, Number(r.commissionTotal));
        }

        // Taxa cartao snapshot: SUM(card_fee_snapshot) por order. Onda 1.3
        // grava snapshot fixo no INSERT do payment. Para vendas pre-snapshot
        // (pedidos antigos), fallback recalcula via storeFees no helper.
        const cardFeeRows = await tx
          .select({
            orderId: orderPaymentTable.orderId,
            cardFeeTotal: sql<number>`coalesce(sum(${orderPaymentTable.cardFeeSnapshotInCents}) filter (where ${orderPaymentTable.cardFeeSnapshotInCents} is not null), 0)::int`,
          })
          .from(orderPaymentTable)
          .where(inArray(orderPaymentTable.orderId, orderIds))
          .groupBy(orderPaymentTable.orderId);
        for (const r of cardFeeRows) {
          cardFeeByOrderId.set(r.orderId, Number(r.cardFeeTotal));
        }

        const creditRows = await tx
          .select({
            orderId: receivableTable.orderId,
            outstanding: sql<string>`
              COALESCE(SUM(${receivableTable.amountInCents}), 0)
              - COALESCE(SUM(
                  CASE WHEN ${receivablePaymentTable.id} IS NULL THEN 0
                       ELSE ${receivablePaymentTable.amountInCents}
                  END
                ), 0)
            `,
          })
          .from(receivableTable)
          .leftJoin(
            receivablePaymentTable,
            eq(receivablePaymentTable.receivableId, receivableTable.id),
          )
          .where(
            and(
              inArray(receivableTable.orderId, orderIds),
              sql`${receivableTable.paidAt} IS NULL`,
            ),
          )
          .groupBy(receivableTable.orderId);
        for (const r of creditRows) {
          if (r.orderId) {
            const v = Number(r.outstanding);
            if (v > 0) creditOutstandingByOrderId.set(r.orderId, v);
          }
        }
      }

      // Onda 1.4 — agregados do PERÍODO filtrado (não só da página).
      // Exclui canceladas/expiradas pra ticket médio fazer sentido como
      // "venda efetiva". Status quote e awaiting_whatsapp também entram
      // pra dar visibilidade do funil. Split por método vem de
      // `order_payment` quando existir; fallback no `order.payment_method`
      // legacy quando não houver row em order_payment (pedido antigo).
      const [periodAgg] = await tx
        .select({
          totalInCents: sql<string>`COALESCE(SUM(CASE WHEN ${orderTable.status} NOT IN ('canceled','expired') THEN ${orderTable.totalInCents} ELSE 0 END), 0)`,
          countOk: sql<number>`COUNT(*) FILTER (WHERE ${orderTable.status} NOT IN ('canceled','expired'))::int`,
        })
        .from(orderTable)
        .where(whereList);

      const periodTotalInCents = Number(periodAgg?.totalInCents ?? 0);
      const periodCount = Number(periodAgg?.countOk ?? 0);

      // Split por método: soma `order_payment` das vendas não-canceladas
      // do período (mesmo escopo do listing). JOIN explícito pra que o
      // filtro `whereList` continue valendo.
      const splitRows = await tx
        .select({
          method: orderPaymentTable.method,
          totalInCents: sql<string>`COALESCE(SUM(${orderPaymentTable.amountInCents}), 0)`,
        })
        .from(orderPaymentTable)
        .innerJoin(orderTable, eq(orderPaymentTable.orderId, orderTable.id))
        .where(
          and(
            whereList,
            sql`${orderTable.status} NOT IN ('canceled','expired')`,
          ),
        )
        .groupBy(orderPaymentTable.method);

      const periodByMethod: Record<string, number> = {};
      for (const r of splitRows) {
        periodByMethod[r.method] = Number(r.totalInCents);
      }

      const periodSummary: OrdersPeriodSummary = {
        totalInCents: periodTotalInCents,
        count: periodCount,
        ticketAverageInCents:
          periodCount > 0 ? Math.round(periodTotalInCents / periodCount) : 0,
        byMethod: periodByMethod,
      };

      return {
        orders,
        total: totalRows[0]?.value ?? 0,
        statusCounts: statusCountsRow[0] ?? {
          total: 0,
          quote: 0,
          awaiting_whatsapp: 0,
          confirmed: 0,
          fulfilled: 0,
          canceled: 0,
        },
        paymentCountsByOrderId,
        creditOutstandingByOrderId,
        itemQtyByOrderId,
        // Onda R3 — agregacoes pra lucro real por venda.
        costByOrderId,
        qtyWithCostByOrderId,
        commissionByOrderId,
        cardFeeByOrderId,
        periodSummary,
      };
    },
  );

  // Status que CONTAM como venda efetiva (lucro faz sentido). Quote/canceled/
  // expired nao contam — net_profit fica null. Lojista nao precisa ver
  // "lucro de venda cancelada".
  const COUNTS_AS_SALE = new Set([
    "confirmed",
    "fulfilled",
    "awaiting_whatsapp",
    "returned",
  ]);

  // Storefees pra fallback do helper quando a venda nao tem snapshot de taxa
  // (pedidos antigos pre-SQL 82). Tipa pra compatibilidade com `calculateNetProfit`.
  const storeFees = {
    cardRealFeeBpsDebit: store.cardRealFeeBpsDebit,
    cardRealFeeBpsCredit1x: store.cardRealFeeBpsCredit1x,
    cardRealFeeBpsCredit2xTo6x: store.cardRealFeeBpsCredit2xTo6x,
    cardRealFeeBpsCredit7xTo12x: store.cardRealFeeBpsCredit7xTo12x,
  };

  // Onda R3 — pre-calcula lucro real por venda server-side. Evita
  // N+1 e mantem coerencia com `calculateNetProfit` canonico. UI consome
  // valor pronto.
  const orderRows: OrderTableRow[] = orders.map((o) => {
    const itemQty = itemQtyByOrderId.get(o.id) ?? 0;
    const qtyWithCost = qtyWithCostByOrderId.get(o.id) ?? 0;
    const costInCents = costByOrderId.get(o.id) ?? 0;
    const commissionInCents = commissionByOrderId.get(o.id) ?? 0;
    const cardFeeInCents = cardFeeByOrderId.get(o.id) ?? 0;
    const countsAsSale = COUNTS_AS_SALE.has(o.status);

    // Cobertura CMV: % de qty com custo snapshot. 100 = todos os itens
    // tinham custo cadastrado no momento da venda. 0 = nenhum.
    const costCoveragePct =
      itemQty === 0 ? 0 : Math.round((qtyWithCost / itemQty) * 100);

    let netProfitInCents: number | null = null;
    let netMarginPct: number | null = null;

    if (countsAsSale) {
      // Usa snapshots gravados na venda. Quando snapshot de cardFee nao existe
      // (pedido pre-SQL 82), o helper calcula via storeFees + paymentMethod.
      const result = calculateNetProfit({
        revenueInCents: o.totalInCents,
        costInCents,
        // Quando ha cardFee snapshot, passamos "other" pra zerar recalculo
        // do helper e somamos manualmente. Caso contrario passa method real.
        paymentMethod: cardFeeInCents > 0
          ? "other"
          : (o.paymentMethod ?? "cash") as PaymentMethodCategory,
        installments: 1,
        commissionBps: 0, // ja embutido em commissionInCents
        taxBps: 0,
        storeFees,
      });
      // Soma manual: o helper ja desconta cost; precisamos somar cardFee
      // (snapshot) + commissao (snapshot) que nao passaram pelo helper.
      netProfitInCents = result.netProfitInCents - cardFeeInCents - commissionInCents;
      netMarginPct =
        o.totalInCents > 0
          ? (netProfitInCents / o.totalInCents) * 100
          : 0;
    }

    return {
      id: o.id,
      shortCode: o.shortCode,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      totalInCents: o.totalInCents,
      status: o.status,
      channel: o.channel,
      paymentMethod: o.paymentMethod,
      notes: o.customerNotes,
      createdAt: o.createdAt,
      paymentCount: paymentCountsByOrderId.get(o.id) ?? 0,
      creditOutstandingInCents: creditOutstandingByOrderId.get(o.id) ?? 0,
      itemQuantity: itemQty,
      // Onda R3 — lucro real por venda.
      netProfitInCents,
      netMarginPct,
      costCoveragePct,
    };
  });

  // Agregados pra pill global "X de Y com custo incompleto".
  const salesRows = orderRows.filter((r) => r.netProfitInCents !== null);
  const incompleteSales = salesRows.filter((r) => (r.costCoveragePct ?? 100) < 100).length;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters =
    q !== "" || statusFilter !== null || channelFilter !== null;

  const rangeStart = total === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(offset + PAGE_SIZE, total);

  const buildHref = (nextPage: number) => {
    const usp = new URLSearchParams();
    if (q) usp.set("q", q);
    if (statusFilter) usp.set("status", statusFilter);
    if (channelFilter) usp.set("canal", channelFilter);
    if (dateFromIso) usp.set("de", dateFromIso);
    if (dateToIso) usp.set("ate", dateToIso);
    if (nextPage > 1) usp.set("page", String(nextPage));
    const qs = usp.toString();
    return qs ? `?${qs}` : "?";
  };

  const counts: OrdersStatusCounts = statusCounts;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Prefetch silencioso do chunk do PdvShell — venda é o caminho
          principal desta rota; sem prefetch a primeira "Nova venda" do
          dia espera 1-3s em conexão de cidade do interior (audit 2026-05-26). */}
      <PdvPrefetcher />

      {/* H1 + subtítulo + ações. Nova venda volta pro header (audit
          2026-05-28): a refatoração Finexy tirou o CTA do topbar mas
          ninguém replantou — F2/Cmd+K continuam funcionando como atalho,
          mas lojista no celular ou que não conhece atalho não tem
          affordance pra abrir o modal. Régua "funciona ou esconde": o
          caminho principal da rota tem que ter botão visível. */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="b3-page-title">Vendas</h1>
          <p className="b3-page-sub">
            Pedidos de balcão (PDV) e online (loja + WhatsApp)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <NewSaleButton />
          <PrintPageButton label="Imprimir lista" />
          <OrdersExportCsvButton />
        </div>
      </div>

      {/* Banner de caixa — fora do modal (audit 2026-05-21). Lojista
          monitora status na própria página de Vendas e pode abrir caixa
          aqui antes de começar a vender no modal. */}
      <CashSessionStatus active={cashSessionForBanner} />

      {orders.length === 0 && !hasFilters ? (
        <EmptyState />
      ) : (
        <div className="b3-card overflow-hidden">
          {/* Tabs por status */}
          <Suspense
            fallback={<div className="bg-bg-app h-12 animate-pulse" />}
          >
            <OrdersStatusTabs counts={counts} />
          </Suspense>

          {/* Toolbar: busca + filtros + counter */}
          <Suspense
            fallback={<div className="bg-bg-app h-14 animate-pulse" />}
          >
            <OrdersToolbar
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              total={total}
              periodSummary={periodSummary}
              dateFromIso={dateFromIso}
              dateToIso={dateToIso}
            />
          </Suspense>

          {/* Onda R3 — pill global de cobertura CMV. So aparece quando
              tem venda incompleta nesta listagem. Sutil pra nao gritar
              em loja sem custos cadastrados ainda. */}
          {incompleteSales > 0 ? (
            <div
              className="flex items-center justify-between gap-3 rounded-md border border-line bg-bg-app/60 px-3 py-2 text-[12px]"
              role="status"
            >
              <span className="text-ink-3">
                <span className="font-semibold text-ink-1 tabular-nums">
                  {incompleteSales}
                </span>
                {" "}de {salesRows.length} vendas com{" "}
                <span className="font-medium">custo incompleto</span> — lucro mostrado é otimista.
              </span>
              <a
                href="/admin/produtos?status=no-cost"
                className="font-medium text-mangos-green-800 underline-offset-2 hover:underline"
              >
                Preencher custos →
              </a>
            </div>
          ) : null}

          {/* Tabela ou estado "sem resultados pra filtro" — o drawer
              de detalhe é montado globalmente em admin-shell e lê
              ?detail= direto do URL (handoff 2026-05-25). */}
          {orders.length === 0 ? (
            <NoResults />
          ) : (
            <OrdersTable orders={orderRows} />
          )}

          {orders.length > 0 ? (
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
        <ReceiptIcon className="size-6" />
      </div>
      <h2 className="text-lg font-semibold text-ink-1">
        Sem vendas por enquanto
      </h2>
      <p className="text-ink-4 max-w-md text-sm">
        Use o botão{" "}
        <strong className="text-ink-2">Nova venda</strong> acima (ou{" "}
        <kbd className="b3-newsale-kbd inline-block px-1.5 py-0.5 text-[10px]">
          F2
        </kbd>
        ) pra registrar uma venda no balcão agora — ou aguarde algum cliente
        finalizar pela loja online / WhatsApp. As duas aparecem aqui.
      </p>
    </div>
  );
}

/** YYYY-MM-DD em horário local (não UTC) — pra echo na URL e no toggle. */
function toIsoDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function NoResults() {
  return (
    <div className="flex flex-col items-center gap-3 p-8 text-center sm:p-12">
      <div className="bg-bg-app text-ink-4 flex size-12 items-center justify-center rounded-full">
        <SearchXIcon className="size-6" />
      </div>
      <h2 className="text-lg font-semibold text-ink-1">
        Nenhuma venda encontrada
      </h2>
      <p className="text-ink-4 max-w-sm text-sm">
        Confira o código ou o status, ou limpe os filtros.
      </p>
    </div>
  );
}
