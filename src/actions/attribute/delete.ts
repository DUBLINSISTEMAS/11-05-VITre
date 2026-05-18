"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";

import { attributeTable, attributeValueTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  checkRateLimit,
  RateLimitError,
  rateLimits,
} from "@/lib/rate-limit";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

import {
  deleteAttributeSchema,
  deleteAttributeValueSchema,
} from "./schema";

export async function deleteAttribute(
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

  const parsed = deleteAttributeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "ID inválido." };

  const store = await getCurrentStore(userId);
  if (!store) return { ok: false, error: "Loja não encontrada." };

  try {
    await withTenant(store.id, userId, async (tx) => {
      await tx
        .delete(attributeTable)
        .where(
          and(
            eq(attributeTable.id, parsed.data.id),
            eq(attributeTable.storeId, store.id),
          ),
        );
    });
    revalidatePath("/admin/atributos");
    revalidateTag(`store-${store.slug}`);
    return { ok: true };
  } catch (e) {
    logger.error("attribute.delete_failed", { err: e, storeId: store.id });
    return { ok: false, error: "Falha ao excluir atributo." };
  }
}

export async function deleteAttributeValue(
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

  const parsed = deleteAttributeValueSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "ID inválido." };

  const store = await getCurrentStore(userId);
  if (!store) return { ok: false, error: "Loja não encontrada." };

  try {
    await withTenant(store.id, userId, async (tx) => {
      await tx
        .delete(attributeValueTable)
        .where(
          and(
            eq(attributeValueTable.id, parsed.data.id),
            eq(attributeValueTable.storeId, store.id),
          ),
        );
    });
    revalidatePath("/admin/atributos");
    revalidateTag(`store-${store.slug}`);
    return { ok: true };
  } catch (e) {
    logger.error("attribute_value.delete_failed", { err: e, storeId: store.id });
    return { ok: false, error: "Falha ao excluir valor." };
  }
}
