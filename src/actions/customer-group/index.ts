"use server";

import { and, asc, eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { customerGroupTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  checkRateLimit,
  RateLimitError,
  rateLimits,
} from "@/lib/rate-limit";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

const upsertSchema = z.object({
  id: z.string().uuid().nullable(),
  name: z.string().min(1, "Nome obrigatório").max(60),
  discountBps: z.number().int().min(0).max(9999),
  description: z
    .string()
    .max(280)
    .nullable()
    .transform((v) => (v && v.trim() !== "" ? v.trim() : null)),
  position: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  /**
   * Audit 2026-05-26 — tier de pricing default do grupo. Antes o schema
   * IGNORAVA o campo (existia no DB com default 'regular' mas form nunca
   * setava). PDV já lê via `groupPricingTier` quando vincula cliente —
   * se grupo for "wholesale", PDV substitui preço base por
   * `product.wholesalePriceInCents`. Sem esse campo, feature inteira
   * de preço atacado era zumbi.
   */
  defaultPricingTier: z.enum(["regular", "wholesale"]).default("regular"),
});

export type UpsertGroupInput = z.input<typeof upsertSchema>;

export async function loadCustomerGroups() {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user) return [];
  const store = await getCurrentStore(session.user.id);
  if (!store) return [];

  return withTenant(store.id, session.user.id, (tx) =>
    tx
      .select()
      .from(customerGroupTable)
      .where(eq(customerGroupTable.storeId, store.id))
      .orderBy(asc(customerGroupTable.position), asc(customerGroupTable.name)),
  );
}

export async function upsertCustomerGroup(
  input: UpsertGroupInput,
): Promise<
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> }
> {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user) return { ok: false, error: "Sessão expirada." };
  const userId = session.user.id;

  try {
    await checkRateLimit(rateLimits.mutation, userId);
  } catch (e) {
    if (e instanceof RateLimitError) return { ok: false, error: e.message };
    throw e;
  }

  const parsed = upsertSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (!fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return { ok: false, error: "Confira os campos.", fieldErrors };
  }
  const data = parsed.data;

  const store = await getCurrentStore(userId);
  if (!store) return { ok: false, error: "Loja não encontrada." };

  try {
    const id = await withTenant(store.id, userId, async (tx) => {
      if (data.id) {
        await tx
          .update(customerGroupTable)
          .set({
            name: data.name,
            discountBps: data.discountBps,
            description: data.description,
            position: data.position,
            isActive: data.isActive,
            defaultPricingTier: data.defaultPricingTier,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(customerGroupTable.id, data.id),
              eq(customerGroupTable.storeId, store.id),
            ),
          );
        return data.id;
      }
      const [created] = await tx
        .insert(customerGroupTable)
        .values({
          storeId: store.id,
          name: data.name,
          discountBps: data.discountBps,
          description: data.description,
          position: data.position,
          isActive: data.isActive,
          defaultPricingTier: data.defaultPricingTier,
        })
        .returning({ id: customerGroupTable.id });
      return created!.id;
    });

    revalidatePath("/admin/clientes/grupos");
    revalidatePath("/admin/clientes");
    revalidatePath("/admin/pdv");
    revalidateTag(`store-${store.slug}`);
    return { ok: true, id };
  } catch (e) {
    logger.error("customer_group.upsert_failed", { err: e, storeId: store.id });
    const msg = e instanceof Error && e.message.includes("customer_group_store_name_unique")
      ? "Já existe um grupo com esse nome."
      : "Falha ao salvar grupo.";
    return { ok: false, error: msg };
  }
}

export async function deleteCustomerGroup(
  input: { id: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user) return { ok: false, error: "Sessão expirada." };
  const userId = session.user.id;

  try {
    await checkRateLimit(rateLimits.mutation, userId);
  } catch (e) {
    if (e instanceof RateLimitError) return { ok: false, error: e.message };
    throw e;
  }

  const parsed = z.object({ id: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "ID inválido." };

  const store = await getCurrentStore(userId);
  if (!store) return { ok: false, error: "Loja não encontrada." };

  try {
    await withTenant(store.id, userId, async (tx) => {
      await tx
        .delete(customerGroupTable)
        .where(
          and(
            eq(customerGroupTable.id, parsed.data.id),
            eq(customerGroupTable.storeId, store.id),
          ),
        );
    });
    revalidatePath("/admin/clientes/grupos");
    revalidatePath("/admin/clientes");
    return { ok: true };
  } catch (e) {
    logger.error("customer_group.delete_failed", { err: e, storeId: store.id });
    return { ok: false, error: "Falha ao excluir grupo." };
  }
}
