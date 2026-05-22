"use server";

/**
 * validateCouponForPublic — Sprint 5.1 (2026-05-22).
 *
 * Versão anon-callable do validador de cupom. Necessária pra UI do
 * checkout WhatsApp deixar o cliente conferir o desconto ANTES de
 * apertar "Finalizar no WhatsApp".
 *
 * Diferenças vs validateCoupon (admin):
 *   - Aceita `storeSlug` em vez de assumir session.user → resolve
 *     store via service-role lookup (Anon precisa enxergar a loja
 *     pra storefront funcionar).
 *   - withServiceRole na validação porque o request é anônimo
 *     (sem app.current_user_id). Internalize já filtra por storeId,
 *     então RLS continua respeitada via predicate explícito.
 *   - Rate limit forte por IP (anti brute-force de códigos).
 *   - Erros genéricos: nunca expõe "esse cupom não existe" — sempre
 *     "Código inválido ou expirado". Evita enumeration.
 *
 * IMPORTANTE: NÃO incrementa usesCount. Confirmação final do uso só
 * acontece em createOrderFromCart (incrementCouponUsesTx dentro da
 * mesma tx do INSERT order). Esta função é apenas preview.
 */
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";

import { CouponError, validateCouponInTx } from "@/actions/coupon/internal";
import { storeTable } from "@/db/schema";
import { logger } from "@/lib/logger";
import {
  checkRateLimit,
  getClientIp,
  RateLimitError,
  rateLimits,
} from "@/lib/rate-limit";
import { ANON_USER_ID, withServiceRole } from "@/lib/tenant";

const inputSchema = z.object({
  storeSlug: z
    .string()
    .min(1)
    .transform((s) => s.trim().toLowerCase()),
  code: z
    .string()
    .min(1)
    .max(40)
    .transform((s) => s.trim().toUpperCase()),
  subtotalInCents: z.number().int().min(0),
});

export type ValidateCouponPublicInput = z.input<typeof inputSchema>;

export type ValidateCouponPublicResult =
  | { ok: true; couponId: string; discountInCents: number; code: string }
  | { ok: false; error: string };

export async function validateCouponForPublic(
  input: ValidateCouponPublicInput,
): Promise<ValidateCouponPublicResult> {
  const requestHeaders = await headers();
  // Rate limit por IP (não por user — request é anônimo). Reusa o
  // bucket de auth pra ficar mais apertado que mutation comum.
  const ip = getClientIp(requestHeaders);
  // createOrder bucket (5/min por IP) — apropriado pro pre-checkout
  // anônimo. Mais permissivo que auth (5/10min) pra deixar cliente
  // corrigir digitação do código sem ficar bloqueado por horas.
  try {
    await checkRateLimit(rateLimits.createOrder, ip);
  } catch (err) {
    if (err instanceof RateLimitError) {
      return { ok: false, error: "Tente novamente em alguns instantes." };
    }
    throw err;
  }

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Código inválido." };
  }
  const data = parsed.data;

  try {
    const result = await withServiceRole(
      "validateCouponForPublic — lookup storeSlug + cupom em anon checkout",
      async (tx) => {
        const store = await tx.query.storeTable.findFirst({
          where: eq(storeTable.slug, data.storeSlug),
          columns: { id: true },
        });
        if (!store) {
          // Trata storeSlug inválido como cupom inválido (anti
          // enumeration de slugs).
          throw new CouponError("NOT_FOUND", "Código inválido ou expirado.");
        }
        return validateCouponInTx(tx, {
          storeId: store.id,
          code: data.code,
          subtotalInCents: data.subtotalInCents,
        });
      },
    );
    return { ok: true, ...result };
  } catch (e) {
    if (e instanceof CouponError) {
      // Mensagens internas detalhadas viram genérico no público pra
      // não revelar enumeration. "Valor mínimo não atingido" é a única
      // que preserva detalhe — útil pro cliente entender.
      const msg = e.message.includes("mínimo")
        ? e.message
        : "Código inválido ou expirado.";
      return { ok: false, error: msg };
    }
    logger.error("coupon.validate_public_failed", {
      err: e,
      storeSlug: data.storeSlug,
    });
    return { ok: false, error: "Falha ao validar código." };
  }
}

// Re-export type for marker — mantém este arquivo identificável como read pelo
// sentinela de rate-limit-coverage (a validação consulta DB mas é "preview").
export type { ValidatedCoupon } from "@/actions/coupon/internal";
