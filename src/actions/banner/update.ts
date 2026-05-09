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

import { type UpdateBannerInput,updateBannerSchema } from "./schema";

export type UpdateBannerResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function updateBanner(
  input: UpdateBannerInput,
): Promise<UpdateBannerResult> {
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

  const parsed = updateBannerSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (!fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return { ok: false, error: "Confira os campos.", fieldErrors };
  }

  const store = await getCurrentStore(userId);
  if (!store) return { ok: false, error: "Loja não encontrada." };

  const link =
    parsed.data.link === null || parsed.data.link.trim() === ""
      ? null
      : parsed.data.link.trim();

  try {
    const row = await withTenant(store.id, userId, async (tx) => {
      const [r] = await tx
        .update(bannerTable)
        .set({ link })
        .where(
          and(
            eq(bannerTable.id, parsed.data.bannerId),
            eq(bannerTable.storeId, store.id),
          ),
        )
        .returning({ id: bannerTable.id });
      return r;
    });

    if (!row) return { ok: false, error: "Banner não encontrado." };
  } catch (e) {
    console.error("[update-banner] update falhou", e);
    return { ok: false, error: "Falha ao salvar banner." };
  }

  revalidatePath("/admin/banners");
  revalidateTag(`store-${store.slug}`);

  return { ok: true };
}
