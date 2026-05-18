"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { leadTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  checkRateLimit,
  RateLimitError,
  rateLimits,
} from "@/lib/rate-limit";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["new", "contacted", "converted", "lost"]).nullish(),
  customerId: z.string().uuid().nullish(),
  notes: z.string().max(1000).nullish(),
});

export type UpdateLeadInput = z.input<typeof updateSchema>;

export async function updateLead(input: UpdateLeadInput) {
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

  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Dados inválidos." };
  const data = parsed.data;

  const store = await getCurrentStore(userId);
  if (!store) return { ok: false as const, error: "Loja não encontrada." };

  try {
    await withTenant(store.id, userId, async (tx) => {
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (data.status !== undefined && data.status !== null) {
        updates.status = data.status;
      }
      if (data.customerId !== undefined) {
        updates.customerId = data.customerId;
      }
      if (data.notes !== undefined) {
        updates.notes = data.notes === null || data.notes === "" ? null : data.notes;
      }
      await tx
        .update(leadTable)
        .set(updates)
        .where(and(eq(leadTable.id, data.id), eq(leadTable.storeId, store.id)));
    });
    revalidatePath("/admin/contatos");
    return { ok: true as const };
  } catch (e) {
    logger.error("lead.update_failed", { err: e, storeId: store.id });
    return { ok: false as const, error: "Falha ao atualizar lead." };
  }
}

export async function deleteLead(input: { id: string }) {
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
        .delete(leadTable)
        .where(
          and(
            eq(leadTable.id, parsed.data.id),
            eq(leadTable.storeId, store.id),
          ),
        );
    });
    revalidatePath("/admin/contatos");
    return { ok: true as const };
  } catch (e) {
    logger.error("lead.delete_failed", { err: e, storeId: store.id });
    return { ok: false as const, error: "Falha ao excluir lead." };
  }
}
