"use server";

/**
 * Server actions do domínio brand (Sprint 2A).
 *
 * Padrões CLAUDE.md:
 * - withTenant sempre (RLS-first; policy brand_tenant_isolation valida store_id)
 * - Zod boundaries (upsertBrandSchema, deleteBrandSchema)
 * - revalidatePath /admin/marcas + /admin/produtos (form de produto consome lista)
 * - revalidateTag store-${slug} pra storefront (se algum dia mostrar marca pública)
 * - Rate limit em mutações (toda action que escreve)
 * - slug auto-gerado se não fornecido
 *
 * Coexistência com texto livre:
 * - product.brand (text) é snapshot histórico
 * - product.brand_id (uuid) é FK opcional pra brand.id
 * - update do produto que escolha brand do select preenche AMBOS
 */
import { and, count, eq, ne, sql } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";

import { brandTable, productTable } from "@/db/schema";
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
  deleteBrandSchema,
  slugifyBrand,
  type UpsertBrandInput,
  upsertBrandSchema,
} from "./schema";
import type { BrandListRow } from "./types";

async function getSessionAndStore() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  const store = await getCurrentStore(session.user.id);
  if (!store) return null;
  return { session, store };
}

/**
 * Lista marcas da loja atual com contagem de produtos referenciando cada uma.
 * Read-only, sem rate limit (admin autenticado + RLS).
 */
export async function loadBrands(): Promise<BrandListRow[]> {
  const ctx = await getSessionAndStore();
  if (!ctx) return [];

  return withTenant(ctx.store.id, ctx.session.user.id, async (tx) => {
    const rows = await tx
      .select({
        id: brandTable.id,
        name: brandTable.name,
        slug: brandTable.slug,
        createdAt: brandTable.createdAt,
        updatedAt: brandTable.updatedAt,
        productCount: sql<number>`coalesce(count(${productTable.id}) filter (where ${productTable.brandId} = ${brandTable.id}), 0)::int`,
      })
      .from(brandTable)
      .leftJoin(
        productTable,
        and(
          eq(productTable.brandId, brandTable.id),
          eq(productTable.storeId, ctx.store.id),
        ),
      )
      .where(eq(brandTable.storeId, ctx.store.id))
      .groupBy(brandTable.id)
      .orderBy(brandTable.name);

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      productCount: r.productCount,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  });
}

export type UpsertBrandResult =
  | { ok: true; id: string; name: string; slug: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Cria ou atualiza uma marca. Slug auto-gerado do name se não fornecido.
 * Conflito de slug por loja retorna erro com fieldError em `slug`.
 */
export async function upsertBrand(
  input: UpsertBrandInput,
): Promise<UpsertBrandResult> {
  const ctx = await getSessionAndStore();
  if (!ctx) return { ok: false, error: "Sessão expirada." };

  try {
    await checkRateLimit(rateLimits.mutation, ctx.session.user.id);
  } catch (err) {
    if (err instanceof RateLimitError) {
      return { ok: false, error: err.message };
    }
    throw err;
  }

  const parsed = upsertBrandSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (!fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return { ok: false, error: "Verifique os campos.", fieldErrors };
  }

  const data = parsed.data;
  const slug = data.slug ?? slugifyBrand(data.name);

  if (slug.length === 0) {
    return {
      ok: false,
      error: "Não foi possível gerar slug a partir do nome.",
      fieldErrors: { slug: "Slug vazio." },
    };
  }

  try {
    return await withTenant<UpsertBrandResult>(
      ctx.store.id,
      ctx.session.user.id,
      async (tx) => {
        // Detecta colisão de slug. Permite o próprio id (caso edit do mesmo registro).
        const conflict = await tx
          .select({ id: brandTable.id })
          .from(brandTable)
          .where(
            and(
              eq(brandTable.storeId, ctx.store.id),
              eq(brandTable.slug, slug),
              data.id ? ne(brandTable.id, data.id) : undefined,
            ),
          )
          .limit(1);

        if (conflict.length > 0) {
          return {
            ok: false,
            error: "Já existe uma marca com este endereço (slug).",
            fieldErrors: { slug: "Endereço já em uso." },
          };
        }

        if (data.id) {
          const updated = await tx
            .update(brandTable)
            .set({
              name: data.name,
              slug,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(brandTable.id, data.id),
                eq(brandTable.storeId, ctx.store.id),
              ),
            )
            .returning({
              id: brandTable.id,
              name: brandTable.name,
              slug: brandTable.slug,
            });
          const row = updated[0];
          if (!row) return { ok: false, error: "Marca não encontrada." };
          revalidatePath("/admin/marcas");
          revalidatePath("/admin/produtos");
          revalidateTag(`store-${ctx.store.slug}`);
          return { ok: true, id: row.id, name: row.name, slug: row.slug };
        }

        const inserted = await tx
          .insert(brandTable)
          .values({
            storeId: ctx.store.id,
            name: data.name,
            slug,
          })
          .returning({
            id: brandTable.id,
            name: brandTable.name,
            slug: brandTable.slug,
          });
        const row = inserted[0];
        if (!row) return { ok: false, error: "Falha ao criar marca." };
        revalidatePath("/admin/marcas");
        revalidatePath("/admin/produtos");
        revalidateTag(`store-${ctx.store.slug}`);
        return { ok: true, id: row.id, name: row.name, slug: row.slug };
      },
    );
  } catch (e) {
    logger.error("brand.upsert_failed", { err: e });
    return { ok: false, error: "Falha ao salvar marca." };
  }
}

export async function deleteBrand(
  input: { id: string },
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getSessionAndStore();
  if (!ctx) return { ok: false, error: "Sessão expirada." };

  try {
    await checkRateLimit(rateLimits.mutation, ctx.session.user.id);
  } catch (err) {
    if (err instanceof RateLimitError) {
      return { ok: false, error: err.message };
    }
    throw err;
  }

  const parsed = deleteBrandSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };

  try {
    await withTenant(ctx.store.id, ctx.session.user.id, async (tx) => {
      // Produtos que referenciam essa marca: brand_id vira NULL (SET NULL no FK).
      // O snapshot em product.brand (texto) FICA preservado — histórico não muda.
      await tx
        .delete(brandTable)
        .where(
          and(
            eq(brandTable.id, parsed.data.id),
            eq(brandTable.storeId, ctx.store.id),
          ),
        );
    });
    revalidatePath("/admin/marcas");
    revalidatePath("/admin/produtos");
    revalidateTag(`store-${ctx.store.slug}`);
    return { ok: true };
  } catch (e) {
    logger.error("brand.delete_failed", { err: e });
    return { ok: false, error: "Falha ao deletar marca." };
  }
}
