import { and, asc, eq } from "drizzle-orm";
import { PackageIcon, StoreIcon } from "lucide-react";
import { notFound } from "next/navigation";

import { ProductActionsMenu } from "@/components/admin/product-actions-menu";
import { ProductForm } from "@/components/admin/product-form";
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

interface EditarProdutoPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditarProdutoPage({
  params,
}: EditarProdutoPageProps) {
  const { id } = await params;

  const session = await requireSession();
  const store = await getCurrentStore(session.user.id);
  if (!store) notFound();

  // Tudo dentro de um único withTenant — aproveita a transação pra setar
  // GUC uma vez e rodar a query do produto + as 3 paralelas em sequência.
  const result = await withTenant(store.id, session.user.id, async (tx) => {
    // Fetch produto com defesa em profundidade (`storeId` no where)
    const product = await tx.query.productTable.findFirst({
      where: and(
        eq(productTable.id, id),
        eq(productTable.storeId, store.id),
      ),
    });
    if (!product) return null;

    // Imagens, variantes e categorias da loja — SÉRIE dentro do tx
    // (`pg` deprecou paralelas no mesmo client).
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
      .orderBy(asc(categoryTable.name));

    return { product, images, variants, categories };
  });

  if (!result) notFound();
  const { product, images, variants, categories } = result;

  const isDraft =
    !product.name.trim() || product.slug.startsWith("draft-");
  const headerTitle = isDraft
    ? "Novo produto"
    : product.name;

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title={headerTitle}
        breadcrumb={[
          { label: "Sua Loja", icon: StoreIcon },
          { label: "Produtos", icon: PackageIcon, href: "/admin/produtos" },
          { label: isDraft ? "Novo" : product.name },
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

      {isDraft ? (
        <p className="bg-primary/5 text-primary border-primary/20 rounded-lg border px-3 py-2 text-xs">
          Rascunho — preencha pelo menos o nome e o preço, e depois marque
          “Visível” pra publicar na sua vitrine.
        </p>
      ) : null}

      <ProductForm
        categories={categories}
        isDraft={isDraft}
        initialData={{
          productId: product.id,
          name: product.name,
          description: product.description,
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
            // Form representa colorHex como string ("" = vazio); banco null.
            colorHex: v.colorHex ?? "",
            featuredImageId: v.featuredImageId,
          })),
          images,
        }}
      />
    </div>
  );
}
