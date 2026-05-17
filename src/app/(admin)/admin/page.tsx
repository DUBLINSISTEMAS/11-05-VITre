import { count, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { QuickActions } from "@/components/admin/dashboard/quick-actions";
import {
  type RecentOrderRow,
  RecentOrdersTable,
} from "@/components/admin/dashboard/recent-orders-table";
import {
  type SalesSummary,
  SalesSummaryCard,
} from "@/components/admin/dashboard/sales-summary-card";
import {
  SetupChecklist,
  type SetupItem,
} from "@/components/admin/dashboard/setup-checklist";
import {
  bannerTable,
  categoryTable,
  orderTable,
  productTable,
} from "@/db/schema";
import { requireSession } from "@/lib/auth-server";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

/** Cor brand default (Vitrê azul royal — pré-redesign). Marker pra detectar
 *  se a lojista personalizou no setup. Match exato — qualquer hex diferente
 *  conta como personalização. */
const BRAND_DEFAULT_HEX = "#1E3FE6";

/** Período em dias aceito no URL ?periodo=7|30|90. Default 30. */
const periodoSchema = z
  .enum(["7", "30", "90"])
  .catch("30")
  .transform((v) => Number(v) as 7 | 30 | 90);

function getFirstName(fullName: string | null | undefined): string {
  if (!fullName) return "lojista";
  return fullName.trim().split(/\s+/)[0] ?? "lojista";
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

export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const session = await requireSession();
  const store = await getCurrentStore(session.user.id);

  // Layout já redirecionou se sem loja, mas TS exige guard.
  if (!store) {
    throw new Error("UNREACHABLE: admin page sem loja");
  }

  const sp = await searchParams;
  const periodo = periodoSchema.parse(sp.periodo);
  const firstName = getFirstName(session.user.name);

  // Stats agregados em 4 round-trips: salesStats (5 buckets em 1 query
  // via FILTER), productStats (3 stats), categoryCount, bannerCount,
  // revenueSeriesRows (group by day, janela do período), recentOrdersRaw.
  // node-pg deprecou paralelas no mesmo tx — queries em série dentro do
  // withTenant.
  const {
    salesStats,
    productStats,
    categoryCountRows,
    bannerCountRows,
    revenueSeriesRows,
    recentOrdersRaw,
  } = await withTenant(store.id, session.user.id, async (tx) => {
    // 5 buckets de status × (count + sum) em 1 SELECT via FILTER
    // Window: últimos `periodo` dias. Interval interpolado direto na SQL
    // string (zod garantiu enum, sem injection).
    const salesStats = await tx
      .select({
        // TOTAL = todos status na janela
        totalCount: sql<number>`count(*) filter (where ${orderTable.createdAt} >= now() - interval '${sql.raw(String(periodo))} days')::int`,
        totalSum: sql<number>`coalesce(sum(${orderTable.totalInCents}) filter (where ${orderTable.createdAt} >= now() - interval '${sql.raw(String(periodo))} days'), 0)::int`,
        // APROVADOS = confirmed + fulfilled
        aprovadosCount: sql<number>`count(*) filter (where ${orderTable.status} in ('confirmed','fulfilled') and ${orderTable.createdAt} >= now() - interval '${sql.raw(String(periodo))} days')::int`,
        aprovadosSum: sql<number>`coalesce(sum(${orderTable.totalInCents}) filter (where ${orderTable.status} in ('confirmed','fulfilled') and ${orderTable.createdAt} >= now() - interval '${sql.raw(String(periodo))} days'), 0)::int`,
        // PENDENTES = awaiting_whatsapp
        pendentesCount: sql<number>`count(*) filter (where ${orderTable.status} = 'awaiting_whatsapp' and ${orderTable.createdAt} >= now() - interval '${sql.raw(String(periodo))} days')::int`,
        pendentesSum: sql<number>`coalesce(sum(${orderTable.totalInCents}) filter (where ${orderTable.status} = 'awaiting_whatsapp' and ${orderTable.createdAt} >= now() - interval '${sql.raw(String(periodo))} days'), 0)::int`,
        // CANCELADOS = canceled (note: schema usa single L)
        canceladosCount: sql<number>`count(*) filter (where ${orderTable.status} = 'canceled' and ${orderTable.createdAt} >= now() - interval '${sql.raw(String(periodo))} days')::int`,
        canceladosSum: sql<number>`coalesce(sum(${orderTable.totalInCents}) filter (where ${orderTable.status} = 'canceled' and ${orderTable.createdAt} >= now() - interval '${sql.raw(String(periodo))} days'), 0)::int`,
        // EXPIRADOS = expired
        expiradosCount: sql<number>`count(*) filter (where ${orderTable.status} = 'expired' and ${orderTable.createdAt} >= now() - interval '${sql.raw(String(periodo))} days')::int`,
        expiradosSum: sql<number>`coalesce(sum(${orderTable.totalInCents}) filter (where ${orderTable.status} = 'expired' and ${orderTable.createdAt} >= now() - interval '${sql.raw(String(periodo))} days'), 0)::int`,
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

    const categoryCountRows = await tx
      .select({ value: count() })
      .from(categoryTable)
      .where(eq(categoryTable.storeId, store.id));

    const bannerCountRows = await tx
      .select({ value: count() })
      .from(bannerTable)
      .where(eq(bannerTable.storeId, store.id));

    // Receita por dia — janela do período selecionado, group by day
    const revenueSeriesRows = await tx
      .select({
        day: sql<string>`to_char(date_trunc('day', ${orderTable.createdAt}), 'YYYY-MM-DD')`,
        total: sql<number>`coalesce(sum(${orderTable.totalInCents}), 0)::int`,
      })
      .from(orderTable)
      .where(
        sql`${orderTable.storeId} = ${store.id} and ${orderTable.status} in ('confirmed','fulfilled') and ${orderTable.createdAt} >= now() - interval '${sql.raw(String(periodo))} days'`,
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

    return {
      salesStats,
      productStats,
      categoryCountRows,
      bannerCountRows,
      revenueSeriesRows,
      recentOrdersRaw,
    };
  });

  // ---- Sales summary ----
  const sStat = salesStats[0];
  const summary: SalesSummary = {
    total: {
      count: sStat?.totalCount ?? 0,
      totalInCents: sStat?.totalSum ?? 0,
    },
    aprovados: {
      count: sStat?.aprovadosCount ?? 0,
      totalInCents: sStat?.aprovadosSum ?? 0,
    },
    pendentes: {
      count: sStat?.pendentesCount ?? 0,
      totalInCents: sStat?.pendentesSum ?? 0,
    },
    cancelados: {
      count: sStat?.canceladosCount ?? 0,
      totalInCents: sStat?.canceladosSum ?? 0,
    },
    expirados: {
      count: sStat?.expiradosCount ?? 0,
      totalInCents: sStat?.expiradosSum ?? 0,
    },
  };

  // ---- Revenue series com zeros preenchidos ----
  const revenueByDay = new Map(
    revenueSeriesRows.map((r) => [r.day, Number(r.total)]),
  );
  const series = generateLastNDays(periodo).map(
    (date) => revenueByDay.get(date) ?? 0,
  );

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
  const productsPublished = productStats[0]?.productsPublished ?? 0;
  const categoryCount = categoryCountRows[0]?.value ?? 0;
  const bannerCount = bannerCountRows[0]?.value ?? 0;
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

  const allSetupDone = setupItems.every((i) => i.done);

  return (
    <div className="b3-page">
      <h1 className="mb-6 text-[24px] font-bold tracking-[-0.025em] text-ink-1">
        Olá, {firstName}!
      </h1>

      <QuickActions storeSlug={store.slug} />

      <SalesSummaryCard periodo={periodo} series={series} summary={summary} />

      {!allSetupDone ? (
        <div className="mt-4">
          <SetupChecklist items={setupItems} />
        </div>
      ) : null}

      <div className="mt-4">
        <RecentOrdersTable orders={recentOrders} />
      </div>
    </div>
  );
}
