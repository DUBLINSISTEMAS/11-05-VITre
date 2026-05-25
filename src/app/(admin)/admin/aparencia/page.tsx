import { and, count, eq } from "drizzle-orm";

import { AparenciaEditor } from "@/components/admin/aparencia-editor";
import { bannerTable, categoryTable, productTable } from "@/db/schema";
import { requireSession } from "@/lib/auth-server";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

/**
 * Aparência — PP4 (handoff pixel-perfect 2026-05-25).
 *
 * Layout sidebar 260px com 8 sections + edit panel + preview iframe
 * embaixo. Bate aparencia.jsx do bundle pixel-pixel.
 *
 * 4 sections funcionais (Identidade, Banners, SEO, parcial); 4 mock UI
 * com pill "Em breve" — flexibilização explícita da régua
 * "funciona-ou-esconde" durante a onda pixel-perfect (decisão
 * documentada em memory: pixel-perfect-redesign-decisao-2026-05-25.md).
 */
export default async function AparenciaPage() {
  const session = await requireSession();
  const store = await getCurrentStore(session.user.id);
  if (!store) {
    throw new Error("UNREACHABLE: aparencia page sem loja");
  }

  // Counts pras cards das sections — 3 queries leves em paralelo.
  const counts = await withTenant(store.id, session.user.id, async (tx) => {
    const [bannersRow] = await tx
      .select({ value: count() })
      .from(bannerTable)
      .where(
        and(
          eq(bannerTable.storeId, store.id),
          eq(bannerTable.isActive, true),
        ),
      );
    const [categoriesRow] = await tx
      .select({ value: count() })
      .from(categoryTable)
      .where(eq(categoryTable.storeId, store.id));
    const [featuredRow] = await tx
      .select({ value: count() })
      .from(productTable)
      .where(
        and(
          eq(productTable.storeId, store.id),
          eq(productTable.isFeatured, true),
          eq(productTable.isActive, true),
        ),
      );
    return {
      activeBanners: Number(bannersRow?.value ?? 0),
      totalCategories: Number(categoriesRow?.value ?? 0),
      featuredProducts: Number(featuredRow?.value ?? 0),
    };
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-ink-1 text-[22px] font-bold tracking-[-0.025em]">
          Aparência
        </h1>
        <p className="text-ink-4 mt-1 text-[13px]">
          Edite à esquerda, veja na hora abaixo —{" "}
          <span className="text-ink-2 font-mono">mangospay.app/{store.slug}</span>
        </p>
      </div>

      <AparenciaEditor
        storeSlug={store.slug}
        store={{
          name: store.name,
          slug: store.slug,
          primaryColor: store.primaryColor,
          logoUrl: store.logoUrl,
          bannerRotationSec: store.bannerRotationSec,
          categoryShape: store.categoryShape,
          productCardStyle: store.productCardStyle,
          heroStyle: store.heroStyle,
          bottomNavStyle: store.bottomNavStyle,
        }}
        counts={counts}
      />
    </div>
  );
}
