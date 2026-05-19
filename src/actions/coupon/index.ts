"use server";

import { and, asc, eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import {
  CouponError,
  incrementCouponUsesTx,
  validateCouponInTx,
} from "@/actions/coupon/internal";
import { couponTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  checkRateLimit,
  RateLimitError,
  rateLimits,
} from "@/lib/rate-limit";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

const upsertSchema = z
  .object({
    id: z.string().uuid().nullable(),
    code: z
      .string()
      .min(2, "Mínimo 2 caracteres")
      .max(40, "Máx 40 caracteres")
      .regex(
        /^[A-Z0-9_-]+$/i,
        "Use apenas letras, números, hífen e underline",
      )
      .transform((s) => s.trim().toUpperCase()),
    discountType: z.enum(["percentage", "fixed"]),
    /** Bps quando percentage; centavos quando fixed. UI converte antes. */
    discountValue: z.number().int().min(1),
    startsAt: z.string().nullable(),
    endsAt: z.string().nullable(),
    maxUses: z.number().int().min(1).nullable(),
    description: z
      .string()
      .max(280)
      .nullable()
      .transform((v) => (v && v.trim() !== "" ? v.trim() : null)),
    isActive: z.boolean().default(true),
  })
  .refine(
    (d) =>
      d.discountType !== "percentage" ||
      (d.discountValue >= 1 && d.discountValue <= 9999),
    { message: "Percentual deve ser 0,01% a 99,99%", path: ["discountValue"] },
  )
  .refine(
    (d) =>
      d.startsAt === null ||
      d.endsAt === null ||
      new Date(d.startsAt) < new Date(d.endsAt),
    { message: "Início precisa ser antes do fim", path: ["endsAt"] },
  );

export type UpsertCouponInput = z.input<typeof upsertSchema>;

export async function loadCoupons() {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user) return [];
  const store = await getCurrentStore(session.user.id);
  if (!store) return [];

  return withTenant(store.id, session.user.id, (tx) =>
    tx
      .select()
      .from(couponTable)
      .where(eq(couponTable.storeId, store.id))
      .orderBy(asc(couponTable.code)),
  );
}

export async function upsertCoupon(input: UpsertCouponInput) {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user) return { ok: false as const, error: "Sessão expirada." };
  const userId = session.user.id;

  try {
    await checkRateLimit(rateLimits.mutation, userId);
  } catch (e) {
    if (e instanceof RateLimitError) return { ok: false as const, error: e.message };
    throw e;
  }

  const parsed = upsertSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (!fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return {
      ok: false as const,
      error: "Confira os campos.",
      fieldErrors,
    };
  }
  const data = parsed.data;

  const store = await getCurrentStore(userId);
  if (!store) return { ok: false as const, error: "Loja não encontrada." };

  try {
    const id = await withTenant(store.id, userId, async (tx) => {
      const startsAt = data.startsAt ? new Date(data.startsAt) : null;
      const endsAt = data.endsAt ? new Date(data.endsAt) : null;

      if (data.id) {
        await tx
          .update(couponTable)
          .set({
            code: data.code,
            discountType: data.discountType,
            discountValue: data.discountValue,
            startsAt,
            endsAt,
            maxUses: data.maxUses,
            description: data.description,
            isActive: data.isActive,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(couponTable.id, data.id),
              eq(couponTable.storeId, store.id),
            ),
          );
        return data.id;
      }
      const [created] = await tx
        .insert(couponTable)
        .values({
          storeId: store.id,
          code: data.code,
          discountType: data.discountType,
          discountValue: data.discountValue,
          startsAt,
          endsAt,
          maxUses: data.maxUses,
          description: data.description,
          isActive: data.isActive,
        })
        .returning({ id: couponTable.id });
      return created!.id;
    });

    revalidatePath("/admin/promocoes/cupons");
    revalidateTag(`store-${store.slug}`);
    return { ok: true as const, id };
  } catch (e) {
    logger.error("coupon.upsert_failed", { err: e, storeId: store.id });
    const msg = e instanceof Error && e.message.includes("coupon_store_code_unique")
      ? "Já existe um cupom com esse código."
      : "Falha ao salvar cupom.";
    return { ok: false as const, error: msg };
  }
}

export async function deleteCoupon(input: { id: string }) {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user) return { ok: false as const, error: "Sessão expirada." };
  const userId = session.user.id;

  try {
    await checkRateLimit(rateLimits.mutation, userId);
  } catch (e) {
    if (e instanceof RateLimitError) return { ok: false as const, error: e.message };
    throw e;
  }

  const parsed = z.object({ id: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "ID inválido." };

  const store = await getCurrentStore(userId);
  if (!store) return { ok: false as const, error: "Loja não encontrada." };

  try {
    await withTenant(store.id, userId, async (tx) => {
      await tx
        .delete(couponTable)
        .where(
          and(
            eq(couponTable.id, parsed.data.id),
            eq(couponTable.storeId, store.id),
          ),
        );
    });
    revalidatePath("/admin/promocoes/cupons");
    return { ok: true as const };
  } catch (e) {
    logger.error("coupon.delete_failed", { err: e, storeId: store.id });
    return { ok: false as const, error: "Falha ao excluir cupom." };
  }
}

// CouponError + ValidatedCoupon + validateCouponInTx + incrementCouponUsesTx
// vivem em ./internal.ts (não-"use server"). Next 15 rejeita class/interface
// exports em arquivos com "use server" — quebra build webpack. Pattern:
// helpers compartilhados em internal.ts, Server Actions públicos aqui.

/**
 * Valida cupom no PDV (UI client). Retorna desconto em centavos
 * calculado sobre subtotal. NÃO incrementa usesCount — isso é feito
 * atomicamente no checkout via incrementCouponUsesTx (mesmo tx do
 * INSERT order).
 *
 * Permanece como server action pública pra UI do PDV pré-validar +
 * mostrar discount antes de finalizar. O server da venda RECALCULA
 * tudo (não confia no payload do client) — esta função é só preview.
 */
export async function validateCoupon(
  input: { code: string; subtotalInCents: number },
): Promise<
  | { ok: true; couponId: string; discountInCents: number; code: string }
  | { ok: false; error: string }
> {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user) return { ok: false, error: "Sessão expirada." };
  const userId = session.user.id;

  const parsed = z
    .object({
      code: z.string().min(1).transform((s) => s.trim().toUpperCase()),
      subtotalInCents: z.number().int().min(0),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Código inválido." };

  const store = await getCurrentStore(userId);
  if (!store) return { ok: false, error: "Loja não encontrada." };

  try {
    const result = await withTenant(store.id, userId, (tx) =>
      validateCouponInTx(tx, {
        storeId: store.id,
        code: parsed.data.code,
        subtotalInCents: parsed.data.subtotalInCents,
      }),
    );
    return { ok: true, ...result };
  } catch (e) {
    if (e instanceof CouponError) {
      return { ok: false, error: e.message };
    }
    logger.error("coupon.validate_failed", { err: e, storeId: store.id });
    return { ok: false, error: "Falha ao validar cupom." };
  }
}

/**
 * @deprecated Use `incrementCouponUsesTx` dentro do tx do INSERT order.
 * Mantido pra compatibilidade — chamada NÃO atômica com o pedido vira
 * race window. Pattern correto: incrementCouponUsesTx + soft failure.
 *
 * Hoje sem callers — preservado caso alguma migração de admin precise.
 * Pode ser removido em refator futuro.
 */
export async function incrementCouponUses(couponId: string): Promise<void> {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user) return;
  const userId = session.user.id;
  const store = await getCurrentStore(userId);
  if (!store) return;

  await withTenant(store.id, userId, (tx) =>
    incrementCouponUsesTx(tx, { storeId: store.id, couponId }),
  );
}
