import { asc, eq } from "drizzle-orm";
import { ChevronLeftIcon } from "lucide-react";
import Link from "next/link";

import { brandTable, categoryTable } from "@/db/schema";
import { requireSession } from "@/lib/auth-server";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

import { NewProductForm } from "./new-product-form";

export const dynamic = "force-dynamic";

/**
 * Novo produto — Onda A.17 pixel-perfect Dublin v3 (back-row pattern).
 */
export default async function NovoProdutoPage() {
  const session = await requireSession();
  const store = await getCurrentStore(session.user.id);
  if (!store) {
    throw new Error("UNREACHABLE: novo produto page sem loja");
  }

  const { categories, brands } = await withTenant(
    store.id,
    session.user.id,
    async (tx) => {
      const categories = await tx
        .select({
          id: categoryTable.id,
          name: categoryTable.name,
          parentId: categoryTable.parentId,
        })
        .from(categoryTable)
        .where(eq(categoryTable.storeId, store.id))
        .orderBy(asc(categoryTable.position), asc(categoryTable.name));
      // Sprint 2A — marcas pro Select inline no form.
      const brands = await tx
        .select({
          id: brandTable.id,
          name: brandTable.name,
        })
        .from(brandTable)
        .where(eq(brandTable.storeId, store.id))
        .orderBy(asc(brandTable.name));
      return { categories, brands };
    },
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-start gap-3">
        <Link
          href="/admin/produtos"
          aria-label="Voltar para produtos"
          className="b3-btn b3-btn--sm size-9 shrink-0 justify-center p-0"
        >
          <ChevronLeftIcon size={15} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-ink-1 text-[22px] font-bold tracking-[-0.025em]">
            Novo produto
          </h1>
          <p className="text-ink-4 mt-1 text-[13px]">
            Preencha nome e preço pra começar. Fotos e categoria podem entrar
            agora ou depois.
          </p>
        </div>
      </div>
      <NewProductForm categories={categories} brands={brands} />
    </div>
  );
}
