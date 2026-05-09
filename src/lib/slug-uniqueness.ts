import { and, eq, like, ne, or } from "drizzle-orm";

import { db } from "@/db";
import { productTable } from "@/db/schema";
import type { Tx } from "@/lib/tenant";

import { generateSlug } from "./slug";

/**
 * Gera slug único dentro de uma loja, partindo do nome do produto.
 *
 * Estratégia: gera slug base via `generateSlug(name)`. Se já existir naquela
 * loja, tenta `slug-2`, `slug-3`, ... até achar livre.
 *
 * Uma única query busca todos os slugs já tomados que sejam exatamente `base`
 * ou começam com `base-`. O cálculo do sufixo acontece no JS — barato.
 *
 * `excludeProductId` (opcional): ignora o próprio produto na verificação. Usado
 * em update pra um produto poder manter seu slug atual sem conflitar com ele
 * mesmo.
 *
 * `client` (opcional): use um Tx ativo (de dentro de `withTenant`) para que a
 * query passe pelo GUC de tenant. Default = `db` (para callers que ainda não
 * estão dentro de withTenant).
 */
export async function generateUniqueProductSlug(params: {
  storeId: string;
  name: string;
  excludeProductId?: string;
  client?: Tx;
}): Promise<string> {
  const { storeId, name, excludeProductId, client = db } = params;
  const base = generateSlug(name);

  if (!base) {
    // Nome só com caracteres que viram vazio após slugify (emojis, símbolos).
    // Caller geralmente vai validar `name.trim().length` antes; isto é só
    // último recurso.
    return `produto-${Date.now()}`;
  }

  const taken = await client
    .select({ slug: productTable.slug })
    .from(productTable)
    .where(
      and(
        eq(productTable.storeId, storeId),
        excludeProductId ? ne(productTable.id, excludeProductId) : undefined,
        or(
          eq(productTable.slug, base),
          like(productTable.slug, `${base}-%`),
        ),
      ),
    );

  const takenSet = new Set(taken.map((r) => r.slug));
  if (!takenSet.has(base)) return base;

  let n = 2;
  while (takenSet.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}
