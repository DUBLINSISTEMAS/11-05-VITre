"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { cashAdjustmentTable, cashSessionTable } from "@/db/schema";
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
  type RecordAdjustmentInput,
  recordAdjustmentSchema,
} from "./schema";

export type RecordAdjustmentResult =
  | { ok: true; adjustmentId: string }
  | {
      ok: false;
      error: string;
      errorCode?:
        | "VALIDATION"
        | "UNAUTHORIZED"
        | "RATE_LIMIT"
        | "NOT_FOUND"
        | "ALREADY_CLOSED";
      fieldErrors?: Record<string, string>;
    };

/**
 * Registra sangria (saída) ou reforço (entrada) numa sessão de caixa
 * aberta (ADR-0022 D3).
 *
 * Pré-condição: sessão pertence à loja + `closed_at IS NULL`. Sessão
 * fechada bloqueia INSERT (sessão imutável após Z).
 */
export async function recordAdjustment(
  input: RecordAdjustmentInput,
): Promise<RecordAdjustmentResult> {
  const session = await auth.api.getSession({ headers: await headers() });
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

  const parsed = recordAdjustmentSchema.safeParse(input);
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
      // 1. Validar sessão alvo: existe + da loja + aberta
      const [target] = await tx
        .select({
          id: cashSessionTable.id,
          closedAt: cashSessionTable.closedAt,
        })
        .from(cashSessionTable)
        .where(
          and(
            eq(cashSessionTable.id, data.sessionId),
            eq(cashSessionTable.storeId, store.id),
          ),
        )
        .limit(1);

      if (!target) {
        return { ok: false as const, errorCode: "NOT_FOUND" as const };
      }
      if (target.closedAt !== null) {
        return {
          ok: false as const,
          errorCode: "ALREADY_CLOSED" as const,
        };
      }

      const [row] = await tx
        .insert(cashAdjustmentTable)
        .values({
          cashSessionId: target.id,
          type: data.type,
          amountInCents: data.amountInCents,
          reason: data.reason,
          createdByUserId: userId,
        })
        .returning({ id: cashAdjustmentTable.id });

      if (!row) throw new Error("INSERT cash_adjustment não retornou id");
      return { ok: true as const, adjustmentId: row.id };
    });

    if (result.ok) {
      revalidatePath("/admin/pdv");
      revalidatePath("/admin/pdv/caixa");
      revalidatePath(`/admin/pdv/caixa/${data.sessionId}`);
      return { ok: true, adjustmentId: result.adjustmentId };
    }

    if (result.errorCode === "NOT_FOUND") {
      return {
        ok: false,
        error: "Caixa não encontrado.",
        errorCode: "NOT_FOUND",
      };
    }
    return {
      ok: false,
      error:
        "Esse caixa já foi fechado — não é possível registrar movimentação.",
      errorCode: "ALREADY_CLOSED",
    };
  } catch (e) {
    logger.error("cash_session.adjustment_failed", {
      err: e,
      storeId: store.id,
      sessionId: data.sessionId,
    });
    return { ok: false, error: "Falha ao registrar movimentação." };
  }
}
