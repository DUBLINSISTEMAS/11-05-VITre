"use server";

/**
 * updatePdvPolicy — Sprint 3.5 (2026-05-22).
 *
 * Atualiza configurações operacionais do PDV separadas dos campos
 * de identidade da loja. Hoje só `requireOpenCashSession`; futuro
 * pode crescer (senha pra desconto >X%, exigir CPF acima de R$Y, etc).
 *
 * Action isolada porque o domínio de "policy" muda por motivos
 * diferentes do form de identidade (nome/endereço/whatsapp) — separar
 * evita save acidental do bloco errado.
 */
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { storeTable } from "@/db/schema";
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
  type UpdatePdvPolicyInput,
  updatePdvPolicySchema,
} from "./schema";

export type UpdatePdvPolicyResult =
  | { ok: true }
  | { ok: false; error: string };

export async function updatePdvPolicy(
  input: UpdatePdvPolicyInput,
): Promise<UpdatePdvPolicyResult> {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user) {
    return { ok: false, error: "Sessão expirada. Faça login novamente." };
  }
  const userId = session.user.id;

  try {
    await checkRateLimit(rateLimits.mutation, userId);
  } catch (err) {
    if (err instanceof RateLimitError) return { ok: false, error: err.message };
    throw err;
  }

  const parsed = updatePdvPolicySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Dados inválidos." };
  }
  const data = parsed.data;

  const store = await getCurrentStore(userId);
  if (!store) return { ok: false, error: "Loja não encontrada." };

  try {
    await withTenant(store.id, userId, async (tx) => {
      await tx
        .update(storeTable)
        .set({ requireOpenCashSession: data.requireOpenCashSession })
        .where(eq(storeTable.id, store.id));
    });

    revalidatePath("/admin/configuracoes");
    revalidatePath("/admin/pdv");
    revalidatePath("/admin/pdv/caixa");

    logger.info("store.pdv_policy_updated", {
      storeId: store.id,
      requireOpenCashSession: data.requireOpenCashSession,
    });

    return { ok: true };
  } catch (e) {
    logger.error("store.update_pdv_policy_failed", { err: e });
    return { ok: false, error: "Falha ao salvar configuração." };
  }
}
