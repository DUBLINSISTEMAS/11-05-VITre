"use server";

import { and, count, eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";

import { productImageTable, productTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import { compressImage, validateImageInput } from "@/lib/image";
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

import { uploadProductImageSchema } from "./schema";

export type UploadProductImageResult =
  | { ok: true; id: string; url: string; position: number }
  | { ok: false; error: string };

/** Limite duro server-side (independente do que o client envia). */
const MAX_IMAGES_PER_PRODUCT = 5;

/**
 * Recebe um File via FormData, valida, comprime via sharp, sobe pro Supabase
 * Storage e persiste em `product_image`.
 *
 * Limites enforced server-side:
 * - max 5 imagens por produto
 * - max 10MB no upload bruto
 * - mime allowlist
 *
 * Rate limit por userId (Sandra na rede da loja com várias funcionárias
 * compartilhando IP — userId é o identificador correto aqui).
 */
export async function uploadProductImage(
  formData: FormData,
): Promise<UploadProductImageResult> {
  const requestHeaders = await headers();

  // 1. Auth
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user) {
    return { ok: false, error: "Sessão expirada. Faça login novamente." };
  }
  const userId = session.user.id;

  // 2. Rate limit (por user)
  try {
    await checkRateLimit(rateLimits.upload, userId);
  } catch (e) {
    if (e instanceof RateLimitError) return { ok: false, error: e.message };
    throw e;
  }

  // 3. Parse FormData
  const file = formData.get("file");
  const productIdRaw = formData.get("productId");

  if (!(file instanceof File)) {
    return { ok: false, error: "Arquivo ausente." };
  }
  let parsedProductId: string;
  try {
    const parsed = uploadProductImageSchema.parse({ productId: productIdRaw });
    parsedProductId = parsed.productId;
  } catch {
    return { ok: false, error: "Identificador do produto inválido." };
  }

  // 4. Validação do arquivo
  const validationError = validateImageInput(file);
  if (validationError) {
    return { ok: false, error: validationError };
  }

  // 5. Resolve loja do user
  const store = await getCurrentStore(userId);
  if (!store) {
    return { ok: false, error: "Loja não encontrada." };
  }

  // 6. Verifica que produto pertence à loja (sob withTenant — RLS via GUC)
  const product = await withTenant(store.id, userId, async (tx) =>
    tx.query.productTable.findFirst({
      where: and(
        eq(productTable.id, parsedProductId),
        eq(productTable.storeId, store.id),
      ),
      columns: { id: true },
    }),
  );
  if (!product) {
    return { ok: false, error: "Produto não encontrado." };
  }

  // 7. Comprime via sharp ANTES de tocar no DB
  // (se sharp falhar, não desperdiçamos transação)
  let compressed;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    compressed = await compressImage(buffer);
  } catch {
    return {
      ok: false,
      error: "Não conseguimos processar essa imagem. Tente outra.",
    };
  }

  // 8. Upload pro Storage
  const filename = generateProductImageFilename();
  const path = `${store.id}/${parsedProductId}/${filename}`;
  let publicUrl: string;
  try {
    publicUrl = await uploadToStorage({
      bucket: "productImages",
      path,
      buffer: compressed.buffer,
      contentType: compressed.contentType,
    });
  } catch (e) {
    console.error("[upload-image] storage falhou", e);
    return { ok: false, error: "Falha no upload. Tente novamente em instantes." };
  }

  // 9. Insere no DB com transação (limite de 5 + alocação de position atômicas)
  // Race-safe: dois uploads simultâneos vão ler counts diferentes;
  // o segundo vai ver o primeiro já inserido e calcular position correta.
  // Em caso raro de conflict (`product_image_product_position_unique`), retornamos
  // erro útil ao caller (UI pode tentar de novo).
  let dbInsertSucceeded = false;
  try {
    const inserted = await withTenant(store.id, userId, async (tx) => {
      const [{ value: existing }] = await tx
        .select({ value: count() })
        .from(productImageTable)
        .where(eq(productImageTable.productId, parsedProductId));

      if (existing >= MAX_IMAGES_PER_PRODUCT) {
        throw new ProductImageLimitError();
      }

      const [row] = await tx
        .insert(productImageTable)
        .values({
          storeId: store.id,
          productId: parsedProductId,
          url: publicUrl,
          position: existing,
        })
        .returning({
          id: productImageTable.id,
          position: productImageTable.position,
        });

      if (!row) throw new Error("insert sem retorno");
      return row;
    });
    dbInsertSucceeded = true;

    revalidatePath(`/admin/produtos/${parsedProductId}/editar`);
    revalidateTag(`store-${store.slug}`);

    return {
      ok: true,
      id: inserted.id,
      url: publicUrl,
      position: inserted.position,
    };
  } catch (e) {
    if (e instanceof ProductImageLimitError) {
      return {
        ok: false,
        error: `Limite de ${MAX_IMAGES_PER_PRODUCT} imagens por produto atingido.`,
      };
    }
    // Conflict de unique(productId, position) — race muito raro
    if (isUniqueViolation(e)) {
      return {
        ok: false,
        error: "Conflito ao salvar. Tente enviar a imagem novamente.",
      };
    }
    console.error("[upload-image] db insert falhou", e);
    return { ok: false, error: "Falha ao salvar imagem." };
  } finally {
    // Cleanup best-effort: se DB rejeitou (limite, unique, qualquer erro),
    // o .webp recém-subido fica órfão no bucket. Deleta — não bloqueia o
    // erro original do DB.
    if (!dbInsertSucceeded) {
      const orphanPath = extractStoragePath("productImages", publicUrl);
      if (orphanPath) {
        await deleteFromStorage({
          bucket: "productImages",
          path: orphanPath,
        });
      }
    }
  }
}

class ProductImageLimitError extends Error {}

function isUniqueViolation(e: unknown): boolean {
  if (typeof e !== "object" || e === null) return false;
  const code = (e as { code?: string }).code;
  return code === "23505";
}
