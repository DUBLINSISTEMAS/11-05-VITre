import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { loadActiveCashSession } from "@/actions/cash-session/load";
import {
  type ChecklistStep,
  OnboardingChecklist,
} from "@/components/admin/dashboard/onboarding-checklist";
import { OpCard } from "@/components/admin/dashboard/op-card";
import {
  type RecentOrderRow,
  RecentOrdersTable,
} from "@/components/admin/dashboard/recent-orders-table";
import {
  type SalesSummary,
  SalesSummaryCard,
} from "@/components/admin/dashboard/sales-summary-card";
import { StoreLinkCard } from "@/components/admin/dashboard/store-link-card";
import {
  bannerTable,
  orderTable,
  productTable,
  receivableTable,
} from "@/db/schema";
import { requireSession } from "@/lib/auth-server";
import { formatBRL } from "@/lib/pricing";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

/** Período em dias aceito no URL ?periodo=7|30|90. Default 30. */
const periodoSchema = z
  .enum(["7", "30", "90"])
  .catch("30")
  .transform((v) => Number(v) as 7 | 30 | 90);

/** Gera array de YYYY-MM-DD pros últimos N dias (ordenado ASC, hoje no fim). */
function generateLastNDays(n: number): string[] {
  const days: string[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function formatDuration(openedAt: Date): string {
  const ms = Date.now() - openedAt.getTime();
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min}min aberto`;
  const h = Math.floor(min / 60);
  const remMin = min % 60;
  return remMin === 0 ? `${h}h aberto` : `${h}h${remMin}min aberto`;
}

export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const session = await requireSession();
  const store = await getCurrentStore(session.user.id);
  if (!store) {
    throw new Error("UNREACHABLE: admin page sem loja");
  }

  const sp = await searchParams;
  const periodo = periodoSchema.parse(sp.periodo);
  // Sprint 1.5 (auditoria 2026-05-21 doc 04): eliminamos `sql.raw(String(periodo))`
  // em favor de Date calculada server-side. Mais seguro (parametrizado, zero
  // chance de injection mesmo se Zod schema for trocado por engano) e mais
  // rápido (PG recebe timestamp como bind var em vez de fazer cast de string).
  const periodStartDate = new Date(Date.now() - periodo * 24 * 60 * 60 * 1000);

  // Sessão de caixa ativa (faz seu próprio withTenant — cache() em getCurrentStore
  // deduplica a query da loja). Roda em paralelo com o bloco principal.
  const cashSessionPromise = loadActiveCashSession();

  const {
    salesStats,
    revenueSeriesRows,
    recentOrdersRaw,
    receivableStats,
    lowStockCount,
    yesterdaySales,
    productCount,
    bannerCount,
    totalOrderCount,
  } = await withTenant(store.id, session.user.id, async (tx) => {
    // 5 buckets de status × (count + sum) em 1 SELECT via FILTER
    const salesStats = await tx
      .select({
        totalCount: sql<number>`count(*) filter (where ${orderTable.createdAt} >= ${periodStartDate})::int`,
        totalSum: sql<number>`coalesce(sum(${orderTable.totalInCents}) filter (where ${orderTable.createdAt} >= ${periodStartDate}), 0)::int`,
        aprovadosCount: sql<number>`count(*) filter (where ${orderTable.status} in ('confirmed','fulfilled') and ${orderTable.createdAt} >= ${periodStartDate})::int`,
        aprovadosSum: sql<number>`coalesce(sum(${orderTable.totalInCents}) filter (where ${orderTable.status} in ('confirmed','fulfilled') and ${orderTable.createdAt} >= ${periodStartDate}), 0)::int`,
        pendentesCount: sql<number>`count(*) filter (where ${orderTable.status} = 'awaiting_whatsapp' and ${orderTable.createdAt} >= ${periodStartDate})::int`,
        pendentesSum: sql<number>`coalesce(sum(${orderTable.totalInCents}) filter (where ${orderTable.status} = 'awaiting_whatsapp' and ${orderTable.createdAt} >= ${periodStartDate}), 0)::int`,
        canceladosCount: sql<number>`count(*) filter (where ${orderTable.status} = 'canceled' and ${orderTable.createdAt} >= ${periodStartDate})::int`,
        canceladosSum: sql<number>`coalesce(sum(${orderTable.totalInCents}) filter (where ${orderTable.status} = 'canceled' and ${orderTable.createdAt} >= ${periodStartDate}), 0)::int`,
        expiradosCount: sql<number>`count(*) filter (where ${orderTable.status} = 'expired' and ${orderTable.createdAt} >= ${periodStartDate})::int`,
        expiradosSum: sql<number>`coalesce(sum(${orderTable.totalInCents}) filter (where ${orderTable.status} = 'expired' and ${orderTable.createdAt} >= ${periodStartDate}), 0)::int`,
      })
      .from(orderTable)
      .where(eq(orderTable.storeId, store.id));

    // Receita por dia — janela do período selecionado
    const revenueSeriesRows = await tx
      .select({
        day: sql<string>`to_char(date_trunc('day', ${orderTable.createdAt}), 'YYYY-MM-DD')`,
        total: sql<number>`coalesce(sum(${orderTable.totalInCents}), 0)::int`,
      })
      .from(orderTable)
      .where(
        sql`${orderTable.storeId} = ${store.id} and ${orderTable.status} in ('confirmed','fulfilled') and ${orderTable.createdAt} >= ${periodStartDate}`,
      )
      .groupBy(sql`date_trunc('day', ${orderTable.createdAt})`)
      .orderBy(sql`date_trunc('day', ${orderTable.createdAt})`);

    const recentOrdersRaw = await tx.query.orderTable.findMany({
      where: eq(orderTable.storeId, store.id),
      orderBy: [desc(orderTable.createdAt)],
      limit: 5,
      columns: {
        id: true,
        shortCode: true,
        customerName: true,
        totalInCents: true,
        status: true,
        createdAt: true,
      },
    });

    // ---- Card 2: A receber (pendente + vencido) ----
    const receivableStats = await tx
      .select({
        pendingSum: sql<number>`coalesce(sum(${receivableTable.amountInCents}) filter (where ${receivableTable.paidAt} is null), 0)::int`,
        overdueSum: sql<number>`coalesce(sum(${receivableTable.amountInCents}) filter (where ${receivableTable.paidAt} is null and ${receivableTable.dueDate} < now()), 0)::int`,
        overdueCount: sql<number>`count(*) filter (where ${receivableTable.paidAt} is null and ${receivableTable.dueDate} < now())::int`,
      })
      .from(receivableTable)
      .where(eq(receivableTable.storeId, store.id));

    // ---- Card 3: Estoque baixo ----
    // Conta produtos com track_stock + min definido onde stock <= min.
    // Variantes não têm campo minStockQuantity (apenas produtos a nível pai),
    // então a contagem é product-scope. Quando variantes ganharem min stock
    // próprio (Sprint futura), adicionar query irmã + soma.
    const lowStockProducts = await tx
      .select({ value: sql<number>`count(*)::int` })
      .from(productTable)
      .where(
        and(
          eq(productTable.storeId, store.id),
          eq(productTable.trackStock, true),
          sql`${productTable.minStockQuantity} is not null`,
          sql`${productTable.stockQuantity} <= ${productTable.minStockQuantity}`,
        ),
      );
    const lowStockCount = lowStockProducts[0]?.value ?? 0;

    // ---- Card 4: Venda ontem ----
    const yesterdaySales = await tx
      .select({
        count: sql<number>`count(*)::int`,
        sum: sql<number>`coalesce(sum(${orderTable.totalInCents}), 0)::int`,
      })
      .from(orderTable)
      .where(
        sql`${orderTable.storeId} = ${store.id} and ${orderTable.status} in ('confirmed','fulfilled') and date(${orderTable.createdAt}) = current_date - 1`,
      );

    // ---- Sinais de onboarding (3 counts baratos pra detectar loja "fresh") ----
    // Cada query é um count(*) com filtro indexado em store_id — custo
    // desprezível mesmo em loja madura.
    const productCountRow = await tx
      .select({ value: sql<number>`count(*)::int` })
      .from(productTable)
      .where(eq(productTable.storeId, store.id));
    const productCount = productCountRow[0]?.value ?? 0;

    const bannerCountRow = await tx
      .select({ value: sql<number>`count(*)::int` })
      .from(bannerTable)
      .where(eq(bannerTable.storeId, store.id));
    const bannerCount = bannerCountRow[0]?.value ?? 0;

    // Considera qualquer venda confirmada/cumprida (storefront ou balcão)
    // como "loja já vendeu pelo menos uma vez". Orçamento, aguardando
    // WhatsApp, cancelado e expirado NÃO contam — não são compromisso fechado.
    const totalOrderCountRow = await tx
      .select({ value: sql<number>`count(*)::int` })
      .from(orderTable)
      .where(
        sql`${orderTable.storeId} = ${store.id} and ${orderTable.status} in ('confirmed','fulfilled','returned')`,
      );
    const totalOrderCount = totalOrderCountRow[0]?.value ?? 0;

    return {
      salesStats,
      revenueSeriesRows,
      recentOrdersRaw,
      receivableStats,
      lowStockCount,
      yesterdaySales,
      productCount,
      bannerCount,
      totalOrderCount,
    };
  });

  const cashSession = await cashSessionPromise;

  // ---- Sales summary (período selecionado) ----
  const sStat = salesStats[0];
  const summary: SalesSummary = {
    total: { count: sStat?.totalCount ?? 0, totalInCents: sStat?.totalSum ?? 0 },
    aprovados: { count: sStat?.aprovadosCount ?? 0, totalInCents: sStat?.aprovadosSum ?? 0 },
    pendentes: { count: sStat?.pendentesCount ?? 0, totalInCents: sStat?.pendentesSum ?? 0 },
    cancelados: { count: sStat?.canceladosCount ?? 0, totalInCents: sStat?.canceladosSum ?? 0 },
    expirados: { count: sStat?.expiradosCount ?? 0, totalInCents: sStat?.expiradosSum ?? 0 },
  };
  const revenueByDay = new Map(
    revenueSeriesRows.map((r) => [r.day, Number(r.total)]),
  );
  const series = generateLastNDays(periodo).map((date) => revenueByDay.get(date) ?? 0);

  const recentOrders: RecentOrderRow[] = recentOrdersRaw.map((o) => ({
    id: o.id,
    shortCode: o.shortCode,
    customerName: o.customerName,
    totalInCents: o.totalInCents,
    status: o.status,
    createdAt: o.createdAt,
  }));

  // ---- Card 4: dados de ontem ----
  const yStat = yesterdaySales[0];
  const yesterdayCount = yStat?.count ?? 0;
  const yesterdaySum = yStat?.sum ?? 0;

  // ---- Card 2: a receber ----
  const rStat = receivableStats[0];
  const pendingSum = rStat?.pendingSum ?? 0;
  const overdueSum = rStat?.overdueSum ?? 0;
  const overdueCount = rStat?.overdueCount ?? 0;

  // ---- Onboarding state ----
  // Lojista é "fresh" quando ainda não cadastrou produto NEM registrou venda
  // confirmada. Nesses dois casos o checklist substitui os OpCards vazios:
  // mostrar "Caixa fechado / Sem vendas / Tudo dentro do mínimo" pra quem
  // acabou de chegar é desencorajador e não orienta. Quando a loja já tem
  // produto e já vendeu (ou já está rodando), volta o dashboard cheio.
  const isFreshStore = productCount === 0 || totalOrderCount === 0;

  const onboardingSteps: ChecklistStep[] = [
    {
      number: "01",
      title: "Cadastre seu primeiro produto",
      description:
        "Adicione foto, preço e estoque. Com 5+ produtos a vitrine começa a vender.",
      ctaLabel: "Cadastrar",
      href: "/admin/produtos/novo",
      done: productCount > 0,
    },
    {
      number: "02",
      title: "Suba o logo da sua loja",
      description:
        "Aparece no topo da vitrine, no recibo do PDV e no QR code que clientes escaneiam.",
      ctaLabel: "Subir logo",
      href: "/admin/aparencia",
      done: Boolean(store.logoUrl),
    },
    {
      number: "03",
      title: "Informe endereço e horário",
      description:
        "Cliente precisa saber onde e quando você atende — sai no rodapé e na página Sobre.",
      ctaLabel: "Preencher",
      href: "/admin/configuracoes",
      done: Boolean(store.addressCity && store.businessHours),
    },
    {
      number: "04",
      title: "Suba um banner de destaque",
      description:
        "Banner no topo da vitrine chama atenção pra coleção, promoção ou produto novo.",
      ctaLabel: "Subir banner",
      href: "/admin/banners",
      done: bannerCount > 0,
    },
    {
      number: "05",
      title: "Registre sua primeira venda",
      description:
        "Use o PDV pra venda no balcão ou aguarde o cliente fechar pelo WhatsApp.",
      ctaLabel: "Abrir PDV",
      href: "/admin/pdv",
      done: totalOrderCount > 0,
    },
  ];

  return (
    <div className="b3-page">
      {/* S2 (handoff pixel-perfect 2026-05-25): usa classe `.b3-page-title`
          (utility compartilhada com pedidos/produtos/clientes/etc) em vez de
          tailwind inline. Bate dashboard.jsx:202 do bundle. */}
      <h1 className="b3-page-title">Hoje</h1>

      {/* Link público da loja — sempre no topo, copy + QR + abrir loja a 1 clique. */}
      <div className="mb-4">
        <StoreLinkCard storeSlug={store.slug} storeName={store.name} />
      </div>

      {isFreshStore ? (
        <OnboardingChecklist storeName={store.name} steps={onboardingSteps} />
      ) : (
        <>
          {/* 4 cards de operação do dia.
              S2 (handoff): grid auto-fit minmax(220px, 1fr) — flow natural
              que mostra 1/2/3/4 cards conforme largura disponível, em vez de
              snap em breakpoints sm/xl que pula 3-col entre 768-1280px.
              Bate dashboard.jsx:209 do bundle. */}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
            <OpCard
              label="Caixa"
              value={
                cashSession
                  ? formatBRL(cashSession.expectedInCents)
                  : "Caixa fechado"
              }
              subInfo={
                cashSession
                  ? `Abertura ${formatBRL(cashSession.session.openingAmountInCents)} · ${formatDuration(cashSession.session.openedAt)}`
                  : undefined
              }
              cta={{
                label: cashSession ? "Ver caixa" : "Abrir caixa",
                href: "/admin/pdv/caixa",
              }}
            />

            <OpCard
              label="A receber"
              value={formatBRL(pendingSum)}
              subInfo={
                pendingSum === 0 ? "Nenhum fiado em aberto" : "Total pendente"
              }
              subInfoEmphasis={
                overdueSum > 0
                  ? {
                      text: `${formatBRL(overdueSum)} vencido${overdueCount > 1 ? "s" : ""}`,
                      tone: "danger",
                    }
                  : undefined
              }
              cta={{
                label: "Ver fiados",
                href: "/admin/financeiro/receber",
              }}
            />

            <OpCard
              label="Estoque baixo"
              value={String(lowStockCount)}
              subInfo={
                lowStockCount === 0
                  ? "Tudo dentro do mínimo"
                  : `produto${lowStockCount > 1 ? "s" : ""} no/abaixo do mínimo`
              }
              cta={{ label: "Ver lista", href: "/admin/estoque/relatorio" }}
            />

            <OpCard
              label="Venda ontem"
              value={formatBRL(yesterdaySum)}
              subInfo={
                yesterdayCount === 0
                  ? "Sem vendas confirmadas"
                  : `${yesterdayCount} venda${yesterdayCount > 1 ? "s" : ""}`
              }
            />
          </div>

          <div className="mt-6">
            <SalesSummaryCard
              periodo={periodo}
              series={series}
              summary={summary}
            />
          </div>

          <div className="mt-4">
            <RecentOrdersTable orders={recentOrders} />
          </div>
        </>
      )}
    </div>
  );
}
