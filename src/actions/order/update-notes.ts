"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { orderTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import {
  checkRateLimit,
  RateLimitError,
  rateLimits,
} from "@/lib/rate-limit";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

/**
 * Edita a observação livre (`customer_notes`) de um pedido — Sprint final
 * Vendas (audit 2026-05-26).
 *
 * O nome do campo no schema é `customerNotes` por motivo histórico (Fase
 * 1 do storefront), mas semanticamente é a OBS livre da venda inteira —
 * lojista digita "embrulho de presente", "retirar dia 30", "fiado vale
 * #12", etc. Antes era read-only no drawer mesmo com o comentário no
 * `orders-table.tsx:64` prometendo "Edita no detail drawer".
 *
 * Limite 500 chars (espelha balcao/schema.ts e DB CHECK). Empty → null
 * pra consistência.
 */
// Audit 2026-05-26 — schema mantido INTERNO ao módulo (não export) porque
// Next.js exige que arquivos com "use server" exportem APENAS async functions.
// Se algum caller precisar do tipo, importa via inference no chamado direto.
const updateOrderNotesSchema = z.object({
  orderId: z.string().uuid(),
  notes: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().trim().max(500, "Máximo 500 caracteres").nullable(),
  ),
});

type UpdateOrderNotesInput = z.input<typeof updateOrderNotesSchema>;

type UpdateOrderNotesResult =
  | { ok: true }
  | { ok: false; error: string };

export async function updateOrderNotes(
  input: UpdateOrderNotesInput,
): Promise<UpdateOrderNotesResult> {
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

  const parsed = updateOrderNotesSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }

  const store = await getCurrentStore(userId);
  if (!store) return { ok: false, error: "Loja não encontrada." };

  const result = await withTenant(store.id, userId, async (tx) => {
    const updated = await tx
      .update(orderTable)
      .set({ customerNotes: parsed.data.notes })
      .where(
        and(
          eq(orderTable.id, parsed.data.orderId),
          eq(orderTable.storeId, store.id),
        ),
      )
      .returning({ id: orderTable.id });

    if (updated.length === 0) {
      return { ok: false, error: "Pedido não encontrado." } as const;
    }
    return { ok: true } as const;
  });

  if (!result.ok) return result;

  revalidatePath("/admin/pedidos");
  revalidatePath(`/admin/pedidos/${parsed.data.orderId}`);
  return result;
}
