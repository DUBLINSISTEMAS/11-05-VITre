/**
 * Helpers de upload/delete em Supabase Storage.
 *
 * 4 buckets (ver `supabase/sql/02_storage_buckets.sql`):
 *  - store-logos     → logos das lojas
 *  - store-banners   → banners da home
 *  - product-images  → galeria de produto
 *  - category-images → ícones circulares de categoria (Fase 1.5)
 *
 * Todos os buckets são PUBLIC para read; escrita só via service_role
 * (este módulo). Anon não consegue subir nada direto.
 *
 * Caminho dos arquivos:
 *  - logo:      {storeId}/logo.webp
 *  - banner:    {storeId}/{nanoid}.webp
 *  - produto:   {storeId}/{productId}/{nanoid}.webp
 *  - categoria: {storeId}/{nanoid}.webp
 */
import { nanoid } from "nanoid";

import { logger } from "@/lib/logger";

import { supabaseService } from "./server";

export const BUCKETS = {
  storeLogos: "store-logos",
  storeBanners: "store-banners",
  productImages: "product-images",
  categoryImages: "category-images",
} as const satisfies Record<string, string>;

export type BucketKey = keyof typeof BUCKETS;

interface UploadParams {
  bucket: BucketKey;
  path: string; // path dentro do bucket — caller monta
  buffer: Buffer;
  contentType: string;
}

/**
 * Sobe arquivo no bucket e retorna URL pública.
 * Throw em caso de erro do Supabase.
 */
export async function uploadToStorage({
  bucket,
  path,
  buffer,
  contentType,
}: UploadParams): Promise<string> {
  const { error } = await supabaseService.storage
    .from(BUCKETS[bucket])
    .upload(path, buffer, {
      contentType,
      upsert: false,
      cacheControl: "31536000, immutable", // 1 ano — nome é único, conteúdo nunca muda
    });

  if (error) {
    throw new Error(`Upload falhou em ${BUCKETS[bucket]}/${path}: ${error.message}`);
  }

  const { data } = supabaseService.storage
    .from(BUCKETS[bucket])
    .getPublicUrl(path);

  return data.publicUrl;
}

/**
 * Helper para gerar nome único de arquivo de produto.
 * Ex: "abc123def456.webp"
 */
export function generateProductImageFilename(): string {
  return `${nanoid(16)}.webp`;
}

/**
 * Apaga arquivo do storage. Falha silenciosamente (loga warn) — porque
 * cleanup de imagens é "best effort"; não queremos falhar uma operação
 * de domínio se o storage estiver com hiccup.
 */
export async function deleteFromStorage({
  bucket,
  path,
}: {
  bucket: BucketKey;
  path: string;
}): Promise<void> {
  const { error } = await supabaseService.storage
    .from(BUCKETS[bucket])
    .remove([path]);

  if (error) {
    logger.warn("storage.delete_failed", {
      bucket: BUCKETS[bucket],
      path,
      message: error.message,
    });
  }
}

/**
 * Extrai o path do bucket a partir de uma public URL do Supabase.
 * Ex: "https://x.supabase.co/storage/v1/object/public/product-images/storeId/productId/file.webp"
 *  → "storeId/productId/file.webp"
 *
 * Retorna null se a URL não pertence ao bucket informado (defesa contra
 * tentativa de deletar arquivo de outro lugar).
 */
export function extractStoragePath(
  bucket: BucketKey,
  publicUrl: string,
): string | null {
  try {
    const url = new URL(publicUrl);
    const marker = `/storage/v1/object/public/${BUCKETS[bucket]}/`;
    const idx = url.pathname.indexOf(marker);
    if (idx === -1) return null;
    return url.pathname.slice(idx + marker.length);
  } catch {
    return null;
  }
}
