"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";

import { productImageTable } from "@/db/schema";
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
  generateProductImageFilename,
  uploadToStorage,
} from "@/lib/supabase/storage";
import { withTenant } from "@/lib/tenant";

export type ReplaceProductImageResult =
  | { ok: true; id: string; url: string }
  | { ok: false; error: string };

/**
 * Substitui o blob de uma imagem de produto existente, mantendo o mesmo
 * `id` e `position`. Usado pelo editor inline (ImageEditorDialog) quando
 * o lojista clica em "Ajustar imagem" no thumbnail e confirma o crop.
 *
 * Por que não delete + insert?
 *  - Position seria realocada (last-place), perdendo a ordem visual.
 *  - URL muda, então `featuredImageId` de variantes que apontam pra essa
 *    foto ficariam órfãos. FK SET NULL salva, mas a UX quebra.
 *
 * Fluxo:
 *  1. valida imagem + auth + rate limit (mesmo padrão de uploadProductImage)
 *  2. comprime via sharp (gate de qualidade + EXIF strip)
 *  3. faz upload da imagem nova pro Storage (URL diferente)
 *  4. atualiza row em product_image (`url = new`)
 *  5. deleta blob antigo do Storage (best-effort)
 *
 * Se algo falha entre 3 e 4, o blob novo fica órfão e é coletado em
 * cleanup futuro (cron pendente). Vale o trade-off pra não atomic-ar
 * o storage + DB.
 */
export async function replaceProductImage(
  formData: FormData,
): Promise<ReplaceProductImageResult> {
  const requestHeaders = await headers();

  // 1. Auth
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user) {
    return { ok: false, error: "Sessão expirada. Faça login novamente." };
  }
  const userId = session.user.id;

  // 2. Rate limit (mesma bucket de upload)
  try {
    await checkRateLimit(rateLimits.upload, userId);
  } catch (e) {
    if (e instanceof RateLimitError) return { ok: false, error: e.message };
    throw e;
  }

  const file = formData.get("file");
  const imageIdRaw = formData.get("imageId");

  if (!(file instanceof File)) {
    return { ok: false, error: "Arquivo ausente." };
  }
  if (typeof imageIdRaw !== "string" || imageIdRaw.length < 1) {
    return { ok: false, error: "Identificador da imagem inválido." };
  }
  const imageId = imageIdRaw;

  const validationError = validateImageInput(file);
  if (validationError) {
    return { ok: false, error: validationError };
  }

  const store = await getCurrentStore(userId);
  if (!store) {
    return { ok: false, error: "Loja não encontrada." };
  }

  // 3. Confirma que a imagem existe e pertence à loja, captura url antigo
  const existing = await withTenant(store.id, userId, async (tx) =>
    tx.query.productImageTable.findFirst({
      where: and(
        eq(productImageTable.id, imageId),
        eq(productImageTable.storeId, store.id),
      ),
      columns: { id: true, productId: true, url: true },
    }),
  );
  if (!existing) {
    return { ok: false, error: "Imagem não encontrada." };
  }

  // 4. Comprime
  let compressed;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    compressed = await compressImage(buffer);
  } catch (e) {
    logger.error("product.replace_image.compress_failed", {
      err: e,
      imageId,
    });
    return {
      ok: false,
      error: "Não conseguimos processar essa imagem. Tente outra.",
    };
  }

  // 5. Upload do novo blob
  const filename = generateProductImageFilename();
  const path = `${store.id}/${existing.productId}/${filename}`;
  let publicUrl: string;
  try {
    publicUrl = await uploadToStorage({
      bucket: "productImages",
      path,
      buffer: compressed.buffer,
      contentType: compressed.contentType,
    });
  } catch (e) {
    logger.error("product.replace_image.storage_failed", {
      err: e,
      storeId: store.id,
      imageId,
    });
    return { ok: false, error: "Falha no upload. Tente novamente em instantes." };
  }

  // 6. Atualiza DB
  try {
    await withTenant(store.id, userId, async (tx) => {
      await tx
        .update(productImageTable)
        .set({ url: publicUrl })
        .where(
          and(
            eq(productImageTable.id, imageId),
            eq(productImageTable.storeId, store.id),
          ),
        );
    });
  } catch (e) {
    logger.error("product.replace_image.db_update_failed", {
      err: e,
      storeId: store.id,
      imageId,
    });
    // Cleanup do novo blob — DB rejeitou.
    const orphanPath = extractStoragePath("productImages", publicUrl);
    if (orphanPath) {
      await deleteFromStorage({ bucket: "productImages", path: orphanPath });
    }
    return { ok: false, error: "Falha ao salvar imagem." };
  }

  // 7. Cleanup do blob antigo (best-effort — não bloqueia retorno)
  const oldPath = extractStoragePath("productImages", existing.url);
  if (oldPath) {
    await deleteFromStorage({ bucket: "productImages", path: oldPath });
  }

  revalidatePath("/admin/produtos");
  revalidateTag(`store-${store.slug}`);

  return { ok: true, id: imageId, url: publicUrl };
}
