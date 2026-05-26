/**
 * Helpers internos compartilhados entre os loaders do storefront.
 *
 * Uso é privado ao diretório `storefront/`. NUNCA importe daqui de fora —
 * são funções uncached (sem `unstable_cache`) e tipos cuja API é interna.
 * O loader público correspondente envolve estes helpers com cache.
 */
import { sql } from "drizzle-orm";

import type { Product } from "@/db/schema";
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
 * Anexa a imagem com MENOR position a uma lista de produtos.
 *
 * S1.5 (2026-05-26) — antes filtrava `position = 0` estritamente. Edge case:
 * lojista deleta imagem position=0 e fica com 1, 2, 3 — produto aparecia sem
 * imagem na home. Migrado pra `DISTINCT ON (product_id) ORDER BY position`
 * que sempre pega a primeira disponível.
 *
 * Performance: DISTINCT ON é index-friendly via `product_image_product_position_unique`
 * que cobre (product_id, position). Single index seek + filter por store_id.
 *
 * Drizzle ORM não tem builder pra DISTINCT ON, então usa template tag `sql`.
 * Parametrizado contra SQL injection (productIds via placeholder).
 */
export async function attachPrimaryImage(
  tx: Tx,
  storeId: string,
  rows: Product[],
): Promise<ProductCardData[]> {
  if (rows.length === 0) return [];

  const productIds = rows.map((r) => r.id);
  const result = await tx.execute<{
    product_id: string;
    url: string;
    alt: string | null;
  }>(sql`
    SELECT DISTINCT ON (product_id)
      product_id, url, alt
    FROM product_image
    WHERE store_id = ${storeId}
      AND product_id = ANY(${productIds})
    ORDER BY product_id, position ASC
  `);

  const firstByProduct = new Map<string, { url: string; alt: string | null }>();
  for (const img of result.rows) {
    firstByProduct.set(img.product_id, { url: img.url, alt: img.alt });
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
