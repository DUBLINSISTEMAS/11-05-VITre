"use server";

import { nanoid } from "nanoid";
import { headers } from "next/headers";

import { productTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  checkRateLimit,
  RateLimitError,
  rateLimits,
} from "@/lib/rate-limit";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

import { type UpdateProductInput } from "./schema";
import { updateProduct } from "./update";

export type SaveAndCreateNextResult =
  | { ok: true; nextProductId: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Salva o produto atual E cria imediatamente um draft novo, retornando
 * o id do próximo. Padrão Shopify "Save and create another" — o lojista
 * cadastra em série sem voltar pra lista entre cada um.
 *
 * Estratégia:
 *  1. Reusa `updateProduct` pra persistir o atual (mesmo schema, refines,
 *     diff de variantes, revalidações).
 *  2. Se sucesso, insere draft novo na mesma loja.
 *  3. Retorna `nextProductId` pro client navegar com `router.replace` e
 *     resetar o form.
 *
 * Falhas no passo 1 retornam o erro e fieldErrors do `updateProduct`. O
 * passo 2 é independente — se falhar, o atual já foi salvo, o caller
 * deve tratar mostrando aviso ("Salvo, mas não conseguimos abrir um novo").
 */
export async function saveAndCreateNext(
  input: UpdateProductInput,
): Promise<SaveAndCreateNextResult> {
  // 1. Salva o atual (delega pra action existente — mesma transação,
  //    mesma defesa em profundidade, mesmo revalidate, mesma validação Zod
  //    com fieldErrors). Se falhar, retorna o erro específico do `updateProduct`
  //    intacto pra Sandra ver mensagem precisa (não genérica).
  const saveResult = await updateProduct(input);
  if (!saveResult.ok) {
    return saveResult;
  }

  // 2. Cria o próximo draft. Auth + rate-limit + tenant guard duplicados
  //    aqui (em vez de chamar createDraftProduct) pra economizar 1 round-trip
  //    de getSession. Mesma garantia.
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user) {
    return {
      ok: false,
      error:
        "Produto salvo, mas sua sessão expirou. Faça login pra cadastrar o próximo.",
    };
  }
  const userId = session.user.id;

  try {
    await checkRateLimit(rateLimits.mutation, userId);
  } catch (e) {
    if (e instanceof RateLimitError) {
      return {
        ok: false,
        error: `Produto salvo. ${e.message}`,
      };
    }
    throw e;
  }

  const store = await getCurrentStore(userId);
  if (!store) {
    return {
      ok: false,
      error: "Produto salvo, mas não conseguimos abrir um novo.",
    };
  }

  try {
    const row = await withTenant(store.id, userId, async (tx) => {
      const [r] = await tx
        .insert(productTable)
        .values({
          storeId: store.id,
          name: "",
          slug: `draft-${nanoid(8)}`,
          description: "",
          basePriceInCents: 0,
          isActive: false,
        })
        .returning({ id: productTable.id });
      return r;
    });

    if (!row) {
      return {
        ok: false,
        error: "Produto salvo, mas não conseguimos abrir um novo.",
      };
    }
    return { ok: true, nextProductId: row.id };
  } catch (e) {
    logger.error("product.save_and_create_next.insert_failed", {
      err: e,
      storeId: store.id,
    });
    return {
      ok: false,
      error: "Produto salvo, mas não conseguimos abrir um novo.",
    };
  }
}
