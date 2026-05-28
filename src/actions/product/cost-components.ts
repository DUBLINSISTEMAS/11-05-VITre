"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";

import { productCostComponentTable, productTable } from "@/db/schema";
import { requireSession } from "@/lib/auth-server";
import { checkRateLimit, rateLimits } from "@/lib/rate-limit";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

const ComponentSchema = z.object({
  label: z.string().trim().min(1, "Descreva o material").max(120),
  amountInCents: z.number().int().min(0),
});
const SaveSchema = z.object({
  productId: z.string().uuid(),
  components: z.array(ComponentSchema).max(50),
});

export async function saveCostComponents(input: z.infer<typeof SaveSchema>) {
  const parsed = SaveSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  const session = await requireSession();
  await checkRateLimit(rateLimits.mutation, session.user.id);
  const store = await getCurrentStore(session.user.id);
  if (!store) return { ok: false as const, error: "Loja não encontrada" };

  const { productId, components } = parsed.data;
  const totalInCents = components.reduce((acc, c) => acc + c.amountInCents, 0);

  await withTenant(store.id, session.user.id, async (tx) => {
    const [prod] = await tx.select({ id: productTable.id }).from(productTable)
      .where(and(eq(productTable.id, productId), eq(productTable.storeId, store.id))).limit(1);
    if (!prod) throw new Error("Produto não encontrado");

    await tx.delete(productCostComponentTable)
      .where(and(eq(productCostComponentTable.productId, productId), eq(productCostComponentTable.storeId, store.id)));

    if (components.length > 0) {
      await tx.insert(productCostComponentTable).values(
        components.map((c, i) => ({ storeId: store.id, productId, label: c.label, amountInCents: c.amountInCents, position: i })),
      );
    }
    await tx.update(productTable).set({ costPriceInCents: totalInCents })
      .where(and(eq(productTable.id, productId), eq(productTable.storeId, store.id)));
  });

  revalidateTag(`store-${store.slug}`);
  revalidatePath(`/admin/produtos/${productId}`);
  return { ok: true as const, totalInCents };
}

export async function loadCostComponents(productId: string) {
  const session = await requireSession();
  const store = await getCurrentStore(session.user.id);
  if (!store) return [];
  return withTenant(store.id, session.user.id, async (tx) =>
    tx.select({ id: productCostComponentTable.id, label: productCostComponentTable.label, amountInCents: productCostComponentTable.amountInCents })
      .from(productCostComponentTable)
      .where(and(eq(productCostComponentTable.productId, productId), eq(productCostComponentTable.storeId, store.id)))
      .orderBy(productCostComponentTable.position),
  );
}
