import { and, asc, eq } from "drizzle-orm";
import { ArrowLeftIcon, MoreVerticalIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DeleteProductDialog } from "@/components/admin/delete-product-dialog";
import { ProductForm } from "@/components/admin/product-form";
import { ProductPublishToggle } from "@/components/admin/product-publish-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

    // Imagens, variantes e categorias da loja em paralelo
    const [images, variants, categories] = await Promise.all([
      tx
        .select({
          id: productImageTable.id,
          url: productImageTable.url,
          position: productImageTable.position,
        })
        .from(productImageTable)
        .where(eq(productImageTable.productId, id))
        .orderBy(asc(productImageTable.position)),
      tx
        .select({
          id: productVariantTable.id,
          name: productVariantTable.name,
          priceInCents: productVariantTable.priceInCents,
          stockQuantity: productVariantTable.stockQuantity,
        })
        .from(productVariantTable)
        .where(eq(productVariantTable.productId, id))
        .orderBy(asc(productVariantTable.createdAt)),
      tx
        .select({
          id: categoryTable.id,
          name: categoryTable.name,
          parentId: categoryTable.parentId,
        })
        .from(categoryTable)
        .where(eq(categoryTable.storeId, store.id))
        .orderBy(asc(categoryTable.name)),
    ]);

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
      {/* Header da página */}
      <header className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Button asChild variant="ghost" size="icon" className="-ml-2 shrink-0">
            <Link href="/admin/produtos" prefetch aria-label="Voltar">
              <ArrowLeftIcon />
            </Link>
          </Button>
          <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">
            {headerTitle}
          </h1>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <ProductPublishToggle
            productId={product.id}
            isActive={product.isActive}
            disabled={isDraft}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Mais opções">
                <MoreVerticalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DeleteProductDialog
                productId={product.id}
                productName={product.name}
                trigger={
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={(e) => e.preventDefault()}
                  >
                    Excluir produto
                  </DropdownMenuItem>
                }
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

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
          variants: variants.map((v) => ({
            id: v.id,
            name: v.name,
            priceInCents: v.priceInCents,
            stockQuantity: v.stockQuantity,
          })),
          images,
        }}
      />
    </div>
  );
}
