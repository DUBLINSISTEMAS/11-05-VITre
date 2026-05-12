/**
 * Validação das variáveis de ambiente via Zod.
 * Falha cedo (no boot) se faltar variável obrigatória.
 *
 * Como usar:
 *   import { env } from "@/lib/env";
 *   const url = env.DATABASE_URL;
 *
 * NOTA sobre `.optional()` + preprocess:
 *   Vercel injeta envs ausentes/vazias como "" em process.env, NÃO como
 *   undefined. Sem o preprocess, `z.string().url().optional()` rejeita ""
 *   ("Invalid input") e o build quebra ao coletar config (ex.: /_not-found).
 *   Toda env opcional usa `optionalUrl` / `optionalString` / `optionalMin`
 *   abaixo, que normalizam "" -> undefined ANTES da validação. Não desfaça
 *   "achando que é verboso" — é gate de deploy.
 */
import { z } from "zod";

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

const optionalUrl = z.preprocess(emptyToUndefined, z.string().url().optional());
const optionalString = z.preprocess(emptyToUndefined, z.string().optional());
const optionalMin = (n: number) =>
  z.preprocess(emptyToUndefined, z.string().min(n).optional());

const envSchema = z.object({
  // App
  NEXT_PUBLIC_APP_URL: z.preprocess(
    (v) => (v === "" || v === undefined ? "http://localhost:3000" : v),
    z.string().url()
  ),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // Database - suporta tanto DATABASE_URL quanto POSTGRES_URL (Vercel integration)
  DATABASE_URL: z.preprocess(
    (v) => v || process.env.POSTGRES_URL,
    z.string().url()
  ),
  DIRECT_URL: z.preprocess(
    (v) => v || process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL,
    z.string().url()
  ),

  // Supabase Storage / client
  NEXT_PUBLIC_SUPABASE_URL: z.preprocess(
    (v) => v || process.env.SUPABASE_URL,
    z.string().url()
  ),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.preprocess(
    (v) => v || process.env.SUPABASE_ANON_KEY,
    z.string().min(1)
  ),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Better Auth
  // baseURL é derivada de NEXT_PUBLIC_APP_URL para garantir que cliente e
  // servidor usem exatamente o mesmo host (CORS/cookies dependem disso).
  BETTER_AUTH_SECRET: z.preprocess(
    (v) => v || process.env.SUPABASE_JWT_SECRET || "development-secret-min-32-chars-here",
    z.string().min(32)
  ),
  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,

  // Resend (opcional em desenvolvimento)
  RESEND_API_KEY: optionalMin(1),
  RESEND_FROM_EMAIL: z.preprocess(emptyToUndefined, z.string().email().optional()),

  // Upstash Redis (rate limit) - opcional em desenvolvimento
  UPSTASH_REDIS_REST_URL: optionalUrl,
  UPSTASH_REDIS_REST_TOKEN: optionalMin(1),

  // Cron secret - opcional em desenvolvimento
  CRON_SECRET: optionalMin(16),

  // Health endpoint detail gate (gate H3 — sem isso, role/bypassrls são
  // ocultos no payload público do /api/health).
  HEALTH_SECRET: optionalMin(16),

  // Sentry (opcional — Sentry vira no-op em dev local sem DSN).
  // DSN não é secret crítico (vai no client bundle pelo SDK).
  // SENTRY_ENVIRONMENT permite separar prod/preview no dashboard Sentry.
  // NEXT_PUBLIC_SENTRY_ENVIRONMENT é lido em instrumentation-client.ts (M3).
  SENTRY_DSN: optionalUrl,
  NEXT_PUBLIC_SENTRY_DSN: optionalUrl,
  SENTRY_ENVIRONMENT: optionalString,
  NEXT_PUBLIC_SENTRY_ENVIRONMENT: optionalString,
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Variáveis de ambiente inválidas:");
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error("Configuração de ambiente inválida. Veja .env.example.");
}

export const env = parsed.data;
