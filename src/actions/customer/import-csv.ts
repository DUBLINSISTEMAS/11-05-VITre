"use server";

/**
 * Bloco I.8 (2026-05-29) — import em lote de clientes via CSV.
 *
 * Modelo:
 *   - Cliente parseia o CSV (header + rows) e manda já como objetos.
 *   - Server valida CADA row contra `createCustomerSchema`, dedup intra-batch
 *     por phone E.164 (primeiro vence), dedup contra phones existentes
 *     na loja, insere em uma única transação.
 *   - Retorna { created, skippedDuplicates, errors } pro UI mostrar relatório.
 *
 * Limites de segurança:
 *   - max 500 rows por batch (UI mostra batches sequenciais se precisar).
 *   - rate-limit por user (rateLimits.mutation, 1 hit por chamada — não por row).
 */

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

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
import { and, eq, inArray } from "drizzle-orm";

import { createCustomerSchema } from "./schema";

const MAX_BATCH = 500;

const importInputSchema = z.object({
  rows: z
    .array(z.unknown())
    .min(1, "Nenhuma linha pra importar.")
    .max(MAX_BATCH, `Máximo de ${MAX_BATCH} linhas por importação.`),
});

export interface ImportRowError {
  rowIndex: number;
  rowName: string;
  message: string;
}

export type ImportCustomersResult =
  | {
      ok: true;
      created: number;
      skippedDuplicates: number;
      errors: ImportRowError[];
    }
  | { ok: false; error: string };

export async function importCustomersCSV(
  input: unknown,
): Promise<ImportCustomersResult> {
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

  const parsed = importInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error:
        parsed.error.issues[0]?.message ??
        "Linhas inválidas pro import.",
    };
  }

  const store = await getCurrentStore(userId);
  if (!store) return { ok: false, error: "Loja não encontrada." };

  const errors: ImportRowError[] = [];
  const validRows: Array<{
    rowIndex: number;
    data: z.infer<typeof createCustomerSchema>;
  }> = [];

  // Validação row a row + dedup intra-batch.
  const seenPhonesInBatch = new Set<string>();
  parsed.data.rows.forEach((raw, i) => {
    const result = createCustomerSchema.safeParse(raw);
    const rowName =
      (raw &&
        typeof raw === "object" &&
        "name" in raw &&
        typeof raw.name === "string"
        ? raw.name
        : "") || `linha ${i + 1}`;
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      const path = firstIssue?.path.join(".") ?? "";
      errors.push({
        rowIndex: i,
        rowName,
        message: path
          ? `${path}: ${firstIssue?.message ?? "inválido"}`
          : firstIssue?.message ?? "linha inválida",
      });
      return;
    }
    const data = result.data;
    if (seenPhonesInBatch.has(data.phone)) {
      errors.push({
        rowIndex: i,
        rowName,
        message: `Telefone ${data.phone} duplicado no arquivo.`,
      });
      return;
    }
    seenPhonesInBatch.add(data.phone);
    validRows.push({ rowIndex: i, data });
  });

  if (validRows.length === 0) {
    return { ok: true, created: 0, skippedDuplicates: 0, errors };
  }

  try {
    const phonesToCheck = validRows.map((r) => r.data.phone);

    const { created, skippedDuplicates } = await withTenant(
      store.id,
      userId,
      async (tx) => {
        // Dedup contra DB existente (UNIQUE constraint cobriria, mas
        // antecipar evita explosão de erros + permite contar skipped).
        const existingRows = await tx
          .select({ phone: customerTable.phone })
          .from(customerTable)
          .where(
            and(
              eq(customerTable.storeId, store.id),
              inArray(customerTable.phone, phonesToCheck),
            ),
          );
        const existing = new Set(existingRows.map((r) => r.phone));

        const fresh = validRows.filter((r) => !existing.has(r.data.phone));
        const skipped = validRows.length - fresh.length;

        if (fresh.length === 0) {
          return { created: 0, skippedDuplicates: skipped };
        }

        await tx.insert(customerTable).values(
          fresh.map((r) => ({
            storeId: store.id,
            name: r.data.name,
            phone: r.data.phone,
            type: r.data.type,
            document: r.data.document,
            email: r.data.email,
            addressStreet: r.data.addressStreet,
            addressNumber: r.data.addressNumber,
            addressComplement: r.data.addressComplement,
            addressNeighborhood: r.data.addressNeighborhood,
            addressCity: r.data.addressCity,
            addressState: r.data.addressState,
            addressZip: r.data.addressZip,
            notes: r.data.notes,
            groupId: r.data.groupId,
          })),
        );

        return { created: fresh.length, skippedDuplicates: skipped };
      },
    );

    revalidatePath("/admin/clientes");
    return { ok: true, created, skippedDuplicates, errors };
  } catch (e) {
    logger.error("customer.import_failed", { err: e, storeId: store.id });
    return {
      ok: false,
      error: "Falha ao importar. Tente novamente em alguns segundos.",
    };
  }
}
