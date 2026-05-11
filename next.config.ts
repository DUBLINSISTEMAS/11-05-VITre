import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

/**
 * Content Security Policy + cabeçalhos de segurança baseline.
 *
 * Por quê:
 *   - CSP limita de onde JS/CSS/imagens/conexões podem vir, mitigando XSS.
 *   - HSTS força HTTPS por 2 anos (preload-friendly).
 *   - X-Frame-Options + frame-ancestors bloqueiam clickjacking.
 *   - Permissions-Policy desliga APIs do browser que não usamos.
 *
 * Concessões:
 *   - script/style-src 'unsafe-inline': Next App Router emite payloads de
 *     hydration inline. Tighten via nonces (`headers()` + `nonce` injection)
 *     é roadmap. Por hora 'unsafe-inline' é o trade-off comum.
 *   - img-src libera `*.supabase.co` (Storage), `data:` (ícones inline) e
 *     `blob:` (preview de upload).
 *   - connect-src libera `*.supabase.co` pra Storage upload via fetch.
 *
 * Aplicado a TODAS as rotas. Se um path específico precisar relaxar
 * (ex: futura página com iframe legítimo), criar entry separado em `headers()`.
 */
const SECURITY_HEADERS = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' https://*.supabase.co data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
  {
    // HSTS: força HTTPS por 2 anos. `preload` qualifica para a HSTS preload
    // list (chrome://net-internals/#hsts) — só ativar quando domínio
    // definitivo estiver estável; remover/manter sob critério.
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    // Legacy reforço ao frame-ancestors (Edge antigo respeita só este).
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    // Desliga APIs do browser que o app não usa. Whitelist explícita
    // protege contra futura dependência de terceiros que tente abusar.
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
  experimental: {
    serverActions: {
      // Sharp comprime ANTES de chegar aqui? Não — comprimimos server-side
      // dentro da action. Logo o body cru tem que comportar foto de iPhone
      // (5-8 MB) com folga. 12 MB cobre fotos modernas + Content-Type overhead.
      // Mantém alinhado com MAX_INPUT_BYTES de lib/image.ts (10 MB).
      bodySizeLimit: "12mb",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

/**
 * Sentry wrap:
 *   - Plugin Webpack/Turbopack do Sentry tenta upload de source maps no build.
 *   - Sem SENTRY_AUTH_TOKEN, o upload falha silently (warning, build OK).
 *   - Pra ativar upload: gerar token no Dashboard Sentry > Settings > Auth Tokens,
 *     adicionar SENTRY_AUTH_TOKEN às envs Vercel + GitHub Actions secrets.
 *   - `silent: !CI` esconde logs verbosos em dev local; CI/Vercel mostram.
 */
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  // sourcemaps.disable=true pula upload (não temos SENTRY_AUTH_TOKEN ainda).
  // Quando founder gerar token, remover esta linha e source maps sobem
  // pra Sentry desofuscar stacks de prod.
  sourcemaps: { disable: true },
  // tunnelRoute: "/monitoring", // descomentar se ad-blockers travarem o ingest.
});
