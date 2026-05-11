"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";

import { bannerTable } from "@/db/schema";
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
  type ToggleBannerActiveInput,
  toggleBannerActiveSchema,
} from "./schema";

export type ToggleBannerActiveResult =
  | { ok: true; isActive: boolean }
  | { ok: false; error: string };

export async function toggleBannerActive(
  input: ToggleBannerActiveInput,
): Promise<ToggleBannerActiveResult> {
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

  const parsed = toggleBannerActiveSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Dados inválidos." };
  }

  const store = await getCurrentStore(userId);
  if (!store) return { ok: false, error: "Loja não encontrada." };

  try {
    const row = await withTenant(store.id, userId, async (tx) => {
      const [r] = await tx
        .update(bannerTable)
        .set({ isActive: parsed.data.isActive })
        .where(
          and(
            eq(bannerTable.id, parsed.data.bannerId),
            eq(bannerTable.storeId, store.id),
          ),
        )
        .returning({ isActive: bannerTable.isActive });
      return r;
    });

    if (!row) return { ok: false, error: "Banner não encontrado." };

    revalidatePath("/admin/banners");
    revalidateTag(`store-${store.slug}`);

    return { ok: true, isActive: row.isActive };
  } catch (e) {
    logger.error("banner.toggle_active_failed", {
      err: e,
      bannerId: parsed.data.bannerId,
    });
    return { ok: false, error: "Falha ao atualizar banner." };
  }
}
