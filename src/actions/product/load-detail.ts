"use server";

import { and, asc, eq } from "drizzle-orm";
import { headers } from "next/headers";

import type { CategoryOption } from "@/components/admin/category-dialog";
import type { ProductImageData } from "@/components/admin/image-uploader";
import type { VariantData } from "@/components/admin/variant-editor";
import {
  categoryTable,
  productImageTable,
  productTable,
  productVariantTable,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

export interface ProductDetail {
  id: string;
  name: string;
  description: string;
  basePriceInCents: number;
  promoPriceInCents: number | null;
  promoStartsAt: Date | null;
  promoEndsAt: Date | null;
  categoryId: string | null;
  trackStock: boolean;
  stockQuantity: number | null;
  isActive: boolean;
  isFeatured: boolean;
  composition: string | null;
  modeling: string | null;
  lining: string | null;
  washing: string | null;
  slug: string;
  images: ProductImageData[];
  variants: VariantData[];
  categories: CategoryOption[];
}

export type LoadProductDetailResult =
  | { ok: true; product: ProductDetail }
  | { ok: false; error: string };

export async function loadProductFormOptions(): Promise<
  | { ok: true; categories: CategoryOption[] }
  | { ok: false; error: string }
> {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user) {
    return { ok: false, error: "Sessão expirada." };
  }

  const store = await getCurrentStore(session.user.id);
  if (!store) return { ok: false, error: "Loja não encontrada." };

  const categories = await withTenant(store.id, session.user.id, async (tx) => {
    return await tx
      .select({
        id: categoryTable.id,
        name: categoryTable.name,
        parentId: categoryTable.parentId,
      })
      .from(categoryTable)
      .where(eq(categoryTable.storeId, store.id))
      .orderBy(asc(categoryTable.name));
  });

  return { ok: true, categories };
}

/**
 * Carrega detalhe completo de produto sob demanda — usado pelo ProductDialog
 * (Onda 5, 2026-05-12). Substitui a rota /admin/produtos/[id]/editar quanto
 * a carregamento de dados; o dialog renderiza ProductForm em cima.
 *
 * Inclui categorias da loja porque o form precisa popular o Select.
 * Tudo dentro de withTenant pra RLS isolado.
 */
export async function loadProductDetail(
  productId: string,
): Promise<LoadProductDetailResult> {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user) {
    return { ok: false, error: "Sessão expirada." };
  }

  const store = await getCurrentStore(session.user.id);
  if (!store) return { ok: false, error: "Loja não encontrada." };

  const result = await withTenant(store.id, session.user.id, async (tx) => {
    const product = await tx.query.productTable.findFirst({
      where: and(
        eq(productTable.id, productId),
        eq(productTable.storeId, store.id),
      ),
    });
    if (!product) return null;

    // SÉRIE — pg deprecou paralelas no mesmo tx.
    const images = await tx
      .select({
        id: productImageTable.id,
        url: productImageTable.url,
        position: productImageTable.position,
      })
      .from(productImageTable)
      .where(eq(productImageTable.productId, productId))
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
      .where(eq(productVariantTable.productId, productId))
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

  if (!result) return { ok: false, error: "Produto não encontrado." };

  return {
    ok: true,
    product: {
      id: result.product.id,
      name: result.product.name,
      description: result.product.description ?? "",
      basePriceInCents: result.product.basePriceInCents,
      promoPriceInCents: result.product.promoPriceInCents,
      promoStartsAt: result.product.promoStartsAt,
      promoEndsAt: result.product.promoEndsAt,
      categoryId: result.product.categoryId,
      trackStock: result.product.trackStock,
      stockQuantity: result.product.stockQuantity,
      isActive: result.product.isActive,
      isFeatured: result.product.isFeatured,
      composition: result.product.composition,
      modeling: result.product.modeling,
      lining: result.product.lining,
      washing: result.product.washing,
      slug: result.product.slug,
      images: result.images,
      variants: result.variants.map((v) => ({
        id: v.id,
        name: v.name,
        priceInCents: v.priceInCents,
        stockQuantity: v.stockQuantity,
        axis: v.axis,
        colorHex: v.colorHex ?? "",
        featuredImageId: v.featuredImageId,
      })),
      categories: result.categories,
    },
  };
}
