"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";

import { attributeTable, attributeValueTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  checkRateLimit,
  RateLimitError,
  rateLimits,
} from "@/lib/rate-limit";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

import {
  type UpsertAttributeValueInput,
  upsertAttributeValueSchema,
} from "./schema";

export async function upsertAttributeValue(
  input: UpsertAttributeValueInput,
): Promise<
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> }
> {
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

  const parsed = upsertAttributeValueSchema.safeParse(input);
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
      // Confirma que o atributo pertence à loja (defesa em camadas).
      const [parent] = await tx
        .select({ id: attributeTable.id })
        .from(attributeTable)
        .where(
          and(
            eq(attributeTable.id, data.attributeId),
            eq(attributeTable.storeId, store.id),
          ),
        )
        .limit(1);
      if (!parent) throw new Error("ATTRIBUTE_NOT_FOUND");

      if (data.id) {
        await tx
          .update(attributeValueTable)
          .set({
            label: data.label,
            colorHex: data.colorHex,
            position: data.position,
          })
          .where(
            and(
              eq(attributeValueTable.id, data.id),
              eq(attributeValueTable.storeId, store.id),
            ),
          );
        return data.id;
      }

      const [created] = await tx
        .insert(attributeValueTable)
        .values({
          storeId: store.id,
          attributeId: data.attributeId,
          label: data.label,
          colorHex: data.colorHex,
          position: data.position,
        })
        .returning({ id: attributeValueTable.id });
      return created!.id;
    });

    revalidatePath("/admin/atributos");
    revalidateTag(`store-${store.slug}`);
    return { ok: true, id };
  } catch (e) {
    logger.error("attribute_value.upsert_failed", { err: e, storeId: store.id });
    if (e instanceof Error && e.message === "ATTRIBUTE_NOT_FOUND") {
      return { ok: false, error: "Atributo não encontrado." };
    }
    const msg = e instanceof Error && e.message.includes("attribute_value_attribute_label_unique")
      ? "Já existe um valor com esse label nesse atributo."
      : "Falha ao salvar valor.";
    return { ok: false, error: msg };
  }
}
