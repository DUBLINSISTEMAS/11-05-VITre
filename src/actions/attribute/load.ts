"use server";

import { asc, eq } from "drizzle-orm";
import { headers } from "next/headers";

import { attributeTable, attributeValueTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

export type AttributeWithValues = {
  id: string;
  name: string;
  type: "color" | "size" | "text";
  position: number;
  isActive: boolean;
  values: {
    id: string;
    label: string;
    colorHex: string | null;
    position: number;
  }[];
};

export async function loadAttributes(): Promise<AttributeWithValues[]> {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user) return [];

  const store = await getCurrentStore(session.user.id);
  if (!store) return [];

  return withTenant(store.id, session.user.id, async (tx) => {
    const attrs = await tx
      .select()
      .from(attributeTable)
      .where(eq(attributeTable.storeId, store.id))
      .orderBy(asc(attributeTable.position), asc(attributeTable.name));

    if (attrs.length === 0) return [];

    const values = await tx
      .select()
      .from(attributeValueTable)
      .where(eq(attributeValueTable.storeId, store.id))
      .orderBy(asc(attributeValueTable.position), asc(attributeValueTable.label));

    const valuesByAttr = new Map<string, AttributeWithValues["values"]>();
    for (const v of values) {
      const arr = valuesByAttr.get(v.attributeId) ?? [];
      arr.push({
        id: v.id,
        label: v.label,
        colorHex: v.colorHex,
        position: v.position,
      });
      valuesByAttr.set(v.attributeId, arr);
    }

    return attrs.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      position: a.position,
      isActive: a.isActive,
      values: valuesByAttr.get(a.id) ?? [],
    }));
  });
}
