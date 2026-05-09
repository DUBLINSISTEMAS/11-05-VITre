"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";

import { bannerTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import {
  checkRateLimit,
  RateLimitError,
  rateLimits,
} from "@/lib/rate-limit";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

import {
  type ReorderBannersInput,
  reorderBannersSchema,
} from "./schema";

export type ReorderBannersResult =
  | { ok: true }
  | { ok: false; error: string };

export async function reorderBanners(
  input: ReorderBannersInput,
): Promise<ReorderBannersResult> {
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

  const parsed = reorderBannersSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Dados inválidos." };
  }
  const { orderedIds } = parsed.data;

  const store = await getCurrentStore(userId);
  if (!store) return { ok: false, error: "Loja não encontrada." };

  type StepResult = { ok: true } | { ok: false; error: string };
  let result: StepResult;
  try {
    result = await withTenant(store.id, userId, async (tx) => {
      const scope = await tx.query.bannerTable.findMany({
        where: eq(bannerTable.storeId, store.id),
        columns: { id: true },
      });
      const scopeIds = new Set(scope.map((b) => b.id));
      for (const id of orderedIds) {
        if (!scopeIds.has(id)) {
          return { ok: false, error: "Banner fora do escopo." } as const;
        }
      }

      for (let i = 0; i < orderedIds.length; i++) {
        await tx
          .update(bannerTable)
          .set({ position: i })
          .where(
            and(
              eq(bannerTable.id, orderedIds[i]!),
              eq(bannerTable.storeId, store.id),
            ),
          );
      }

      return { ok: true } as const;
    });
  } catch (e) {
    console.error("[reorder-banners] transaction falhou", e);
    return { ok: false, error: "Falha ao reordenar." };
  }

  if (!result.ok) return result;

  revalidatePath("/admin/banners");
  revalidateTag(`store-${store.slug}`);

  return { ok: true };
}
