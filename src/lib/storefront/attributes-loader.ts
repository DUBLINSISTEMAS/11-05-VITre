/**
 * Loader de atributos ativos da loja com seus valores — Sprint 5.5
 * (2026-05-22).
 *
 * Usado pelo CategoryFilterChips do storefront pra renderizar chips
 * dinâmicos por valor de atributo (Tamanho M, Cor Azul, Material
 * Algodão). Filtra valores que TÊM produto vinculado — evita poluir
 * UI com "Cor: Roxo (0)".
 *
 * Cached por (storeId), tag `store-${slug}`, TTL 5min.
 */
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { cache } from "react";

import {
  attributeTable,
  attributeValueTable,
  productAttributeValueTable,
} from "@/db/schema";
import { STORE_CACHE_TAG } from "@/lib/storefront/store-loader";
import { withTenant } from "@/lib/tenant";

export interface StorefrontAttributeValue {
  id: string;
  label: string;
  colorHex: string | null;
  /** Count de produtos ativos com este valor. */
  productCount: number;
}

export interface StorefrontAttribute {
  id: string;
  name: string;
  type: "color" | "size" | "text";
  values: StorefrontAttributeValue[];
}

async function loadAttributesFromDb(
  storeId: string,
): Promise<StorefrontAttribute[]> {
  return withTenant(storeId, null, async (tx) => {
    const attributes = await tx
      .select({
        id: attributeTable.id,
        name: attributeTable.name,
        type: attributeTable.type,
      })
      .from(attributeTable)
      .where(
        and(
          eq(attributeTable.storeId, storeId),
          eq(attributeTable.isActive, true),
        ),
      )
      .orderBy(asc(attributeTable.position), asc(attributeTable.name));

    if (attributes.length === 0) return [];

    const attributeIds = attributes.map((a) => a.id);

    // Valores agregados com count de produtos vinculados. LEFT JOIN
    // garante que valores sem produto entram com 0 (filtramos depois).
    const values = await tx
      .select({
        id: attributeValueTable.id,
        attributeId: attributeValueTable.attributeId,
        label: attributeValueTable.label,
        colorHex: attributeValueTable.colorHex,
        position: attributeValueTable.position,
        productCount: sql<number>`count(${productAttributeValueTable.productId})::int`,
      })
      .from(attributeValueTable)
      .leftJoin(
        productAttributeValueTable,
        and(
          eq(productAttributeValueTable.attributeValueId, attributeValueTable.id),
          eq(productAttributeValueTable.storeId, storeId),
        ),
      )
      .where(
        and(
          eq(attributeValueTable.storeId, storeId),
          inArray(attributeValueTable.attributeId, attributeIds),
        ),
      )
      .groupBy(
        attributeValueTable.id,
        attributeValueTable.attributeId,
        attributeValueTable.label,
        attributeValueTable.colorHex,
        attributeValueTable.position,
      )
      .orderBy(
        asc(attributeValueTable.position),
        asc(attributeValueTable.label),
      );

    // Agrupa por attributeId, filtra valores sem produto.
    const valuesByAttr = new Map<string, StorefrontAttributeValue[]>();
    for (const v of values) {
      if (v.productCount === 0) continue;
      const arr = valuesByAttr.get(v.attributeId) ?? [];
      arr.push({
        id: v.id,
        label: v.label,
        colorHex: v.colorHex,
        productCount: v.productCount,
      });
      valuesByAttr.set(v.attributeId, arr);
    }

    return attributes
      .map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        values: valuesByAttr.get(a.id) ?? [],
      }))
      // Esconde atributo sem nenhum valor com produto.
      .filter((a) => a.values.length > 0);
  });
}

export const loadActiveAttributesForStore = cache(
  async (
    storeId: string,
    storeSlug: string,
  ): Promise<StorefrontAttribute[]> => {
    const cached = unstable_cache(
      async () => loadAttributesFromDb(storeId),
      ["storefront-attributes", storeId],
      { tags: [STORE_CACHE_TAG(storeSlug)], revalidate: 300 },
    );
    return cached();
  },
);
