import { asc, eq } from "drizzle-orm";

import { BannersAdmin } from "@/components/admin/banners-admin";
import { bannerTable } from "@/db/schema";
import { requireSession } from "@/lib/auth-server";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

const MAX_BANNERS = 10;

/**
 * Banners — Onda A.16 pixel-perfect Dublin v3 (B3BannersScreen
 * bagy-routes.jsx:168). Chrome canônico H1 22px + subtitle; BannersAdmin
 * preservado (430 linhas — sweep shadcn→b3 follow-up).
 */
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
      {/* S20 (handoff pixel-perfect 2026-05-25): h1+sub viram b3-page-title +
          b3-page-sub (handoff stub-pages.jsx:172 "Banners"). Sub mantém
          texto informativo (carrossel automático + tempo configurável). */}
      <div>
        <h1 className="b3-page-title">Banners</h1>
        <p className="b3-page-sub">
          Imagens grandes que aparecem no topo da sua vitrine. Até{" "}
          {MAX_BANNERS} banners. Com 2 ou mais ativos, eles trocam
          automaticamente em carrossel — ajuste o tempo em Aparência → Banners.
        </p>
      </div>

      <BannersAdmin banners={banners} maxBanners={MAX_BANNERS} />
    </div>
  );
}
