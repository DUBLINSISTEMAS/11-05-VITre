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
import {
  deleteFromStorage,
  extractStoragePath,
} from "@/lib/supabase/storage";
import { withTenant } from "@/lib/tenant";

import { type DeleteBannerInput,deleteBannerSchema } from "./schema";

export type DeleteBannerResult =
  | { ok: true }
  | { ok: false; error: string };

export async function deleteBanner(
  input: DeleteBannerInput,
): Promise<DeleteBannerResult> {
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

  const parsed = deleteBannerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Identificador inválido." };
  }

  const store = await getCurrentStore(userId);
  if (!store) return { ok: false, error: "Loja não encontrada." };

  type StepResult =
    | { ok: true; imageUrl: string }
    | { ok: false; error: string };
  let result: StepResult;
  try {
    result = await withTenant(store.id, userId, async (tx) => {
      const banner = await tx.query.bannerTable.findFirst({
        where: and(
          eq(bannerTable.id, parsed.data.bannerId),
          eq(bannerTable.storeId, store.id),
        ),
        columns: { id: true, imageUrl: true },
      });
      if (!banner) {
        return { ok: false, error: "Banner não encontrado." } as const;
      }

      await tx
        .delete(bannerTable)
        .where(
          and(
            eq(bannerTable.id, parsed.data.bannerId),
            eq(bannerTable.storeId, store.id),
          ),
        );

      return { ok: true, imageUrl: banner.imageUrl } as const;
    });
  } catch (e) {
    console.error("[delete-banner] delete falhou", e);
    return { ok: false, error: "Falha ao excluir banner." };
  }

  if (!result.ok) return result;
  const banner = { imageUrl: result.imageUrl };

  const oldPath = extractStoragePath("storeBanners", banner.imageUrl);
  if (oldPath) {
    await deleteFromStorage({ bucket: "storeBanners", path: oldPath });
  }

  revalidatePath("/admin/banners");
  revalidateTag(`store-${store.slug}`);

  return { ok: true };
}
