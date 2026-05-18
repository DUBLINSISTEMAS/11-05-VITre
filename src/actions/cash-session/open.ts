"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { cashSessionTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import { isUniqueViolation } from "@/lib/db-errors";
import { logger } from "@/lib/logger";
import {
  checkRateLimit,
  RateLimitError,
  rateLimits,
} from "@/lib/rate-limit";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

import { type OpenCashSessionInput, openCashSessionSchema } from "./schema";

export type OpenCashSessionResult =
  | { ok: true; sessionId: string }
  | {
      ok: false;
      error: string;
      errorCode?: "ALREADY_OPEN" | "VALIDATION" | "UNAUTHORIZED" | "RATE_LIMIT";
      fieldErrors?: Record<string, string>;
    };

/**
 * Abre uma sessão de caixa (ADR-0022).
 *
 * Pré-condição: nenhuma sessão `closed_at IS NULL` na loja (UNIQUE PARTIAL
 * em SQL 29 garante; aqui retornamos ALREADY_OPEN amigável em vez de
 * stack trace).
 *
 * Sessão criada via INSERT — UNIQUE PARTIAL `cash_session_open_per_store`
 * vira erro 23505 se já houver sessão aberta. Tratamos esse caso explícito.
 */
export async function openCashSession(
  input: OpenCashSessionInput,
): Promise<OpenCashSessionResult> {
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

  const parsed = openCashSessionSchema.safeParse(input);
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
    // Defesa em profundidade — checa ANTES do INSERT pra dar erro
    // amigável em vez de depender do unique violation.
    const sessionId = await withTenant(store.id, userId, async (tx) => {
      const [existing] = await tx
        .select({ id: cashSessionTable.id })
        .from(cashSessionTable)
        .where(
          and(
            eq(cashSessionTable.storeId, store.id),
            sql`${cashSessionTable.closedAt} IS NULL`,
          ),
        )
        .limit(1);
      if (existing) {
        throw new AlreadyOpenError();
      }

      const [row] = await tx
        .insert(cashSessionTable)
        .values({
          storeId: store.id,
          openedByUserId: userId,
          openingAmountInCents: data.openingAmountInCents,
        })
        .returning({ id: cashSessionTable.id });

      if (!row) throw new Error("INSERT cash_session não retornou id");
      return row.id;
    });

    revalidatePath("/admin/pdv");
    revalidatePath("/admin/pdv/caixa");

    return { ok: true, sessionId };
  } catch (e) {
    if (e instanceof AlreadyOpenError) {
      return {
        ok: false,
        error: "Já existe um caixa aberto. Feche o atual antes de abrir outro.",
        errorCode: "ALREADY_OPEN",
      };
    }
    if (isUniqueViolation(e)) {
      // Race condition: outro request abriu sessão entre nosso check e
      // INSERT. UX igual ao AlreadyOpenError.
      return {
        ok: false,
        error: "Já existe um caixa aberto. Feche o atual antes de abrir outro.",
        errorCode: "ALREADY_OPEN",
      };
    }
    logger.error("cash_session.open_failed", { err: e, storeId: store.id });
    return { ok: false, error: "Falha ao abrir caixa." };
  }
}

class AlreadyOpenError extends Error {
  constructor() {
    super("ALREADY_OPEN");
  }
}
