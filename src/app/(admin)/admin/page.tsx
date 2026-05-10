import {
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  or,
  sql,
} from "drizzle-orm";

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

  // ---- Time windows ----
  const now = sql`now()`;
  const last7Start = sql`now() - interval '7 days'`;
  const prev7Start = sql`now() - interval '14 days'`;
  const prev7End = sql`now() - interval '7 days'`;
  const last90Start = sql`now() - interval '90 days'`;

  const promoStartCondition = or(
    isNull(productTable.promoStartsAt),
    lte(productTable.promoStartsAt, now),
  );
  const promoEndCondition = or(
    isNull(productTable.promoEndsAt),
    gte(productTable.promoEndsAt, now),
  );

  const fulfilledOrConfirmed: ReadonlyArray<
    "confirmed" | "fulfilled"
  > = ["confirmed", "fulfilled"];

  // 11 queries paralelas — todas leves (count/sum com index em store_id).
  const [
    ordersLast7Rows,
    ordersPrev7Rows,
    revenueLast7Rows,
    revenuePrev7Rows,
    productTotalRows,
    productsPublishedRows,
    promoActiveRows,
    pendingOrdersRows,
    categoryCountRows,
    bannerCountRows,
    revenueSeriesRows,
    recentOrdersRaw,
  ] = await withTenant(store.id, session.user.id, async (tx) =>
    Promise.all([
      // Pedidos confirmados/fulfilled últimos 7 dias
      tx
        .select({ value: count() })
        .from(orderTable)
        .where(
          and(
            eq(orderTable.storeId, store.id),
            inArray(orderTable.status, fulfilledOrConfirmed),
            gte(orderTable.createdAt, last7Start),
          ),
        ),
      // Pedidos confirmados/fulfilled 7 dias anteriores (8-14d atrás)
      tx
        .select({ value: count() })
        .from(orderTable)
        .where(
          and(
            eq(orderTable.storeId, store.id),
            inArray(orderTable.status, fulfilledOrConfirmed),
            gte(orderTable.createdAt, prev7Start),
            lt(orderTable.createdAt, prev7End),
          ),
        ),
      // Receita 7d
      tx
        .select({
          value: sql<number>`coalesce(sum(${orderTable.totalInCents}), 0)::int`,
        })
        .from(orderTable)
        .where(
          and(
            eq(orderTable.storeId, store.id),
            inArray(orderTable.status, fulfilledOrConfirmed),
            gte(orderTable.createdAt, last7Start),
          ),
        ),
      // Receita 7d anteriores
      tx
        .select({
          value: sql<number>`coalesce(sum(${orderTable.totalInCents}), 0)::int`,
        })
        .from(orderTable)
        .where(
          and(
            eq(orderTable.storeId, store.id),
            inArray(orderTable.status, fulfilledOrConfirmed),
            gte(orderTable.createdAt, prev7Start),
            lt(orderTable.createdAt, prev7End),
          ),
        ),
      // Produtos total
      tx
        .select({ value: count() })
        .from(productTable)
        .where(eq(productTable.storeId, store.id)),
      // Produtos publicados (isActive=true)
      tx
        .select({ value: count() })
        .from(productTable)
        .where(
          and(
            eq(productTable.storeId, store.id),
            eq(productTable.isActive, true),
          ),
        ),
      // Promoção ativa agora
      tx
        .select({ value: count() })
        .from(productTable)
        .where(
          and(
            eq(productTable.storeId, store.id),
            isNotNull(productTable.promoPriceInCents),
            promoStartCondition,
            promoEndCondition,
          ),
        ),
      // Pedidos pendentes (awaiting + confirmed)
      tx
        .select({ value: count() })
        .from(orderTable)
        .where(
          and(
            eq(orderTable.storeId, store.id),
            inArray(orderTable.status, ["awaiting_whatsapp", "confirmed"]),
          ),
        ),
      // Categorias total
      tx
        .select({ value: count() })
        .from(categoryTable)
        .where(eq(categoryTable.storeId, store.id)),
      // Banners total
      tx
        .select({ value: count() })
        .from(bannerTable)
        .where(eq(bannerTable.storeId, store.id)),
      // Receita por dia últimos 90 dias (apenas dias com receita).
      // Completa zeros no JS abaixo.
      tx
        .select({
          day: sql<string>`to_char(date_trunc('day', ${orderTable.createdAt}), 'YYYY-MM-DD')`,
          total: sql<number>`coalesce(sum(${orderTable.totalInCents}), 0)::int`,
        })
        .from(orderTable)
        .where(
          and(
            eq(orderTable.storeId, store.id),
            inArray(orderTable.status, fulfilledOrConfirmed),
            gte(orderTable.createdAt, last90Start),
          ),
        )
        .groupBy(sql`date_trunc('day', ${orderTable.createdAt})`)
        .orderBy(sql`date_trunc('day', ${orderTable.createdAt})`),
      // Top 5 pedidos recentes
      tx.query.orderTable.findMany({
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
      }),
    ]),
  );

  // ---- Stat cards data ----
  const ordersLast7 = ordersLast7Rows[0]?.value ?? 0;
  const ordersPrev7 = ordersPrev7Rows[0]?.value ?? 0;
  const revenueLast7 = revenueLast7Rows[0]?.value ?? 0;
  const revenuePrev7 = revenuePrev7Rows[0]?.value ?? 0;
  const productTotal = productTotalRows[0]?.value ?? 0;
  const productsPublished = productsPublishedRows[0]?.value ?? 0;
  const promoActive = promoActiveRows[0]?.value ?? 0;
  const pendingOrders = pendingOrdersRows[0]?.value ?? 0;
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
