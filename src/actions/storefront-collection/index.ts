"use server";

/**
 * Server actions de coleções da loja online (ADR-0031, Frente C).
 *
 * Padrões:
 * - withTenant sempre (RLS-first)
 * - Zod boundaries
 * - revalidatePath /admin/colecoes + revalidateTag store-${slug} pra
 *   storefront rerenderizar quando publica/despublica
 * - slug auto-generated do name se não fornecido
 */
import { and, asc, count, eq, inArray, ne, sql } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import {
  productTable,
  storefrontCollectionItemTable,
  storefrontCollectionTable,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  checkRateLimit,
  RateLimitError,
  rateLimits,
} from "@/lib/rate-limit";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function toSlug(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const upsertSchema = z.object({
  id: z.string().uuid().nullable(),
  name: z.string().trim().min(1).max(80),
  slug: z
    .string()
    .trim()
    .max(60)
    .nullish()
    .transform((v) => (v ? v : null)),
  description: z
    .string()
    .trim()
    .max(500)
    .nullish()
    .transform((v) => (v && v.length > 0 ? v : null)),
  showInHome: z.boolean().default(true),
  isActive: z.boolean().default(true),
  position: z.number().int().min(0).default(0),
});

export type UpsertCollectionInput = z.input<typeof upsertSchema>;

async function getSessionAndStore() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const store = await getCurrentStore(session.user.id);
  if (!store) return null;
  return { session, store };
}

export interface CollectionListItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  position: number;
  showInHome: boolean;
  isActive: boolean;
  productCount: number;
}

export async function loadCollections(): Promise<CollectionListItem[]> {
  const ctx = await getSessionAndStore();
  if (!ctx) return [];

  return withTenant(ctx.store.id, ctx.session.user.id, async (tx) => {
    const collections = await tx
      .select()
      .from(storefrontCollectionTable)
      .where(eq(storefrontCollectionTable.storeId, ctx.store.id))
      .orderBy(
        asc(storefrontCollectionTable.position),
        asc(storefrontCollectionTable.name),
      );

    if (collections.length === 0) return [];

    const counts = await tx
      .select({
        collectionId: storefrontCollectionItemTable.collectionId,
        n: count(),
      })
      .from(storefrontCollectionItemTable)
      .where(
        inArray(
          storefrontCollectionItemTable.collectionId,
          collections.map((c) => c.id),
        ),
      )
      .groupBy(storefrontCollectionItemTable.collectionId);

    const countMap = new Map(counts.map((c) => [c.collectionId, c.n]));

    return collections.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      position: c.position,
      showInHome: c.showInHome,
      isActive: c.isActive,
      productCount: countMap.get(c.id) ?? 0,
    }));
  });
}

export interface CollectionDetail extends CollectionListItem {
  productIds: string[];
}

export async function loadCollectionDetail(
  id: string,
): Promise<CollectionDetail | null> {
  const ctx = await getSessionAndStore();
  if (!ctx) return null;

  return withTenant(ctx.store.id, ctx.session.user.id, async (tx) => {
    const row = await tx.query.storefrontCollectionTable.findFirst({
      where: and(
        eq(storefrontCollectionTable.storeId, ctx.store.id),
        eq(storefrontCollectionTable.id, id),
      ),
    });
    if (!row) return null;

    const items = await tx
      .select({ productId: storefrontCollectionItemTable.productId })
      .from(storefrontCollectionItemTable)
      .where(eq(storefrontCollectionItemTable.collectionId, id))
      .orderBy(asc(storefrontCollectionItemTable.position));

    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      position: row.position,
      showInHome: row.showInHome,
      isActive: row.isActive,
      productCount: items.length,
      productIds: items.map((i) => i.productId),
    };
  });
}

export type UpsertResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function upsertCollection(
  input: UpsertCollectionInput,
): Promise<UpsertResult> {
  const ctx = await getSessionAndStore();
  if (!ctx) return { ok: false, error: "Sessão expirada." };

  // Sprint 1.5 — rate limit mutation por userId (auditoria 2026-05-21 doc 04).
  try {
    await checkRateLimit(rateLimits.mutation, ctx.session.user.id);
  } catch (err) {
    if (err instanceof RateLimitError) {
      return { ok: false, error: err.message };
    }
    throw err;
  }

  const parsed = upsertSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (!fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return { ok: false, error: "Verifique os campos.", fieldErrors };
  }
  const data = parsed.data;
  const slug = data.slug ?? toSlug(data.name);

  if (!SLUG_RE.test(slug)) {
    return {
      ok: false,
      error: "Slug inválido.",
      fieldErrors: { slug: "Use letras minúsculas, números e hífens." },
    };
  }

  try {
    return await withTenant(
      ctx.store.id,
      ctx.session.user.id,
      async (tx): Promise<UpsertResult> => {
        // Verifica colisão de slug (com OUTRA coleção)
        const slugCollision = await tx
          .select({ id: storefrontCollectionTable.id })
          .from(storefrontCollectionTable)
          .where(
            and(
              eq(storefrontCollectionTable.storeId, ctx.store.id),
              eq(storefrontCollectionTable.slug, slug),
              data.id
                ? ne(storefrontCollectionTable.id, data.id)
                : sql`true`,
            ),
          )
          .limit(1);
        if (slugCollision.length > 0) {
          return {
            ok: false,
            error: "Já existe coleção com este endereço.",
            fieldErrors: { slug: "Slug já usado nesta loja." },
          };
        }

        if (data.id) {
          await tx
            .update(storefrontCollectionTable)
            .set({
              name: data.name,
              slug,
              description: data.description,
              showInHome: data.showInHome,
              isActive: data.isActive,
              position: data.position,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(storefrontCollectionTable.storeId, ctx.store.id),
                eq(storefrontCollectionTable.id, data.id),
              ),
            );
          revalidatePath("/admin/colecoes");
          revalidateTag(`store-${ctx.store.slug}`);
          return { ok: true, id: data.id };
        }

        const [row] = await tx
          .insert(storefrontCollectionTable)
          .values({
            storeId: ctx.store.id,
            name: data.name,
            slug,
            description: data.description,
            showInHome: data.showInHome,
            isActive: data.isActive,
            position: data.position,
          })
          .returning({ id: storefrontCollectionTable.id });
        if (!row) return { ok: false, error: "Falha ao salvar." };
        revalidatePath("/admin/colecoes");
        revalidateTag(`store-${ctx.store.slug}`);
        return { ok: true, id: row.id };
      },
    );
  } catch (e) {
    logger.error("collection.upsert_failed", { err: e });
    return { ok: false, error: "Falha ao salvar coleção." };
  }
}

export async function deleteCollection(id: string): Promise<{ ok: boolean }> {
  const ctx = await getSessionAndStore();
  if (!ctx) return { ok: false };

  // Sprint 1.5 — rate limit mutation (auditoria 2026-05-21 doc 04).
  try {
    await checkRateLimit(rateLimits.mutation, ctx.session.user.id);
  } catch (err) {
    if (err instanceof RateLimitError) {
      return { ok: false };
    }
    throw err;
  }

  try {
    await withTenant(ctx.store.id, ctx.session.user.id, async (tx) => {
      await tx
        .delete(storefrontCollectionTable)
        .where(
          and(
            eq(storefrontCollectionTable.storeId, ctx.store.id),
            eq(storefrontCollectionTable.id, id),
          ),
        );
    });
    revalidatePath("/admin/colecoes");
    revalidateTag(`store-${ctx.store.slug}`);
    return { ok: true };
  } catch (e) {
    logger.error("collection.delete_failed", { err: e });
    return { ok: false };
  }
}

const setProductsSchema = z.object({
  collectionId: z.string().uuid(),
  productIds: z.array(z.string().uuid()).max(200),
});

export async function setCollectionProducts(
  input: z.infer<typeof setProductsSchema>,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getSessionAndStore();
  if (!ctx) return { ok: false, error: "Sessão expirada." };

  // Sprint 1.5 — rate limit mutation (auditoria 2026-05-21 doc 04).
  try {
    await checkRateLimit(rateLimits.mutation, ctx.session.user.id);
  } catch (err) {
    if (err instanceof RateLimitError) {
      return { ok: false, error: err.message };
    }
    throw err;
  }

  const parsed = setProductsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };

  try {
    await withTenant(ctx.store.id, ctx.session.user.id, async (tx) => {
      // Confirma que collection é da loja
      const col = await tx
        .select({ id: storefrontCollectionTable.id })
        .from(storefrontCollectionTable)
        .where(
          and(
            eq(storefrontCollectionTable.id, parsed.data.collectionId),
            eq(storefrontCollectionTable.storeId, ctx.store.id),
          ),
        )
        .limit(1);
      if (col.length === 0) throw new Error("Coleção não encontrada");

      // Valida que produtos pertencem à loja
      if (parsed.data.productIds.length > 0) {
        const found = await tx
          .select({ id: productTable.id })
          .from(productTable)
          .where(
            and(
              eq(productTable.storeId, ctx.store.id),
              inArray(productTable.id, parsed.data.productIds),
            ),
          );
        if (found.length !== parsed.data.productIds.length) {
          throw new Error("Produto fora da loja");
        }
      }

      // Wipe + re-insert (simples; ordem definida pelo array)
      await tx
        .delete(storefrontCollectionItemTable)
        .where(
          eq(
            storefrontCollectionItemTable.collectionId,
            parsed.data.collectionId,
          ),
        );

      if (parsed.data.productIds.length > 0) {
        await tx.insert(storefrontCollectionItemTable).values(
          parsed.data.productIds.map((pid, idx) => ({
            collectionId: parsed.data.collectionId,
            productId: pid,
            storeId: ctx.store.id,
            position: idx,
          })),
        );
      }
    });
    revalidatePath("/admin/colecoes");
    revalidateTag(`store-${ctx.store.slug}`);
    return { ok: true };
  } catch (e) {
    logger.error("collection.set_products_failed", { err: e });
    return { ok: false, error: "Falha ao salvar produtos." };
  }
}

/**
 * Lista produtos da loja pra picker (usado no modal de edição da coleção).
 * Limit alto pra abranger SMB; filtrar por nome no client.
 */
export async function listProductsForCollectionPicker(): Promise<
  { id: string; name: string; slug: string; basePriceInCents: number }[]
> {
  const ctx = await getSessionAndStore();
  if (!ctx) return [];
  return withTenant(ctx.store.id, ctx.session.user.id, async (tx) => {
    return tx
      .select({
        id: productTable.id,
        name: productTable.name,
        slug: productTable.slug,
        basePriceInCents: productTable.basePriceInCents,
      })
      .from(productTable)
      .where(eq(productTable.storeId, ctx.store.id))
      .orderBy(asc(productTable.name))
      .limit(500);
  });
}
