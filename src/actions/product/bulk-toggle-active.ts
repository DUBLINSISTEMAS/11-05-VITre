"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";

import { productTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import {
  checkRateLimit,
  RateLimitError,
  rateLimits,
} from "@/lib/rate-limit";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

import {
  type BulkToggleActiveInput,
  bulkToggleActiveSchema,
} from "./schema";

export type BulkToggleActiveResult =
  | { ok: true; updated: number; skippedDrafts: number }
  | { ok: false; error: string };

/**
 * Liga/desliga visibilidade de N produtos em uma transação.
 *
 * - Quando `isActive=true` (publicar em lote), produtos rascunho (slug
 *   `draft-*` ou nome vazio) são pulados silenciosamente — bulk publish
 *   não é o canal pra terminar de cadastrar produto. Reportado como
 *   `skippedDrafts` pra UI poder avisar.
 * - Quando `isActive=false` (pausar em lote), aplica direto sem filtro
 *   de rascunho (rascunho ativo já é caso edge improvável).
 *
 * Defesa em profundidade: WHERE inclui `storeId = ?` mesmo com `withTenant`
 * setando RLS — proteção contra IDs forjados de outras lojas.
 */
export async function bulkToggleProductsActive(
  input: BulkToggleActiveInput,
): Promise<BulkToggleActiveResult> {
  const requestHeaders = await headers();

  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user) {
    return { ok: false, error: "Sessão expirada. Faça login novamente." };
  }
  const userId = session.user.id;

  try {
    await checkRateLimit(rateLimits.mutation, userId);
  } catch (e) {
    if (e instanceof RateLimitError) return { ok: false, error: e.message };
    throw e;
  }

  const parsed = bulkToggleActiveSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }

  const store = await getCurrentStore(userId);
  if (!store) return { ok: false, error: "Loja não encontrada." };

  const { productIds, isActive } = parsed.data;

  type StepResult = { updated: number; skippedDrafts: number };

  let result: StepResult;
  try {
    result = await withTenant(store.id, userId, async (tx) => {
      // Conta candidatos rascunho ANTES do update pra reportar skippedDrafts.
      let skippedDrafts = 0;
      if (isActive) {
        const draftRows = await tx
          .select({ value: sql<number>`count(*)::int` })
          .from(productTable)
          .where(
            and(
              eq(productTable.storeId, store.id),
              inArray(productTable.id, productIds),
              sql`(${productTable.slug} like 'draft-%' or btrim(${productTable.name}) = '')`,
            ),
          );
        skippedDrafts = draftRows[0]?.value ?? 0;
      }

      const updated = await tx
        .update(productTable)
        .set({ isActive, updatedAt: new Date() })
        .where(
          and(
            eq(productTable.storeId, store.id),
            inArray(productTable.id, productIds),
            // Quando ativando, exclui rascunhos da atualização.
            ...(isActive
              ? [
                  sql`${productTable.slug} not like 'draft-%' and btrim(${productTable.name}) <> ''`,
                ]
              : []),
          ),
        )
        .returning({ id: productTable.id });

      return { updated: updated.length, skippedDrafts };
    });
  } catch (e) {
    console.error("[bulk-toggle-active] update falhou", e);
    return { ok: false, error: "Falha ao atualizar produtos." };
  }

  revalidatePath("/admin/produtos");
  revalidateTag(`store-${store.slug}`);

  return {
    ok: true,
    updated: result.updated,
    skippedDrafts: result.skippedDrafts,
  };
}
