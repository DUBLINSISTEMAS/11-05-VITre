/**
 * Env vars CLIENT-safe — APENAS as `NEXT_PUBLIC_*`.
 *
 * Por quê separar de `env.ts`:
 *   - `env.ts` faz `safeParse(process.env)` no boot do servidor; valida
 *     secrets como `DATABASE_URL`, `BETTER_AUTH_SECRET`, `RESEND_API_KEY`.
 *   - Esses secrets NÃO podem ir pro bundle client. Importar `env.ts`
 *     direto de um arquivo `"use client"` pode arrastar os schemas Zod
 *     pra bundle e expor estrutura sensível.
 *   - Next replaces `process.env.NEXT_PUBLIC_*` por string literal em
 *     build time para o bundle client, então não há runtime parse aqui
 *     (impossível validar antes do build pro browser).
 *
 * Uso:
 *   - Em `"use client"`: `import { clientEnv } from "@/lib/env-client"`
 *   - Em RSC/server actions: `import { env } from "@/lib/env"`
 *
 * Convenção #2 do CLAUDE.md (Zod em todos os boundaries) — env é
 * boundary, então valida-se no SERVIDOR (env.ts) com fallback typed pra
 * client (este arquivo).
 */

/**
 * Fallbacks ausentes resolvem pra string vazia. Em prod, Next garante
 * que `NEXT_PUBLIC_*` definidas no Vercel viram literal — fallback só
 * dispara em dev sem `.env.local` populado, sinal de bug de setup.
 */
export const clientEnv = {
  APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? "",
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  /**
   * `NODE_ENV` é uma das poucas envs que Next replaces em build pra
   * ambos client e server (gating de dead-code). Centralizado aqui pra
   * o client não usar `process.env.NODE_ENV` solto.
   */
  isDev: process.env.NODE_ENV !== "production",
} as const;
