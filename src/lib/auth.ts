/**
 * Better Auth — configuração principal do Vitrê.
 *
 * Auth gerencia apenas LOJISTAS. Cliente final do storefront NÃO loga.
 *
 * Decisões:
 * - emailAndPassword com `requireEmailVerification: false` no MVP (Fase 1).
 *   BLOQUEADO até a fase do Resend domain (T1-7) + tela `/verificar-email`
 *   estarem prontas. Memory: `better-auth-require-email-verification-flow-break`.
 *   Plano para ativar (3 passos):
 *     1) Provisionar dominio em Resend + DKIM/SPF/DMARC.
 *     2) Criar pagina `/verificar-email` com Suspense + reenvio (cooldown 60s).
 *     3) Trocar `requireEmailVerification: true` + `sendOnSignUp: true` +
 *        adicionar `callbackURL: "/verificar-email"` no signUp do client.
 *   Sem essas peças, signup -> protegida quebra ("sessao expirada").
 * - `revokeSessionsOnPasswordReset: true` (S2 da auditoria 2026-05-19):
 *   apos reset bem-sucedido, Better Auth invalida TODAS as sessoes do
 *   usuario (incluindo cookies roubados pre-reset). Usuario refaz login
 *   na pagina `/entrar?reset=ok`.
 * - Drizzle adapter com mapeamento explícito do schema custom (importante:
 *   nossas tabelas têm nomes singulares ("user" não "users") e campo `role`
 *   adicional em `userTable`).
 * - `additionalFields.role` com `input: false` impede o client de definir
 *   role no signup — sempre criado como `store_owner` (default da coluna).
 * - Google OAuth opcional: ativado apenas se as duas envs estiverem
 *   populadas. Caso contrário, só email/senha.
 *
 * Documentação: docs/arquitetura-tecnica.md §8
 */
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/email";
import { env } from "@/lib/env";

const googleEnabled = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

export const auth = betterAuth({
  appName: "Vitrê",
  // Single source of truth para client e server. Trocar AMBOS via .env quando
  // mudar de domínio (dev / preview Vercel / produção).
  baseURL: env.NEXT_PUBLIC_APP_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.NEXT_PUBLIC_APP_URL],

  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.userTable,
      session: schema.sessionTable,
      account: schema.accountTable,
      verification: schema.verificationTable,
    },
  }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // BLOQUEADO em false ate /verificar-email + Resend domain (T1-7). Ver
    // header do arquivo para plano de ativacao em 3 passos. Trocar para
    // true quebra signup -> protegida ("sessao expirada").
    requireEmailVerification: false,
    /**
     * S2 da auditoria 2026-05-19: ao concluir reset, Better Auth invalida
     * TODAS as sessoes ativas do usuario via `internalAdapter.deleteSessions`.
     * Defesa contra atacante com cookie roubado pre-reset. Usuario faz
     * login novo na pagina `/entrar?reset=ok` (toast "Senha atualizada").
     */
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail({
        to: user.email,
        url,
        name: user.name,
      });
    },
  },

  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail({
        to: user.email,
        url,
        name: user.name,
      });
    },
    sendOnSignUp: false, // ligar quando trocar requireEmailVerification.
  },

  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "store_owner",
        input: false, // não pode ser definido pelo cliente; default da coluna NOT NULL DEFAULT 'store_owner' garante o valor.
      },
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 dias
    updateAge: 60 * 60 * 24, // refresh token em ações ≥ 1 dia depois
  },

  socialProviders: googleEnabled
    ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID!,
          clientSecret: env.GOOGLE_CLIENT_SECRET!,
        },
      }
    : undefined,

  /**
   * `nextCookies` é OBRIGATÓRIO em Next 15 quando `auth.api.*` é chamado de
   * server actions. Ele intercepta as `Set-Cookie` internas do Better Auth e
   * propaga via `cookies()` do Next, fazendo o cookie chegar ao browser.
   *
   * Sem esse plugin, signUp/signIn parecem funcionar (retornam ok) mas a
   * sessão não persiste — próxima request volta sem cookie e parece "expirada".
   *
   * IMPORTANTE: deve ser o ÚLTIMO plugin no array (intercept order).
   */
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
