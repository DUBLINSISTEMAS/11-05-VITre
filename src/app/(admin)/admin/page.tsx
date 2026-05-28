import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { loadDashboardSinais } from "@/actions/dashboard/load-sinais";
import { loadDashboardLucro } from "@/actions/reports/load-dashboard-lucro";
import { DateRangePill } from "@/components/admin/dashboard/date-range-pill";
import { HeroLucro } from "@/components/admin/dashboard/hero-lucro";
import { NewSaleButton } from "@/components/admin/dashboard/new-sale-button";
import {
  type ChecklistStep,
  OnboardingChecklist,
} from "@/components/admin/dashboard/onboarding-checklist";
import { PegandoFogo } from "@/components/admin/dashboard/pegando-fogo";
import {
  type RecentOrderRow,
  RecentOrdersTable,
} from "@/components/admin/dashboard/recent-orders-table";
import {
  RevenueAnalyticsChart,
  type RevenuePoint,
} from "@/components/admin/dashboard/revenue-analytics-chart";
import {
  type IncomePoint,
  TotalIncomeChart,
} from "@/components/admin/dashboard/total-income-chart";
import {
  bannerTable,
  expenseTable,
  orderTable,
  productTable,
} from "@/db/schema";
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

const MONTH_PT = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
] as const;

/** Preenche série temporal contínua: mapeia cada dia do período pra um ponto,
 *  com label "dd/mm" e valor (zero quando não houve venda). Mantém continuidade
 *  temporal sem mentir — barra zero some, label do dia continua. */
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
  const incomeSeriesStart = new Date(
    now.getFullYear(),
    now.getMonth() - 7,
    1,
  );

  const {
    revenueSeriesRows,
    recentOrders,
    productCount,
    bannerCount,
    totalOrderCount,
    incomeRows,
    expenseRows,
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

    // === Receita por mês (últimos 8 meses) — pro TotalIncomeChart ===
    const incomeRows = await tx
      .select({
        month: sql<string>`to_char(date_trunc('month', ${orderTable.createdAt}), 'YYYY-MM')`,
        sum: sql<number>`coalesce(sum(${orderTable.totalInCents}), 0)::int`,
      })
      .from(orderTable)
      .where(
        sql`${orderTable.storeId} = ${store.id}
            and ${orderTable.status} in ('confirmed','fulfilled')
            and ${orderTable.createdAt} >= ${incomeSeriesStart}`,
      )
      .groupBy(sql`date_trunc('month', ${orderTable.createdAt})`);

    // === Despesa por mês (últimos 8 meses, paidAt) ===
    const expenseRows = await tx
      .select({
        month: sql<string>`to_char(date_trunc('month', ${expenseTable.paidAt}), 'YYYY-MM')`,
        sum: sql<number>`coalesce(sum(${expenseTable.amountInCents}), 0)::int`,
      })
      .from(expenseTable)
      .where(
        sql`${expenseTable.storeId} = ${store.id}
            and ${expenseTable.paidAt} is not null
            and ${expenseTable.paidAt} >= ${incomeSeriesStart}`,
      )
      .groupBy(sql`date_trunc('month', ${expenseTable.paidAt})`);

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
      incomeRows,
      expenseRows,
    };
  });

  // Hero de Lucro + Sinais "pegando fogo" — em paralelo top-level.
  // Cada chamada abre sua própria transação RLS-aware, então Promise.all
  // sem efeito DeprecationWarning (cliente pg diferente por transação).
  const [lucroData, sinaisData] = await Promise.all([
    loadDashboardLucro(),
    loadDashboardSinais(),
  ]);

  // === Onboarding state ===
  const isFreshStore = productCount === 0 || totalOrderCount === 0;

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
        <h1 className="b3-page-title">Como tá o negócio hoje</h1>
        <OnboardingChecklist storeName={store.name} steps={onboardingSteps} />
      </div>
    );
  }

  // === REVENUE CHART (série temporal real) ===
  const revenueByDay = new Map(
    revenueSeriesRows.map((r) => [r.day, Number(r.total)]),
  );
  const revenueSeries: RevenuePoint[] = fillDailySeries(revenueByDay, periodo);

  // === INCOME CHART (8 meses retroativos) ===
  const incomeMap = new Map(
    incomeRows.map((r) => [r.month, Number(r.sum)]),
  );
  const expenseMap = new Map(
    expenseRows.map((r) => [r.month, Number(r.sum)]),
  );
  const incomeChartData: IncomePoint[] = Array.from({ length: 8 }).map((_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (7 - i), 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return {
      label: MONTH_PT[d.getMonth()]!,
      profit: incomeMap.get(key) ?? 0,
      loss: expenseMap.get(key) ?? 0,
    };
  });

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

  return (
    <div className="b3-page">
      {/* Header da página: título + actions (DateRangePill + Nova venda).
          Mobile empilha em coluna; desktop fica lado a lado. */}
      <div className="b3-dashboard-hd">
        <h1 className="b3-page-title">Como tá o negócio hoje</h1>
        <div className="b3-dashboard-hd-actions">
          <DateRangePill periodo={periodo} />
          <NewSaleButton />
        </div>
      </div>

      {/* Hero de Lucro Líquido — Bloco F.2.1 da ressignificação.
          Substitui 4 MetricCards genéricos por DOIS números úteis:
          quanto lucrou ontem (vs mesmo dia da semana passada) e quanto
          essa semana (vs mesma janela 7d atrás). Honestidade explícita
          via cobertura CMV. */}
      {lucroData ? (
        <HeroLucro
          yesterday={lucroData.yesterday}
          thisWeek={lucroData.thisWeek}
        />
      ) : null}

      {/* Pegando fogo agora — Bloco F.2.2.
          Sinais DELTA do dia (não fila acumulada). 4 categorias curadas:
          caixa esquecido · WhatsApp pendente · fiado vencido · estoque
          novo em mínimo. Vazio = "Tudo em dia 🤝". */}
      <PegandoFogo
        items={sinaisData.items}
        allClear={sinaisData.allClear}
      />

      {/* 2 gráficos: 60/40 */}
      <div className="b3-charts-grid">
        <RevenueAnalyticsChart data={revenueSeries} periodLabel={periodLabel} />
        <TotalIncomeChart data={incomeChartData} />
      </div>

      {/* Tabela de vendas recentes */}
      <RecentOrdersTable orders={recentRows} />
    </div>
  );
}
