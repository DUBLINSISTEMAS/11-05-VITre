import { and, count, eq } from "drizzle-orm";
import { ExternalLinkIcon } from "lucide-react";
import Link from "next/link";

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
      {/* S19 (handoff pixel-perfect 2026-05-25): h1+sub viram b3-page-title +
          b3-page-sub. Título "Aparência da loja" (handoff aparencia.jsx:25)
          em vez de só "Aparência". CTA "Abrir loja" no canto direito —
          handoff tem também "Restaurar" + "Publicar" mas arquitetura atual
          é auto-save por seção, então só o "Abrir loja" faz sentido (dirty
          tracking + publish drawer seriam refactor maior, fora do escopo
          desta slice). */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="b3-page-title">Aparência da loja</h1>
          <p className="b3-page-sub">
            Edite à esquerda, veja na hora abaixo —{" "}
            <span className="text-ink-2 font-mono">vitre.site/{store.slug}</span>
          </p>
        </div>
        <Link
          href={`/${store.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          prefetch={false}
          className="b3-btn b3-btn--sm"
          title="Abrir loja em nova aba"
        >
          <ExternalLinkIcon size={13} aria-hidden />
          Abrir loja
        </Link>
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
