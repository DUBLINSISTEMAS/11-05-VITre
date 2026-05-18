import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { ChevronLeftIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductActionsMenu } from "@/components/admin/product-actions-menu";
import { ProductPublishToggle } from "@/components/admin/product-publish-toggle";
import {
  type RelatedPickerItem,
  RelatedProductsCard,
} from "@/components/admin/related-products-card";
import {
  categoryTable,
  productImageTable,
  productRelatedTable,
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

    // Curadoria manual atual de "Você pode gostar também".
    const relatedRows = await tx
      .select({ id: productRelatedTable.relatedProductId })
      .from(productRelatedTable)
      .where(
        and(
          eq(productRelatedTable.storeId, store.id),
          eq(productRelatedTable.productId, id),
        ),
      )
      .orderBy(asc(productRelatedTable.position));

    // Catálogo de candidatos (ativos da loja, exceto o atual). Inclui
    // capa pra preview no picker. ≤ catálogo típico é pequeno
    // (≤200 produtos), passar tudo no SSR + filtragem client é OK.
    const candidates = await tx
      .select({
        id: productTable.id,
        name: productTable.name,
      })
      .from(productTable)
      .where(
        and(
          eq(productTable.storeId, store.id),
          eq(productTable.isActive, true),
          ne(productTable.id, id),
        ),
      )
      .orderBy(asc(productTable.name));

    // Capas das candidatas (posicao 0). Map separado pra evitar JOIN.
    const candidateIds = candidates.map((c) => c.id);
    const covers: Array<{ productId: string; url: string }> =
      candidateIds.length > 0
        ? await tx
            .select({
              productId: productImageTable.productId,
              url: productImageTable.url,
            })
            .from(productImageTable)
            .where(
              and(
                eq(productImageTable.storeId, store.id),
                eq(productImageTable.position, 0),
                inArray(productImageTable.productId, candidateIds),
              ),
            )
        : [];
    const coverByProduct = new Map(covers.map((c) => [c.productId, c.url]));

    const candidatesWithCover: RelatedPickerItem[] = candidates.map((c) => ({
      id: c.id,
      name: c.name,
      cover: coverByProduct.get(c.id) ?? null,
    }));

    return {
      product,
      images,
      variants,
      categories,
      relatedIds: relatedRows.map((r) => r.id),
      candidatesWithCover,
    };
  });

  if (!result) notFound();

  const { product, images, variants, categories, relatedIds, candidatesWithCover } =
    result;
  const isDraft =
    !product.name.trim() || product.slug.startsWith("draft-");
  const headerTitle = isDraft ? "Rascunho sem nome" : product.name;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Back-row Dublin v3 (B3ProdutoDetalheScreen bagy-detail.jsx:119-134) */}
      <div className="flex items-start gap-3">
        <Link
          href="/admin/produtos"
          aria-label="Voltar para produtos"
          className="b3-btn b3-btn--sm size-9 shrink-0 justify-center p-0"
        >
          <ChevronLeftIcon size={15} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-ink-1 truncate text-[22px] font-bold tracking-[-0.025em]">
              {headerTitle}
            </h1>
            {!isDraft ? (
              product.isActive ? (
                <span className="b3-pill b3-pill--ok">Publicado</span>
              ) : (
                <span className="b3-pill b3-pill--gold">Despublicado</span>
              )
            ) : (
              <span className="b3-pill">Rascunho</span>
            )}
          </div>
          <p className="text-ink-4 mt-1 text-[13px]">
            {isDraft
              ? "Complete os dados pra publicar."
              : "Edite os dados e clique em Salvar."}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ProductPublishToggle
            productId={product.id}
            isActive={product.isActive}
            disabled={isDraft}
          />
          <ProductActionsMenu
            productId={product.id}
            productName={product.name}
            variants={variants.map((v) => ({
              id: v.id,
              name: v.name,
              stockQuantity: v.stockQuantity ?? 0,
            }))}
          />
        </div>
      </div>

      <RelatedProductsCard
        productId={product.id}
        initialRelatedIds={relatedIds}
        candidates={candidatesWithCover}
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
          installmentsOverride: product.installmentsOverride,
          cashDiscountOverrideBps: product.cashDiscountOverrideBps,
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
