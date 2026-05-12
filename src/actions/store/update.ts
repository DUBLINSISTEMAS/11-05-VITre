"use server";

import { eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";

import { storeTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  checkRateLimit,
  RateLimitError,
  rateLimits,
} from "@/lib/rate-limit";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";
import { parseWhatsAppBR } from "@/lib/whatsapp-format";

import { type UpdateStoreInput,updateStoreSchema } from "./schema";

export type UpdateStoreResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Atualiza dados textuais da loja. `slug`, `logoUrl`, `iconUrl` ficam de
 * fora (têm fluxos próprios). Mudança de niche NÃO regera categorias —
 * elas já existem e o lojista é dono delas.
 *
 * Strings vazias viram null no banco (consistência com schema nullable).
 */
export async function updateStore(
  input: UpdateStoreInput,
): Promise<UpdateStoreResult> {
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

  const parsed = updateStoreSchema.safeParse(input);
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

  // Re-parse do WhatsApp (gera E.164 + display canônicos)
  let phone;
  try {
    phone = parseWhatsAppBR(data.whatsappNumber);
  } catch {
    return {
      ok: false,
      error: "Número de WhatsApp inválido.",
      fieldErrors: { whatsappNumber: "Número inválido." },
    };
  }

  const emptyToNull = (s: string | null): string | null => {
    if (s === null) return null;
    const trimmed = s.trim();
    return trimmed === "" ? null : trimmed;
  };

  try {
    await withTenant(store.id, userId, async (tx) => {
      await tx
        .update(storeTable)
        .set({
          name: data.name,
          description: emptyToNull(data.description),
          niche: data.niche as typeof storeTable.$inferInsert.niche,
          whatsappNumber: phone.e164,
          whatsappDisplay: phone.display,
          primaryColor: data.primaryColor,
          addressStreet: emptyToNull(data.addressStreet),
          addressNumber: emptyToNull(data.addressNumber),
          addressNeighborhood: emptyToNull(data.addressNeighborhood),
          addressCity: emptyToNull(data.addressCity),
          addressState: data.addressState
            ? data.addressState.trim().toUpperCase() || null
            : null,
          googleMapsUrl: emptyToNull(data.googleMapsUrl),
          instagramHandle: emptyToNull(data.instagramHandle),
          bannerRotationSec: data.bannerRotationSec,
          updatedAt: new Date(),
        })
        .where(eq(storeTable.id, store.id));
    });
  } catch (e) {
    logger.error("store.update_failed", { err: e, storeId: store.id });
    return { ok: false, error: "Falha ao salvar configurações." };
  }

  revalidatePath("/admin/configuracoes");
  revalidatePath("/admin");
  revalidateTag(`store-${store.slug}`);

  return { ok: true };
}
