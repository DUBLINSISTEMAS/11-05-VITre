"use server";

import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";

import { storeTable } from "@/db/schema";
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

import { uploadStoreImageSchema } from "./schema";

export type UploadStoreImageResult =
  | { ok: true; url: string; kind: "logo" | "icon" }
  | { ok: false; error: string };

/**
 * Sobe logo OU ícone da loja. Substitui imagem anterior (deleta a antiga
 * do Storage best-effort) — Sandra só vê a nova.
 *
 * Bucket: `store-logos` (mesmo bucket pra logo e ícone — paths separados
 * por nome de arquivo).
 *
 * Limites: max 1 imagem por slot (logo OU icon). Same compression que
 * produto (800×800 webp 75%). Para ícones quadradinhos isso é ok — sharp
 * preserva o aspect com fit:cover.
 */
export async function uploadStoreImage(
  formData: FormData,
): Promise<UploadStoreImageResult> {
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
  const kindRaw = formData.get("kind");
  const parsed = uploadStoreImageSchema.safeParse({ kind: kindRaw });
  if (!parsed.success) {
    return { ok: false, error: "Tipo de imagem inválido." };
  }
  const { kind } = parsed.data;

  const validationError = validateImageInput(file);
  if (validationError) {
    return { ok: false, error: validationError };
  }

  const store = await getCurrentStore(userId);
  if (!store) return { ok: false, error: "Loja não encontrada." };

  // Comprime
  let compressed;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    compressed = await compressImage(buffer);
  } catch (e) {
    logger.error("upload.store.compress_failed", {
      err: e,
      kind,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    });
    return {
      ok: false,
      error: "Não conseguimos processar essa imagem. Tente outra.",
    };
  }

  // Upload no bucket store-logos com nome único (cache-bust + permite
  // rollback simples se algo der errado).
  const filename = `${kind}-${nanoid(12)}.webp`;
  const path = `${store.id}/${filename}`;
  let publicUrl: string;
  try {
    publicUrl = await uploadToStorage({
      bucket: "storeLogos",
      path,
      buffer: compressed.buffer,
      contentType: compressed.contentType,
    });
  } catch (e) {
    console.error("[upload-store-image] storage falhou", e);
    return { ok: false, error: "Falha no upload. Tente em instantes." };
  }

  // Atualiza coluna correspondente + captura URL antiga pra cleanup
  const previousUrl = kind === "logo" ? store.logoUrl : store.iconUrl;
  try {
    await withTenant(store.id, userId, async (tx) => {
      await tx
        .update(storeTable)
        .set({
          ...(kind === "logo"
            ? { logoUrl: publicUrl }
            : { iconUrl: publicUrl }),
          updatedAt: new Date(),
        })
        .where(eq(storeTable.id, store.id));
    });
  } catch (e) {
    console.error("[upload-store-image] db update falhou", e);
    // Best-effort cleanup do upload novo (DB rejeitou; não vamos manter órfão)
    const newPath = extractStoragePath("storeLogos", publicUrl);
    if (newPath) {
      await deleteFromStorage({ bucket: "storeLogos", path: newPath });
    }
    return { ok: false, error: "Falha ao salvar imagem." };
  }

  // Deleta a antiga (best-effort)
  if (previousUrl) {
    const oldPath = extractStoragePath("storeLogos", previousUrl);
    if (oldPath) {
      await deleteFromStorage({ bucket: "storeLogos", path: oldPath });
    }
  }

  revalidatePath("/admin/configuracoes");
  revalidatePath("/admin");
  revalidateTag(`store-${store.slug}`);

  return { ok: true, url: publicUrl, kind };
}
