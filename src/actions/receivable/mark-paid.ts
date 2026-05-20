"use server";

/**
 * markReceivablePaid — Sprint 2B.
 *
 * Marca um receivable como pago. Quando há `cash_session` ativa, também
 * gera um `cash_adjustment` type='other_in' pra dinheiro ENTRAR no caixa
 * registrado. Quando não há sessão aberta, apenas atualiza receivable
 * (entrada financeira fica registrada sem casar com fluxo de caixa).
 *
 * Idempotente: chamadas duplicadas com paid_at já preenchido retornam
 * sucesso sem alterar nada (defesa contra duplo-clique).
 */
import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import {
  cashAdjustmentTable,
  cashSessionTable,
  receivableTable,
} from "@/db/schema";
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
  id: z.string().uuid(),
  /** Optional — quando não passado, default é now. Útil pra registrar pagamento atrasado. */
  paidAt: z.date().optional(),
});

export type MarkReceivablePaidResult =
  | { ok: true; paidAt: Date; cashAdjustmentId: string | null }
  | { ok: false; error: string };

export async function markReceivablePaid(
  input: z.input<typeof inputSchema>,
): Promise<MarkReceivablePaidResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { ok: false, error: "Sessão expirada." };
  const store = await getCurrentStore(session.user.id);
  if (!store) return { ok: false, error: "Loja não encontrada." };

  try {
    await checkRateLimit(rateLimits.mutation, session.user.id);
  } catch (err) {
    if (err instanceof RateLimitError) {
      return { ok: false, error: err.message };
    }
    throw err;
  }

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };

  try {
    return await withTenant<MarkReceivablePaidResult>(
      store.id,
      session.user.id,
      async (tx) => {
        const [existing] = await tx
          .select()
          .from(receivableTable)
          .where(
            and(
              eq(receivableTable.id, parsed.data.id),
              eq(receivableTable.storeId, store.id),
            ),
          )
          .limit(1);

        if (!existing) {
          return { ok: false, error: "Fiado não encontrado." };
        }
        // Idempotência — se já está pago, retorna sucesso sem mexer.
        if (existing.paidAt) {
          return {
            ok: true,
            paidAt: existing.paidAt,
            cashAdjustmentId: null,
          };
        }

        const paidAt = parsed.data.paidAt ?? new Date();

        const updated = await tx
          .update(receivableTable)
          .set({ paidAt })
          .where(
            and(
              eq(receivableTable.id, parsed.data.id),
              eq(receivableTable.storeId, store.id),
              isNull(receivableTable.paidAt), // defesa contra race condition
            ),
          )
          .returning({ id: receivableTable.id });

        if (updated.length === 0) {
          // Race: alguém marcou enquanto a gente lia. Tratamos como ok
          // (lookup de novo pra trazer paidAt verdadeiro).
          const [reread] = await tx
            .select({ paidAt: receivableTable.paidAt })
            .from(receivableTable)
            .where(eq(receivableTable.id, parsed.data.id))
            .limit(1);
          return {
            ok: true,
            paidAt: reread?.paidAt ?? paidAt,
            cashAdjustmentId: null,
          };
        }

        // Se há sessão de caixa ATIVA, gera entrada cash_adjustment.
        // Permite reconciliar fiado recebido com fechamento Z.
        const [activeCash] = await tx
          .select({ id: cashSessionTable.id })
          .from(cashSessionTable)
          .where(
            and(
              eq(cashSessionTable.storeId, store.id),
              sql`${cashSessionTable.closedAt} IS NULL`,
            ),
          )
          .limit(1);

        let cashAdjustmentId: string | null = null;
        if (activeCash) {
          const adj = await tx
            .insert(cashAdjustmentTable)
            .values({
              cashSessionId: activeCash.id,
              type: "other_in",
              amountInCents: existing.amountInCents,
              reason: `Pagamento fiado #${parsed.data.id.slice(0, 8)}`,
              createdByUserId: session.user.id,
            })
            .returning({ id: cashAdjustmentTable.id });
          cashAdjustmentId = adj[0]?.id ?? null;
        }

        revalidatePath("/admin/clientes");
        revalidatePath(`/admin/clientes/${existing.customerId}`);
        revalidatePath("/admin");
        revalidatePath("/admin/pdv/caixa");

        logger.info("receivable.paid", {
          storeId: store.id,
          receivableId: parsed.data.id,
          amountInCents: existing.amountInCents,
          cashAdjustmentId,
          hadCashSession: !!activeCash,
        });

        return { ok: true, paidAt, cashAdjustmentId };
      },
    );
  } catch (e) {
    logger.error("receivable.mark_paid_failed", { err: e });
    return { ok: false, error: "Falha ao marcar como pago." };
  }
}
