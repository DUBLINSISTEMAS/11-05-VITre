import { asc, count, eq } from "drizzle-orm";
import { TagIcon } from "lucide-react";

import { CategoriesAdmin } from "@/components/admin/categories-admin";
import { CategoryDialog } from "@/components/admin/category-dialog";
import { AdminPageHeader } from "@/components/admin/shell/page-header";
import { categoryTable, productTable } from "@/db/schema";
import { requireSession } from "@/lib/auth-server";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

export default async function CategoriasPage() {
  const session = await requireSession();
  const store = await getCurrentStore(session.user.id);
  if (!store) {
    throw new Error("UNREACHABLE: categorias page sem loja");
  }

  const { categories, productCounts } = await withTenant(
    store.id,
    session.user.id,
    async (tx) => {
      // SÉRIE dentro do tx — `pg` deprecou paralelas no mesmo client.
      const categories = await tx.query.categoryTable.findMany({
        where: eq(categoryTable.storeId, store.id),
        orderBy: [asc(categoryTable.position), asc(categoryTable.name)],
        columns: {
          id: true,
          name: true,
          slug: true,
          parentId: true,
          position: true,
          isActive: true,
          imageUrl: true,
        },
      });
      const productCounts = await tx
        .select({ categoryId: productTable.categoryId, value: count() })
        .from(productTable)
        .where(eq(productTable.storeId, store.id))
        .groupBy(productTable.categoryId);
      return { categories, productCounts };
    },
  );

  const productCountByCategory: Record<string, number> = {};
  for (const row of productCounts) {
    if (row.categoryId) {
      productCountByCategory[row.categoryId] = row.value;
    }
  }

  const rootOptions = categories
    .filter((c) => c.parentId === null)
    .map((c) => ({ id: c.id, name: c.name, parentId: null }));

  const totalCount = categories.length;

  return (
    <div className="space-y-4 sm:space-y-6">
      <AdminPageHeader
        title="Categorias"
        subtitle={
          totalCount === 0
            ? "Nenhuma categoria ainda."
            : `${totalCount} ${totalCount === 1 ? "categoria" : "categorias"}`
        }
        actions={<CategoryDialog rootCategories={rootOptions} />}
      />

      {categories.length === 0 ? (
        <EmptyState />
      ) : (
        <CategoriesAdmin
          categories={categories}
          productCountByCategory={productCountByCategory}
        />
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="border-line flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center sm:p-12">
      <div className="bg-brand-wash text-brand flex size-12 items-center justify-center rounded-full">
        <TagIcon className="size-6" />
      </div>
      <h2 className="text-lg font-semibold text-ink-1">Organize sua vitrine</h2>
      <p className="text-ink-4 max-w-sm text-sm">
        Categorias agrupam produtos pra seu cliente achar rápido — ex:
        “Vestidos”, “Anéis”, “Perfumes”. Você pode criar subcategorias
        (até 2 níveis).
      </p>
    </div>
  );
}
