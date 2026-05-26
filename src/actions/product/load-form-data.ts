"use server";

/**
 * Server action que carrega TUDO que o ProductForm precisa pra abrir
 * (modo edit ou modo novo) — handoff PP1 Fase B (2026-05-25).
 *
 * Centraliza o que /admin/produtos/[id]/page.tsx e /admin/produtos/novo/
 * page.tsx faziam antes em SSR. Agora o ProductFormDrawer (montado em
 * admin-shell) chama isso ao abrir, e as duas páginas viraram redirects
 * pro deep-link ?edit=<id|new>.
 *
 * Modos:
 *   - productId = null  → modo "novo" (cria draft via insert + carrega
 *     brands + categories)
 *   - productId = "uuid" → modo "edit" (carrega produto existente, ou
 *     retorna { ok: false, code: "not_found" })
 *
 * Tudo passa por withTenant (RLS-first, CLAUDE.md #1).
 */

import { and, asc, eq } from "drizzle-orm";
import { headers } from "next/headers";

import type { ProductFormInitialData } from "@/components/admin/product-form";
import {
  brandTable,
  categoryTable,
  productImageTable,
  productTable,
  productVariantTable,
  type Store,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

export interface ProductFormDrawerData {
  initialData: ProductFormInitialData;
  categories: Array<{ id: string; name: string; parentId: string | null }>;
  brands: Array<{ id: string; name: string }>;
  storeNiche: Store["niche"];
  /** isDraft=true → modo "novo" (sem productId real); ProductForm chama createProductFromValues. */
  isDraft: boolean;
  /** Mode hint pro caller: "edit" carregou produto existente; "new" é form vazio. */
  mode: "edit" | "new";
}

export type LoadProductFormDataResult =
  | { ok: true; data: ProductFormDrawerData }
  | { ok: false; code: "unauthenticated" | "no_store" | "not_found" | "error"; message: string };

export async function loadProductFormData(
  productId: string | null,
): Promise<LoadProductFormDataResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { ok: false, code: "unauthenticated", message: "Sessão expirada." };
  }
  const store = await getCurrentStore(session.user.id);
  if (!store) {
    return { ok: false, code: "no_store", message: "Loja não encontrada." };
  }

  // Modo "novo" — não cria produto ainda (igual NewProductForm legacy).
  // ProductForm com initialData vazio + onCreateProduct={createProductFromValues}
  // insere na primeira gravação. Só carregamos brands + categories.
  if (productId === null) {
    const meta = await withTenant(store.id, session.user.id, async (tx) => {
      const categories = await tx
        .select({
          id: categoryTable.id,
          name: categoryTable.name,
          parentId: categoryTable.parentId,
        })
        .from(categoryTable)
        .where(eq(categoryTable.storeId, store.id))
        .orderBy(asc(categoryTable.position), asc(categoryTable.name));
      const brands = await tx
        .select({ id: brandTable.id, name: brandTable.name })
        .from(brandTable)
        .where(eq(brandTable.storeId, store.id))
        .orderBy(asc(brandTable.name));
      return { categories, brands };
    });

    return {
      ok: true,
      data: {
        initialData: emptyInitialData(),
        categories: meta.categories,
        brands: meta.brands,
        storeNiche: store.niche,
        isDraft: true,
        mode: "new",
      },
    };
  }

  // Modo "edit" — carrega produto existente + relacionados.
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
      .orderBy(asc(categoryTable.position), asc(categoryTable.name));

    const brands = await tx
      .select({ id: brandTable.id, name: brandTable.name })
      .from(brandTable)
      .where(eq(brandTable.storeId, store.id))
      .orderBy(asc(brandTable.name));

    return { product, images, variants, categories, brands };
  });

  if (!result) {
    return { ok: false, code: "not_found", message: "Produto não encontrado." };
  }

  const { product, images, variants, categories, brands } = result;
  const isDraft = !product.name.trim() || product.slug.startsWith("draft-");

  return {
    ok: true,
    data: {
      initialData: {
        productId: product.id,
        name: product.name,
        description: product.description ?? "",
        basePriceInCents: product.basePriceInCents,
        promoPriceInCents: product.promoPriceInCents,
        categoryId: product.categoryId,
        trackStock: product.trackStock,
        stockQuantity: product.stockQuantity,
        allowOversell: product.allowOversell,
        installmentsOverride: product.installmentsOverride,
        cashDiscountOverrideBps: product.cashDiscountOverrideBps,
        isActive: product.isActive,
        isFeatured: product.isFeatured,
        isPublishedToStorefront: product.isPublishedToStorefront,
        composition: product.composition,
        modeling: product.modeling,
        lining: product.lining,
        washing: product.washing,
        wholesalePriceInCents: product.wholesalePriceInCents,
        costPriceInCents: product.costPriceInCents,
        minStockQuantity: product.minStockQuantity,
        maxStockQuantity: product.maxStockQuantity,
        gtin: product.gtin,
        brand: product.brand,
        brandId: product.brandId,
        unit: product.unit,
        internalCode: product.internalCode,
        defaultCommissionBps: product.defaultCommissionBps,
        ncm: product.ncm,
        weightGrams: product.weightGrams,
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
      },
      categories,
      brands,
      storeNiche: store.niche,
      isDraft,
      mode: "edit",
    },
  };
}

/**
 * Defaults pro modo "novo". Espelha o que NewProductForm passava como
 * initialData inline. Mantemos aqui pra ter UMA fonte de verdade.
 */
function emptyInitialData(): ProductFormInitialData {
  return {
    productId: "new",
    name: "",
    description: "",
    basePriceInCents: 0,
    promoPriceInCents: null,
    categoryId: null,
    // Onda 1.4 (2026-05-24): default LIGADO. ICP é varejo físico.
    trackStock: true,
    stockQuantity: 0,
    allowOversell: false,
    installmentsOverride: null,
    cashDiscountOverrideBps: null,
    isActive: true,
    isFeatured: false,
    isPublishedToStorefront: true,
    composition: null,
    modeling: null,
    lining: null,
    washing: null,
    wholesalePriceInCents: null,
    costPriceInCents: null,
    minStockQuantity: null,
    maxStockQuantity: null,
    gtin: null,
    brand: null,
    brandId: null,
    unit: "un",
    internalCode: null,
    defaultCommissionBps: null,
    ncm: null,
    weightGrams: null,
    variants: [],
    images: [],
  };
}
