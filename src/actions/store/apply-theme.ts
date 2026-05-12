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
import { THEME_PRESETS } from "@/lib/storefront/themes";
import { withTenant } from "@/lib/tenant";

import { type ApplyThemeInput, applyThemeSchema } from "./schema";

export type ApplyThemeResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Aplica um preset de tema (Onda C) na loja do usuário autenticado.
 *
 * Cada preset escolhe 4 eixos enum de uma vez (categoryShape +
 * productCardStyle + heroStyle + bottomNavStyle). UPDATE atômico em
 * `storeTable` + revalida cache da vitrine.
 *
 * Por que ação dedicada (não reusar `updateStore`):
 *  - `updateStore` valida campos textuais (nome, endereço, etc) — não
 *    faria sentido obrigar lojista a reenviar tudo pra trocar tema.
 *  - Separar isola escopo e permite rate limit independente futuro.
 *  - JSDoc fica claro: 1 click no admin = 1 action.
 *
 * Defesa em camadas:
 *  1. Zod valida presetId (3 valores conhecidos)
 *  2. Lookup em THEME_PRESETS (raiz da verdade)
 *  3. CHECK constraint no DB (supabase/sql/16) — última linha
 */
export async function applyTheme(
  input: ApplyThemeInput,
): Promise<ApplyThemeResult> {
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

  const parsed = applyThemeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Modelo inválido." };
  }
  const { presetId } = parsed.data;
  const preset = THEME_PRESETS[presetId];

  const store = await getCurrentStore(userId);
  if (!store) return { ok: false, error: "Loja não encontrada." };

  try {
    await withTenant(store.id, userId, async (tx) => {
      await tx
        .update(storeTable)
        .set({
          categoryShape: preset.categoryShape,
          productCardStyle: preset.productCardStyle,
          heroStyle: preset.heroStyle,
          bottomNavStyle: preset.bottomNavStyle,
          updatedAt: new Date(),
        })
        .where(eq(storeTable.id, store.id));
    });
  } catch (e) {
    logger.error("store.apply_theme_failed", {
      err: e,
      storeId: store.id,
      presetId,
    });
    return { ok: false, error: "Falha ao aplicar o modelo." };
  }

  revalidatePath("/admin/aparencia");
  revalidatePath("/admin");
  revalidateTag(`store-${store.slug}`);

  return { ok: true };
}
