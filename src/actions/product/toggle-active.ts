"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";

import { productTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import {
  checkRateLimit,
  RateLimitError,
  rateLimits,
} from "@/lib/rate-limit";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

import { type ToggleActiveInput, toggleActiveSchema } from "./schema";

export type ToggleActiveResult =
  | { ok: true; isActive: boolean }
  | { ok: false; error: string };

/**
 * Liga/desliga visibilidade do produto no catálogo público sem mexer em mais
 * nada. Útil pro lojista pausar um item temporariamente (esgotado, em troca).
 *
 * Não permite ativar produto rascunho (sem nome ou com slug `draft-*`) — UI
 * deveria ocultar o toggle nesses casos, mas validamos no servidor por defesa.
 */
export async function toggleProductActive(
  input: ToggleActiveInput,
): Promise<ToggleActiveResult> {
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

  const parsed = toggleActiveSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Dados inválidos." };
  }

  const store = await getCurrentStore(userId);
  if (!store) return { ok: false, error: "Loja não encontrada." };

  type StepResult = { ok: true } | { ok: false; error: string };
  let result: StepResult;
  try {
    result = await withTenant(store.id, userId, async (tx) => {
      const product = await tx.query.productTable.findFirst({
        where: and(
          eq(productTable.id, parsed.data.productId),
          eq(productTable.storeId, store.id),
        ),
        columns: { id: true, name: true, slug: true },
      });
      if (!product) {
        return { ok: false, error: "Produto não encontrado." } as const;
      }

      // Bloqueia ativação de rascunho não preenchido
      if (parsed.data.isActive) {
        if (!product.name.trim() || product.slug.startsWith("draft-")) {
          return {
            ok: false,
            error: "Preencha o produto antes de publicá-lo.",
          } as const;
        }
      }

      await tx
        .update(productTable)
        .set({ isActive: parsed.data.isActive, updatedAt: new Date() })
        .where(
          and(
            eq(productTable.id, parsed.data.productId),
            eq(productTable.storeId, store.id),
          ),
        );

      return { ok: true } as const;
    });
  } catch (e) {
    console.error("[toggle-active] update falhou", e);
    return { ok: false, error: "Falha ao atualizar status." };
  }

  if (!result.ok) return result;

  revalidatePath("/admin/produtos");
  revalidatePath(`/admin/produtos/${parsed.data.productId}/editar`);
  revalidateTag(`store-${store.slug}`);

  return { ok: true, isActive: parsed.data.isActive };
}
