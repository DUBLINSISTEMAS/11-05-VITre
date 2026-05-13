"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";

import { productImageTable, productTable, productVariantTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import { compressImage } from "@/lib/image";
import { logger } from "@/lib/logger";
import {
  checkRateLimit,
  RateLimitError,
  rateLimits,
} from "@/lib/rate-limit";
import { generateUniqueProductSlug } from "@/lib/slug-uniqueness";
import { getCurrentStore } from "@/lib/store-context";
import {
  generateProductImageFilename,
  uploadToStorage,
} from "@/lib/supabase/storage";
import { withTenant } from "@/lib/tenant";

import {
  productFormSchema,
  type ProductFormValues,
} from "./schema";

export type CreateProductFromValuesResult =
  | { ok: true; productId: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Cria um produto com todos os dados do formulário e faz upload das imagens.
 * Recebe os arquivos de imagem via FormData ou diretamente como Files.
 */
export async function createProductFromValues(
  input: ProductFormValues,
  imageFiles: File[] = [],
): Promise<CreateProductFromValuesResult> {
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

  const parsed = productFormSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (!fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return {
      ok: false,
      error: "Confira os campos destacados.",
      fieldErrors,
    };
  }
  const data = parsed.data;

  const store = await getCurrentStore(userId);
  if (!store) return { ok: false, error: "Loja não encontrada." };

  try {
    const row = await withTenant(store.id, userId, async (tx) => {
      const slug = await generateUniqueProductSlug({
        storeId: store.id,
        name: data.name,
        client: tx,
      });

      const [created] = await tx
        .insert(productTable)
        .values({
          storeId: store.id,
          categoryId: data.categoryId,
          name: data.name,
          slug,
          description: data.description,
          basePriceInCents: data.basePriceInCents,
          promoPriceInCents: data.promoPriceInCents,
          trackStock: data.trackStock,
          stockQuantity: data.trackStock ? data.stockQuantity : null,
          isActive: data.isActive,
          isFeatured: data.isFeatured,
          composition: data.composition,
          modeling: data.modeling,
          lining: data.lining,
          washing: data.washing,
        })
        .returning({ id: productTable.id });

      if (!created) return null;

      if (data.variants.length > 0) {
        await tx.insert(productVariantTable).values(
          data.variants.map((v) => ({
            storeId: store.id,
            productId: created.id,
            name: v.name,
            priceInCents: v.priceInCents,
            stockQuantity: v.stockQuantity,
            trackStock: v.stockQuantity !== null,
            axis: v.axis,
            colorHex: v.axis === "color" ? v.colorHex : null,
            featuredImageId: v.featuredImageId,
          })),
        );
      }

      return created;
    });

    if (!row) return { ok: false, error: "Falha ao criar produto." };

    // Upload das imagens após criar o produto
    if (imageFiles.length > 0) {
      const uploadPromises = imageFiles.map(async (file, index) => {
        try {
          const buffer = Buffer.from(await file.arrayBuffer());
          const compressed = await compressImage(buffer);
          
          const filename = generateProductImageFilename();
          const path = `${store.id}/${row.id}/${filename}`;
          
          const publicUrl = await uploadToStorage({
            bucket: "productImages",
            path,
            buffer: compressed.buffer,
            contentType: compressed.contentType,
          });

          // Insere no banco
          await withTenant(store.id, userId, async (tx) => {
            await tx.insert(productImageTable).values({
              storeId: store.id,
              productId: row.id,
              url: publicUrl,
              position: index,
            });
          });
        } catch (e) {
          logger.error("product.create.image_upload_failed", {
            err: e,
            storeId: store.id,
            productId: row.id,
            index,
          });
          // Não falha a criação do produto por causa de imagem
        }
      });

      await Promise.allSettled(uploadPromises);
    }

    revalidatePath("/admin/produtos");
    revalidateTag(`store-${store.slug}`);

    return { ok: true, productId: row.id };
  } catch (e) {
    logger.error("product.create_from_values.tx_failed", {
      err: e,
      storeId: store.id,
    });
    return { ok: false, error: "Falha ao criar produto. Tente novamente." };
  }
}
