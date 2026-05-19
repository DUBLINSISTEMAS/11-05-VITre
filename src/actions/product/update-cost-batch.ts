"use server";

/**
 * ADR-0034 Camada 2 — Bulk update de custo + comissão padrão.
 *
 * Consumida pela tela `/admin/produtos/custos` (grid estilo planilha).
 * Lojista edita várias linhas e salva tudo de uma vez. Sem isso,
 * preencher custo em 200 produtos um por um inviabiliza a Camada 5
 * (relatório de margem) — ninguém vai fazer.
 *
 * Estratégia:
 *   - Uma transação. Tudo OK ou tudo rollback.
 *   - Cada linha vira UPDATE individual (`WHERE id = $ AND store_id = $`).
 *     Não dá pra fazer UPDATE em batch via Drizzle quando valores diferem
 *     por linha — uns 100 UPDATEs em transação é aceitável (índice pk).
 *   - Linhas com campos `undefined` são no-op (mantém valor atual).
 *     Linhas com `null` zeram o campo (lojista limpou de propósito).
 *   - Rate limit mesma faixa de mutação (rateLimits.mutation).
 */

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

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

import {
  type UpdateProductCostBatchInput,
  updateProductCostBatchSchema,
} from "./schema";

export type UpdateProductCostBatchResult =
  | { ok: true; updatedCount: number }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function updateProductCostBatch(
  input: UpdateProductCostBatchInput,
): Promise<UpdateProductCostBatchResult> {
  const parsed = updateProductCostBatchSchema.safeParse(input);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    return {
      ok: false,
      error: "Dados inválidos.",
      fieldErrors: Object.fromEntries(
        Object.entries(flat.fieldErrors).map(([k, v]) => [k, v?.[0] ?? ""]),
      ),
    };
  }
  const { rows } = parsed.data;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { ok: false, error: "Sessão expirada." };
  }

  try {
    await checkRateLimit(rateLimits.mutation, session.user.id);
  } catch (e) {
    if (e instanceof RateLimitError) {
      return { ok: false, error: "Muitas requisições. Tente em alguns segundos." };
    }
    throw e;
  }

  const store = await getCurrentStore(session.user.id);
  if (!store) {
    return { ok: false, error: "Loja não encontrada." };
  }

  /**
   * Linhas com nenhum campo definido (ambos undefined) são no-op.
   * Filtramos pra evitar UPDATEs vazios que só tocam `updated_at`
   * sem trazer valor.
   */
  const meaningful = rows.filter(
    (r) =>
      r.costPriceInCents !== undefined || r.defaultCommissionBps !== undefined,
  );

  if (meaningful.length === 0) {
    return { ok: true, updatedCount: 0 };
  }

  let updatedCount = 0;

  try {
    await withTenant(store.id, session.user.id, async (tx) => {
      for (const row of meaningful) {
        const patch: {
          costPriceInCents?: number | null;
          defaultCommissionBps?: number | null;
          updatedAt: Date;
        } = { updatedAt: new Date() };

        if (row.costPriceInCents !== undefined) {
          patch.costPriceInCents = row.costPriceInCents;
        }
        if (row.defaultCommissionBps !== undefined) {
          patch.defaultCommissionBps = row.defaultCommissionBps;
        }

        const result = await tx
          .update(productTable)
          .set(patch)
          .where(
            and(
              eq(productTable.id, row.productId),
              eq(productTable.storeId, store.id),
            ),
          );
        // Drizzle pg-core retorna { rowCount } via driver postgres.js.
        // Algumas versões expõem como `count`. Fallback seguro.
        const rc =
          (result as { rowCount?: number; count?: number })?.rowCount ??
          (result as { count?: number })?.count ??
          0;
        updatedCount += rc;
      }
    });
  } catch (e) {
    logger.error("updateProductCostBatch failed", { error: String(e) });
    return { ok: false, error: "Erro ao salvar. Tente novamente." };
  }

  // Invalida o listing admin (custo não vaza pra storefront público).
  revalidatePath("/admin/produtos");
  revalidatePath("/admin/produtos/custos");

  return { ok: true, updatedCount };
}
