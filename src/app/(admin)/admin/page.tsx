import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { loadActiveCashSession } from "@/actions/cash-session/load";
import { loadDashboardChannels } from "@/actions/dashboard/load-channels";
import { loadDashboardKpis } from "@/actions/dashboard/load-kpis";
import { loadDashboardSinais } from "@/actions/dashboard/load-sinais";
import { loadDashboardLucro } from "@/actions/reports/load-dashboard-lucro";
import { ChannelsCard } from "@/components/admin/dashboard/channels-card";
import { DateRangePill } from "@/components/admin/dashboard/date-range-pill";
import { DashboardKpiRow } from "@/components/admin/dashboard/kpi-row";
// Onda M4 (2026-05-29) — KpisSecundarios e ProdutosBombando removidos do
// dashboard. KpisSecundarios duplicava info do HeroLucro (lucrou ontem +
// semana ja cobre faturamento). ProdutosBombando era info nao-acionavel
// ("essa peca ta bombando" — lojista nao pode fazer nada de imediato).
// Lista densa de vendas + sinais urgentes em "Pegando fogo" cobrem o que
// importa pra triagem do dia. Founder reportou dashboard inflado L6.
import { LojaOnlineSnapshot } from "@/components/admin/dashboard/loja-online-snapshot";
import { NewSaleButton } from "@/components/admin/dashboard/new-sale-button";
import {
  type ChecklistStep,
  OnboardingChecklist,
  OnboardingProgressStrip,
} from "@/components/admin/dashboard/onboarding-checklist";
import { PegandoFogo } from "@/components/admin/dashboard/pegando-fogo";
// Onda R4 (2026-05-29) — HeroLucro splash deletado. ProfitSummary
// Stripe-style: 1 numero principal modesto + delta + breakdown denso.
// Founder pediu sistema-minimalista, nao SaaS-EUA.
import { ProfitSummary } from "@/components/admin/dashboard/profit-summary";
import {
  type RecentOrderRow,
  RecentOrdersTable,
} from "@/components/admin/dashboard/recent-orders-table";
import {
  RevenueAnalyticsChart,
  type RevenuePoint,
} from "@/components/admin/dashboard/revenue-analytics-chart";
import { CashSessionStatus } from "@/components/admin/pdv/cash-session-status";
import { bannerTable, orderTable, productTable } from "@/db/schema";
import { requireSession } from "@/lib/auth-server";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

/** Período em dias aceito no URL ?periodo=7|30|90. Default 30.
 *  Controla o gráfico "Receita do período" — NÃO o Hero de Lucro
 *  (esse usa janela canônica ontem + semana atual). */
const periodoSchema = z
  .enum(["7", "30", "90"])
  .catch("30")
  .transform((v) => Number(v) as 7 | 30 | 90);

/** Preenche série temporal contínua: mapeia cada dia do período pra um ponto,
 *  com label "dd/mm" e valor (zero quando não houve venda). Mantém continuidade
 *  temporal sem mentir — barra zero some, label do dia continua.
 *  Bloco E3 UX (2026-05-29): último ponto marcado isPartial pra UI mostrar
 *  que o dia atual ainda está em curso. */
function fillDailySeries(
  rowsByDay: Map<string, number>,
  days: number,
): RevenuePoint[] {
  const result: RevenuePoint[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    const isoDay = d.toISOString().slice(0, 10);
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    result.push({
      label: `${dd}/${mm}`,
      value: rowsByDay.get(isoDay) ?? 0,
      isPartial: i === 0, // hoje é parcial (dia em curso)
    });
  }
  return result;
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

  const now = new Date();
  const periodStart = new Date(now.getTime() - periodo * 86400000);

  const {
    revenueSeriesRows,
    recentOrders,
    productCount,
    bannerCount,
    totalOrderCount,
  } = await withTenant(store.id, session.user.id, async (tx) => {
    // Hero de Lucro Líquido (F.2.1) calcula em transações próprias via
    // loadDashboardLucro (Promise.all top-level). Não duplica trabalho aqui.

    // === Receita diária no período (pra agrupar por dia da semana) ===
    const revenueSeriesRows = await tx
      .select({
        day: sql<string>`to_char(date_trunc('day', ${orderTable.createdAt}), 'YYYY-MM-DD')`,
        total: sql<number>`coalesce(sum(${orderTable.totalInCents}), 0)::int`,
      })
      .from(orderTable)
      .where(
        sql`${orderTable.storeId} = ${store.id}
            and ${orderTable.status} in ('confirmed','fulfilled')
            and ${orderTable.createdAt} >= ${periodStart}`,
      )
      .groupBy(sql`date_trunc('day', ${orderTable.createdAt})`)
      .orderBy(sql`date_trunc('day', ${orderTable.createdAt})`);

    // === Vendas recentes com Categoria + Itens (via subselect) ===
    // Atenção: `${orderTable.id}` é serializado como "id" pelo Drizzle, o que
    // colide com `order_item.id` ou `product.id` dentro das subqueries
    // (column reference "id" is ambiguous). Por isso referenciamos a outer
    // table pelo nome qualificado "order"."id" literalmente — `orderTable`
    // é mapeada pra tabela "order" (palavra reservada, sempre vem aspeada).
    const recentOrders = await tx
      .select({
        id: orderTable.id,
        shortCode: orderTable.shortCode,
        customerName: orderTable.customerName,
        totalInCents: orderTable.totalInCents,
        status: orderTable.status,
        createdAt: orderTable.createdAt,
        itemCount: sql<number>`(
          SELECT coalesce(sum(oi.quantity), 0)::int
          FROM order_item oi
          WHERE oi.order_id = "order"."id"
        )`,
        categoryLabel: sql<string | null>`(
          SELECT c.name
          FROM order_item oi
          LEFT JOIN product p ON p.id = oi.product_id
          LEFT JOIN category c ON c.id = p.category_id
          WHERE oi.order_id = "order"."id"
          ORDER BY oi.created_at ASC
          LIMIT 1
        )`,
      })
      .from(orderTable)
      .where(eq(orderTable.storeId, store.id))
      .orderBy(desc(orderTable.createdAt))
      .limit(6);

    // Bloco E3 UX (2026-05-29) — queries de Receita vs Despesa por mês
    // (8m) removidas junto com o TotalIncomeChart. Lojista que quer
    // visão mensal vai pra /admin/relatorios/resultado.

    // === Sinais de onboarding ===
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

    const totalOrderCountRow = await tx
      .select({ value: sql<number>`count(*)::int` })
      .from(orderTable)
      .where(
        sql`${orderTable.storeId} = ${store.id} and ${orderTable.status} in ('confirmed','fulfilled','returned')`,
      );
    const totalOrderCount = totalOrderCountRow[0]?.value ?? 0;

    return {
      revenueSeriesRows,
      recentOrders,
      productCount,
      bannerCount,
      totalOrderCount,
    };
  });

  // Hero + Sinais + Bombando + KPIs/LojaOnline + Caixa — paralelo top-level.
  // Cada chamada abre sua própria transação RLS-aware, então Promise.all
  // sem efeito DeprecationWarning (cliente pg diferente por transação).
  // Bloco E2 UX (2026-05-29) — caixa entra aqui pra render no topo do
  // dashboard (primeiro toque do dia do lojista de balcão).
  // Onda M4 (2026-05-29) — loadProdutosBombando removido junto com o
  // componente que consumia. loadDashboardKpis ainda carrega porque
  // LojaOnlineSnapshot consome o subset `lojaOnline`.
  const [lucroData, sinaisData, kpisData, channelsData, activeCashSession] =
    await Promise.all([
      loadDashboardLucro(),
      loadDashboardSinais(),
      loadDashboardKpis({ periodoDays: periodo }),
      loadDashboardChannels({ periodoDays: periodo }),
      loadActiveCashSession(),
    ]);

  // === Onboarding state ===
  // Bloco E1 UX (2026-05-29): trocado OR por AND. Antes a loja que
  // cadastrou 1 produto E fez 1 venda perdia o checklist inteiro — mesmo
  // sem ter feito passos 2-4 (logo, endereço, banner). Agora o checklist
  // cheio só aparece em loja TOTALMENTE zerada; loja madura com passos
  // pendentes vê uma faixa fina (OnboardingProgressStrip).
  const isFreshStore = productCount === 0 && totalOrderCount === 0;

  const onboardingSteps: ChecklistStep[] = [
    {
      number: "01",
      title: "Cadastre seu primeiro produto",
      description:
        "Adicione foto, preço e estoque. Com 5+ produtos a vitrine começa a vender.",
      ctaLabel: "Cadastrar",
      href: "/admin/produtos?edit=new",
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

  if (isFreshStore) {
    return (
      <div className="b3-page">
        <div className="b3-page-title-wrap">
          <span className="b3-page-eyebrow">Visão geral</span>
          <h1 className="b3-page-title">Dashboard</h1>
        </div>
        <OnboardingChecklist storeName={store.name} steps={onboardingSteps} />
      </div>
    );
  }

  // === REVENUE CHART (série temporal real) ===
  const revenueByDay = new Map(
    revenueSeriesRows.map((r) => [r.day, Number(r.total)]),
  );
  const revenueSeries: RevenuePoint[] = fillDailySeries(revenueByDay, periodo);

  // === RECENT ORDERS ===
  const recentRows: RecentOrderRow[] = recentOrders.map((o) => ({
    id: o.id,
    shortCode: o.shortCode,
    customerName: o.customerName,
    totalInCents: o.totalInCents,
    status: o.status,
    createdAt: o.createdAt,
    categoryLabel: o.categoryLabel?.trim() || "—",
    itemCount: Number(o.itemCount ?? 0),
  }));

  const periodLabel =
    periodo === 7
      ? "Últimos 7 dias"
      : periodo === 30
        ? "Últimos 30 dias"
        : "Últimos 90 dias";

  const compareLabel =
    periodo === 7
      ? "7 dias atrás"
      : periodo === 30
        ? "30 dias atrás"
        : "90 dias atrás";

  return (
    <div className="b3-page b3-dashboard-page">
      {/* Header: eyebrow + title à esquerda · period + Nova venda à direita.
          Mobile empilha em coluna full-width. */}
      <div className="b3-dashboard-hd">
        <div className="b3-page-title-wrap">
          <span className="b3-page-eyebrow">Visão geral</span>
          <h1 className="b3-page-title">Dashboard</h1>
        </div>
        <div className="b3-dashboard-hd-actions">
          <DateRangePill periodo={periodo} />
          <NewSaleButton />
        </div>
      </div>

      {/* Onboarding strip — só aparece quando há passos pendentes. */}
      <OnboardingProgressStrip steps={onboardingSteps} />

      {/* Caixa do dia — primeiro toque do balcão. Full-width sempre. */}
      <CashSessionStatus
        active={
          activeCashSession
            ? {
                id: activeCashSession.session.id,
                openedAt: activeCashSession.session.openedAt,
                openingAmountInCents:
                  activeCashSession.session.openingAmountInCents,
                expectedInCents: activeCashSession.expectedInCents,
                saleCount: activeCashSession.saleCount,
              }
            : null
        }
      />

      {/* Linha de KPIs — 4 stat-tiles do período (Vendas / Faturamento /
          Clientes novos / Devoluções). Reference Shopeers, paleta Mangos. */}
      {kpisData ? (
        <DashboardKpiRow
          kpis={kpisData.kpis}
          compareLabel={compareLabel}
        />
      ) : null}

      {/* GRID 12-col (Onda M5, 2026-05-29) — reorganização Shopeers-style.
          Hero de Lucro à esquerda (8/12), Pegando fogo à direita (4/12). */}
      <div className="b3-dashboard-grid">
        <div className="b3-dashboard-col-main">
          {lucroData ? (
            <ProfitSummary
              primary={lucroData.thisWeek}
              secondary={lucroData.yesterday}
            />
          ) : null}
        </div>
        <div className="b3-dashboard-col-side">
          <PegandoFogo
            items={sinaisData.items}
            allClear={sinaisData.allClear}
            checkedAt={sinaisData.checkedAt}
            failedChecks={sinaisData.failedChecks}
          />
        </div>
      </div>

      {/* Gráfico de receita — full width pra dia-a-dia ficar legível. */}
      <RevenueAnalyticsChart data={revenueSeries} periodLabel={periodLabel} />

      {/* Segunda linha de grid: Vendas recentes (8/12) + Canais + Loja online (4/12). */}
      <div className="b3-dashboard-grid">
        <div className="b3-dashboard-col-main">
          <RecentOrdersTable orders={recentRows} />
        </div>
        <div className="b3-dashboard-col-side">
          {channelsData ? (
            <ChannelsCard
              data={channelsData}
              periodLabel={periodLabel}
            />
          ) : null}
          {kpisData ? <LojaOnlineSnapshot data={kpisData.lojaOnline} /> : null}
        </div>
      </div>
    </div>
  );
}

