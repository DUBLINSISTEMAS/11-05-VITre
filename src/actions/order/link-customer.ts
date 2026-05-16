"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { customerTable, orderTable } from "@/db/schema";
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

/**
 * Vincula um cliente cadastrado a um pedido existente (ADR-0014 follow-up).
 *
 * Operações cobertas:
 *   - `linkOrderToCustomer({ orderId, customerId })` — set FK
 *   - `linkOrderToCustomer({ orderId, customerId: null })` — unset (desvincular)
 *   - `createAndLinkCustomerFromOrder(orderId)` — cria customer a partir
 *     do snapshot do pedido (name + phone) e vincula
 *
 * RLS via `withTenant`: order e customer precisam pertencer à mesma loja.
 * Snapshots `customer_name`/`customer_phone` NÃO são tocados — eles são
 * histórico imutável da época da compra.
 */

const linkSchema = z.object({
  orderId: z.string().uuid(),
  customerId: z.string().uuid().nullable(),
});

export type LinkOrderToCustomerResult =
  | { ok: true }
  | { ok: false; error: string };

export async function linkOrderToCustomer(input: {
  orderId: string;
  customerId: string | null;
}): Promise<LinkOrderToCustomerResult> {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user) {
    return { ok: false, error: "Sessão expirada." };
  }
  const userId = session.user.id;

  try {
    await checkRateLimit(rateLimits.mutation, userId);
  } catch (e) {
    if (e instanceof RateLimitError) return { ok: false, error: e.message };
    throw e;
  }

  const parsed = linkSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Identificador inválido." };
  }

  const store = await getCurrentStore(userId);
  if (!store) return { ok: false, error: "Loja não encontrada." };

  try {
    const updated = await withTenant(store.id, userId, async (tx) => {
      // Garante que o pedido existe e é da loja
      const order = await tx.query.orderTable.findFirst({
        where: and(
          eq(orderTable.id, parsed.data.orderId),
          eq(orderTable.storeId, store.id),
        ),
        columns: { id: true },
      });
      if (!order) return false;

      // Se vai linkar, garante que o customer existe e é da loja
      if (parsed.data.customerId !== null) {
        const customer = await tx.query.customerTable.findFirst({
          where: and(
            eq(customerTable.id, parsed.data.customerId),
            eq(customerTable.storeId, store.id),
          ),
          columns: { id: true },
        });
        if (!customer) return false;
      }

      await tx
        .update(orderTable)
        .set({ customerId: parsed.data.customerId })
        .where(
          and(
            eq(orderTable.id, parsed.data.orderId),
            eq(orderTable.storeId, store.id),
          ),
        );
      return true;
    });

    if (!updated) {
      return { ok: false, error: "Pedido ou cliente não encontrado." };
    }

    revalidatePath("/admin/pedidos");
    return { ok: true };
  } catch (e) {
    logger.error("order.link_customer_failed", {
      err: e,
      orderId: parsed.data.orderId,
      customerId: parsed.data.customerId,
    });
    return { ok: false, error: "Falha ao vincular cliente ao pedido." };
  }
}

// ---------------------------------------------------------------------
// createAndLinkCustomerFromOrder — cria customer com snapshot + linka
// ---------------------------------------------------------------------

const createFromOrderSchema = z.object({
  orderId: z.string().uuid(),
});

export type CreateAndLinkResult =
  | { ok: true; customerId: string }
  | { ok: false; error: string };

export async function createAndLinkCustomerFromOrder(input: {
  orderId: string;
}): Promise<CreateAndLinkResult> {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user) {
    return { ok: false, error: "Sessão expirada." };
  }
  const userId = session.user.id;

  try {
    await checkRateLimit(rateLimits.mutation, userId);
  } catch (e) {
    if (e instanceof RateLimitError) return { ok: false, error: e.message };
    throw e;
  }

  const parsed = createFromOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Identificador inválido." };
  }

  const store = await getCurrentStore(userId);
  if (!store) return { ok: false, error: "Loja não encontrada." };

  try {
    const result = await withTenant(store.id, userId, async (tx) => {
      const order = await tx.query.orderTable.findFirst({
        where: and(
          eq(orderTable.id, parsed.data.orderId),
          eq(orderTable.storeId, store.id),
        ),
        columns: {
          id: true,
          customerName: true,
          customerPhone: true,
          customerId: true,
        },
      });
      if (!order) return { ok: false, error: "Pedido não encontrado." } as const;

      if (order.customerId !== null) {
        return {
          ok: false,
          error: "Este pedido já está vinculado a um cliente.",
        } as const;
      }

      // Se já existe customer com esse phone na loja, só linka (não cria duplicata)
      const existing = await tx.query.customerTable.findFirst({
        where: and(
          eq(customerTable.storeId, store.id),
          eq(customerTable.phone, order.customerPhone),
        ),
        columns: { id: true },
      });

      let customerId: string;
      if (existing) {
        customerId = existing.id;
      } else {
        const [inserted] = await tx
          .insert(customerTable)
          .values({
            storeId: store.id,
            name: order.customerName,
            phone: order.customerPhone,
          })
          .returning({ id: customerTable.id });
        if (!inserted) {
          return { ok: false, error: "Falha ao criar cliente." } as const;
        }
        customerId = inserted.id;
      }

      await tx
        .update(orderTable)
        .set({ customerId })
        .where(
          and(
            eq(orderTable.id, parsed.data.orderId),
            eq(orderTable.storeId, store.id),
          ),
        );

      return { ok: true, customerId } as const;
    });

    if (result.ok) {
      revalidatePath("/admin/pedidos");
      revalidatePath("/admin/clientes");
    }
    return result;
  } catch (e) {
    if (isUniqueViolation(e)) {
      const constraint = getConstraintName(e);
      if (constraint === "customer_store_phone_unique") {
        return {
          ok: false,
          error:
            "Já existe um cliente com este telefone — recarregue e tente vincular.",
        };
      }
    }
    logger.error("order.create_and_link_customer_failed", {
      err: e,
      orderId: parsed.data.orderId,
    });
    return { ok: false, error: "Falha ao criar/vincular cliente." };
  }
}
