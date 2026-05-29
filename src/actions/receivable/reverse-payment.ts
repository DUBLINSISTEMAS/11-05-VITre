"use server";

/**
 * reverseReceivablePayment — Pre-Sprint-6 B.
 *
 * Estorna um pagamento de fiado registrado por engano. Lojista digitou
 * R$ 100 em vez de R$ 10? Em vez de SQL manual no banco, registra uma
 * linha NEGATIVA em receivable_payment com FK pro original.
 *
 * Modelo append-only (CLAUDE.md princípio 5):
 *   - Original (positivo) permanece intocado.
 *   - Estorno = nova linha com amount = -original e reversal_of_id = original.id.
 *   - Soma efetiva = SUM(amount) — naturalmente desconta o estorno.
 *
 * Salvaguardas:
 *   - UNIQUE parcial (DB, SQL 54): cada original só tem 1 estorno.
 *   - Advisory lock por receivable: serializa 2 cliques simultâneos.
 *   - Bloqueio app-layer: não estorna pagamento que JÁ É um estorno
 *     (reversal_of_id NOT NULL).
 *
 * Efeitos colaterais:
 *   - Recalcula receivable.paid_at: se SUM(payments) cair abaixo do
 *     amount, paid_at volta a NULL (fiado deixa de estar quitado).
 *   - Cash_adjustment 'other_out' no caixa aberto (dinheiro saiu —
 *     espelho do 'other_in' gerado no pagamento original).
 */
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import {
  cashAdjustmentTable,
  cashSessionTable,
  receivablePaymentTable,
  receivableTable,
} from "@/db/schema";
import { extractClientContext, recordAuditEvent } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { checkRateLimit, RateLimitError, rateLimits } from "@/lib/rate-limit";
import { safeUserMessage } from "@/lib/safe-error";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

const inputSchema = z.object({
  paymentId: z.string().uuid(),
  reason: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().trim().min(3, "Informe o motivo do estorno.").max(500),
  ),
});
export type ReverseReceivablePaymentInput = z.input<typeof inputSchema>;

export type ReverseReceivablePaymentResult =
  | {
      ok: true;
      reversalId: string;
      /** true se este estorno fez o receivable voltar a ser pendente. */
      reopenedReceivable: boolean;
      cashAdjustmentId: string | null;
    }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function reverseReceivablePayment(
  input: ReverseReceivablePaymentInput,
): Promise<ReverseReceivablePaymentResult> {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user) return { ok: false, error: "Sessão expirada." };
  const userId = session.user.id;

  const store = await getCurrentStore(userId);
  if (!store) return { ok: false, error: "Loja não encontrada." };

  const clientCtx = extractClientContext(requestHeaders);

  try {
    await checkRateLimit(rateLimits.mutation, userId);
  } catch (err) {
    if (err instanceof RateLimitError) return { ok: false, error: err.message };
    throw err;
  }

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (!fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return { ok: false, error: "Verifique os campos.", fieldErrors };
  }
  const data = parsed.data;

  try {
    return await withTenant<ReverseReceivablePaymentResult>(
      store.id,
      userId,
      async (tx) => {
        // 1) Buscar payment original
        const [original] = await tx
          .select({
            id: receivablePaymentTable.id,
            receivableId: receivablePaymentTable.receivableId,
            amountInCents: receivablePaymentTable.amountInCents,
            method: receivablePaymentTable.method,
            reversalOfId: receivablePaymentTable.reversalOfId,
          })
          .from(receivablePaymentTable)
          .where(
            and(
              eq(receivablePaymentTable.id, data.paymentId),
              eq(receivablePaymentTable.storeId, store.id),
            ),
          )
          .limit(1);

        if (!original) {
          return { ok: false, error: "Pagamento não encontrado." };
        }
        if (original.reversalOfId !== null) {
          return {
            ok: false,
            error: "Este lançamento já é um estorno e não pode ser estornado.",
          };
        }
        if (original.amountInCents <= 0) {
          // Defesa em profundidade: estorno tem CHECK no DB pra ser <0
          return {
            ok: false,
            error: "Pagamento original com valor inválido.",
          };
        }

        // 2) Advisory lock por receivable — serializa contra duplo-clique
        //    e contra novo pagamento simultâneo.
        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(hashtext(${"receivable-" + original.receivableId}))`,
        );

        // 3) Já existe estorno deste payment? UNIQUE parcial (SQL 54)
        //    impediria o INSERT, mas mensagem amigável > 23505 do PG.
        const [existing] = await tx
          .select({ id: receivablePaymentTable.id })
          .from(receivablePaymentTable)
          .where(eq(receivablePaymentTable.reversalOfId, original.id))
          .limit(1);
        if (existing) {
          return {
            ok: false,
            error: "Este pagamento já foi estornado.",
          };
        }

        // 4) Inserir estorno (append-only)
        const [reversalRow] = await tx
          .insert(receivablePaymentTable)
          .values({
            storeId: store.id,
            receivableId: original.receivableId,
            amountInCents: -original.amountInCents,
            method: original.method,
            notes: data.reason,
            reversalOfId: original.id,
            createdByUserId: userId,
          })
          .returning({ id: receivablePaymentTable.id });
        if (!reversalRow) throw new Error("Falha ao gravar estorno.");

        // 5) Recalcular paid_at do receivable.
        //    Releitura da soma considerando o estorno acabado de inserir.
        const [receivable] = await tx
          .select({
            id: receivableTable.id,
            amountInCents: receivableTable.amountInCents,
            paidAt: receivableTable.paidAt,
            customerId: receivableTable.customerId,
          })
          .from(receivableTable)
          .where(eq(receivableTable.id, original.receivableId))
          .limit(1);
        const [sumRow] = await tx
          .select({
            paid: sql<number>`coalesce(sum(${receivablePaymentTable.amountInCents}), 0)::int`,
          })
          .from(receivablePaymentTable)
          .where(
            eq(receivablePaymentTable.receivableId, original.receivableId),
          );
        const paidSum = sumRow?.paid ?? 0;

        let reopenedReceivable = false;
        if (receivable) {
          if (receivable.paidAt && paidSum < receivable.amountInCents) {
            // Estorno desfez a quitação — reabre.
            await tx
              .update(receivableTable)
              .set({ paidAt: null, paidMethod: null })
              .where(eq(receivableTable.id, receivable.id));
            reopenedReceivable = true;
          }
        }

        // 6) Cash adjustment reverso ('other_out') quando há caixa aberto.
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
          const [adj] = await tx
            .insert(cashAdjustmentTable)
            .values({
              cashSessionId: activeCash.id,
              type: "other_out",
              amountInCents: original.amountInCents,
              reason:
                `Estorno fiado #${original.id.slice(0, 8)} — ${data.reason}`.slice(
                  0,
                  500,
                ),
              createdByUserId: userId,
            })
            .returning({ id: cashAdjustmentTable.id });
          cashAdjustmentId = adj?.id ?? null;
        }

        revalidatePath("/admin/financeiro/receber");
        revalidatePath("/admin");
        revalidatePath("/admin/pdv/caixa");

        logger.info("receivable.payment_reversed", {
          storeId: store.id,
          receivableId: original.receivableId,
          originalPaymentId: original.id,
          reversalId: reversalRow.id,
          amountInCents: original.amountInCents,
          reopenedReceivable,
          cashAdjustmentId,
        });

        // Sprint 6A — auditoria forense (forense pós-incidente).
        await recordAuditEvent(tx, {
          storeId: store.id,
          actorUserId: userId,
          action: "receivable.payment_reversed",
          entityType: "receivable_payment",
          entityId: original.id,
          payload: {
            reversalId: reversalRow.id,
            receivableId: original.receivableId,
            amountInCents: original.amountInCents,
            method: original.method,
            reopenedReceivable,
            reason: data.reason,
          },
          ip: clientCtx.ip,
          userAgent: clientCtx.userAgent,
        });

        return {
          ok: true,
          reversalId: reversalRow.id,
          reopenedReceivable,
          cashAdjustmentId,
        };
      },
    );
  } catch (e) {
    logger.error("receivable.reverse_payment_failed", { err: e });
    return {
      ok: false,
      error: safeUserMessage(
        e,
        "Falha ao estornar pagamento. Tente novamente.",
      ),
    };
  }
}
