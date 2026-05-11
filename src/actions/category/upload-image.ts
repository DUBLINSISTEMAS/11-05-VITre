"use server";

import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";

import { categoryTable } from "@/db/schema";
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

import { uploadCategoryImageSchema } from "./schema";

export type UploadCategoryImageResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

/**
 * Sobe imagem para uma categoria. Substitui imagem anterior (deleta a antiga
 * do Storage best-effort) — single-slot por categoria.
 *
 * Usada na strip de categorias da home (CategoryStrip). Compressão
 * padrão do projeto (sharp 800×800 webp 75%) — pode ser ampla, será
 * mostrada num tile quadrado de 76px no mobile (rounded-[10px]), então
 * sharp.fit:cover já cuida.
 *
 * Validações:
 *  - Sessão + ratelimit (upload)
 *  - File válido
 *  - Categoria pertence à loja do usuário
 */
export async function uploadCategoryImage(
  formData: FormData,
): Promise<UploadCategoryImageResult> {
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
  // Zod no boundary — alinha com uploadProductImageSchema. Rejeita strings
  // não-UUID antes de tocar DB (defesa em profundidade contra payload arbitrário).
  const parsed = uploadCategoryImageSchema.safeParse({
    categoryId: formData.get("categoryId"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Categoria inválida." };
  }
  const { categoryId } = parsed.data;

  const validationError = validateImageInput(file);
  if (validationError) {
    return { ok: false, error: validationError };
  }

  const store = await getCurrentStore(userId);
  if (!store) return { ok: false, error: "Loja não encontrada." };

  // Categoria pertence à loja (sob withTenant — RLS via GUC)
  const existing = await withTenant(store.id, userId, async (tx) =>
    tx.query.categoryTable.findFirst({
      where: and(
        eq(categoryTable.id, categoryId),
        eq(categoryTable.storeId, store.id),
      ),
      columns: { id: true, imageUrl: true },
    }),
  );
  if (!existing) {
    return { ok: false, error: "Categoria não encontrada." };
  }

  // Comprime
  let compressed;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    compressed = await compressImage(buffer);
  } catch (e) {
    logger.error("upload.category.compress_failed", {
      err: e,
      categoryId,
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
      bucket: "categoryImages",
      path,
      buffer: compressed.buffer,
      contentType: compressed.contentType,
    });
  } catch (e) {
    logger.error("category.upload_image.storage_failed", {
      err: e,
      storeId: store.id,
      categoryId,
    });
    return { ok: false, error: "Falha no upload. Tente em instantes." };
  }

  // Atualiza coluna + captura URL antiga pra cleanup
  const previousUrl = existing.imageUrl;
  try {
    await withTenant(store.id, userId, async (tx) => {
      await tx
        .update(categoryTable)
        .set({ imageUrl: publicUrl })
        .where(
          and(
            eq(categoryTable.id, categoryId),
            eq(categoryTable.storeId, store.id),
          ),
        );
    });
  } catch (e) {
    logger.error("category.upload_image.db_update_failed", {
      err: e,
      storeId: store.id,
      categoryId,
    });
    const newPath = extractStoragePath("categoryImages", publicUrl);
    if (newPath) {
      await deleteFromStorage({ bucket: "categoryImages", path: newPath });
    }
    return { ok: false, error: "Falha ao salvar imagem." };
  }

  // Deleta a antiga (best-effort)
  if (previousUrl) {
    const oldPath = extractStoragePath("categoryImages", previousUrl);
    if (oldPath) {
      await deleteFromStorage({ bucket: "categoryImages", path: oldPath });
    }
  }

  revalidatePath("/admin/categorias");
  revalidateTag(`store-${store.slug}`);

  return { ok: true, url: publicUrl };
}
