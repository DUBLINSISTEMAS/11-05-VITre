"use server";

import { and, asc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { headers } from "next/headers";

import {
  productImageTable,
  productTable,
  productVariantTable,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

const MAX_RESULTS = 24;

export interface PdvProductVariantHit {
  id: string;
  name: string;
  priceInCents: number | null;
  stockQuantity: number | null;
  trackStock: boolean;
}

export interface PdvProductHit {
  id: string;
  name: string;
  basePriceInCents: number;
  promoPriceInCents: number | null;
  promoStartsAt: Date | null;
  promoEndsAt: Date | null;
  /**
   * Sprint 5.4 — preço atacado. NULL = sem preço dedicado pra atacado
   * (PDV usa o preço normal mesmo pra cliente com tier wholesale).
   */
  wholesalePriceInCents: number | null;
  trackStock: boolean;
  stockQuantity: number | null;
  isActive: boolean;
  thumbUrl: string | null;
  /** GTIN/EAN-13 do produto. Sprint 1A: usado pra scanner — match exato
   *  no input do PDV adiciona direto sem mostrar lista. */
  gtin: string | null;
  variants: PdvProductVariantHit[];
}

export interface SearchProductsForPdvOptions {
  /** Filtra por categoria. Null/undefined = todas. */
  categoryId?: string | null;
}

/**
 * Busca rápida de produtos pra ProductSearchPicker do /admin/pdv
 * (Fase 5 — ADR-0016). Read-only, sem rate limit (admin authenticated +
 * RLS). Match em name ilike. Inclui variantes ATIVAS + thumbnail.
 *
 * Limite 24 (dialog do redesign mostra grid scrollável). Lojista
 * refina por busca ou categoria pra ver mais.
 */
export async function searchProductsForPdv(
  q: string,
  options?: SearchProductsForPdvOptions,
): Promise<PdvProductHit[]> {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user) return [];

  const store = await getCurrentStore(session.user.id);
  if (!store) return [];

  const trimmed = q.trim();
  const safeQ = trimmed.replace(/[\\%_]/g, "\\$&");
  const categoryFilter = options?.categoryId ?? null;

  return withTenant(store.id, session.user.id, async (tx) => {
    const baseConditions = [
      eq(productTable.storeId, store.id),
      eq(productTable.isActive, true),
    ];
    if (categoryFilter) {
      baseConditions.push(eq(productTable.categoryId, categoryFilter));
    }

    const where =
      trimmed.length > 0
        ? and(
            ...baseConditions,
            or(
              ilike(productTable.name, `%${safeQ}%`),
              ilike(productTable.slug, `%${safeQ}%`),
              // Sprint 1A — match exato em GTIN pra scanner.
              eq(productTable.gtin, trimmed),
            ),
          )
        : and(...baseConditions);

    const products = await tx
      .select({
        id: productTable.id,
        name: productTable.name,
        basePriceInCents: productTable.basePriceInCents,
        promoPriceInCents: productTable.promoPriceInCents,
        promoStartsAt: productTable.promoStartsAt,
        promoEndsAt: productTable.promoEndsAt,
        wholesalePriceInCents: productTable.wholesalePriceInCents,
        trackStock: productTable.trackStock,
        stockQuantity: productTable.stockQuantity,
        isActive: productTable.isActive,
        gtin: productTable.gtin,
      })
      .from(productTable)
      .where(where)
      .orderBy(
        trimmed.length > 0
          ? asc(productTable.name)
          : sql`${productTable.updatedAt} DESC`,
      )
      .limit(MAX_RESULTS);

    if (products.length === 0) return [];

    const productIds = products.map((p) => p.id);

    // Thumbnail: pega primeira imagem de cada produto (position asc).
    // FIX 2026-05-19: `sql\`... = ANY(\${array})\`` quebrou em prod —
    // Drizzle interpolava o array elemento-por-elemento (= ANY(uuid)),
    // não como array PG. inArray() gera `IN (?, ?, ...)` corretamente.
    const images = await tx
      .select({
        productId: productImageTable.productId,
        url: productImageTable.url,
        position: productImageTable.position,
      })
      .from(productImageTable)
      .where(
        and(
          eq(productImageTable.storeId, store.id),
          inArray(productImageTable.productId, productIds),
        ),
      )
      .orderBy(asc(productImageTable.position));

    const thumbByProductId = new Map<string, string>();
    for (const img of images) {
      if (!thumbByProductId.has(img.productId)) {
        thumbByProductId.set(img.productId, img.url);
      }
    }

    // Variantes ativas — mesmo fix do query de imagens (ver acima).
    const variants = await tx
      .select({
        id: productVariantTable.id,
        productId: productVariantTable.productId,
        name: productVariantTable.name,
        priceInCents: productVariantTable.priceInCents,
        stockQuantity: productVariantTable.stockQuantity,
        trackStock: productVariantTable.trackStock,
      })
      .from(productVariantTable)
      .where(
        and(
          eq(productVariantTable.storeId, store.id),
          eq(productVariantTable.isActive, true),
          inArray(productVariantTable.productId, productIds),
        ),
      )
      .orderBy(asc(productVariantTable.name));

    const variantsByProduct = new Map<string, PdvProductVariantHit[]>();
    for (const v of variants) {
      const list = variantsByProduct.get(v.productId) ?? [];
      list.push({
        id: v.id,
        name: v.name,
        priceInCents: v.priceInCents,
        stockQuantity: v.stockQuantity,
        trackStock: v.trackStock,
      });
      variantsByProduct.set(v.productId, list);
    }

    return products.map((p) => ({
      ...p,
      thumbUrl: thumbByProductId.get(p.id) ?? null,
      variants: variantsByProduct.get(p.id) ?? [],
    }));
  });
}
