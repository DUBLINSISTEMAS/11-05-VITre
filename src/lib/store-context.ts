/**
 * Resolve a loja do usuário logado.
 *
 * MVP: 1 usuário = 1 loja. Quando suportarmos multi-loja por owner (Fase 4+),
 * `getCurrentStore` ganha um parâmetro de seleção (ex: store id da query).
 *
 * `cache()` do React dedupa no mesmo request — layout + page admin fazem 1 query.
 *
 * Bootstrap: aqui ainda não sabemos qual store é. Usamos `OWNER_SCOPE_SENTINEL`
 * (UUID-zeros) no GUC `app.current_store_id`. A policy `store_owner_access`
 * deixa o SELECT passar via `owner_id = current_setting('app.current_user_id')`.
 * As demais policies permanecem fechadas pq o sentinela nunca casa com id
 * real (escopo correto). Ver `OWNER_SCOPE_SENTINEL` em `tenant.ts` pra o
 * porquê de não usarmos string vazia.
 */
import { eq } from "drizzle-orm";
import { cache } from "react";

import { type Store, storeTable } from "@/db/schema";
import { OWNER_SCOPE_SENTINEL, withTenant } from "@/lib/tenant";

export const getCurrentStore = cache(
  async (userId: string): Promise<Store | null> => {
    return withTenant(OWNER_SCOPE_SENTINEL, userId, async (tx) => {
      const store = await tx.query.storeTable.findFirst({
        where: eq(storeTable.ownerId, userId),
      });
      return store ?? null;
    });
  },
);
