import { asc, eq } from "drizzle-orm";

import { BannersAdmin } from "@/components/admin/banners-admin";
import { bannerTable } from "@/db/schema";
import { requireSession } from "@/lib/auth-server";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

const MAX_BANNERS = 10;

export default async function BannersPage() {
  const session = await requireSession();
  const store = await getCurrentStore(session.user.id);
  if (!store) {
    throw new Error("UNREACHABLE: banners page sem loja");
  }

  const banners = await withTenant(store.id, session.user.id, async (tx) =>
    tx.query.bannerTable.findMany({
      where: eq(bannerTable.storeId, store.id),
      orderBy: [asc(bannerTable.position)],
      columns: {
        id: true,
        imageUrl: true,
        link: true,
        position: true,
        isActive: true,
      },
    }),
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Banners
        </h1>
        <p className="text-muted-foreground text-sm">
          Imagens grandes que aparecem no topo da sua loja. Até{" "}
          {MAX_BANNERS} banners.
        </p>
      </header>

      <BannersAdmin banners={banners} maxBanners={MAX_BANNERS} />
    </div>
  );
}
