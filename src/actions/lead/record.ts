"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";

import { leadTable, type ProductSnapshot,productTable } from "@/db/schema";
import { logger } from "@/lib/logger";
import { getEffectivePrice } from "@/lib/pricing";
import {
  checkRateLimit,
  getClientIp,
  RateLimitError,
  rateLimits,
} from "@/lib/rate-limit";
import { getStoreBySlug } from "@/lib/storefront/store-loader";
import { withServiceRole } from "@/lib/tenant";

/**
 * S4 da auditoria 2026-05-19: storeId NUNCA pode vir do client (storefront
 * anonimo poderia gravar lead em qualquer loja). Recebemos `storeSlug` da
 * URL, resolvemos server-side via `getStoreBySlug` (loja precisa estar
 * `is_active=true`). Storefront NAO conhece o uuid da loja — apenas o slug.
 */
const recordSchema = z.object({
  storeSlug: z.string().min(1).max(64),
  productId: z.string().uuid().nullable(),
  source: z.enum(["pdp_button", "list_button", "cart_button", "other"]),
});

export type RecordLeadInput = z.input<typeof recordSchema>;

/**
 * Storefront público chama isso ANTES de window.open(WA). Falha silenciosa
 * — não bloqueia o redirect pro WhatsApp.
 *
 * Hardening S4 (auditoria 2026-05-19):
 *   1. `storeSlug` (nao `storeId`) — resolvido server-side via
 *      `getStoreBySlug`. Loja inexistente/inativa = no-op.
 *   2. Snapshot de preco usa `getEffectivePrice` (respeita janela
 *      `promoStartsAt`/`promoEndsAt`). Antes pegava `promoPriceInCents`
 *      cru, podia gravar lead com preco promocional fora da janela.
 *   3. Rate limit por IP via `getClientIp` (sliding window 60/min — bucket
 *      `lead:${ip}:${storeId}`). Fail-open com warn se Upstash cair (C7).
 *
 * NAO CHAMADO HOJE (memory team `b34-leads-backend-only-no-storefront-wiring`).
 * Candidatos naturais para wiring (em ordem de prioridade):
 *   (a) src/components/storefront/whatsapp-auto-handoff.tsx — sucesso/[token]
 *       handoff pro WA do lojista. ANTES do `window.location.href`. Captura
 *       `cart_button`, intencao mais forte (cliente ja confirmou pedido).
 *   (b) src/components/storefront/product-purchase-panel.tsx — botao "Adicionar
 *       a sacola" tambem aciona fluxo PDP. Captura `pdp_button`.
 *   (c) src/components/storefront/checkout-panel.tsx — antes do
 *       `router.push(/sucesso?...)`. Equivalente a (a) mas mais cedo no
 *       fluxo (cobre caso de auto-handoff falhar).
 * Recomendado comecar por (a) — momento de maior intencao com menos ruido.
 */
export async function recordLead(
  input: RecordLeadInput,
): Promise<{ ok: boolean }> {
  const parsed = recordSchema.safeParse(input);
  if (!parsed.success) return { ok: false };

  // 1. Resolve a loja a partir do slug (server-side, anti-spoofing).
  const store = await getStoreBySlug(parsed.data.storeSlug);
  if (!store) return { ok: false };

  // 2. Rate limit por IP+store (anonimo). getClientIp respeita header
  //    chain (cf-connecting-ip > x-forwarded-for > x-real-ip) e retorna
  //    null quando nenhum header confiavel — fail-open com warn (C7/S7).
  const requestHeaders = await headers();
  const ip = getClientIp(requestHeaders);
  try {
    await checkRateLimit(
      rateLimits.mutation,
      ip === null ? null : `lead:${ip}:${store.id}`,
    );
  } catch (e) {
    if (e instanceof RateLimitError) return { ok: false };
    throw e;
  }

  try {
    await withServiceRole("recordLead — storefront anônimo", async (tx) => {
      let productSnapshot: ProductSnapshot | null = null;
      if (parsed.data.productId) {
        const [product] = await tx
          .select({
            name: productTable.name,
            basePriceInCents: productTable.basePriceInCents,
            promoPriceInCents: productTable.promoPriceInCents,
            promoStartsAt: productTable.promoStartsAt,
            promoEndsAt: productTable.promoEndsAt,
            slug: productTable.slug,
            storeId: productTable.storeId,
          })
          .from(productTable)
          .where(eq(productTable.id, parsed.data.productId))
          .limit(1);

        // Confirma que produto pertence à loja (anti-spoofing).
        if (product && product.storeId === store.id) {
          productSnapshot = {
            name: product.name,
            // Usa helper centralizado em pricing.ts — respeita janela
            // promoStartsAt/promoEndsAt. Antes (S4 da auditoria) pegava
            // `promoPriceInCents ?? basePriceInCents` cru, gravando lead
            // com preco promo fora da janela temporal.
            priceInCents: getEffectivePrice({
              basePriceInCents: product.basePriceInCents,
              promoPriceInCents: product.promoPriceInCents,
              promoStartsAt: product.promoStartsAt,
              promoEndsAt: product.promoEndsAt,
            }),
            url: `/p/${product.slug}`,
          };
        }
      }

      await tx.insert(leadTable).values({
        storeId: store.id,
        productId: parsed.data.productId,
        productSnapshot,
        source: parsed.data.source,
        status: "new",
      });
    });
    return { ok: true };
  } catch (e) {
    logger.warn("lead.record_failed", { err: e });
    return { ok: false };
  }
}
