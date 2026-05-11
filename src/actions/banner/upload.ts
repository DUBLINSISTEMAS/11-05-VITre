"use server";

import { count, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";

import { bannerTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import { compressImage, validateImageInput } from "@/lib/image";
import { logger } from "@/lib/logger";
import {
  checkRateLimit,
  RateLimitError,
  rateLimits,
} from "@/lib/rate-limit";
import { getCurrentStore } from "@/lib/store-context";
import {
  deleteFromStorage,
  extractStoragePath,
  uploadToStorage,
} from "@/lib/supabase/storage";
import { withTenant } from "@/lib/tenant";

import { createBannerSchema } from "./schema";

export type UploadBannerResult =
  | { ok: true; banner: { id: string; imageUrl: string; position: number } }
  | { ok: false; error: string };

const MAX_BANNERS_PER_STORE = 10;

/**
 * Sobe banner novo. Recebe `FormData` com `file` (e opcionalmente `link`).
 * Position é alocada server-side com count atômico em transação (igual
 * imagem de produto). Limite duro de 10 banners.
 */
export async function uploadBanner(
  formData: FormData,
): Promise<UploadBannerResult> {
  const requestHeaders = await headers();

  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user) {
    return { ok: false, error: "Sessão expirada. Faça login novamente." };
  }
  const userId = session.user.id;

  try {
    await checkRateLimit(rateLimits.upload, userId);
  } catch (e) {
    if (e instanceof RateLimitError) return { ok: false, error: e.message };
    throw e;
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "Arquivo ausente." };
  }
  const linkRaw = formData.get("link");
  const bannerInput = createBannerSchema.safeParse({
    link:
      typeof linkRaw === "string" && linkRaw.trim() !== ""
        ? linkRaw
        : null,
  });
  if (!bannerInput.success) {
    return { ok: false, error: "Link do banner inválido." };
  }
  const link =
    bannerInput.data.link === null || bannerInput.data.link.trim() === ""
      ? null
      : bannerInput.data.link.trim();

  const validationError = validateImageInput(file);
  if (validationError) {
    return { ok: false, error: validationError };
  }

  const store = await getCurrentStore(userId);
  if (!store) return { ok: false, error: "Loja não encontrada." };

  let compressed;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    compressed = await compressImage(buffer);
  } catch (e) {
    logger.error("upload.banner.compress_failed", {
      err: e,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    });
    return {
      ok: false,
      error: "Não conseguimos processar essa imagem. Tente outra.",
    };
  }

  const filename = `${nanoid(16)}.webp`;
  const path = `${store.id}/${filename}`;
  let publicUrl: string;
  try {
    publicUrl = await uploadToStorage({
      bucket: "storeBanners",
      path,
      buffer: compressed.buffer,
      contentType: compressed.contentType,
    });
  } catch (e) {
    logger.error("banner.upload.storage_failed", {
      err: e,
      storeId: store.id,
    });
    return { ok: false, error: "Falha no upload. Tente em instantes." };
  }

  let dbInsertSucceeded = false;
  try {
    const inserted = await withTenant(store.id, userId, async (tx) => {
      const [{ value: existing }] = await tx
        .select({ value: count() })
        .from(bannerTable)
        .where(eq(bannerTable.storeId, store.id));

      if (existing >= MAX_BANNERS_PER_STORE) {
        throw new BannerLimitError();
      }

      const [row] = await tx
        .insert(bannerTable)
        .values({
          storeId: store.id,
          imageUrl: publicUrl,
          link,
          position: existing,
        })
        .returning({
          id: bannerTable.id,
          imageUrl: bannerTable.imageUrl,
          position: bannerTable.position,
        });

      if (!row) throw new Error("insert sem retorno");
      return row;
    });
    dbInsertSucceeded = true;

    revalidatePath("/admin/banners");
    revalidateTag(`store-${store.slug}`);

    return { ok: true, banner: inserted };
  } catch (e) {
    if (e instanceof BannerLimitError) {
      return {
        ok: false,
        error: `Limite de ${MAX_BANNERS_PER_STORE} banners por loja atingido.`,
      };
    }
    logger.error("banner.upload.db_insert_failed", {
      err: e,
      storeId: store.id,
    });
    return { ok: false, error: "Falha ao salvar banner." };
  } finally {
    // Cleanup best-effort do .webp órfão quando o INSERT falha — não
    // bloqueia o erro original do DB.
    if (!dbInsertSucceeded) {
      const orphanPath = extractStoragePath("storeBanners", publicUrl);
      if (orphanPath) {
        await deleteFromStorage({
          bucket: "storeBanners",
          path: orphanPath,
        });
      }
    }
  }
}

class BannerLimitError extends Error {}
