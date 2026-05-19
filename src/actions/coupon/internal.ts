/**
 * Helpers internos de cupom — usados DENTRO de tx do caller (PDV +
 * checkout WhatsApp). Não-"use server" porque:
 *  - `CouponError` é uma classe (Next 15 rejeita class exports em
 *    arquivos "use server").
 *  - `ValidatedCoupon` é interface tipada (idem).
 *  - `validateCouponInTx` / `incrementCouponUsesTx` são tx-aware:
 *    recebem o `tx` do caller, não abrem sessão própria. Não fazem
 *    sentido como Server Action standalone.
 *
 * Os 2 Server Actions públicos de cupom (preview de validação +
 * increment standalone) vivem em `./index.ts` com "use server" e
 * delegam pra estes helpers.
 *
 * Separação criada na auditoria 2026-05-19 (Onda A — build fix Vercel).
 */
import { and, eq, sql } from "drizzle-orm";

import { couponTable } from "@/db/schema";
import { type Tx } from "@/lib/tenant";

/**
 * Erro tipado para fluxos de venda (PDV + checkout) — distingue cupom
 * inválido/esgotado de erro genérico, pra UI mostrar mensagem correta.
 *
 * Tratado como soft failure dentro do tx do INSERT order (rollback +
 * resposta amigável). Pattern: `soft-failure-pattern-tx-aninhado`.
 */
export class CouponError extends Error {
  constructor(
    public readonly code:
      | "NOT_FOUND"
      | "INACTIVE"
      | "NOT_YET_VALID"
      | "EXPIRED"
      | "EXHAUSTED"
      | "NO_DISCOUNT",
    message: string,
  ) {
    super(message);
    this.name = "CouponError";
  }
}

export interface ValidatedCoupon {
  couponId: string;
  code: string;
  discountInCents: number;
}

/**
 * Núcleo de validação de cupom. Roda DENTRO do tx do caller (PDV /
 * checkout) — sem dependência de session/getCurrentStore, recebe storeId
 * direto. Aceita couponId OU code (PDV envia couponId já resolvido pela
 * UI; checkout aceita os 2 pra flexibilidade futura).
 *
 * NÃO incrementa usesCount — caller faz isso via incrementCouponUsesTx
 * APÓS INSERT order, mesmo tx, atomic.
 *
 * Throw CouponError em cenários de negócio; throw genérico em falha DB.
 */
export async function validateCouponInTx(
  tx: Tx,
  args: {
    storeId: string;
    couponId?: string | null;
    code?: string | null;
    subtotalInCents: number;
    now?: Date;
  },
): Promise<ValidatedCoupon> {
  const now = args.now ?? new Date();
  const subtotal = args.subtotalInCents;

  if (subtotal < 0) {
    throw new CouponError("NO_DISCOUNT", "Subtotal inválido.");
  }

  const filters = [eq(couponTable.storeId, args.storeId)];
  if (args.couponId) {
    filters.push(eq(couponTable.id, args.couponId));
  } else if (args.code) {
    const code = args.code.trim().toUpperCase();
    if (!code) throw new CouponError("NOT_FOUND", "Cupom não encontrado.");
    filters.push(eq(couponTable.code, code));
  } else {
    throw new CouponError("NOT_FOUND", "Cupom não informado.");
  }

  const found = await tx
    .select()
    .from(couponTable)
    .where(and(...filters))
    .limit(1);

  const coupon = found[0];
  if (!coupon) throw new CouponError("NOT_FOUND", "Cupom não encontrado.");
  if (!coupon.isActive) throw new CouponError("INACTIVE", "Cupom inativo.");
  if (coupon.startsAt && coupon.startsAt > now)
    throw new CouponError("NOT_YET_VALID", "Cupom ainda não está vigente.");
  if (coupon.endsAt && coupon.endsAt < now)
    throw new CouponError("EXPIRED", "Cupom expirado.");
  if (coupon.maxUses !== null && coupon.usesCount >= coupon.maxUses)
    throw new CouponError("EXHAUSTED", "Cupom esgotado.");

  const discountInCents =
    coupon.discountType === "percentage"
      ? Math.floor((subtotal * coupon.discountValue) / 10000)
      : Math.min(coupon.discountValue, subtotal);

  if (discountInCents <= 0)
    throw new CouponError(
      "NO_DISCOUNT",
      "Cupom não gera desconto neste valor.",
    );

  return {
    couponId: coupon.id,
    code: coupon.code,
    discountInCents,
  };
}

/**
 * Incremento ATÔMICO de usesCount após venda confirmada. Roda dentro do
 * mesmo tx do INSERT order. Cláusula WHERE garante max_uses não é
 * violado mesmo sob concorrência — sem advisory lock necessário
 * (Postgres UPDATE é row-locking). Se rowcount=0, throw CouponError
 * EXHAUSTED — caller rollback automático.
 *
 * Pattern: race-resistant via WHERE + RETURNING.
 * Defesa em profundidade: CHECK constraint coupon_uses_within_max em
 * supabase/sql/40_coupon_uses_check.sql.
 */
export async function incrementCouponUsesTx(
  tx: Tx,
  args: { storeId: string; couponId: string },
): Promise<void> {
  const rows = await tx
    .update(couponTable)
    .set({
      usesCount: sql`${couponTable.usesCount} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(couponTable.id, args.couponId),
        eq(couponTable.storeId, args.storeId),
        sql`(${couponTable.maxUses} IS NULL OR ${couponTable.usesCount} < ${couponTable.maxUses})`,
      ),
    )
    .returning({ id: couponTable.id });

  if (rows.length === 0) {
    throw new CouponError(
      "EXHAUSTED",
      "Cupom esgotado durante a venda. Recarregue a tela.",
    );
  }
}
