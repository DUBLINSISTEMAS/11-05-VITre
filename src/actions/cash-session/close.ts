"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { cashAdjustmentTable, cashSessionTable, orderTable } from "@/db/schema";
import { extractClientContext, recordAuditEvent } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  checkRateLimit,
  RateLimitError,
  rateLimits,
} from "@/lib/rate-limit";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

import { type CloseCashSessionInput, closeCashSessionSchema } from "./schema";

export type CloseCashSessionResult =
  | { ok: true }
  | {
      ok: false;
      error: string;
      errorCode?:
        | "VALIDATION"
        | "UNAUTHORIZED"
        | "RATE_LIMIT"
        | "NOT_FOUND"
        | "ALREADY_CLOSED"
        | "EXPECTED_MISMATCH";
      fieldErrors?: Record<string, string>;
    };

/**
 * Fecha uma sessão de caixa (ADR-0022).
 *
 * Servidor RECALCULA `closing_expected` a partir das vendas + adjustments
 * — não confia no valor enviado pelo cliente (UX exibe o esperado mas
 * o servidor recomputa pra evitar tampering ou drift de cache).
 *
 * ADR-0022 D2 = bloqueia reabrir → UPDATE só funciona se `closed_at IS NULL`.
 * Sessão já fechada retorna ALREADY_CLOSED.
 * ADR-0022 D5 = aceita qualquer diferença + obriga notes se ≠ 0 (Zod
 * `closeCashSessionSchema.superRefine` já valida client-side; aqui
 * revalidamos pós-recompute server-side).
 */
export async function closeCashSession(
  input: CloseCashSessionInput,
): Promise<CloseCashSessionResult> {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user) {
    return {
      ok: false,
      error: "Sessão expirada. Faça login novamente.",
      errorCode: "UNAUTHORIZED",
    };
  }
  const userId = session.user.id;

  try {
    await checkRateLimit(rateLimits.mutation, userId);
  } catch (e) {
    if (e instanceof RateLimitError) {
      return { ok: false, error: e.message, errorCode: "RATE_LIMIT" };
    }
    throw e;
  }

  const parsed = closeCashSessionSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (!fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return {
      ok: false,
      error: "Confira os campos destacados.",
      errorCode: "VALIDATION",
      fieldErrors,
    };
  }
  const data = parsed.data;

  const store = await getCurrentStore(userId);
  if (!store) return { ok: false, error: "Loja não encontrada." };

  try {
    const result = await withTenant(store.id, userId, async (tx) => {
      // B1 auditoria 2026-05-19 — race close-vs-venda:
      //
      // Antes: SELECT sem lock + UPDATE com `closed_at IS NULL` no WHERE.
      // Janela: entre o snapshot dos aggregates e o UPDATE, uma venda
      // concorrente (createBalcaoSale auto-attach na sessão aberta) podia
      // anexar um movimento que NÃO entrava no `closingExpectedInCents`.
      // O UPDATE ainda ia rodar (sessão ainda IS NULL), mas o snapshot
      // ficava stale → relatório errado.
      //
      // Fix em 2 camadas:
      //  1) pg_advisory_xact_lock(hashtext('cash-session-close-' || storeId))
      //     — serializa concorrência dentro da MESMA loja.
      //  2) SELECT ... FOR UPDATE na cashSession — vendas concorrentes que
      //     leiam essa sessão via `SELECT ... WHERE closed_at IS NULL`
      //     ficam bloqueadas até o COMMIT do close (auto-attach espera).
      //
      // Custo: vendas concorrentes na MESMA loja durante o close serializam.
      // Aceitável — close é raro e rápido (segundos).
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${"cash-session-close-" + store.id}))`,
      );

      // 1. Buscar sessão alvo (com FOR UPDATE pra bloquear race)
      const [target] = await tx
        .select({
          id: cashSessionTable.id,
          storeId: cashSessionTable.storeId,
          openingAmountInCents: cashSessionTable.openingAmountInCents,
          closedAt: cashSessionTable.closedAt,
        })
        .from(cashSessionTable)
        .where(
          and(
            eq(cashSessionTable.id, data.sessionId),
            eq(cashSessionTable.storeId, store.id),
          ),
        )
        .limit(1)
        .for("update");

      if (!target) {
        return { ok: false as const, errorCode: "NOT_FOUND" as const };
      }
      if (target.closedAt !== null) {
        return { ok: false as const, errorCode: "ALREADY_CLOSED" as const };
      }

      // 2. Recomputar closing_expected server-side:
      //    expected = opening
      //             + vendas_dinheiro
      //             + (reinforcement + other_in)            ← entradas avulsas
      //             - (sangria + pay_supplier + pay_bill + other_out)  ← saídas
      //
      // Vendas em outros métodos (pix/cartão) NÃO entram — caixa físico
      // é só dinheiro. Cartão/PIX vão pra conta da loja, não pra gaveta.
      //
      // Onda 1.2 (2026-05-21): UMA query agregada cobre os 6 tipos de
      // adjustment (antes só 2 — bug "quebra de caixa fantasma").
      const [salesAgg] = await tx
        .select({
          total: sql<string | null>`SUM(${orderTable.totalInCents})`,
        })
        .from(orderTable)
        .where(
          and(
            eq(orderTable.cashSessionId, target.id),
            eq(orderTable.paymentMethod, "cash"),
            eq(orderTable.channel, "balcao"),
          ),
        );
      const cashSalesInCents = Number(salesAgg?.total ?? 0);

      const [adjAgg] = await tx
        .select({
          sangria: sql<string>`COALESCE(SUM(CASE WHEN ${cashAdjustmentTable.type} = 'sangria' THEN ${cashAdjustmentTable.amountInCents} ELSE 0 END), 0)`,
          reinforcement: sql<string>`COALESCE(SUM(CASE WHEN ${cashAdjustmentTable.type} = 'reinforcement' THEN ${cashAdjustmentTable.amountInCents} ELSE 0 END), 0)`,
          paySupplier: sql<string>`COALESCE(SUM(CASE WHEN ${cashAdjustmentTable.type} = 'pay_supplier' THEN ${cashAdjustmentTable.amountInCents} ELSE 0 END), 0)`,
          payBill: sql<string>`COALESCE(SUM(CASE WHEN ${cashAdjustmentTable.type} = 'pay_bill' THEN ${cashAdjustmentTable.amountInCents} ELSE 0 END), 0)`,
          otherIn: sql<string>`COALESCE(SUM(CASE WHEN ${cashAdjustmentTable.type} = 'other_in' THEN ${cashAdjustmentTable.amountInCents} ELSE 0 END), 0)`,
          otherOut: sql<string>`COALESCE(SUM(CASE WHEN ${cashAdjustmentTable.type} = 'other_out' THEN ${cashAdjustmentTable.amountInCents} ELSE 0 END), 0)`,
        })
        .from(cashAdjustmentTable)
        .where(eq(cashAdjustmentTable.cashSessionId, target.id));

      const sangriaInCents = Number(adjAgg?.sangria ?? 0);
      const reinforcementInCents = Number(adjAgg?.reinforcement ?? 0);
      const paySupplierInCents = Number(adjAgg?.paySupplier ?? 0);
      const payBillInCents = Number(adjAgg?.payBill ?? 0);
      const otherInInCents = Number(adjAgg?.otherIn ?? 0);
      const otherOutInCents = Number(adjAgg?.otherOut ?? 0);

      const inflowsInCents = reinforcementInCents + otherInInCents;
      const outflowsInCents =
        sangriaInCents + paySupplierInCents + payBillInCents + otherOutInCents;

      const closingExpectedInCents =
        target.openingAmountInCents +
        cashSalesInCents +
        inflowsInCents -
        outflowsInCents;

      // 3. Validar: se diferença ≠ 0 exige notes (defesa em profundidade
      //    além do Zod, porque expected é recomputado server-side e pode
      //    diferir do enviado pelo client)
      const hasDelta = data.closingActualInCents !== closingExpectedInCents;
      if (hasDelta && data.closingNotes === null) {
        return {
          ok: false as const,
          errorCode: "VALIDATION" as const,
          fieldErrors: {
            closingNotes:
              "Diferença detectada — descreva o motivo (sobra, falta, sangria não registrada…).",
          },
        };
      }

      // 4. UPDATE
      const updated = await tx
        .update(cashSessionTable)
        .set({
          closedByUserId: userId,
          closedAt: new Date(),
          closingExpectedInCents,
          closingActualInCents: data.closingActualInCents,
          closingNotes: data.closingNotes,
        })
        .where(
          and(
            eq(cashSessionTable.id, target.id),
            isNull(cashSessionTable.closedAt), // defense-in-depth contra race
          ),
        )
        .returning({ id: cashSessionTable.id });

      if (updated.length === 0) {
        return { ok: false as const, errorCode: "ALREADY_CLOSED" as const };
      }

      // Sprint 6A — auditoria de fechamento (delta vs esperado é
      // forense crítica: divergência alta = fraude ou erro grave).
      const clientCtx = extractClientContext(requestHeaders);
      await recordAuditEvent(tx, {
        storeId: store.id,
        actorUserId: userId,
        action: "cash_session.closed",
        entityType: "cash_session",
        entityId: target.id,
        payload: {
          closingExpectedInCents,
          closingActualInCents: data.closingActualInCents,
          deltaInCents:
            data.closingActualInCents - closingExpectedInCents,
          closingNotes: data.closingNotes,
        },
        ip: clientCtx.ip,
        userAgent: clientCtx.userAgent,
      });

      return { ok: true as const };
    });

    if (result.ok) {
      revalidatePath("/admin/pdv");
      revalidatePath("/admin/pdv/caixa");
      revalidatePath(`/admin/pdv/caixa/${data.sessionId}`);
      return { ok: true };
    }

    if (result.errorCode === "NOT_FOUND") {
      return { ok: false, error: "Caixa não encontrado.", errorCode: "NOT_FOUND" };
    }
    if (result.errorCode === "ALREADY_CLOSED") {
      return {
        ok: false,
        error: "Esse caixa já foi fechado.",
        errorCode: "ALREADY_CLOSED",
      };
    }
    if (result.errorCode === "VALIDATION") {
      return {
        ok: false,
        error: "Confira os campos destacados.",
        errorCode: "VALIDATION",
        fieldErrors: result.fieldErrors,
      };
    }
    return { ok: false, error: "Falha ao fechar caixa." };
  } catch (e) {
    logger.error("cash_session.close_failed", {
      err: e,
      storeId: store.id,
      sessionId: data.sessionId,
    });
    return { ok: false, error: "Falha ao fechar caixa." };
  }
}
