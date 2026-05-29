"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { quoteSheetTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getConstraintName, isUniqueViolation } from "@/lib/db-errors";
import { logger } from "@/lib/logger";
import {
  checkRateLimit,
  RateLimitError,
  rateLimits,
} from "@/lib/rate-limit";
import { generateShortCode } from "@/lib/shortcode";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

import {
  type CreateQuoteSheetInput,
  createQuoteSheetSchema,
  dateStringToUtcNoon,
} from "./schema";

export type CreateQuoteSheetResult =
  | { ok: true; quoteSheet: { id: string; shortCode: string } }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

const MAX_SHORTCODE_RETRIES = 5;

/**
 * Cria uma ficha de orçamento de balcão. Diferente de salvar orçamento
 * via PDV (`saveAsQuote` em `orderTable`): aqui é texto livre, sem itens
 * do catálogo, sem desconto de estoque.
 *
 * Restante é DERIVADO no server (total − entrada) — schema não aceita
 * override pra evitar inconsistência. Cortesia/desconto: lojista ajusta
 * o total.
 */
export async function createQuoteSheet(
  input: CreateQuoteSheetInput,
): Promise<CreateQuoteSheetResult> {
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

  const parsed = createQuoteSheetSchema.safeParse(input);
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

  const remainderInCents = data.totalInCents - data.downPaymentInCents;

  try {
    const inserted = await withTenant(store.id, userId, async (tx) => {
      let lastError: unknown = null;
      for (let attempt = 0; attempt < MAX_SHORTCODE_RETRIES; attempt++) {
        const shortCode = generateShortCode();
        try {
          const [row] = await tx
            .insert(quoteSheetTable)
            .values({
              storeId: store.id,
              shortCode,
              customerName: data.customerName,
              customerPhone: data.customerPhone,
              customerDocument: data.customerDocument,
              customerCity: data.customerCity,
              receivedAt: dateStringToUtcNoon(data.receivedAt),
              deliveryAt: dateStringToUtcNoon(data.deliveryAt),
              description: data.description,
              totalInCents: data.totalInCents,
              downPaymentInCents: data.downPaymentInCents,
              downPaymentNote: data.downPaymentNote,
              remainderInCents,
              noticeText: data.noticeText,
              createdBy: userId,
            })
            .returning({
              id: quoteSheetTable.id,
              shortCode: quoteSheetTable.shortCode,
            });
          return row;
        } catch (e) {
          if (
            isUniqueViolation(e) &&
            getConstraintName(e) === "quote_sheet_store_short_code_unique"
          ) {
            lastError = e;
            continue; // retry com novo shortCode
          }
          throw e;
        }
      }
      throw (
        lastError ??
        new Error("Falha ao gerar código único após várias tentativas.")
      );
    });

    if (!inserted) {
      return { ok: false, error: "Falha ao cadastrar ficha de orçamento." };
    }

    revalidatePath("/admin/orcamentos");
    return { ok: true, quoteSheet: inserted };
  } catch (e) {
    logger.error("quote-sheet.create_failed", { err: e, storeId: store.id });
    return { ok: false, error: "Falha ao cadastrar ficha de orçamento." };
  }
}
