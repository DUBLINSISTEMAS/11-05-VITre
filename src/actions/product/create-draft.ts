"use server";

import { and, desc, eq, like, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { headers } from "next/headers";

import { productImageTable, productTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  checkRateLimit,
  RateLimitError,
  rateLimits,
} from "@/lib/rate-limit";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

export type CreateDraftProductResult =
  | { ok: true; productId: string }
  | { ok: false; error: string };

/**
 * Cria um produto rascunho (vazio, inativo) e retorna o id.
 *
 * Por que rascunho? Imagens precisam de `productId` para subir pro Storage.
 * Sem produto criado primeiro, o lojista não conseguiria fotografar antes
 * de digitar nome/preço — fluxo péssimo no celular. Criar draft + redirecionar
 * pro `/editar` é o padrão Shopify/Linear.
 *
 * Slug placeholder = `draft-${nanoid(8)}`. O slug real é regenerado a partir
 * do nome no primeiro `updateProduct` que chega com nome preenchido.
 *
 * Defesas:
 * - Rate limit por user (mutation), pra evitar geração descontrolada de drafts.
 * - `redirect()` é responsabilidade do **caller** (server component da rota
 *   `/admin/produtos/novo`), pra manter esta action testável e fora de
 *   try/catch interno.
 */
export async function createDraftProduct(): Promise<CreateDraftProductResult> {
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

  const store = await getCurrentStore(userId);
  if (!store) {
    return { ok: false, error: "Loja não encontrada." };
  }

  try {
    return await withTenant(store.id, userId, async (tx) => {
      // Reuso de draft recente: se lojista clicou "+ Novo produto" e abandonou,
      // evita acumular lixo. Procura draft `draft-*` sem nome E sem imagens
      // criado nas últimas 24h. Se achar, reusa o id.
      const recentDraft = await tx
        .select({
          id: productTable.id,
          imageCount: sql<number>`count(${productImageTable.id})`.mapWith(Number),
        })
        .from(productTable)
        .leftJoin(
          productImageTable,
          eq(productImageTable.productId, productTable.id),
        )
        .where(
          and(
            eq(productTable.storeId, store.id),
            eq(productTable.name, ""),
            like(productTable.slug, "draft-%"),
            sql`${productTable.createdAt} > now() - interval '24 hours'`,
          ),
        )
        .groupBy(productTable.id, productTable.createdAt)
        .orderBy(desc(productTable.createdAt))
        .limit(1);

      if (recentDraft[0] && recentDraft[0].imageCount === 0) {
        return { ok: true, productId: recentDraft[0].id } as const;
      }

      const [row] = await tx
        .insert(productTable)
        .values({
          storeId: store.id,
          name: "",
          slug: `draft-${nanoid(8)}`,
          description: "",
          basePriceInCents: 0,
          isActive: false,
        })
        .returning({ id: productTable.id });

      if (!row) {
        return { ok: false, error: "Falha ao criar rascunho." } as const;
      }

      return { ok: true, productId: row.id } as const;
    });
  } catch (e) {
    logger.error("product.create_draft.insert_failed", {
      err: e,
      storeId: store.id,
    });
    return { ok: false, error: "Falha ao criar rascunho do produto." };
  }
}
