"use server";

/**
 * markReceivablePaid — Sprint 2B; refeito como alias compat na Sprint 4B.
 *
 * Quita um fiado inteiro num único clique. Vira açúcar sintático sobre
 * `recordReceivablePayment` da Sprint 4B: calcula o saldo restante e
 * registra um pagamento que zera o fiado.
 *
 * Idempotente: se já está pago, retorna ok sem alterar nada.
 *
 * Mantido pra preservar contratos existentes da UI antiga. Novas UIs
 * (Sprint 4B `payment-dialog`) chamam `recordReceivablePayment` direto
 * pra controle de valor parcial e método.
 */
import { and, eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";

import { receivablePaymentTable, receivableTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

import { recordReceivablePayment } from "./record-payment";

const inputSchema = z.object({
  id: z.string().uuid(),
  /**
   * Método usado pra quitar. Default 'other' pra preservar contratos
   * antigos (chamadas legadas sem método). UIs novas devem passar
   * explícito.
   */
  method: z
    .enum(["cash", "pix", "debit", "credit", "other"])
    .default("other"),
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

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };

  // Releitura do receivable + saldo restante (idempotência: já pago = ok).
  const lookup = await withTenant(store.id, session.user.id, async (tx) => {
    const [row] = await tx
      .select({
        id: receivableTable.id,
        amountInCents: receivableTable.amountInCents,
        paidAt: receivableTable.paidAt,
      })
      .from(receivableTable)
      .where(
        and(
          eq(receivableTable.id, parsed.data.id),
          eq(receivableTable.storeId, store.id),
        ),
      )
      .limit(1);
    if (!row) return null;
    const [sumRow] = await tx
      .select({
        paid: sql<number>`coalesce(sum(${receivablePaymentTable.amountInCents}), 0)::int`,
      })
      .from(receivablePaymentTable)
      .where(eq(receivablePaymentTable.receivableId, parsed.data.id));
    return {
      ...row,
      paidSum: sumRow?.paid ?? 0,
    };
  });

  if (!lookup) return { ok: false, error: "Fiado não encontrado." };
  if (lookup.paidAt) {
    return {
      ok: true,
      paidAt: lookup.paidAt,
      cashAdjustmentId: null,
    };
  }

  const remaining = lookup.amountInCents - lookup.paidSum;
  if (remaining <= 0) {
    // Soma >= amount mas paid_at NULL (drift). Trata como já pago e
    // retorna ok — recordReceivablePayment vai reconciliar no próximo
    // ciclo se necessário.
    return {
      ok: true,
      paidAt: new Date(),
      cashAdjustmentId: null,
    };
  }

  // Delega pra action nova (que faz append + auto-quitação + cash).
  const result = await recordReceivablePayment({
    receivableId: parsed.data.id,
    amountInCents: remaining,
    method: parsed.data.method,
    notes: null,
  });

  if (!result.ok) {
    logger.warn("receivable.mark_paid_legacy_failed", { err: result.error });
    return { ok: false, error: result.error };
  }

  return {
    ok: true,
    paidAt: new Date(),
    cashAdjustmentId: result.cashAdjustmentId,
  };
}
