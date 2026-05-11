"use server";

import { eq, sql } from "drizzle-orm";
import { headers } from "next/headers";

import { categoryTable, storeTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { NICHE_CATEGORIES, type NicheValue } from "@/lib/niche-categories";
import { checkRateLimit, getClientIp, RateLimitError, rateLimits } from "@/lib/rate-limit";
import { generateSlug, isReservedSlug, isValidSlugFormat } from "@/lib/slug";
import { withTenant } from "@/lib/tenant";
import { parseWhatsAppBR } from "@/lib/whatsapp-format";

import {
  type CreateStoreData,
  type CreateStoreInput,
  createStoreSchema,
} from "./schema";

export type CreateStoreResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: string };

/**
 * Cria a primeira loja do usuário logado, com categorias pré-populadas pelo nicho.
 * Tudo numa transação Drizzle. Se categorias falharem, store também é desfeita.
 *
 * Aceita `CreateStoreInput` (tipo de entrada, com `.default()` opcional)
 * mas trabalha com `CreateStoreData` (saída do parse) internamente.
 * `includeNicheCategories` é booleano garantido depois do parse.
 */
export async function createStore(input: CreateStoreInput): Promise<CreateStoreResult> {
  let parsed: CreateStoreData;
  try {
    parsed = createStoreSchema.parse(input);
  } catch {
    return { ok: false, error: "Dados inválidos. Confira os campos." };
  }

  const requestHeaders = await headers();

  // Rate limit por IP (compartilha bucket com auth, limite de 10 req/10min).
  try {
    await checkRateLimit(rateLimits.auth, getClientIp(requestHeaders));
  } catch (e) {
    if (e instanceof RateLimitError) return { ok: false, error: e.message };
    throw e;
  }

  // Auth
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user) {
    return { ok: false, error: "Sessão expirada. Faça login novamente." };
  }
  const userId = session.user.id;

  // Garantir slug ainda livre + formato válido (race com check assíncrono).
  if (!isValidSlugFormat(parsed.slug) || isReservedSlug(parsed.slug)) {
    return { ok: false, error: "Endereço da loja inválido." };
  }

  // Bootstrap: passa pelo GUC `app.current_user_id` (storeId vazio).
  // Policy `store_owner_access` permite SELECT/INSERT desde que owner_id
  // bata; `store_public_read_active` complementa pra detectar slug em uso
  // por loja ativa de outro owner.
  const slugTaken = await withTenant("", userId, async (tx) =>
    tx.query.storeTable.findFirst({
      where: eq(storeTable.slug, parsed.slug),
      columns: { id: true },
    }),
  );
  if (slugTaken) {
    return {
      ok: false,
      error: "Esse endereço acabou de ser usado por outra loja. Escolha outro.",
    };
  }

  // Garantir que esse user ainda não tem loja (Fase 1: 1 user = 1 loja).
  const existingStore = await withTenant("", userId, async (tx) =>
    tx.query.storeTable.findFirst({
      where: eq(storeTable.ownerId, userId),
      columns: { id: true, slug: true },
    }),
  );
  if (existingStore) {
    return { ok: true, redirectTo: "/admin" };
  }

  // Parse WhatsApp para E.164 + display.
  let phone;
  try {
    phone = parseWhatsAppBR(parsed.whatsappNumber);
  } catch {
    return { ok: false, error: "Número de WhatsApp inválido." };
  }

  const niche = parsed.niche as NicheValue;
  const initialCategories = parsed.includeNicheCategories
    ? (NICHE_CATEGORIES[niche] ?? [])
    : [];

  // Store + categorias rodam na MESMA transação. Se o INSERT das categorias
  // falhar, o INSERT da store também é desfeito pelo rollback do Drizzle.
  try {
    await withTenant("", userId, async (tx) => {
      const [created] = await tx
        .insert(storeTable)
        .values({
          ownerId: userId,
          slug: parsed.slug,
          name: parsed.name,
          niche,
          whatsappNumber: phone.e164,
          whatsappDisplay: phone.display,
          primaryColor: parsed.primaryColor,
          addressCity: parsed.addressCity || null,
          addressState: (parsed.addressState || "").toUpperCase() || null,
        })
        .returning();

      if (!created) throw new Error("Falha ao criar loja.");

      if (initialCategories.length > 0) {
        await tx.execute(sql`SELECT set_config('app.current_store_id', ${created.id}, true)`);
        await tx.insert(categoryTable).values(
          initialCategories.map((name, position) => ({
            storeId: created.id,
            name,
            slug: generateSlug(name),
            position,
          })),
        );
      }

      return created;
    });
  } catch (err) {
    // M6: catch silencioso cega founder em prod. Logger.error reenvia
    // pro Sentry (instrumentation já configurado) sem vazar pro cliente.
    logger.error("store.create_failed", { err });
    return {
      ok: false,
      error: "Não foi possível criar sua loja agora. Tente novamente.",
    };
  }

  return { ok: true, redirectTo: "/admin" };
}
