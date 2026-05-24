// Limpeza do DB:
//   1) DROP da coluna órfã banner.linked_category_slug
//   2) Resync do drizzle.__drizzle_migrations com as 9 migrations locais
//
// Tudo dentro de UMA transação. Backup do estado atual gravado em
// scripts/migrations-backup-<ISO>.json antes do TRUNCATE.
// Hash algorithm: SHA256( conteúdo do .sql em LF ).
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

import pg from "pg";

const directUrl = process.env.DIRECT_URL;
if (!directUrl) {
  console.error("DIRECT_URL ausente em .env.local");
  process.exit(1);
}

const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8"));
console.log(`Journal local: ${journal.entries.length} migrations\n`);

// Calcula (hash, created_at) das 9 migrations
const expected = journal.entries.map((e) => {
  const sqlLf = readFileSync(`drizzle/${e.tag}.sql`, "utf8").replace(/\r\n/g, "\n");
  const hash = createHash("sha256").update(sqlLf).digest("hex");
  return { tag: e.tag, hash, created_at: e.when };
});

console.log("Hashes calculados:");
for (const e of expected) console.log(`  ${e.tag.padEnd(45)} ${e.hash.slice(0, 24)}…  when=${e.created_at}`);

const client = new pg.Client({ connectionString: directUrl });
await client.connect();

try {
  // -- BACKUP fora da transação (read-only) --
  const before = await client.query(
    `select id, hash, created_at from "drizzle"."__drizzle_migrations" order by id`,
  );
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = `scripts/migrations-backup-${ts}.json`;
  writeFileSync(backupPath, JSON.stringify(before.rows, null, 2));
  console.log(`\n💾 Backup gravado em ${backupPath} (${before.rowCount} linhas)\n`);

  // -- Pre-flight: confirma que coluna órfã existe --
  const colCheck = await client.query(`
    select 1 from information_schema.columns
     where table_schema='public' and table_name='banner' and column_name='linked_category_slug'
  `);
  const hasOrphan = colCheck.rowCount > 0;
  console.log(`Pre-flight: banner.linked_category_slug ${hasOrphan ? "existe (será dropada)" : "ausente (skip)"}`);

  // -- TRANSAÇÃO --
  await client.query("BEGIN");

  if (hasOrphan) {
    await client.query(`ALTER TABLE "banner" DROP COLUMN IF EXISTS "linked_category_slug"`);
    console.log("✅ Coluna órfã dropada");
  }

  await client.query(`DELETE FROM "drizzle"."__drizzle_migrations"`);
  console.log("✅ __drizzle_migrations limpa");

  // Insere com IDs sequenciais (drizzle-kit espera id=ordinal+1)
  for (let i = 0; i < expected.length; i++) {
    const e = expected[i];
    await client.query(
      `INSERT INTO "drizzle"."__drizzle_migrations" (id, hash, created_at) VALUES ($1, $2, $3)`,
      [i + 1, e.hash, e.created_at],
    );
  }
  console.log(`✅ ${expected.length} entries reinseridas`);

  // Reseta a sequence pra evitar conflito futuro
  await client.query(
    `SELECT setval(pg_get_serial_sequence('drizzle.__drizzle_migrations','id'), $1, true)`,
    [expected.length],
  );
  console.log(`✅ sequence id resetada para ${expected.length}`);

  await client.query("COMMIT");
  console.log("\n🎉 COMMIT — limpeza aplicada");

  // -- Verificação final --
  const after = await client.query(
    `select id, hash, created_at from "drizzle"."__drizzle_migrations" order by id`,
  );
  console.log(`\nEstado final (${after.rowCount} entries):`);
  for (const r of after.rows) console.log(`  id=${r.id} ${String(r.hash).slice(0, 24)}…  when=${r.created_at}`);

  const orphanCheck = await client.query(`
    select 1 from information_schema.columns
     where table_schema='public' and table_name='banner' and column_name='linked_category_slug'
  `);
  console.log(`\nbanner.linked_category_slug: ${orphanCheck.rowCount > 0 ? "AINDA EXISTE (erro!)" : "removida ✅"}`);
} catch (e) {
  await client.query("ROLLBACK").catch(() => {});
  console.error("\n❌ ERRO — ROLLBACK aplicado. Estado preservado.");
  console.error(e);
  process.exit(2);
} finally {
  await client.end();
}
