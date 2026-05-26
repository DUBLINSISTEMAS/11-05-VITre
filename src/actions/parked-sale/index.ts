"use server";

/**
 * Server actions de parked_sale (S3.3 do Plano de Endurecimento).
 *
 * - parkSale: pausa carrinho atual (cria row).
 * - listParkedSales: lista pausados do user no store (não-expirados).
 * - resumeParkedSale: retorna items + apaga row.
 * - dropParkedSale: descarta sem retomar.
 *
 * Convenção CLAUDE.md: mutações têm rate-limit. listParkedSales é read.
 */
import { and, desc, eq, gt } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";

import { parkedSaleTable, type ParkedItem } from "@/db/schema";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  checkRateLimit,
  RateLimitError,
  rateLimits,
} from "@/lib/rate-limit";
import { safeUserMessage } from "@/lib/safe-error";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

const parkedItemSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullable().default(null),
  quantity: z.number().int().positive(),
  productName: z.string().optional(),
  variantName: z.string().nullable().optional(),
  unitPriceInCents: z.number().int().nonnegative().optional(),
  discountInCents: z.number().int().nonnegative().optional(),
});

export const parkSaleSchema = z.object({
  customerId: z.string().uuid().nullable().default(null),
  label: z
    .preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? null : v),
      z.string().trim().max(60).nullable(),
    )
    .default(null),
  items: z.array(parkedItemSchema).min(1, "Carrinho vazio."),
});
export type ParkSaleInput = z.input<typeof parkSaleSchema>;

export type ParkSaleResult =
  | { ok: true; parkedSaleId: string }
  | { ok: false; error: string };

export async function parkSale(input: ParkSaleInput): Promise<ParkSaleResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { ok: false, error: "Sessão expirada." };
  const userId = session.user.id;

  try {
    await checkRateLimit(rateLimits.mutation, userId);
  } catch (e) {
    if (e instanceof RateLimitError) return { ok: false, error: e.message };
    throw e;
  }

  const parsed = parkSaleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Dados inválidos." };
  }

  const store = await getCurrentStore(userId);
  if (!store) return { ok: false, error: "Loja não encontrada." };

  try {
    const result = await withTenant(store.id, userId, async (tx) => {
      const [row] = await tx
        .insert(parkedSaleTable)
        .values({
          storeId: store.id,
          userId,
          customerId: parsed.data.customerId,
          label: parsed.data.label,
          items: parsed.data.items as ParkedItem[],
        })
        .returning({ id: parkedSaleTable.id });
      return row;
    });
    return { ok: true, parkedSaleId: result!.id };
  } catch (e) {
    logger.error("parked_sale.create_failed", { err: e, storeId: store.id });
    return {
      ok: false,
      error: safeUserMessage(e, "Falha ao pausar venda. Tente novamente."),
    };
  }
}

export interface ParkedSaleRow {
  id: string;
  customerId: string | null;
  label: string | null;
  items: ParkedItem[];
  parkedAt: Date;
  expiresAt: Date;
  totalInCents: number;
  itemCount: number;
}

export async function listParkedSales(): Promise<ParkedSaleRow[]> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return [];
  const userId = session.user.id;
  const store = await getCurrentStore(userId);
  if (!store) return [];

  return withTenant(store.id, userId, async (tx) => {
    const rows = await tx
      .select()
      .from(parkedSaleTable)
      .where(
        and(
          eq(parkedSaleTable.storeId, store.id),
          eq(parkedSaleTable.userId, userId),
          gt(parkedSaleTable.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(parkedSaleTable.parkedAt))
      .limit(50);

    return rows.map((r) => {
      const items = r.items ?? [];
      const totalInCents = items.reduce(
        (sum, it) =>
          sum + (it.unitPriceInCents ?? 0) * it.quantity - (it.discountInCents ?? 0),
        0,
      );
      const itemCount = items.reduce((sum, it) => sum + it.quantity, 0);
      return {
        id: r.id,
        customerId: r.customerId,
        label: r.label,
        items,
        parkedAt: r.parkedAt,
        expiresAt: r.expiresAt,
        totalInCents,
        itemCount,
      };
    });
  });
}

export async function resumeParkedSale(input: {
  id: string;
}): Promise<{ ok: true; items: ParkedItem[]; customerId: string | null } | { ok: false; error: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { ok: false, error: "Sessão expirada." };
  const userId = session.user.id;

  try {
    await checkRateLimit(rateLimits.mutation, userId);
  } catch (e) {
    if (e instanceof RateLimitError) return { ok: false, error: e.message };
    throw e;
  }

  const store = await getCurrentStore(userId);
  if (!store) return { ok: false, error: "Loja não encontrada." };

  try {
    const row = await withTenant(store.id, userId, async (tx) => {
      const [parked] = await tx
        .select()
        .from(parkedSaleTable)
        .where(
          and(
            eq(parkedSaleTable.id, input.id),
            eq(parkedSaleTable.storeId, store.id),
            eq(parkedSaleTable.userId, userId),
          ),
        );
      if (!parked) return null;
      await tx
        .delete(parkedSaleTable)
        .where(eq(parkedSaleTable.id, input.id));
      return parked;
    });
    if (!row) return { ok: false, error: "Venda pausada não encontrada." };
    return {
      ok: true,
      items: row.items ?? [],
      customerId: row.customerId,
    };
  } catch (e) {
    logger.error("parked_sale.resume_failed", { err: e, storeId: store.id });
    return {
      ok: false,
      error: safeUserMessage(e, "Falha ao retomar venda. Tente novamente."),
    };
  }
}

export async function dropParkedSale(input: {
  id: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { ok: false, error: "Sessão expirada." };
  const userId = session.user.id;

  try {
    await checkRateLimit(rateLimits.mutation, userId);
  } catch (e) {
    if (e instanceof RateLimitError) return { ok: false, error: e.message };
    throw e;
  }

  const store = await getCurrentStore(userId);
  if (!store) return { ok: false, error: "Loja não encontrada." };

  try {
    await withTenant(store.id, userId, async (tx) => {
      await tx
        .delete(parkedSaleTable)
        .where(
          and(
            eq(parkedSaleTable.id, input.id),
            eq(parkedSaleTable.storeId, store.id),
            eq(parkedSaleTable.userId, userId),
          ),
        );
    });
    return { ok: true };
  } catch (e) {
    logger.error("parked_sale.drop_failed", { err: e, storeId: store.id });
    return {
      ok: false,
      error: safeUserMessage(e, "Falha ao descartar venda pausada."),
    };
  }
}
