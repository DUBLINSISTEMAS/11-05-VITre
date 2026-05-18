"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";

import { leadTable, type ProductSnapshot,productTable } from "@/db/schema";
import { logger } from "@/lib/logger";
import {
  checkRateLimit,
  RateLimitError,
  rateLimits,
} from "@/lib/rate-limit";
import { withServiceRole } from "@/lib/tenant";

const recordSchema = z.object({
  storeId: z.string().uuid(),
  productId: z.string().uuid().nullable(),
  source: z.enum(["pdp_button", "list_button", "cart_button", "other"]),
});

export type RecordLeadInput = z.input<typeof recordSchema>;

/**
 * Storefront público chama isso ANTES de window.open(WA). Falha silenciosa
 * — não bloqueia o redirect pro WhatsApp.
 *
 * Rate limit por IP+store via Upstash pra evitar spam (memory `pdv-ratelimit-balcao-store-action`).
 */
export async function recordLead(
  input: RecordLeadInput,
): Promise<{ ok: boolean }> {
  const parsed = recordSchema.safeParse(input);
  if (!parsed.success) return { ok: false };

  // Rate limit por store (anônimo) — chave: ip + storeId
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";
  try {
    await checkRateLimit(rateLimits.mutation, `lead:${ip}:${parsed.data.storeId}`);
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
            slug: productTable.slug,
            storeId: productTable.storeId,
          })
          .from(productTable)
          .where(eq(productTable.id, parsed.data.productId))
          .limit(1);

        // Confirma que produto pertence à loja (anti-spoofing).
        if (product && product.storeId === parsed.data.storeId) {
          productSnapshot = {
            name: product.name,
            priceInCents:
              product.promoPriceInCents ?? product.basePriceInCents,
            url: `/p/${product.slug}`,
          };
        }
      }

      await tx.insert(leadTable).values({
        storeId: parsed.data.storeId,
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
