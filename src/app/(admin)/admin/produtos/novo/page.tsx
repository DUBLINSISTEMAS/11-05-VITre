import { asc, eq } from "drizzle-orm";
import { HomeIcon, PackageIcon } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/shell/page-header";
import { categoryTable } from "@/db/schema";
import { requireSession } from "@/lib/auth-server";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

import { NewProductForm } from "./new-product-form";

export const dynamic = "force-dynamic";

export default async function NovoProdutoPage() {
  const session = await requireSession();
  const store = await getCurrentStore(session.user.id);
  if (!store) {
    throw new Error("UNREACHABLE: novo produto page sem loja");
  }

  // Categorias do SSR — form abre com Select já populado, sem fetch
  // client-side. RLS via withTenant.
  const categories = await withTenant(store.id, session.user.id, async (tx) =>
    tx
      .select({
        id: categoryTable.id,
        name: categoryTable.name,
        parentId: categoryTable.parentId,
      })
      .from(categoryTable)
      .where(eq(categoryTable.storeId, store.id))
      .orderBy(asc(categoryTable.position), asc(categoryTable.name)),
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <AdminPageHeader
        title="Novo produto"
        subtitle="Preencha nome e preço pra começar. Fotos e categoria podem entrar agora ou depois."
        breadcrumb={[
          { label: "Início", icon: HomeIcon, href: "/admin" },
          { label: "Produtos", icon: PackageIcon, href: "/admin/produtos" },
          { label: "Novo" },
        ]}
      />
      <NewProductForm categories={categories} />
    </div>
  );
}
