"use server";

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

import { type CreateCustomerInput, createCustomerSchema } from "./schema";

export type CreateCustomerResult =
  | { ok: true; customer: { id: string; name: string; phone: string } }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Cria cliente no admin (Fase 3 — ADR-0014).
 *
 * Dedup por telefone DENTRO da loja via UNIQUE constraint
 * `customer_store_phone_unique`. Conflict vira fieldError no campo phone
 * (mensagem PT-BR clara, sem jargão de DB).
 */
export async function createCustomer(
  input: CreateCustomerInput,
): Promise<CreateCustomerResult> {
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

  const parsed = createCustomerSchema.safeParse(input);
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
    const inserted = await withTenant(store.id, userId, async (tx) => {
      const [row] = await tx
        .insert(customerTable)
        .values({
          storeId: store.id,
          name: data.name,
          phone: data.phone,
          type: data.type,
          document: data.document,
          email: data.email,
          addressStreet: data.addressStreet,
          addressNumber: data.addressNumber,
          addressComplement: data.addressComplement,
          addressNeighborhood: data.addressNeighborhood,
          addressCity: data.addressCity,
          addressState: data.addressState,
          addressZip: data.addressZip,
          notes: data.notes,
        })
        .returning({
          id: customerTable.id,
          name: customerTable.name,
          phone: customerTable.phone,
        });
      return row;
    });

    if (!inserted) {
      return { ok: false, error: "Falha ao cadastrar cliente." };
    }

    revalidatePath("/admin/clientes");

    return { ok: true, customer: inserted };
  } catch (e) {
    if (isUniqueViolation(e)) {
      const constraint = getConstraintName(e);
      if (constraint === "customer_store_phone_unique") {
        return {
          ok: false,
          error: "Já existe um cliente cadastrado com este telefone.",
          fieldErrors: { phone: "Telefone já cadastrado." },
        };
      }
      if (constraint === "customer_store_document_unique") {
        return {
          ok: false,
          error: "Já existe um cliente cadastrado com este documento.",
          fieldErrors: { document: "Documento já cadastrado." },
        };
      }
    }
    logger.error("customer.create_failed", { err: e, storeId: store.id });
    return { ok: false, error: "Falha ao cadastrar cliente." };
  }
}
