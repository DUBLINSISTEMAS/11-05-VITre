"use server";

import { and, eq, like, ne, or } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";

import { categoryTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getConstraintName, isUniqueViolation } from "@/lib/db-errors";
import { logger } from "@/lib/logger";
import {
  checkRateLimit,
  RateLimitError,
  rateLimits,
} from "@/lib/rate-limit";
import { generateSlug } from "@/lib/slug";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

import { type UpdateCategoryInput,updateCategorySchema } from "./schema";

export type UpdateCategoryResult =
  | {
      ok: true;
      category: { id: string; name: string; slug: string; parentId: string | null };
    }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Atualiza categoria. Mesmo padrão de slug do create (regenera quando o
 * slug-base muda), com 3 validações extras:
 *  1. categoria pertence à loja
 *  2. parent != self (sem self-cycle)
 *  3. parent (se informado) é raiz; não permite virar filha de filha
 *
 * Bloqueia transformar uma raiz que já tem filhas em filha (geraria
 * 3 níveis). Mensagem clara quando bloqueia.
 */
export async function updateCategory(
  input: UpdateCategoryInput,
): Promise<UpdateCategoryResult> {
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

  const parsed = updateCategorySchema.safeParse(input);
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

  // 2. Self-cycle: categoria não pode ser pai dela mesma
  if (data.parentId === data.categoryId) {
    return {
      ok: false,
      error: "Uma categoria não pode ser pai dela mesma.",
      fieldErrors: { parentId: "Pai inválido." },
    };
  }

  type StepResult =
    | {
        ok: true;
        category: { id: string; name: string; slug: string; parentId: string | null };
      }
    | { ok: false; error: string; fieldErrors?: Record<string, string> };

  let result: StepResult;
  try {
    result = await withTenant(store.id, userId, async (tx) => {
      // 1. Categoria pertence à loja
      const existing = await tx.query.categoryTable.findFirst({
        where: and(
          eq(categoryTable.id, data.categoryId),
          eq(categoryTable.storeId, store.id),
        ),
        columns: { id: true, name: true, slug: true, parentId: true },
      });
      if (!existing) {
        return { ok: false, error: "Categoria não encontrada." } as const;
      }

      // 3. Validação de hierarquia (2 níveis)
      if (data.parentId) {
        const parent = await tx.query.categoryTable.findFirst({
          where: and(
            eq(categoryTable.id, data.parentId),
            eq(categoryTable.storeId, store.id),
          ),
          columns: { id: true, parentId: true },
        });
        if (!parent) {
          return {
            ok: false,
            error: "Categoria pai não encontrada.",
            fieldErrors: { parentId: "Categoria pai inválida." },
          } as const;
        }
        if (parent.parentId !== null) {
          return {
            ok: false,
            error: "Categorias só podem ter 2 níveis.",
            fieldErrors: { parentId: "Esta categoria já é uma subcategoria." },
          } as const;
        }

        if (existing.parentId === null) {
          const hasChildren = await tx.query.categoryTable.findFirst({
            where: and(
              eq(categoryTable.parentId, data.categoryId),
              eq(categoryTable.storeId, store.id),
            ),
            columns: { id: true },
          });
          if (hasChildren) {
            return {
              ok: false,
              error:
                "Esta categoria tem subcategorias. Mova ou apague antes de torná-la subcategoria.",
              fieldErrors: { parentId: "Tem subcategorias." },
            } as const;
          }
        }
      }

      // 4. Slug: regenera se o slug-base mudou
      const slugBaseChanged =
        generateSlug(existing.name) !== generateSlug(data.name);
      let nextSlug = existing.slug;
      if (slugBaseChanged) {
        const base = generateSlug(data.name) || "categoria";
        const taken = await tx
          .select({ slug: categoryTable.slug })
          .from(categoryTable)
          .where(
            and(
              eq(categoryTable.storeId, store.id),
              ne(categoryTable.id, data.categoryId),
              or(
                eq(categoryTable.slug, base),
                like(categoryTable.slug, `${base}-%`),
              ),
            ),
          );
        const takenSet = new Set(taken.map((t) => t.slug));
        nextSlug = base;
        if (takenSet.has(base)) {
          let n = 2;
          while (takenSet.has(`${base}-${n}`)) n++;
          nextSlug = `${base}-${n}`;
        }
      }

      const [row] = await tx
        .update(categoryTable)
        .set({
          name: data.name,
          slug: nextSlug,
          parentId: data.parentId,
        })
        .where(
          and(
            eq(categoryTable.id, data.categoryId),
            eq(categoryTable.storeId, store.id),
          ),
        )
        .returning({
          id: categoryTable.id,
          name: categoryTable.name,
          slug: categoryTable.slug,
          parentId: categoryTable.parentId,
        });

      if (!row) {
        return { ok: false, error: "Falha ao salvar categoria." } as const;
      }

      return { ok: true, category: row } as const;
    });
  } catch (e) {
    if (isUniqueViolation(e)) {
      const constraint = getConstraintName(e);
      if (constraint === "category_store_slug_unique") {
        return {
          ok: false,
          error: "Outra categoria usa um nome muito parecido. Tente outro.",
          fieldErrors: { name: "Nome em uso." },
        };
      }
    }
    logger.error("category.update_failed", {
      err: e,
      storeId: store.id,
      categoryId: data.categoryId,
    });
    return { ok: false, error: "Falha ao salvar categoria." };
  }

  if (!result.ok) return result;

  revalidatePath("/admin/categorias");
  revalidatePath("/admin/produtos");
  revalidateTag(`store-${store.slug}`);

  return result;
}
