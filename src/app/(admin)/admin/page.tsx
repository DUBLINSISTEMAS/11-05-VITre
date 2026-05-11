import { count, desc, eq, sql } from "drizzle-orm";

import {
  type RecentOrderRow,
  RecentOrdersTable,
} from "@/components/admin/dashboard/recent-orders-table";
import { RevenueChart } from "@/components/admin/dashboard/revenue-chart";
import {
  SetupChecklist,
  type SetupItem,
} from "@/components/admin/dashboard/setup-checklist";
import {
  DeltaChip,
  StatCard,
} from "@/components/admin/dashboard/stat-card";
import {
  DashboardQuickActions,
  type DashboardStats,
} from "@/components/admin/dashboard-quick-actions";
import { AdminPageHeader } from "@/components/admin/shell/page-header";
import { WelcomeCard } from "@/components/admin/welcome-card";
import {
  bannerTable,
  categoryTable,
  orderTable,
  productTable,
} from "@/db/schema";
import { requireSession } from "@/lib/auth-server";
import { env } from "@/lib/env";
import { formatStatDelta } from "@/lib/format";
import { formatBRL } from "@/lib/pricing";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

/** Cor brand default (Vitrê azul royal — pré-redesign). Marker pra detectar
 *  se a lojista personalizou no setup. Match exato — qualquer hex diferente
 *  conta como personalização. */
const BRAND_DEFAULT_HEX = "#1E3FE6";

function getFirstName(fullName: string | null | undefined): string {
  if (!fullName) return "lojista";
  return fullName.trim().split(/\s+/)[0] ?? "lojista";
}

/**
 * Calcula delta percentual entre período atual e anterior.
 * - prev=0 e curr>0 → +100% (sinaliza "novo" de forma simples)
 * - ambos 0 → 0
 */
function pctDelta(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

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

export default async function AdminHomePage() {
  const session = await requireSession();
  const store = await getCurrentStore(session.user.id);

  // Layout já redirecionou se sem loja, mas TS exige guard.
  if (!store) {
    throw new Error("UNREACHABLE: admin page sem loja");
  }

  const storeUrl = `${env.NEXT_PUBLIC_APP_URL}/${store.slug}`;
  const firstName = getFirstName(session.user.name);

  // 12 stats agregados em 6 round-trips ao DB usando `count(*) FILTER` +
  // `sum(...) FILTER`, agrupados por tabela. Antes: 12 SELECTs em série
  // (~12-15ms total). Depois: 6 SELECTs (~6-8ms). Manteríamos in-tx por
  // node-pg ter deprecado paralelas no mesmo client (pg@9 — ver memory
  // `node-pg-serialize-queries-in-tx`).
  //
  // Estratégia: `FILTER (WHERE ...)` só funciona dentro do MESMO SELECT,
  // então combina-se queries que compartilham FROM. revenueSeries (group
  // by day) e recentOrders (top 5 colunas) ficam separadas — estrutura
  // distinta justifica round-trip dedicado.
  const {
    orderStats,
    productStats,
    categoryCountRows,
    bannerCountRows,
    revenueSeriesRows,
    recentOrdersRaw,
  } = await withTenant(store.id, session.user.id, async (tx) => {
    // 5 stats em orderTable (4 janelas temporais + status pendente)
    const orderStats = await tx
      .select({
        ordersLast7: sql<number>`count(*) filter (where ${orderTable.status} in ('confirmed','fulfilled') and ${orderTable.createdAt} >= now() - interval '7 days')::int`,
        ordersPrev7: sql<number>`count(*) filter (where ${orderTable.status} in ('confirmed','fulfilled') and ${orderTable.createdAt} >= now() - interval '14 days' and ${orderTable.createdAt} < now() - interval '7 days')::int`,
        revenueLast7: sql<number>`coalesce(sum(${orderTable.totalInCents}) filter (where ${orderTable.status} in ('confirmed','fulfilled') and ${orderTable.createdAt} >= now() - interval '7 days'), 0)::int`,
        revenuePrev7: sql<number>`coalesce(sum(${orderTable.totalInCents}) filter (where ${orderTable.status} in ('confirmed','fulfilled') and ${orderTable.createdAt} >= now() - interval '14 days' and ${orderTable.createdAt} < now() - interval '7 days'), 0)::int`,
        pendingOrders: sql<number>`count(*) filter (where ${orderTable.status} in ('awaiting_whatsapp','confirmed'))::int`,
      })
      .from(orderTable)
      .where(eq(orderTable.storeId, store.id));

    // 3 stats em productTable (total, publicados, promoção ativa agora)
    const productStats = await tx
      .select({
        productTotal: sql<number>`count(*)::int`,
        productsPublished: sql<number>`count(*) filter (where ${productTable.isActive} = true)::int`,
        promoActive: sql<number>`count(*) filter (where ${productTable.promoPriceInCents} is not null and (${productTable.promoStartsAt} is null or ${productTable.promoStartsAt} <= now()) and (${productTable.promoEndsAt} is null or ${productTable.promoEndsAt} >= now()))::int`,
      })
      .from(productTable)
      .where(eq(productTable.storeId, store.id));

    // Categorias total (estrutura simples, fica isolado)
    const categoryCountRows = await tx
      .select({ value: count() })
      .from(categoryTable)
      .where(eq(categoryTable.storeId, store.id));

    // Banners total (estrutura simples, fica isolado)
    const bannerCountRows = await tx
      .select({ value: count() })
      .from(bannerTable)
      .where(eq(bannerTable.storeId, store.id));

    // Receita por dia últimos 90 dias — group by day, completa zeros no
    // JS abaixo. Estrutura distinta dos counts; round-trip dedicado.
    const revenueSeriesRows = await tx
      .select({
        day: sql<string>`to_char(date_trunc('day', ${orderTable.createdAt}), 'YYYY-MM-DD')`,
        total: sql<number>`coalesce(sum(${orderTable.totalInCents}), 0)::int`,
      })
      .from(orderTable)
      .where(
        sql`${orderTable.storeId} = ${store.id} and ${orderTable.status} in ('confirmed','fulfilled') and ${orderTable.createdAt} >= now() - interval '90 days'`,
      )
      .groupBy(sql`date_trunc('day', ${orderTable.createdAt})`)
      .orderBy(sql`date_trunc('day', ${orderTable.createdAt})`);

    // Top 5 pedidos recentes (colunas selecionadas pra tabela do dashboard)
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

    return {
      orderStats,
      productStats,
      categoryCountRows,
      bannerCountRows,
      revenueSeriesRows,
      recentOrdersRaw,
    };
  });

  // ---- Stat cards data ----
  const ordersLast7 = orderStats[0]?.ordersLast7 ?? 0;
  const ordersPrev7 = orderStats[0]?.ordersPrev7 ?? 0;
  const revenueLast7 = orderStats[0]?.revenueLast7 ?? 0;
  const revenuePrev7 = orderStats[0]?.revenuePrev7 ?? 0;
  const pendingOrders = orderStats[0]?.pendingOrders ?? 0;
  const productTotal = productStats[0]?.productTotal ?? 0;
  const productsPublished = productStats[0]?.productsPublished ?? 0;
  const promoActive = productStats[0]?.promoActive ?? 0;
  const categoryCount = categoryCountRows[0]?.value ?? 0;
  const bannerCount = bannerCountRows[0]?.value ?? 0;

  const ordersDelta = formatStatDelta(pctDelta(ordersLast7, ordersPrev7));
  const revenueDelta = formatStatDelta(pctDelta(revenueLast7, revenuePrev7));

  // ---- Revenue series com zeros preenchidos ----
  const revenueByDay = new Map(
    revenueSeriesRows.map((r) => [r.day, Number(r.total)]),
  );
  const revenueSeries = generateLastNDays(90).map((date) => ({
    date,
    totalInCents: revenueByDay.get(date) ?? 0,
  }));

  // ---- Recent orders ----
  const recentOrders: RecentOrderRow[] = recentOrdersRaw.map((o) => ({
    id: o.id,
    shortCode: o.shortCode,
    customerName: o.customerName,
    totalInCents: o.totalInCents,
    status: o.status,
    createdAt: o.createdAt,
  }));

  // ---- Setup checklist (6 itens) ----
  const hasAddress =
    !!store.addressStreet && store.addressStreet.trim() !== "";
  const customColor = store.primaryColor !== BRAND_DEFAULT_HEX;
  const setupItems: SetupItem[] = [
    {
      key: "logo",
      label: "Adicione o logo da loja",
      href: "/admin/configuracoes",
      done: !!store.logoUrl,
    },
    {
      key: "address",
      label: "Cadastre o endereço da loja",
      href: "/admin/configuracoes",
      done: hasAddress,
    },
    {
      key: "color",
      label: "Personalize a cor da sua marca",
      href: "/admin/configuracoes",
      done: customColor,
    },
    {
      key: "category",
      label: "Crie a primeira categoria",
      href: "/admin/categorias",
      done: categoryCount > 0,
    },
    {
      key: "banner",
      label: "Suba o primeiro banner",
      href: "/admin/banners",
      done: bannerCount > 0,
    },
    {
      key: "product",
      label: "Publique o primeiro produto",
      href: "/admin/produtos",
      done: productsPublished > 0,
    },
  ];

  // ---- DashboardQuickActions stats (compat — mantido em mobile) ----
  const stats: DashboardStats = {
    products: productTotal,
    promo: promoActive,
    pending: pendingOrders,
    categories: categoryCount,
    banners: bannerCount,
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <AdminPageHeader
        title="Painel"
        subtitle={
          <>
            Olá,{" "}
            <span className="text-foreground font-medium">{firstName}</span>
          </>
        }
      />

      <WelcomeCard storeName={store.name} storeUrl={storeUrl} />

      {/* Stat cards: 4 colunas desktop, 2 mobile */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Pedidos · 7d"
          value={ordersLast7}
          delta={
            <DeltaChip label={ordersDelta.label} tone={ordersDelta.tone} />
          }
          hint="vs 7 dias anteriores"
        />
        <StatCard
          label="Receita · 7d"
          value={formatBRL(revenueLast7)}
          delta={
            <DeltaChip label={revenueDelta.label} tone={revenueDelta.tone} />
          }
          hint="vs 7 dias anteriores"
        />
        <StatCard
          label="Pedidos pendentes"
          value={pendingOrders}
          hint="aguardando ou confirmados"
        />
        <StatCard
          label="Produtos publicados"
          value={productsPublished}
          hint={`${productTotal} no total`}
        />
      </div>

      {/* Chart 2/3 + Setup 1/3 (lg+); empilhado em mobile */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RevenueChart series={revenueSeries} />
        </div>
        <div className="lg:col-span-1">
          <SetupChecklist items={setupItems} />
        </div>
      </div>

      <RecentOrdersTable orders={recentOrders} />

      {/* Atalhos de navegação — ponte mobile (bottom nav cobre 4, atalhos 6) */}
      <div className="lg:hidden">
        <DashboardQuickActions stats={stats} />
      </div>
    </div>
  );
}
