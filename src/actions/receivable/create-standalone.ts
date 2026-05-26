"use server";

/**
 * createStandaloneReceivable — Sprint 4D.
 *
 * Lança um fiado SEM venda associada (orderId = NULL no schema).
 *
 * Casos de uso:
 *   - Empréstimo em dinheiro pro cliente ("emprestei R$ 50, devolve mês
 *     que vem")
 *   - Adiantamento de venda futura
 *   - Débito histórico que não veio de venda Mangos Pay (sistema antigo,
 *     caderneta de papel)
 *
 * Validação: customer obrigatório (RLS-scoped). dueDate opcional.
 * notes opcional (500 chars max — espelha receivable.notes).
 *
 * Não cria order. Não toca em estoque. Não interfere em cash_session.
 * Apenas append na tabela receivable.
 */
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { customerTable, receivableTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { safeUserMessage } from "@/lib/safe-error";
import {
  checkRateLimit,
  RateLimitError,
  rateLimits,
} from "@/lib/rate-limit";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

const inputSchema = z.object({
  customerId: z.string().uuid(),
  amountInCents: z
    .number()
    .int()
    .positive("Valor deve ser maior que zero")
    .max(99_999_999, "Valor acima do máximo"),
  /** Data de vencimento opcional (ISO ou Date). NULL = sem vencimento. */
  dueDate: z
    .preprocess(
      (v) => {
        if (v === null || v === undefined || v === "") return null;
        if (v instanceof Date) return v;
        if (typeof v === "string") {
          const d = new Date(v);
          return Number.isNaN(d.getTime()) ? null : d;
        }
        return v;
      },
      z.date().nullable(),
    )
    .default(null),
  notes: z
    .preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? null : v),
      z.string().trim().max(500).nullable(),
    )
    .default(null),
});
export type CreateStandaloneReceivableInput = z.input<typeof inputSchema>;

export type CreateStandaloneReceivableResult =
  | { ok: true; receivableId: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function createStandaloneReceivable(
  input: CreateStandaloneReceivableInput,
): Promise<CreateStandaloneReceivableResult> {
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

  try {
    return await withTenant<CreateStandaloneReceivableResult>(
      store.id,
      userId,
      async (tx) => {
        // Sanity check: customer pertence à loja (RLS já bloqueia, mas
        // devolvemos erro controlado em vez de NULL-deref no INSERT).
        const [customer] = await tx
          .select({ id: customerTable.id })
          .from(customerTable)
          .where(
            and(
              eq(customerTable.id, parsed.data.customerId),
              eq(customerTable.storeId, store.id),
            ),
          )
          .limit(1);
        if (!customer) {
          return { ok: false, error: "Cliente não encontrado." };
        }

        const [row] = await tx
          .insert(receivableTable)
          .values({
            storeId: store.id,
            customerId: parsed.data.customerId,
            orderId: null,
            amountInCents: parsed.data.amountInCents,
            dueDate: parsed.data.dueDate,
            paidAt: null,
            notes: parsed.data.notes,
            createdByUserId: userId,
          })
          .returning({ id: receivableTable.id });

        if (!row) throw new Error("Falha ao gravar fiado.");

        revalidatePath("/admin/financeiro/receber");
        revalidatePath("/admin/clientes");
        revalidatePath(`/admin/clientes/${parsed.data.customerId}`);
        revalidatePath("/admin");

        logger.info("receivable.standalone_created", {
          storeId: store.id,
          receivableId: row.id,
          customerId: parsed.data.customerId,
          amountInCents: parsed.data.amountInCents,
        });

        return { ok: true, receivableId: row.id };
      },
    );
  } catch (e) {
    logger.error("receivable.standalone_failed", { err: e });
    return {
      ok: false,
      error: safeUserMessage(e, "Falha ao gravar fiado. Tente novamente."),
    };
  }
}
