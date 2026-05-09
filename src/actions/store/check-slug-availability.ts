"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";

import { storeTable } from "@/db/schema";
import { checkRateLimit, getClientIp, RateLimitError,rateLimits } from "@/lib/rate-limit";
import { isReservedSlug, isValidSlugFormat } from "@/lib/slug";
import { withServiceRole } from "@/lib/tenant";

import { type CheckSlugInput,checkSlugSchema } from "./schema";

export type SlugAvailabilityResult =
  | { available: true }
  | { available: false; reason: "format" | "reserved" | "taken" | "throttled" };

/**
 * Verifica se um slug pode ser usado por uma nova loja.
 * - Sem auth: disponibilidade é informação naturalmente pública.
 * - Rate limit por IP (`rateLimits.publicApi`, 60/min) — barra enumeração em massa.
 *   Debounce 500ms no client mantém UX fluido (~2 req/s no pior caso).
 */
export async function checkSlugAvailability(
  input: CheckSlugInput,
): Promise<SlugAvailabilityResult> {
  const requestHeaders = await headers();

  try {
    await checkRateLimit(rateLimits.publicApi, getClientIp(requestHeaders));
  } catch (e) {
    if (e instanceof RateLimitError) {
      return { available: false, reason: "throttled" };
    }
    throw e;
  }

  const { slug } = checkSlugSchema.parse(input);

  if (!isValidSlugFormat(slug)) {
    return { available: false, reason: "format" };
  }
  if (isReservedSlug(slug)) {
    return { available: false, reason: "reserved" };
  }

  // Slug uniqueness é cross-store por natureza — sem owner ainda; usa
  // service role (lookup público de disponibilidade, ratelimit já protege).
  const existing = await withServiceRole(
    "check slug availability (cross-store, pre-auth)",
    async (tx) =>
      tx.query.storeTable.findFirst({
        where: eq(storeTable.slug, slug),
        columns: { id: true },
      }),
  );

  if (existing) {
    return { available: false, reason: "taken" };
  }

  return { available: true };
}
