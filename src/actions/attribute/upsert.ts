"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";

import { attributeTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  checkRateLimit,
  RateLimitError,
  rateLimits,
} from "@/lib/rate-limit";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

import { type UpsertAttributeInput, upsertAttributeSchema } from "./schema";

export type UpsertAttributeResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function upsertAttribute(
  input: UpsertAttributeInput,
): Promise<UpsertAttributeResult> {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user) return { ok: false, error: "Sessão expirada." };
  const userId = session.user.id;

  try {
    await checkRateLimit(rateLimits.mutation, userId);
  } catch (e) {
    if (e instanceof RateLimitError) return { ok: false, error: e.message };
    throw e;
  }

  const parsed = upsertAttributeSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (!fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return { ok: false, error: "Confira os campos.", fieldErrors };
  }
  const data = parsed.data;

  const store = await getCurrentStore(userId);
  if (!store) return { ok: false, error: "Loja não encontrada." };

  try {
    const id = await withTenant(store.id, userId, async (tx) => {
      if (data.id) {
        await tx
          .update(attributeTable)
          .set({
            name: data.name,
            type: data.type,
            position: data.position,
            isActive: data.isActive,
            updatedAt: new Date(),
          })
          .where(
            and(eq(attributeTable.id, data.id), eq(attributeTable.storeId, store.id)),
          );
        return data.id;
      }

      const [created] = await tx
        .insert(attributeTable)
        .values({
          storeId: store.id,
          name: data.name,
          type: data.type,
          position: data.position,
          isActive: data.isActive,
        })
        .returning({ id: attributeTable.id });
      return created!.id;
    });
    revalidatePath("/admin/atributos");
    revalidateTag(`store-${store.slug}`);
    return { ok: true, id };
  } catch (e) {
    logger.error("attribute.upsert_failed", { err: e, storeId: store.id });
    const msg = e instanceof Error && e.message.includes("attribute_store_name_unique")
      ? "Já existe um atributo com esse nome."
      : "Falha ao salvar atributo.";
    return { ok: false, error: msg };
  }
}
