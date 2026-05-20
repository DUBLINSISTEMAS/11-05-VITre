"use server";

/**
 * Server actions do domínio supplier (Sprint 2C).
 *
 * Padrões CLAUDE.md:
 * - withTenant sempre (RLS-first; policy supplier_tenant_isolation aplicada no SQL 46)
 * - Zod boundaries (upsertSupplierSchema, deleteSupplierSchema)
 * - Rate limit em mutations
 * - revalidatePath /admin/fornecedores
 *
 * Restrições:
 * - DELETE bloqueia se houver purchases referenciando (FK ON DELETE NO ACTION,
 *   conforme schema). UI deve avisar lojista.
 * - document unique por loja (índice supplier_store_document_unique).
 */
import { and, count, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { purchaseTable, supplierTable } from "@/db/schema";
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
  deleteSupplierSchema,
  type UpsertSupplierInput,
  upsertSupplierSchema,
} from "./schema";
import type { Supplier, SupplierListRow } from "./types";

async function getSessionAndStore() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  const store = await getCurrentStore(session.user.id);
  if (!store) return null;
  return { session, store };
}

/**
 * Lista fornecedores da loja com count de compras referenciando.
 * Read-only, sem rate limit (admin autenticado + RLS).
 */
export async function loadSuppliers(): Promise<SupplierListRow[]> {
  const ctx = await getSessionAndStore();
  if (!ctx) return [];

  return withTenant(ctx.store.id, ctx.session.user.id, async (tx) => {
    // Count de purchases por supplier (JOIN). Subquery em vez de COUNT(*) FILTER
    // pra manter performance quando catálogo cresce.
    const suppliers = await tx
      .select({
        id: supplierTable.id,
        name: supplierTable.name,
        document: supplierTable.document,
        phone: supplierTable.phone,
        email: supplierTable.email,
        addressCity: supplierTable.addressCity,
        addressState: supplierTable.addressState,
        isActive: supplierTable.isActive,
        createdAt: supplierTable.createdAt,
        updatedAt: supplierTable.updatedAt,
      })
      .from(supplierTable)
      .where(eq(supplierTable.storeId, ctx.store.id))
      .orderBy(supplierTable.name);

    if (suppliers.length === 0) return [];

    // Map id → count via 1 query agregada (mais barato que N+1).
    const counts = await tx
      .select({
        supplierId: purchaseTable.supplierId,
        count: count(),
      })
      .from(purchaseTable)
      .where(eq(purchaseTable.storeId, ctx.store.id))
      .groupBy(purchaseTable.supplierId);
    const countById = new Map(counts.map((c) => [c.supplierId, c.count]));

    return suppliers.map((s) => ({
      id: s.id,
      name: s.name,
      document: s.document,
      phone: s.phone,
      email: s.email,
      city: s.addressCity,
      state: s.addressState,
      isActive: s.isActive,
      purchaseCount: countById.get(s.id) ?? 0,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));
  });
}

/** Detalhe completo de 1 fornecedor pra edit dialog. */
export async function loadSupplierDetail(
  supplierId: string,
): Promise<Supplier | null> {
  const ctx = await getSessionAndStore();
  if (!ctx) return null;
  return withTenant(ctx.store.id, ctx.session.user.id, async (tx) => {
    const [row] = await tx
      .select()
      .from(supplierTable)
      .where(
        and(
          eq(supplierTable.id, supplierId),
          eq(supplierTable.storeId, ctx.store.id),
        ),
      )
      .limit(1);
    return row ?? null;
  });
}

export type UpsertSupplierResult =
  | { ok: true; id: string; name: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function upsertSupplier(
  input: UpsertSupplierInput,
): Promise<UpsertSupplierResult> {
  const ctx = await getSessionAndStore();
  if (!ctx) return { ok: false, error: "Sessão expirada." };

  try {
    await checkRateLimit(rateLimits.mutation, ctx.session.user.id);
  } catch (err) {
    if (err instanceof RateLimitError) {
      return { ok: false, error: err.message };
    }
    throw err;
  }

  const parsed = upsertSupplierSchema.safeParse(input);
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
    return await withTenant<UpsertSupplierResult>(
      ctx.store.id,
      ctx.session.user.id,
      async (tx) => {
        // Conflito de document (unique parcial). Permite o próprio id.
        if (data.document) {
          const conflict = await tx
            .select({ id: supplierTable.id })
            .from(supplierTable)
            .where(
              and(
                eq(supplierTable.storeId, ctx.store.id),
                eq(supplierTable.document, data.document),
                data.id ? ne(supplierTable.id, data.id) : undefined,
              ),
            )
            .limit(1);
          if (conflict.length > 0) {
            return {
              ok: false,
              error: "Já existe um fornecedor com este documento.",
              fieldErrors: { document: "Documento já cadastrado." },
            };
          }
        }

        if (data.id) {
          const updated = await tx
            .update(supplierTable)
            .set({
              name: data.name,
              document: data.document,
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
              isActive: data.isActive,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(supplierTable.id, data.id),
                eq(supplierTable.storeId, ctx.store.id),
              ),
            )
            .returning({ id: supplierTable.id, name: supplierTable.name });
          const row = updated[0];
          if (!row) return { ok: false, error: "Fornecedor não encontrado." };
          revalidatePath("/admin/fornecedores");
          return { ok: true, id: row.id, name: row.name };
        }

        const inserted = await tx
          .insert(supplierTable)
          .values({
            storeId: ctx.store.id,
            name: data.name,
            document: data.document,
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
            isActive: data.isActive,
          })
          .returning({ id: supplierTable.id, name: supplierTable.name });
        const row = inserted[0];
        if (!row) return { ok: false, error: "Falha ao criar fornecedor." };
        revalidatePath("/admin/fornecedores");
        return { ok: true, id: row.id, name: row.name };
      },
    );
  } catch (e) {
    logger.error("supplier.upsert_failed", { err: e });
    return { ok: false, error: "Falha ao salvar fornecedor." };
  }
}

export async function deleteSupplier(
  input: { id: string },
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getSessionAndStore();
  if (!ctx) return { ok: false, error: "Sessão expirada." };

  try {
    await checkRateLimit(rateLimits.mutation, ctx.session.user.id);
  } catch (err) {
    if (err instanceof RateLimitError) {
      return { ok: false, error: err.message };
    }
    throw err;
  }

  const parsed = deleteSupplierSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };

  try {
    return await withTenant<{ ok: boolean; error?: string }>(
      ctx.store.id,
      ctx.session.user.id,
      async (tx) => {
        // Detecta purchases referenciando — schema usa NO ACTION default,
        // então DELETE explodiria. Avisamos antes.
        const purchases = await tx
          .select({ id: purchaseTable.id })
          .from(purchaseTable)
          .where(
            and(
              eq(purchaseTable.storeId, ctx.store.id),
              eq(purchaseTable.supplierId, parsed.data.id),
            ),
          )
          .limit(1);
        if (purchases.length > 0) {
          return {
            ok: false,
            error:
              "Este fornecedor tem compras cadastradas. Desative em vez de excluir (toggle 'Ativo' no editor).",
          };
        }

        await tx
          .delete(supplierTable)
          .where(
            and(
              eq(supplierTable.id, parsed.data.id),
              eq(supplierTable.storeId, ctx.store.id),
            ),
          );
        revalidatePath("/admin/fornecedores");
        return { ok: true };
      },
    );
  } catch (e) {
    logger.error("supplier.delete_failed", { err: e });
    return { ok: false, error: "Falha ao deletar fornecedor." };
  }
}
