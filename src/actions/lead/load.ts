"use server";

import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";

import { customerTable, leadTable, productTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

import type { LeadRow, LeadStats } from "./types";

const filterSchema = z.object({
  q: z.string().nullish(),
  status: z.enum(["new", "contacted", "converted", "lost"]).nullish(),
  page: z.coerce.number().int().min(1).catch(1),
});

const PAGE_SIZE = 20;

export async function loadLeads(rawFilters: Record<string, string | undefined>) {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user) return null;
  const store = await getCurrentStore(session.user.id);
  if (!store) return null;

  const filters = filterSchema.parse(rawFilters);
  const offset = (filters.page - 1) * PAGE_SIZE;

  return withTenant(store.id, session.user.id, async (tx) => {
    const conds = [eq(leadTable.storeId, store.id)];
    if (filters.status) conds.push(eq(leadTable.status, filters.status));
    if (filters.q && filters.q.trim() !== "") {
      const pattern = `%${filters.q.trim()}%`;
      const term = or(
        like(leadTable.customerName, pattern),
        like(leadTable.customerPhone, pattern),
      );
      if (term) conds.push(term);
    }
    const where = and(...conds);

    const rows = await tx
      .select({
        id: leadTable.id,
        productId: leadTable.productId,
        productName: productTable.name,
        customerName: leadTable.customerName,
        customerPhone: leadTable.customerPhone,
        customerId: leadTable.customerId,
        customerDisplayName: customerTable.name,
        source: leadTable.source,
        status: leadTable.status,
        notes: leadTable.notes,
        createdAt: leadTable.createdAt,
      })
      .from(leadTable)
      .leftJoin(productTable, eq(productTable.id, leadTable.productId))
      .leftJoin(customerTable, eq(customerTable.id, leadTable.customerId))
      .where(where)
      .orderBy(desc(leadTable.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset);

    const countResult = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(leadTable)
      .where(where);
    const total = countResult[0]?.count ?? 0;

    // Stats globais (sem filtros — sempre da loja inteira)
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const statsRow = await tx
      .select({
        total: sql<number>`count(*)::int`,
        newToday: sql<number>`count(*) filter (where created_at >= ${startOfDay} and status = 'new')::int`,
        convertedMonth: sql<number>`count(*) filter (where created_at >= ${startOfMonth} and status = 'converted')::int`,
      })
      .from(leadTable)
      .where(eq(leadTable.storeId, store.id));

    const stats: LeadStats = {
      total: statsRow[0]?.total ?? 0,
      newToday: statsRow[0]?.newToday ?? 0,
      convertedThisMonth: statsRow[0]?.convertedMonth ?? 0,
    };

    return {
      rows: rows as LeadRow[],
      total,
      page: filters.page,
      pageSize: PAGE_SIZE,
      stats,
    };
  });
}
