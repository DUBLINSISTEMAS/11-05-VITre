/**
 * Inspeção read-only do Supabase atual pra decidir se serve como prod.
 * Mede: dados de teste, tamanhos, conexões, e extrai metadados úteis.
 *
 * Uso: node scripts/inspect-prod-readiness.mjs
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { Pool } from "pg";

const url = process.env.DIRECT_URL;
const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "(ausente)";

if (!url) {
  console.error("DIRECT_URL ausente em .env.local");
  process.exit(1);
}

// Extrai metadata da URL sem expor secrets
function parseDsn(dsn) {
  try {
    const u = new URL(dsn);
    return {
      host: u.hostname,
      port: u.port,
      database: u.pathname.replace("/", ""),
      user: u.username,
      pooler: u.hostname.includes("pooler"),
      region: u.hostname.match(/aws-\d+-([^.]+)\./)?.[1] ?? "?",
    };
  } catch {
    return null;
  }
}

const meta = parseDsn(url);
console.log("=== METADATA ===");
console.log(`Supabase URL:  ${supaUrl}`);
console.log(`Project ref:   ${supaUrl.match(/https:\/\/([^.]+)\./)?.[1] ?? "?"}`);
console.log(`DB host:       ${meta?.host ?? "?"}`);
console.log(`DB region:     ${meta?.region ?? "?"}`);
console.log(`DB pooler:     ${meta?.pooler ? "sim (transaction mode)" : "não (direta)"}`);
console.log(`DB port:       ${meta?.port}`);
console.log();

const pool = new Pool({ connectionString: url });

async function main() {
  try {
    // Versão do Postgres
    const ver = await pool.query("SELECT version() AS v");
    console.log("=== POSTGRES ===");
    console.log(`  ${ver.rows[0].v.split(",")[0]}`);
    console.log();

    // Tamanho do banco
    const size = await pool.query(`
      SELECT pg_size_pretty(pg_database_size(current_database())) AS db_size
    `);
    console.log("=== TAMANHO ===");
    console.log(`  DB total: ${size.rows[0].db_size}`);

    const topTables = await pool.query(`
      SELECT
        schemaname || '.' || tablename AS tbl,
        pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS sz
      FROM pg_tables
      WHERE schemaname IN ('public', 'storage', 'auth')
      ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC
      LIMIT 8
    `);
    console.log("  Top 8 tabelas por tamanho:");
    for (const r of topTables.rows) console.log(`    ${r.tbl.padEnd(40)} ${r.sz}`);
    console.log();

    // Dados de domínio
    console.log("=== DADOS DE DOMÍNIO ===");
    const counts = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS c FROM store`),
      pool.query(`SELECT COUNT(*)::int AS c FROM "user"`),
      pool.query(`SELECT COUNT(*)::int AS c FROM session`),
      pool.query(`SELECT COUNT(*)::int AS c FROM product`),
      pool.query(`SELECT COUNT(*)::int AS c FROM product_variant`),
      pool.query(`SELECT COUNT(*)::int AS c FROM product_image`),
      pool.query(`SELECT COUNT(*)::int AS c FROM "order"`),
      pool.query(`SELECT COUNT(*)::int AS c FROM order_item`),
      pool.query(`SELECT COUNT(*)::int AS c FROM order_payment`),
      pool.query(`SELECT COUNT(*)::int AS c FROM customer`),
      pool.query(`SELECT COUNT(*)::int AS c FROM receivable`),
      pool.query(`SELECT COUNT(*)::int AS c FROM purchase`),
      pool.query(`SELECT COUNT(*)::int AS c FROM stock_movement`),
      pool.query(`SELECT COUNT(*)::int AS c FROM cash_session`),
      pool.query(`SELECT COUNT(*)::int AS c FROM audit_event`),
      pool.query(`SELECT COUNT(*)::int AS c FROM lead`),
    ]);
    const labels = [
      "store", "user", "session", "product", "product_variant", "product_image",
      "order", "order_item", "order_payment", "customer", "receivable",
      "purchase", "stock_movement", "cash_session", "audit_event", "lead",
    ];
    labels.forEach((l, i) => console.log(`  ${l.padEnd(20)} ${counts[i].rows[0].c}`));
    console.log();

    // Lojas existentes (pra ver se tem teste-* / dev-*)
    const stores = await pool.query(`
      SELECT id, slug, name, niche, is_active, created_at
      FROM store
      ORDER BY created_at DESC
      LIMIT 20
    `);
    console.log("=== LOJAS ===");
    if (stores.rows.length === 0) {
      console.log("  (nenhuma)");
    } else {
      for (const s of stores.rows) {
        console.log(`  ${s.slug.padEnd(30)} ${s.name?.padEnd(35) ?? ""} active=${s.is_active}  ${s.created_at.toISOString().slice(0, 10)}`);
      }
    }
    console.log();

    // Usuários (pra ver se tem testes)
    const userCols = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name='user'
      ORDER BY ordinal_position
    `);
    const has = (c) => userCols.rows.some((r) => r.column_name === c);
    const verifCol = has("emailVerified") ? `"emailVerified"` : (has("email_verified") ? `email_verified` : `NULL`);
    const createdCol = has("createdAt") ? `"createdAt"` : (has("created_at") ? `created_at` : `NULL`);
    const roleCol = has("role") ? `role` : `NULL`;
    const users = await pool.query(`
      SELECT email, ${verifCol} AS ev, ${roleCol} AS role, ${createdCol} AS ca
      FROM "user"
      ORDER BY ${createdCol} DESC NULLS LAST
      LIMIT 20
    `);
    console.log("=== USUÁRIOS ===");
    if (users.rows.length === 0) {
      console.log("  (nenhum)");
    } else {
      for (const u of users.rows) {
        const dt = u.ca instanceof Date ? u.ca.toISOString().slice(0, 10) : "—";
        console.log(`  ${u.email.padEnd(40)} verified=${u.ev}  role=${u.role ?? "-"}  ${dt}`);
      }
    }
    console.log();

    // Idade das sessões mais recentes (atividade)
    const sessCols = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name='session'
    `);
    const sessHas = (c) => sessCols.rows.some((r) => r.column_name === c);
    const expCol = sessHas("expiresAt") ? `"expiresAt"` : (sessHas("expires_at") ? `expires_at` : `NULL`);
    const lastActivity = await pool.query(`SELECT MAX(${expCol}) AS last_session FROM session`);
    const lastOrder = await pool.query(`SELECT MAX(created_at) AS last_order FROM "order"`);
    console.log("=== ATIVIDADE ===");
    console.log(`  Última sessão (expiresAt): ${lastActivity.rows[0].last_session ?? "—"}`);
    console.log(`  Último pedido:             ${lastOrder.rows[0].last_order ?? "—"}`);
    console.log();

    // Extensões instaladas
    const exts = await pool.query(`
      SELECT extname, extversion
      FROM pg_extension
      ORDER BY extname
    `);
    console.log("=== EXTENSÕES ===");
    for (const e of exts.rows) console.log(`  ${e.extname.padEnd(20)} v${e.extversion}`);
    console.log();

    // Roles e conexões
    const roles = await pool.query(`
      SELECT rolname FROM pg_roles
      WHERE rolname NOT LIKE 'pg_%'
        AND rolname IN ('postgres','anon','authenticated','service_role','authenticator','supabase_admin','supabase_auth_admin','dashboard_user')
      ORDER BY rolname
    `);
    console.log("=== ROLES SUPABASE ===");
    for (const r of roles.rows) console.log(`  ${r.rolname}`);
    console.log();

    // Conexões ativas
    const conns = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE state = 'active')::int AS active,
        COUNT(*) FILTER (WHERE state = 'idle')::int AS idle
      FROM pg_stat_activity
      WHERE datname = current_database()
    `);
    const maxConn = await pool.query(`SHOW max_connections`);
    console.log("=== CONEXÕES ===");
    console.log(`  Atuais: total=${conns.rows[0].total}  active=${conns.rows[0].active}  idle=${conns.rows[0].idle}`);
    console.log(`  Max:    ${maxConn.rows[0].max_connections}`);
    console.log();

    // SQL migrations table
    const drizzle = await pool.query(`
      SELECT COUNT(*)::int AS c FROM drizzle.__drizzle_migrations
    `).catch(() => ({ rows: [{ c: "?" }] }));
    console.log("=== DRIZZLE ===");
    console.log(`  Migrations aplicadas: ${drizzle.rows[0].c}`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error("Falha:", e.message);
  process.exit(1);
});
