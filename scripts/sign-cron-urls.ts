/**
 * Gera as URLs assinadas pra colar em `vercel.json` ▸ `crons[].path`.
 *
 * Por que isto existe:
 *   Vercel Cron em plano Hobby NÃO injeta `Authorization` header (só em Pro+).
 *   Nosso fallback é HMAC em query string (`?sig=<hex>`). Como Vercel chama
 *   uma URL ESTÁTICA do `vercel.json`, a assinatura precisa ser gerada uma
 *   vez (aqui), comitada no JSON, e re-gerada se `CRON_SECRET` rotacionar.
 *
 * Por que não importa `signCronUrl` de @/lib/cron-auth:
 *   Aquele módulo importa `env`, que valida TODAS as envs do app (Resend,
 *   Supabase, Upstash etc). Script utilitário não deve quebrar por env não
 *   relacionada faltando — replicamos o HMAC de 1 linha aqui.
 *
 * Uso:
 *   1. Garanta que `.env.local` (ou `.env`) tem o MESMO `CRON_SECRET` que
 *      está em "Vercel ▸ Project ▸ Settings ▸ Environment Variables" (prod).
 *      Sem isso, a sig gerada local não bate com o que prod calcula.
 *   2. Rode:
 *        pnpm exec tsx scripts/sign-cron-urls.ts
 *   3. Cole o output em `vercel.json` (substitui o valor de `path`).
 *   4. Commit + deploy. Smoke real:
 *        curl -i "https://vitre.site/api/cron/keep-alive?sig=<a_gerada>"
 *        # esperado 200; sem sig ou sig errada → 401.
 *
 * Rotação:
 *   Trocou `CRON_SECRET` em prod? Rode de novo e atualize `vercel.json` no
 *   mesmo deploy — senão cron quebra silencioso entre a rotação e o novo
 *   commit.
 */
import { createHmac } from "node:crypto";

import { config as loadDotenv } from "dotenv";

// `.env.local` (Next convention) primeiro, `.env` como fallback.
loadDotenv({ path: ".env.local" });
loadDotenv({ path: ".env" });

const PATHS = [
  "/api/cron/keep-alive",
  "/api/cron/expire-orders",
] as const;

function main() {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) {
    console.error(
      "CRON_SECRET ausente ou curto (<16 chars). Defina em .env.local ou exporte no shell.",
    );
    process.exit(1);
  }

  console.log("=== URLs assinadas pra vercel.json ===\n");
  for (const path of PATHS) {
    const sig = createHmac("sha256", secret).update(path).digest("hex");
    console.log(`  ${path.padEnd(28)} →  ${path}?sig=${sig}`);
  }
  console.log("\nCole o lado direito em `vercel.json` ▸ crons[i].path.\n");
  console.log("Lembrete: rode este script de novo se rotacionar CRON_SECRET.");
}

main();
