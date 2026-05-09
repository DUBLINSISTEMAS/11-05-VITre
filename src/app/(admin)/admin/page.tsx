import {
  and,
  count,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm";

import {
  DashboardQuickActions,
  type DashboardStats,
} from "@/components/admin/dashboard-quick-actions";
import { WelcomeCard } from "@/components/admin/welcome-card";
import {
  bannerTable,
  categoryTable,
  orderTable,
  productTable,
} from "@/db/schema";
import { requireSession } from "@/lib/auth-server";
import { env } from "@/lib/env";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

function getFirstName(fullName: string | null | undefined): string {
  if (!fullName) return "lojista";
  return fullName.trim().split(/\s+/)[0] ?? "lojista";
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

  // 5 contagens em paralelo. Cada query é leve (count(*) com index na storeId).
  const now = sql`now()`;
  const promoStartCondition = or(
    isNull(productTable.promoStartsAt),
    lte(productTable.promoStartsAt, now),
  );
  const promoEndCondition = or(
    isNull(productTable.promoEndsAt),
    gte(productTable.promoEndsAt, now),
  );

  const [
    productTotalRows,
    promoActiveRows,
    pendingOrdersRows,
    categoryCountRows,
    bannerCountRows,
  ] = await withTenant(store.id, session.user.id, async (tx) =>
    Promise.all([
      tx
        .select({ value: count() })
        .from(productTable)
        .where(eq(productTable.storeId, store.id)),
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
      tx
        .select({ value: count() })
        .from(orderTable)
        .where(
          and(
            eq(orderTable.storeId, store.id),
            inArray(orderTable.status, ["awaiting_whatsapp", "confirmed"]),
          ),
        ),
      tx
        .select({ value: count() })
        .from(categoryTable)
        .where(eq(categoryTable.storeId, store.id)),
      tx
        .select({ value: count() })
        .from(bannerTable)
        .where(eq(bannerTable.storeId, store.id)),
    ]),
  );

  const stats: DashboardStats = {
    products: productTotalRows[0]?.value ?? 0,
    promo: promoActiveRows[0]?.value ?? 0,
    pending: pendingOrdersRows[0]?.value ?? 0,
    categories: categoryCountRows[0]?.value ?? 0,
    banners: bannerCountRows[0]?.value ?? 0,
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <header className="space-y-1">
        <p className="text-muted-foreground text-sm">
          Olá, <span className="text-foreground font-medium">{firstName}</span>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Painel
        </h1>
      </header>

      <WelcomeCard storeName={store.name} storeUrl={storeUrl} />

      <DashboardQuickActions stats={stats} />
    </div>
  );
}
