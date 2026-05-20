"use server";

/**
 * recordReceivablePayment — Sprint 4B.
 *
 * Registra UM pagamento (parcial ou total) num receivable. Quando a
 * SOMA dos pagamentos atinge ou ultrapassa o valor do fiado, seta
 * `receivable.paid_at` + `paid_method` automaticamente.
 *
 * Quando há `cash_session` ativa, gera `cash_adjustment` type='other_in'
 * com o VALOR DO PAGAMENTO ATUAL (não do receivable inteiro) — permite
 * reconciliar entradas de fiado parciais com o fechamento Z.
 *
 * Append-only: cada pagamento é uma linha em `receivable_payment`. Erro
 * de digitação vira lançamento reverso (futuro — Sprint 4 não inclui).
 *
 * Lock: advisory lock por receivable_id pra evitar 2 cliques quitarem
 * "metade + metade" simultaneamente e estourarem o saldo.
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
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  checkRateLimit,
  RateLimitError,
  rateLimits,
} from "@/lib/rate-limit";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

import { PAYMENT_METHOD_VALUES } from "../order/balcao/schema";

const inputSchema = z.object({
  receivableId: z.string().uuid(),
  amountInCents: z
    .number()
    .int()
    .positive("Valor do pagamento deve ser maior que zero")
    .max(99_999_999, "Valor acima do máximo"),
  method: z.enum(PAYMENT_METHOD_VALUES),
  notes: z
    .preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? null : v),
      z.string().trim().max(500).nullable(),
    )
    .default(null),
});
export type RecordReceivablePaymentInput = z.input<typeof inputSchema>;

export type RecordReceivablePaymentResult =
  | {
      ok: true;
      paymentId: string;
      /** Saldo restante DEPOIS deste pagamento (0 quando quitou). */
      remainingInCents: number;
      /** true quando este pagamento quitou o fiado (paid_at foi setado). */
      fullyPaid: boolean;
      /** ID do cash_adjustment gerado, se houver caixa aberto. */
      cashAdjustmentId: string | null;
    }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function recordReceivablePayment(
  input: RecordReceivablePaymentInput,
): Promise<RecordReceivablePaymentResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { ok: false, error: "Sessão expirada." };
  const userId = session.user.id;

  const store = await getCurrentStore(userId);
  if (!store) return { ok: false, error: "Loja não encontrada." };

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
    return await withTenant<RecordReceivablePaymentResult>(
      store.id,
      userId,
      async (tx) => {
        // Lock por receivable: serializa cliques duplos do botão
        // "Receber pagamento" no mesmo fiado.
        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(hashtext(${"receivable-" + data.receivableId}))`,
        );

        // 1) Receivable + sanity checks
        const [receivable] = await tx
          .select()
          .from(receivableTable)
          .where(
            and(
              eq(receivableTable.id, data.receivableId),
              eq(receivableTable.storeId, store.id),
            ),
          )
          .limit(1);

        if (!receivable) {
          return { ok: false, error: "Fiado não encontrado." };
        }
        if (receivable.paidAt) {
          return { ok: false, error: "Este fiado já está quitado." };
        }

        // 2) Soma dos pagamentos ANTES deste.
        const [sumRow] = await tx
          .select({
            paid: sql<number>`coalesce(sum(${receivablePaymentTable.amountInCents}), 0)::int`,
          })
          .from(receivablePaymentTable)
          .where(eq(receivablePaymentTable.receivableId, data.receivableId));
        const alreadyPaid = sumRow?.paid ?? 0;
        const remainingBefore = receivable.amountInCents - alreadyPaid;

        if (remainingBefore <= 0) {
          // Defesa de race: alguém quitou enquanto a gente lia. Marca
          // paid_at se ainda estiver null (idempotência).
          await tx
            .update(receivableTable)
            .set({ paidAt: new Date() })
            .where(
              and(
                eq(receivableTable.id, data.receivableId),
                sql`${receivableTable.paidAt} IS NULL`,
              ),
            );
          return {
            ok: false,
            error: "Este fiado já estava quitado.",
          };
        }

        if (data.amountInCents > remainingBefore) {
          return {
            ok: false,
            error: `Valor maior que o saldo restante (R$ ${(remainingBefore / 100)
              .toFixed(2)
              .replace(".", ",")}).`,
            fieldErrors: { amountInCents: "Acima do saldo" },
          };
        }

        // 3) INSERT pagamento (append-only).
        const [paymentRow] = await tx
          .insert(receivablePaymentTable)
          .values({
            storeId: store.id,
            receivableId: data.receivableId,
            amountInCents: data.amountInCents,
            method: data.method,
            notes: data.notes,
            createdByUserId: userId,
          })
          .returning({ id: receivablePaymentTable.id });

        if (!paymentRow) {
          throw new Error("Falha ao gravar pagamento.");
        }

        // 4) Atualiza receivable: paid_at quando soma >= amount.
        const remainingAfter = remainingBefore - data.amountInCents;
        const fullyPaid = remainingAfter <= 0;

        if (fullyPaid) {
          await tx
            .update(receivableTable)
            .set({
              paidAt: new Date(),
              paidMethod: data.method,
            })
            .where(eq(receivableTable.id, data.receivableId));
        }

        // 5) cash_adjustment se há sessão de caixa aberta. Sempre o
        //    valor DESTE pagamento (não acumulado).
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
              type: "other_in",
              amountInCents: data.amountInCents,
              reason: fullyPaid
                ? `Quitação fiado #${data.receivableId.slice(0, 8)}`
                : `Pagamento parcial fiado #${data.receivableId.slice(0, 8)}`,
              createdByUserId: userId,
            })
            .returning({ id: cashAdjustmentTable.id });
          cashAdjustmentId = adj?.id ?? null;
        }

        revalidatePath("/admin/financeiro/receber");
        revalidatePath("/admin/clientes");
        revalidatePath(`/admin/clientes/${receivable.customerId}`);
        revalidatePath("/admin");
        revalidatePath("/admin/pdv/caixa");

        logger.info("receivable.payment_recorded", {
          storeId: store.id,
          receivableId: data.receivableId,
          paymentId: paymentRow.id,
          amountInCents: data.amountInCents,
          method: data.method,
          remainingAfter,
          fullyPaid,
          cashAdjustmentId,
        });

        return {
          ok: true,
          paymentId: paymentRow.id,
          remainingInCents: remainingAfter,
          fullyPaid,
          cashAdjustmentId,
        };
      },
    );
  } catch (e) {
    logger.error("receivable.record_payment_failed", { err: e });
    const msg = e instanceof Error ? e.message : "Falha desconhecida.";
    return { ok: false, error: msg };
  }
}
