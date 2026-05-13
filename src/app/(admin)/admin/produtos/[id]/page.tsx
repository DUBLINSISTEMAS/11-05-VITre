import { and, asc, eq } from "drizzle-orm";
import { HomeIcon, PackageIcon } from "lucide-react";
import { notFound } from "next/navigation";

import { ProductActionsMenu } from "@/components/admin/product-actions-menu";
import { ProductPublishToggle } from "@/components/admin/product-publish-toggle";
import { AdminPageHeader } from "@/components/admin/shell/page-header";
import {
  categoryTable,
  productImageTable,
  productTable,
  productVariantTable,
} from "@/db/schema";
import { requireSession } from "@/lib/auth-server";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

import { EditProductForm } from "./edit-product-form";

export const dynamic = "force-dynamic";

interface EditProdutoPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditProdutoPage({ params }: EditProdutoPageProps) {
  const { id } = await params;

  const session = await requireSession();
  const store = await getCurrentStore(session.user.id);
  if (!store) {
    throw new Error("UNREACHABLE: editar produto page sem loja");
  }

  const result = await withTenant(store.id, session.user.id, async (tx) => {
    const product = await tx.query.productTable.findFirst({
      where: and(eq(productTable.id, id), eq(productTable.storeId, store.id)),
    });
    if (!product) return null;

    // SÉRIE — pg deprecou paralelas no mesmo tx (memory `node-pg-serialize-queries-in-tx`).
    const images = await tx
      .select({
        id: productImageTable.id,
        url: productImageTable.url,
        position: productImageTable.position,
      })
      .from(productImageTable)
      .where(eq(productImageTable.productId, id))
      .orderBy(asc(productImageTable.position));
    const variants = await tx
      .select({
        id: productVariantTable.id,
        name: productVariantTable.name,
        priceInCents: productVariantTable.priceInCents,
        stockQuantity: productVariantTable.stockQuantity,
        axis: productVariantTable.axis,
        colorHex: productVariantTable.colorHex,
        featuredImageId: productVariantTable.featuredImageId,
      })
      .from(productVariantTable)
      .where(eq(productVariantTable.productId, id))
      .orderBy(asc(productVariantTable.createdAt));
    const categories = await tx
      .select({
        id: categoryTable.id,
        name: categoryTable.name,
        parentId: categoryTable.parentId,
      })
      .from(categoryTable)
      .where(eq(categoryTable.storeId, store.id))
      .orderBy(asc(categoryTable.position), asc(categoryTable.name));

    return { product, images, variants, categories };
  });

  if (!result) notFound();

  const { product, images, variants, categories } = result;
  const isDraft =
    !product.name.trim() || product.slug.startsWith("draft-");
  const headerTitle = isDraft ? "Rascunho sem nome" : product.name;

  return (
    <div className="space-y-4 sm:space-y-6">
      <AdminPageHeader
        title={headerTitle}
        subtitle={
          isDraft
            ? "Complete os dados pra publicar."
            : "Edite os dados e clique em Salvar."
        }
        breadcrumb={[
          { label: "Início", icon: HomeIcon, href: "/admin" },
          { label: "Produtos", icon: PackageIcon, href: "/admin/produtos" },
          { label: headerTitle },
        ]}
        actions={
          <>
            <ProductPublishToggle
              productId={product.id}
              isActive={product.isActive}
              disabled={isDraft}
            />
            <ProductActionsMenu
              productId={product.id}
              productName={product.name}
            />
          </>
        }
      />

      <EditProductForm
        categories={categories}
        initialData={{
          productId: product.id,
          name: product.name,
          description: product.description ?? "",
          basePriceInCents: product.basePriceInCents,
          promoPriceInCents: product.promoPriceInCents,
          categoryId: product.categoryId,
          trackStock: product.trackStock,
          stockQuantity: product.stockQuantity,
          isActive: product.isActive,
          isFeatured: product.isFeatured,
          composition: product.composition,
          modeling: product.modeling,
          lining: product.lining,
          washing: product.washing,
          variants: variants.map((v) => ({
            id: v.id,
            name: v.name,
            priceInCents: v.priceInCents,
            stockQuantity: v.stockQuantity,
            axis: v.axis,
            colorHex: v.colorHex ?? "",
            featuredImageId: v.featuredImageId,
          })),
          images,
        }}
      />
    </div>
  );
}
