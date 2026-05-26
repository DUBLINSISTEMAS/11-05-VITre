/**
 * Script de backup manual via pg_dump.
 *
 * S1.6 do Plano de Endurecimento. Roda local OU via GitHub Action semanal.
 * Output: backups/YYYY-MM-DD.sql.gz
 *
 * Uso local:
 *   node --env-file=.env.local scripts/backup-snapshot.mjs
 *
 * Uso CI (.github/workflows/backup-weekly.yml):
 *   - Postgres ephemeral não existe nesse contexto — usa DIRECT_URL do
 *     secret PROD_DIRECT_URL (read-only role recomendado em Sprint 2).
 *   - Sobe artifact com retenção 30 dias.
 *
 * Requer: pg_dump no PATH (Postgres 16+ client tools).
 * No Linux CI: `apt-get install postgresql-client-16`. No Windows local:
 * vem com Postgres instalado OU baixar de https://www.postgresql.org/download/
 */
import { execSync } from "node:child_process";
import { mkdirSync, existsSync } from "node:fs";
import path from "node:path";

const DIRECT_URL = process.env.DIRECT_URL;
if (!DIRECT_URL) {
  console.error("ERRO: DIRECT_URL ausente. Setar .env.local ou env var.");
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
const BACKUP_DIR = path.resolve(process.cwd(), "backups");
const OUT_FILE = path.join(BACKUP_DIR, `${today}.sql.gz`);

if (!existsSync(BACKUP_DIR)) {
  mkdirSync(BACKUP_DIR, { recursive: true });
}

console.log(`→ pg_dump → ${OUT_FILE}`);
console.log(`  DB: ${DIRECT_URL.replace(/:[^:@]+@/, ":***@")}`);

try {
  // --no-owner: ignora roles do dono (vitre_app, postgres) — restore funciona
  //             em qualquer cluster sem precisar pré-criar essas roles.
  // --no-privileges: ignora GRANT lines — restore reaplica via SQLs do projeto.
  // --clean --if-exists: gera DROP IF EXISTS antes de CREATE pra restore safe.
  //                       Não usar em prod sem certeza! Aqui é pra backup.
  // --format=plain: SQL legível humano (vs --format=custom binário).
  // pipe pra gzip pra reduzir tamanho ~10x.
  const cmd = process.platform === "win32"
    ? `pg_dump --no-owner --no-privileges --format=plain "${DIRECT_URL}" | gzip > "${OUT_FILE}"`
    : `pg_dump --no-owner --no-privileges --format=plain "${DIRECT_URL}" | gzip > "${OUT_FILE}"`;

  execSync(cmd, { stdio: "inherit", shell: true });

  // Sanity check: arquivo não-vazio
  const { statSync } = await import("node:fs");
  const stats = statSync(OUT_FILE);
  if (stats.size < 1000) {
    throw new Error(`Backup file suspeito (${stats.size} bytes — esperado >1KB)`);
  }
  console.log(`✓ ${OUT_FILE} (${(stats.size / 1024).toFixed(1)} KB)`);

  // GH Actions: imprime path pro próximo step uploadar como artifact
  if (process.env.GITHUB_OUTPUT) {
    const { appendFile } = await import("node:fs/promises");
    await appendFile(
      process.env.GITHUB_OUTPUT,
      `backup_file=${OUT_FILE}\n` + `backup_date=${today}\n`,
    );
  }
} catch (err) {
  console.error("✗ pg_dump falhou");
  console.error(err.message);
  process.exit(1);
}
