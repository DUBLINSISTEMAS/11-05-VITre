/**
 * Helpers internos compartilhados entre os loaders do storefront.
 *
 * Uso é privado ao diretório `storefront/`. NUNCA importe daqui de fora —
 * são funções uncached (sem `unstable_cache`) e tipos cuja API é interna.
 * O loader público correspondente envolve estes helpers com cache.
 */
import { and, asc, eq, inArray } from "drizzle-orm";

import type { Product } from "@/db/schema";
import { productImageTable } from "@/db/schema";
import type { Tx } from "@/lib/tenant";

export interface ProductCardData
  extends Pick<
    Product,
    | "id"
    | "slug"
    | "name"
    | "basePriceInCents"
    | "promoPriceInCents"
    | "promoStartsAt"
    | "promoEndsAt"
    | "trackStock"
    | "stockQuantity"
    | "isFeatured"
  > {
  primaryImageUrl: string | null;
  primaryImageAlt: string | null;
}

/**
 * Anexa a 1ª imagem (position=0) a uma lista de produtos.
 * Faz 1 query agregada IN (...) em vez de N+1.
 *
 * Dívida conhecida: carrega todas as imagens dos N produtos e descarta
 * todas menos a primeira em memória. Aceitável até centenas de produtos.
 * Quando crescer, migrar para `DISTINCT ON (product_id)` ou subquery
 * com `row_number()`.
 */
export async function attachPrimaryImage(
  tx: Tx,
  storeId: string,
  rows: Product[],
): Promise<ProductCardData[]> {
  if (rows.length === 0) return [];

  const productIds = rows.map((r) => r.id);
  const images = await tx
    .select({
      productId: productImageTable.productId,
      url: productImageTable.url,
      alt: productImageTable.alt,
      position: productImageTable.position,
    })
    .from(productImageTable)
    .where(
      and(
        eq(productImageTable.storeId, storeId),
        inArray(productImageTable.productId, productIds),
      ),
    )
    .orderBy(asc(productImageTable.position));

  const firstByProduct = new Map<string, { url: string; alt: string | null }>();
  for (const img of images) {
    if (!firstByProduct.has(img.productId)) {
      firstByProduct.set(img.productId, { url: img.url, alt: img.alt });
    }
  }

  return rows.map((p) => {
    const img = firstByProduct.get(p.id);
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      basePriceInCents: p.basePriceInCents,
      promoPriceInCents: p.promoPriceInCents,
      promoStartsAt: p.promoStartsAt,
      promoEndsAt: p.promoEndsAt,
      trackStock: p.trackStock,
      stockQuantity: p.stockQuantity,
      isFeatured: p.isFeatured,
      primaryImageUrl: img?.url ?? null,
      primaryImageAlt: img?.alt ?? null,
    };
  });
}

export interface ListResult {
  items: ProductCardData[];
  total: number;
  page: number;
  pageCount: number;
  limit: number;
}

export const DEFAULT_PRODUCT_LIMIT = 24;
export const MAX_PRODUCT_LIMIT = 60;

/** Escapa `%` e `_` no termo do usuário pra ILIKE seguro. */
export function escapeIlikeTerm(q: string): string {
  return `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
}
