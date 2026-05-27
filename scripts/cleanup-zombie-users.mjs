/**
 * Cleanup de "zombie users" do signup self-service.
 *
 * CONTEXTO (auditoria readiness 15 lojas — 2026-05-27, agente 3)
 * Fluxo `/criar-loja/{conta,identidade,tipo-negocio,bem-vindo}` chama
 * `signUpStoreOwner` no passo 1 (cria row em `user` + session) e
 * `createStore` no passo 3. Se o usuário fecha a aba entre os passos,
 * fica com `user` válido + sessão + SEM store. Admin layout redireciona
 * ele de volta pra `/criar-loja/identidade` se logar de novo — então é
 * recovery-friendly, mas a TABELA INFLA com cada signup abandonado.
 *
 * Em 15 lojas reais, esperamos ~3-5 abandonos por loja completa (taxa
 * de conversão signup→store comum em SaaS). Sem cleanup, em 6 meses
 * `user` tem ~10× mais lixo do que stores reais.
 *
 * SEGURANÇA DA DELEÇÃO
 * Critérios cumulativos (todos verdadeiros pra deletar):
 *  1. User NÃO é owner de nenhuma store (LEFT JOIN store ON owner_id IS NULL)
 *  2. createdAt > 7 dias atrás (signup velho — provável abandono real)
 *  3. Nenhuma session ativa (expiresAt > now() — usuário não tá AGORA logando)
 *
 * O critério 3 protege user que ESTÁ no fluxo AGORA — improvável que demore
 * 7 dias completos no fluxo, mas defesa em profundidade nunca é demais.
 *
 * CASCADE
 * Better Auth `session` e `account` têm FK `ON DELETE CASCADE` pro user.
 * Deletar user → session e account vão junto, sem cleanup adicional.
 *
 * MODOS
 *  --dry-run (default): só lista quantos seriam deletados. NÃO modifica DB.
 *  --apply: executa o DELETE.
 *
 * USO LOCAL
 *  node --env-file=.env.local scripts/cleanup-zombie-users.mjs           # dry-run
 *  node --env-file=.env.local scripts/cleanup-zombie-users.mjs --apply
 *
 * USO CI (.github/workflows/cleanup-zombie-users-weekly.yml)
 *  Roda toda segunda 04:00 UTC (01:00 BRT) com --apply.
 *  Usa secret PROD_DIRECT_URL (compartilhado com backup-weekly.yml).
 *
 * GRACE PERIOD
 * 7 dias = compromisso entre limpar cedo (poupar tabela) e dar margem
 * pra usuário que esquece o tab aberto. Ajustar a constante abaixo se
 * necessário (não envolve schema migration).
 */
import { Pool } from "pg";

const GRACE_DAYS = 7;

const url = process.env.DIRECT_URL;
if (!url) {
  console.error("ERRO: DIRECT_URL ausente. Setar .env.local ou env var.");
  process.exit(1);
}

const apply = process.argv.includes("--apply");
const mode = apply ? "APPLY (DELETE)" : "DRY-RUN (read-only)";

console.log(`→ cleanup-zombie-users [${mode}]`);
console.log(`  DB: ${url.replace(/:[^:@]+@/, ":***@")}`);
console.log(`  Grace period: ${GRACE_DAYS} dias`);

const pool = new Pool({ connectionString: url });

// Query com 3 critérios cumulativos. LEFT JOIN store é o mais robusto
// (covering index em owner_id existe pelo FK).
const ZOMBIE_QUERY = `
  SELECT u.id, u.email, u.created_at
  FROM "user" u
  LEFT JOIN store s ON s.owner_id = u.id
  WHERE s.id IS NULL
    AND u.created_at < now() - ($1::int * INTERVAL '1 day')
    AND NOT EXISTS (
      SELECT 1 FROM "session" sess
      WHERE sess.user_id = u.id AND sess.expires_at > now()
    )
`;

try {
  const { rows: zombies } = await pool.query(ZOMBIE_QUERY, [GRACE_DAYS]);

  if (zombies.length === 0) {
    console.log(`✓ Zero zombies. Nada a fazer.`);
    if (process.env.GITHUB_OUTPUT) {
      const { appendFile } = await import("node:fs/promises");
      await appendFile(process.env.GITHUB_OUTPUT, `deleted_count=0\n`);
    }
    await pool.end();
    process.exit(0);
  }

  console.log(`\nEncontrados ${zombies.length} zombie user(s):`);
  for (const z of zombies) {
    const days = Math.floor(
      (Date.now() - new Date(z.created_at).getTime()) / 86_400_000,
    );
    console.log(`  ${z.email.padEnd(40)} (${days}d, ${z.id})`);
  }

  if (!apply) {
    console.log(
      `\n[DRY-RUN] Nenhum DELETE executado. Rode com --apply pra confirmar.`,
    );
    await pool.end();
    process.exit(0);
  }

  // Apply: DELETE em transação. session/account vão por ON DELETE CASCADE.
  // Re-executa a query com DELETE pra evitar race (alguém pode ter logado
  // entre o SELECT e o DELETE — improvável mas a janela existe).
  const { rowCount } = await pool.query(`
    DELETE FROM "user" u
    USING (
      SELECT u2.id FROM "user" u2
      LEFT JOIN store s ON s.owner_id = u2.id
      WHERE s.id IS NULL
        AND u2.created_at < now() - ($1::int * INTERVAL '1 day')
        AND NOT EXISTS (
          SELECT 1 FROM "session" sess
          WHERE sess.user_id = u2.id AND sess.expires_at > now()
        )
    ) AS z
    WHERE u.id = z.id
  `, [GRACE_DAYS]);

  console.log(`\n✓ ${rowCount} user(s) deletado(s). Session/account em cascade.`);

  if (process.env.GITHUB_OUTPUT) {
    const { appendFile } = await import("node:fs/promises");
    await appendFile(
      process.env.GITHUB_OUTPUT,
      `deleted_count=${rowCount}\n`,
    );
  }
} catch (err) {
  console.error("✗ Cleanup falhou");
  console.error(err.message);
  await pool.end();
  process.exit(1);
}

await pool.end();
