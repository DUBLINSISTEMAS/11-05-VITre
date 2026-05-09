/**
 * Resolve a loja do usuário logado.
 *
 * MVP: 1 usuário = 1 loja. Quando suportarmos multi-loja por owner (Fase 4+),
 * `getCurrentStore` ganha um parâmetro de seleção (ex: store id da query).
 *
 * `cache()` do React dedupa no mesmo request — layout + page admin fazem 1 query.
 *
 * Bootstrap: aqui ainda não sabemos qual store é. Usamos `withTenant("", userId)`:
 * o GUC `app.current_user_id` é setado e a policy `store_owner_access` deixa o
 * SELECT passar (`owner_id = current_setting('app.current_user_id')`). Sem
 * `current_store_id`, as outras policies permanecem fechadas — escopo correto.
 */
import { eq } from "drizzle-orm";
import { cache } from "react";

import { type Store, storeTable } from "@/db/schema";
import { withTenant } from "@/lib/tenant";

export const getCurrentStore = cache(
  async (userId: string): Promise<Store | null> => {
    return withTenant("", userId, async (tx) => {
      const store = await tx.query.storeTable.findFirst({
        where: eq(storeTable.ownerId, userId),
      });
      return store ?? null;
    });
  },
);
