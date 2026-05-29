"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { quoteSheetTable } from "@/db/schema";
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
  type ArchiveQuoteSheetInput,
  archiveQuoteSheetSchema,
} from "./schema";

export type ArchiveQuoteSheetResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Arquiva (soft) uma ficha. Sai das listas padrão mas preserva histórico.
 * Coerente com `product.archived_at` (0037).
 */
export async function archiveQuoteSheet(
  input: ArchiveQuoteSheetInput,
): Promise<ArchiveQuoteSheetResult> {
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

  const parsed = archiveQuoteSheetSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Identificador inválido." };
  }

  const store = await getCurrentStore(userId);
  if (!store) return { ok: false, error: "Loja não encontrada." };

  try {
    const updated = await withTenant(store.id, userId, async (tx) => {
      const rows = await tx
        .update(quoteSheetTable)
        .set({ archivedAt: sql`now()`, updatedAt: sql`now()` })
        .where(
          and(
            eq(quoteSheetTable.id, parsed.data.id),
            eq(quoteSheetTable.storeId, store.id),
            isNull(quoteSheetTable.deletedAt),
          ),
        )
        .returning({ id: quoteSheetTable.id });
      return rows[0];
    });

    if (!updated) return { ok: false, error: "Ficha não encontrada." };

    revalidatePath("/admin/orcamentos");
    return { ok: true };
  } catch (e) {
    logger.error("quote-sheet.archive_failed", { err: e, storeId: store.id });
    return { ok: false, error: "Falha ao arquivar ficha." };
  }
}
