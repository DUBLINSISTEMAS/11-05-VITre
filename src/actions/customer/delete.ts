"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { customerTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  checkRateLimit,
  RateLimitError,
  rateLimits,
} from "@/lib/rate-limit";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

import { type DeleteCustomerInput, deleteCustomerSchema } from "./schema";

export type DeleteCustomerResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Deleta cliente (Fase 3 — ADR-0014).
 *
 * FK `order.customer_id` é ON DELETE SET NULL — pedidos históricos NÃO
 * são apagados, ficam órfãos de vínculo mas mantêm os snapshots
 * `customer_name`/`customer_phone`. Lojista perde só a "referência ativa"
 * pro cliente, não o histórico de compras.
 *
 * UI deve confirmar via AlertDialog antes de chamar.
 */
export async function deleteCustomer(
  input: DeleteCustomerInput,
): Promise<DeleteCustomerResult> {
  const requestHeaders = await headers();

  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user) {
    return { ok: false, error: "Sessão expirada. Faça login novamente." };
  }
  const userId = session.user.id;

  try {
    await checkRateLimit(rateLimits.mutation, userId);
  } catch (e) {
    if (e instanceof RateLimitError) return { ok: false, error: e.message };
    throw e;
  }

  const parsed = deleteCustomerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Identificador inválido." };
  }

  const store = await getCurrentStore(userId);
  if (!store) return { ok: false, error: "Loja não encontrada." };

  try {
    const deleted = await withTenant(store.id, userId, async (tx) => {
      const existing = await tx.query.customerTable.findFirst({
        where: and(
          eq(customerTable.id, parsed.data.customerId),
          eq(customerTable.storeId, store.id),
        ),
        columns: { id: true },
      });
      if (!existing) return false;

      await tx
        .delete(customerTable)
        .where(
          and(
            eq(customerTable.id, parsed.data.customerId),
            eq(customerTable.storeId, store.id),
          ),
        );

      return true;
    });

    if (!deleted) {
      return { ok: false, error: "Cliente não encontrado." };
    }

    revalidatePath("/admin/clientes");

    return { ok: true };
  } catch (e) {
    logger.error("customer.delete_failed", {
      err: e,
      storeId: store.id,
      customerId: parsed.data.customerId,
    });
    return { ok: false, error: "Falha ao excluir cliente." };
  }
}
