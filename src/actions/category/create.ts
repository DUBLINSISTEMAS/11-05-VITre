"use server";

import { and, eq, like, or } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";

import { categoryTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getConstraintName, isUniqueViolation } from "@/lib/db-errors";
import {
  checkRateLimit,
  RateLimitError,
  rateLimits,
} from "@/lib/rate-limit";
import { generateSlug } from "@/lib/slug";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

import { type CreateCategoryInput,createCategorySchema } from "./schema";

export type CreateCategoryResult =
  | {
      ok: true;
      category: { id: string; name: string; slug: string; parentId: string | null };
    }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Cria categoria. Slug único por loja com sufixo `-2/-3/...` se conflito.
 *
 * 2 níveis máximo: se `parentId` é informado, valida que o parent é raiz
 * (`parent_id` dele é null). Cobre o caso "Sandra adiciona sub-sub" mesmo
 * que a UI tenha bloqueado.
 *
 * Mensagens PT-BR claras. Sem jargão de DB.
 */
export async function createCategory(
  input: CreateCategoryInput,
): Promise<CreateCategoryResult> {
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

  const parsed = createCategorySchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (!fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return { ok: false, error: "Confira os campos.", fieldErrors };
  }

  const store = await getCurrentStore(userId);
  if (!store) return { ok: false, error: "Loja não encontrada." };

  type StepResult =
    | {
        ok: true;
        category: { id: string; name: string; slug: string; parentId: string | null };
      }
    | { ok: false; error: string; fieldErrors?: Record<string, string> };

  let result: StepResult;
  try {
    result = await withTenant(store.id, userId, async (tx) => {
      // Valida parent (se informado)
      if (parsed.data.parentId) {
        const parent = await tx.query.categoryTable.findFirst({
          where: and(
            eq(categoryTable.id, parsed.data.parentId),
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
      }

      // Slug único na loja
      const base = generateSlug(parsed.data.name) || "categoria";
      const taken = await tx
        .select({ slug: categoryTable.slug })
        .from(categoryTable)
        .where(
          and(
            eq(categoryTable.storeId, store.id),
            or(
              eq(categoryTable.slug, base),
              like(categoryTable.slug, `${base}-%`),
            ),
          ),
        );
      const takenSet = new Set(taken.map((t) => t.slug));
      let nextSlug = base;
      if (takenSet.has(base)) {
        let n = 2;
        while (takenSet.has(`${base}-${n}`)) n++;
        nextSlug = `${base}-${n}`;
      }

      const [row] = await tx
        .insert(categoryTable)
        .values({
          storeId: store.id,
          parentId: parsed.data.parentId,
          name: parsed.data.name,
          slug: nextSlug,
        })
        .returning({
          id: categoryTable.id,
          name: categoryTable.name,
          slug: categoryTable.slug,
          parentId: categoryTable.parentId,
        });

      if (!row) {
        return { ok: false, error: "Falha ao criar categoria." } as const;
      }
      return { ok: true, category: row } as const;
    });
  } catch (e) {
    if (isUniqueViolation(e)) {
      const constraint = getConstraintName(e);
      if (constraint === "category_store_slug_unique") {
        return {
          ok: false,
          error:
            "Outra categoria com nome parecido foi criada agora. Tente outro nome.",
          fieldErrors: { name: "Nome em uso." },
        };
      }
    }
    console.error("[create-category] insert falhou", e);
    return { ok: false, error: "Falha ao criar categoria." };
  }

  if (!result.ok) return result;

  revalidatePath("/admin/categorias");
  revalidateTag(`store-${store.slug}`);

  return result;
}
