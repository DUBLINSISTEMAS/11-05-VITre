"use server";

/**
 * Busca global do admin (B.7 — ⌘K).
 *
 * Query única ≤ 32 chars roda 3 SELECTs em paralelo (produto/cliente/pedido)
 * via withTenant. Limita a 5 resultados por entidade. Sem rank — só `like %term%`
 * + ORDER BY updatedAt DESC. Tipo de retorno discriminado pro UI montar item.
 */
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";

import { customerTable, orderTable, productTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

const inputSchema = z.object({
  q: z.string().trim().min(1).max(32),
});

export type SearchHit =
  | {
      kind: "product";
      id: string;
      label: string;
      sublabel: string;
      href: string;
    }
  | {
      kind: "customer";
      id: string;
      label: string;
      sublabel: string;
      href: string;
    }
  | {
      kind: "order";
      id: string;
      label: string;
      sublabel: string;
      href: string;
    };

export async function globalSearch(input: unknown): Promise<SearchHit[]> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return [];

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return [];
  const store = await getCurrentStore(session.user.id);
  if (!store) return [];

  const term = `%${parsed.data.q}%`;

  return withTenant(store.id, session.user.id, async (tx) => {
    const products = await tx
      .select({
        id: productTable.id,
        name: productTable.name,
        slug: productTable.slug,
      })
      .from(productTable)
      .where(
        and(
          eq(productTable.storeId, store.id),
          or(ilike(productTable.name, term), ilike(productTable.slug, term)),
        ),
      )
      .orderBy(desc(productTable.updatedAt))
      .limit(5);

    const customers = await tx
      .select({
        id: customerTable.id,
        name: customerTable.name,
        phone: customerTable.phone,
      })
      .from(customerTable)
      .where(
        and(
          eq(customerTable.storeId, store.id),
          or(
            ilike(customerTable.name, term),
            ilike(customerTable.phone, term),
            ilike(customerTable.email, term),
          ),
        ),
      )
      .orderBy(desc(customerTable.updatedAt))
      .limit(5);

    const orders = await tx
      .select({
        id: orderTable.id,
        publicToken: orderTable.publicToken,
        customerName: orderTable.customerName,
        status: orderTable.status,
        channel: orderTable.channel,
        totalInCents: orderTable.totalInCents,
      })
      .from(orderTable)
      .where(
        and(
          eq(orderTable.storeId, store.id),
          or(
            ilike(orderTable.customerName, term),
            ilike(orderTable.publicToken, term),
            ilike(sql`${orderTable.id}::text`, term),
          ),
        ),
      )
      .orderBy(desc(orderTable.createdAt))
      .limit(5);

    const hits: SearchHit[] = [];
    for (const p of products) {
      hits.push({
        kind: "product",
        id: p.id,
        label: p.name,
        sublabel: `Produto · ${p.slug}`,
        href: `/admin/produtos?edit=${p.id}`,
      });
    }
    for (const c of customers) {
      hits.push({
        kind: "customer",
        id: c.id,
        label: c.name,
        sublabel: `Cliente · ${c.phone ?? "sem telefone"}`,
        href: `/admin/clientes?customer=${c.id}`,
      });
    }
    for (const o of orders) {
      const valor = (o.totalInCents / 100).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });
      hits.push({
        kind: "order",
        id: o.id,
        label: `Venda ${o.publicToken}`,
        sublabel: `${o.customerName ?? "sem cliente"} · ${o.channel} · ${valor}`,
        href: `/admin/pedidos?detail=${o.id}`,
      });
    }
    return hits;
  });
}
