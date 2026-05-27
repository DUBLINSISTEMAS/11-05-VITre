/**
 * Helpers internos compartilhados entre os loaders do storefront.
 *
 * Uso é privado ao diretório `storefront/`. NUNCA importe daqui de fora —
 * são funções uncached (sem `unstable_cache`) e tipos cuja API é interna.
 * O loader público correspondente envolve estes helpers com cache.
 */
import { and, eq, inArray, asc } from "drizzle-orm";

import { productImageTable, type Product } from "@/db/schema";
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
 * Bugfix 2026-05-27 — a versão template-tag (sql`... ANY(${productIds})`)
 * expandia o array como TUPLA (`ANY($2, $3, ..., $7)`), o que o Postgres
 * rejeita com `parse_oper.c make_scalar_array_op` quando vários produtos
 * vinham na home (qualquer storefront com 2+ produtos). Refator pra usar
 * `selectDistinctOn` + `inArray` do query builder do Drizzle — parametriza
 * o array como `$1::uuid[]` corretamente, IN-list serializado pelo
 * node-postgres.
 *
 * Performance: DISTINCT ON segue usando o index
 * `product_image_product_position_unique` que cobre (product_id, position).
 */
export async function attachPrimaryImage(
  tx: Tx,
  storeId: string,
  rows: Product[],
): Promise<ProductCardData[]> {
  if (rows.length === 0) return [];

  const productIds = rows.map((r) => r.id);
  const images = await tx
    .selectDistinctOn([productImageTable.productId], {
      productId: productImageTable.productId,
      url: productImageTable.url,
      alt: productImageTable.alt,
    })
    .from(productImageTable)
    .where(
      and(
        eq(productImageTable.storeId, storeId),
        inArray(productImageTable.productId, productIds),
      ),
    )
    .orderBy(asc(productImageTable.productId), asc(productImageTable.position));

  const firstByProduct = new Map<string, { url: string; alt: string | null }>();
  for (const img of images) {
    firstByProduct.set(img.productId, { url: img.url, alt: img.alt });
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
