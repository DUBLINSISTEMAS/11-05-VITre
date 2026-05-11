/**
 * Helper de tenant context para queries com Postgres RLS.
 *
 * Uso:
 *   await withTenant(storeId, userId, async (tx) => {
 *     const products = await tx.query.productTable.findMany();
 *   });
 *
 * Toda query feita através de `tx` carrega o GUC `app.current_store_id`,
 * que é o que as policies RLS verificam.
 *
 * Para anônimos (storefront público), passe `userId = null` — as policies
 * `public_read_active` permitem leitura de itens com `is_active = true`.
 */
import { sql } from "drizzle-orm";

import { db, serviceDb } from "@/db";
import { logger } from "@/lib/logger";

export const ANON_USER_ID = "anonymous";

/**
 * Tipo do client Drizzle dentro de uma transação. Exporta pra que callers
 * tipem helpers que recebem `tx` sem indireções (`Parameters<...>[0]`).
 */
export type Tx = typeof db;

export async function withTenant<T>(
  storeId: string,
  userId: string | null,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_store_id', ${storeId}, true)`);
    await tx.execute(
      sql`SELECT set_config('app.current_user_id', ${userId ?? ANON_USER_ID}, true)`,
    );
    return fn(tx as unknown as Tx);
  });
}

/**
 * Bypass RLS — uso APENAS para:
 *   - resolver `storeSlug` antes de saber o tenant (storefront)
 *   - jobs de sistema (cron, seeds, sitemap cross-tenant)
 *   - operações cross-tenant (futuro: admin Vitrê)
 *
 * Usa `serviceDb` (pool dedicado com role `postgres` BYPASSRLS via
 * DIRECT_URL). O pool padrão `db` usa role `vitre_app` NOBYPASSRLS, então
 * cross-tenant ali sempre retornaria zero rows sob FORCE RLS.
 *
 * Sempre logar uso explícito.
 */
export async function withServiceRole<T>(
  reason: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  logger.warn("tenant.service_role_bypass", { reason });
  return fn(serviceDb as unknown as Tx);
}
