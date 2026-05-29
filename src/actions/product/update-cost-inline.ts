"use server";

/**
 * updateProductCostInline — Onda M3 (2026-05-29).
 *
 * Action enxuta pra atualizar SOMENTE o campo `cost_price_in_cents` de UM
 * produto. Usada pelo bulk-edit inline da `/admin/produtos` filtrado por
 * "Sem custo" — lojista digita o custo direto na célula, blur ou debounce
 * 1.5s grava.
 *
 * Antes do M3, atualizar custo exigia abrir o drawer de produto (carrega
 * 6 queries: produto + imagens + variantes + categorias + marcas + store fees)
 * só pra mexer em UM campo. Lojista com 50 produtos sem custo = 50 round
 * trips de drawer. M3 reduz isso pra 1 query de UPDATE simples por
 * produto.
 *
 * NAO substitui o drawer (que cobre 30+ campos); cobre o caso especifico
 * "marcar custo em massa" sem fricção.
 *
 * Segurança:
 *   - Rate limit (CLAUDE.md #6)
 *   - withTenant garante RLS por loja
 *   - Zod valida (cost >= 0, <= R$ 9.999.999,99)
 *   - revalidatePath atualiza /admin/produtos
 */

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { productTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  checkRateLimit,
  RateLimitError,
  rateLimits,
} from "@/lib/rate-limit";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

const inputSchema = z.object({
  productId: z.string().uuid(),
  costPriceInCents: z
    .number()
    .int()
    .min(0, "Custo não pode ser negativo.")
    .max(999_999_999, "Custo acima do máximo permitido.")
    .nullable(),
});

export type UpdateProductCostInlineResult =
  | { ok: true }
  | { ok: false; error: string };

export async function updateProductCostInline(
  input: z.input<typeof inputSchema>,
): Promise<UpdateProductCostInlineResult> {
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

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Custo inválido.",
    };
  }

  const store = await getCurrentStore(userId);
  if (!store) return { ok: false, error: "Loja não encontrada." };

  try {
    const updated = await withTenant(store.id, userId, async (tx) => {
      const rows = await tx
        .update(productTable)
        .set({
          costPriceInCents: parsed.data.costPriceInCents,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(productTable.id, parsed.data.productId),
            eq(productTable.storeId, store.id),
          ),
        )
        .returning({ id: productTable.id });
      return rows.length > 0;
    });

    if (!updated) {
      return { ok: false, error: "Produto não encontrado." };
    }

    revalidatePath("/admin/produtos");
    return { ok: true };
  } catch (e) {
    logger.error("product.update_cost_inline.failed", {
      err: e,
      storeId: store.id,
      productId: parsed.data.productId,
    });
    return { ok: false, error: "Falha ao salvar. Tente novamente." };
  }
}
