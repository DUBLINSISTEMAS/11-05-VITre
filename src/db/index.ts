/**
 * Drizzle clients conectados ao Supabase Postgres.
 *
 * Dois pools distintos:
 *
 * 1. `db` — usa `DATABASE_URL` (pooler PgBouncer transaction mode, role
 *    `vitre_app` com NOBYPASSRLS). É o pool padrão para todo código de
 *    aplicação. Toda query passa por `withTenant(...)` que seta o GUC
 *    `app.current_store_id` antes da execução. Sob FORCE RLS, queries
 *    sem GUC retornam 0 rows.
 *
 * 2. `serviceDb` — usa `DIRECT_URL` (porta 5432 session mode, role
 *    `postgres` que tem BYPASSRLS). É o "service role" para operações
 *    legítimas cross-tenant: sitemap, resolução de slug → store antes
 *    de saber o tenant, crons de sistema. SEMPRE acessar via
 *    `withServiceRole(reason, fn)` em "@/lib/tenant" (loga o motivo
 *    pra auditoria).
 *
 * - Em produção (Vercel serverless), uma instância nova pode ser criada
 *   por invocation; o pooler do Supabase é quem gerencia conexões reais.
 * - Em dev, reusamos os pools via `globalThis` para evitar leak entre
 *   HMR reloads.
 *
 * Env vars são populadas pelo Next (`.env.local` em dev, painel Vercel
 * em prod). Scripts CLI fora do Next (drizzle-kit, tsx) carregam
 * `.env.local` por conta própria.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { env } from "@/lib/env";

import * as schema from "./schema";

declare global {

  var _vitrePool: Pool | undefined;

  var _vitreServicePool: Pool | undefined;
}

// Capacity planning Sprint 0 (S0.1):
//
//   Supabase Free ceiling = 60 conexões. Plano Pro = 200.
//   Target: 10-15 lojas operando todo dia, com tráfego storefront público
//   + admin de cada loja + crons + crawlers (Google).
//
//   `db` (RLS-bound, role vitre_app): caminho quente. Cada warm lambda
//   da Vercel mantém o pool. Com max:5 e 4-6 lambdas warm em pico, são
//   20-30 conexões reservadas — folga até o teto. Bumpar pra Supabase
//   Pro quando passar de 30 lojas (gate Fase 3).
//
//   `serviceDb` (BYPASSRLS, role postgres): uso raríssimo (sitemap,
//   resolver slug→store antes de saber tenant, crons). max:1 basta —
//   PgBouncer fila o resto, latência aceitável.
//
//   Se ver `error: sorry, too many clients already`: PRIMEIRA ação é
//   medir lambdas warm via Vercel Observability, NÃO bumpar max cegamente.
const pool =
  global._vitrePool ??
  new Pool({
    connectionString: env.DATABASE_URL,
    max: 5,
  });

const servicePool =
  global._vitreServicePool ??
  new Pool({
    connectionString: env.DIRECT_URL,
    // max:2 (era 1) — Onda 4 redesign storefront 2026-05-26.
    // Storefront público resolve slug→store via serviceDb a CADA
    // request (`getStoreBySlug` em layout + page + metadata). Com
    // max:1, picos de tráfego (2+ visitas concorrentes na mesma
    // lambda warm) filam no Pool e podem timeoutar → error boundary
    // "não conseguimos carregar a loja". max:2 dá folga sem
    // pressionar o teto (10-15 lambdas warm × 2 = 30 conexões, ainda
    // dentro do budget Free de 60). Bumpar pra 3-4 quando passar de
    // 20 lojas.
    max: 2,
  });

if (env.NODE_ENV !== "production") {
  global._vitrePool = pool;
  global._vitreServicePool = servicePool;
}

export const db = drizzle(pool, { schema });
export const serviceDb = drizzle(servicePool, { schema });

export type Database = typeof db;
