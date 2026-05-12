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
 *   - connect-src libera Supabase Storage e ingest client-side do Sentry.
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
      "connect-src 'self' https://*.supabase.co https://*.sentry.io https://*.ingest.sentry.io",
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

const PREVIEW_SECURITY_HEADERS = SECURITY_HEADERS.map((header) => {
  if (header.key === "Content-Security-Policy") {
    return {
      key: header.key,
      value: header.value.replace(
        "frame-ancestors 'none'",
        "frame-ancestors 'self'",
      ),
    };
  }
  if (header.key === "X-Frame-Options") {
    return { key: "X-Frame-Options", value: "SAMEORIGIN" };
  }
  return header;
});

const GLOBAL_SECURITY_HEADERS = SECURITY_HEADERS;

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
      // Pipeline em 2 camadas:
      //   1. Client aceita arquivo original até 25 MB e comprime no browser
      //      (`browser-image-compression` → WebP ~2 MB max).
      //   2. Server recebe sempre ≤4 MB (limite duro do bodySizeLimit) e
      //      re-comprime com sharp pra WebP 800x800 final.
      // Margem: 4 MB cobre folga pra payload + FormData overhead. Se o
      // client falhar e tentar enviar > 4 MB, Next rejeita com 413 antes
      // mesmo da server action executar.
      bodySizeLimit: "4mb",
    },
  },
  async headers() {
    return [
      {
        source: "/admin/aparencia/preview/:path*",
        headers: PREVIEW_SECURITY_HEADERS,
      },
      {
        source: "/:path*",
        headers: GLOBAL_SECURITY_HEADERS,
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
