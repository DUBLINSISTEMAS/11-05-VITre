"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { customerTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getConstraintName, isUniqueViolation } from "@/lib/db-errors";
import { logger } from "@/lib/logger";
import {
  checkRateLimit,
  RateLimitError,
  rateLimits,
} from "@/lib/rate-limit";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

import { type UpdateCustomerInput, updateCustomerSchema } from "./schema";

export type UpdateCustomerResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Atualiza cliente existente (Fase 3 — ADR-0014).
 *
 * Mesmo padrão de createCustomer: dedup por phone na mesma loja vira
 * fieldError. WHERE duplo (id + storeId) é defesa em profundidade vs RLS.
 */
export async function updateCustomer(
  input: UpdateCustomerInput,
): Promise<UpdateCustomerResult> {
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

  const parsed = updateCustomerSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (!fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return {
      ok: false,
      error: "Confira os campos destacados.",
      fieldErrors,
    };
  }
  const data = parsed.data;

  const store = await getCurrentStore(userId);
  if (!store) return { ok: false, error: "Loja não encontrada." };

  try {
    const updated = await withTenant(store.id, userId, async (tx) => {
      const existing = await tx.query.customerTable.findFirst({
        where: and(
          eq(customerTable.id, data.id),
          eq(customerTable.storeId, store.id),
        ),
        columns: { id: true },
      });
      if (!existing) return null;

      await tx
        .update(customerTable)
        .set({
          name: data.name,
          phone: data.phone,
          email: data.email,
          addressStreet: data.addressStreet,
          addressNumber: data.addressNumber,
          addressComplement: data.addressComplement,
          addressNeighborhood: data.addressNeighborhood,
          addressCity: data.addressCity,
          addressState: data.addressState,
          addressZip: data.addressZip,
          notes: data.notes,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(customerTable.id, data.id),
            eq(customerTable.storeId, store.id),
          ),
        );

      return existing;
    });

    if (!updated) {
      return { ok: false, error: "Cliente não encontrado." };
    }

    revalidatePath("/admin/clientes");
    revalidatePath(`/admin/clientes/${data.id}`);

    return { ok: true };
  } catch (e) {
    if (isUniqueViolation(e)) {
      const constraint = getConstraintName(e);
      if (constraint === "customer_store_phone_unique") {
        return {
          ok: false,
          error: "Já existe outro cliente com este telefone.",
          fieldErrors: { phone: "Telefone em uso por outro cliente." },
        };
      }
    }
    logger.error("customer.update_failed", {
      err: e,
      storeId: store.id,
      customerId: data.id,
    });
    return { ok: false, error: "Falha ao atualizar cliente." };
  }
}
