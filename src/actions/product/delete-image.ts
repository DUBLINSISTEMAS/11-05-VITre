"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";

import { productImageTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getCurrentStore } from "@/lib/store-context";
import {
  BUCKETS,
  deleteFromStorage,
  extractStoragePath,
} from "@/lib/supabase/storage";
import { withTenant } from "@/lib/tenant";

import { deleteProductImageSchema } from "./schema";

export type DeleteProductImageResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Remove uma imagem de produto: apaga do Storage + apaga do DB.
 *
 * Defesa em camadas: query no DB já filtra `storeId` do user. Se imagem não
 * pertence à loja do user logado, retorna erro genérico (não vaza existência).
 */
export async function deleteProductImage(input: {
  imageId: string;
}): Promise<DeleteProductImageResult> {
  const requestHeaders = await headers();

  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user) {
    return { ok: false, error: "Sessão expirada." };
  }

  let parsed;
  try {
    parsed = deleteProductImageSchema.parse(input);
  } catch {
    return { ok: false, error: "ID inválido." };
  }

  const store = await getCurrentStore(session.user.id);
  if (!store) {
    return { ok: false, error: "Loja não encontrada." };
  }

  // Carrega a imagem garantindo que é da loja do user (sob withTenant pra
  // RLS aplicar via GUC).
  const image = await withTenant(store.id, session.user.id, async (tx) =>
    tx.query.productImageTable.findFirst({
      where: and(
        eq(productImageTable.id, parsed.imageId),
        eq(productImageTable.storeId, store.id),
      ),
      columns: { id: true, productId: true, url: true },
    }),
  );
  if (!image) {
    return { ok: false, error: "Imagem não encontrada." };
  }

  // Apaga do Storage primeiro (best effort — não falha o delete do DB)
  const path = extractStoragePath("productImages", image.url);
  if (path) {
    await deleteFromStorage({ bucket: "productImages", path });
  } else {
    console.warn(
      `[delete-image] URL não pertence ao bucket ${BUCKETS.productImages}: ${image.url}`,
    );
  }

  await withTenant(store.id, session.user.id, async (tx) => {
    await tx
      .delete(productImageTable)
      .where(
        and(
          eq(productImageTable.id, image.id),
          eq(productImageTable.storeId, store.id),
        ),
      );
  });

  revalidatePath(`/admin/produtos/${image.productId}/editar`);
  revalidateTag(`store-${store.slug}`);

  return { ok: true };
}
