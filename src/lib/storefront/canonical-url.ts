/**
 * Canonical URL builder pro storefront — Fase 2 Bloco 5b (Onda 34).
 *
 * Fonte única de verdade pra URLs canônicas das páginas públicas
 * (`generateMetadata` + `sitemap.ts` + redirect logic do middleware).
 *
 * MODOS (controlado por `env.STOREFRONT_CANONICAL_HOST_STYLE`):
 *  - "path" (default): `https://vitre.site/{slug}{path}` — compat com
 *    estado anterior, sem requerer DNS wildcard.
 *  - "subdomain": `https://{slug}.vitre.site{path}` — SEO consolida
 *    autoridade no subdomain (cada loja tem identidade própria pra
 *    o Google). Exige wildcard DNS + SSL do Vercel (pendência externa
 *    documentada em docs/multi-tenant-routing.md).
 *
 * Path-based middleware (Bloco 5a) continua roteando AMBOS — só a
 * canonical muda. Mesmo com mode=path, subdomain ainda funciona, mas
 * o Google vê o path como "oficial" e o subdomain como duplicate (até
 * o lojista flipar pra subdomain).
 *
 * Decisão sênior: env var global agora (1 loja por ambiente),
 * granularidade por loja quando 5c (custom domain) entrar — aí cada
 * lojista escolhe estilo no `/admin/configuracoes/dominio`.
 */
import { env } from "@/lib/env";

/**
 * Retorna a URL canônica absoluta da página do storefront.
 *
 * @param storeSlug — slug da loja (já validado a-z0-9-).
 * @param path — caminho a partir do storefront raiz, começando com `/`.
 *               Use `""` ou `"/"` pra home. Sem trailing slash exceto raiz.
 *
 * Exemplos com `NEXT_PUBLIC_APP_URL=https://vitre.site`:
 *   buildStorefrontUrl("loja", "")
 *     mode=path      → "https://vitre.site/loja"
 *     mode=subdomain → "https://loja.vitre.site"
 *   buildStorefrontUrl("loja", "/produto/anel")
 *     mode=path      → "https://vitre.site/loja/produto/anel"
 *     mode=subdomain → "https://loja.vitre.site/produto/anel"
 */
export function buildStorefrontUrl(storeSlug: string, path: string): string {
  const normalizedPath = normalizePath(path);

  if (env.STOREFRONT_CANONICAL_HOST_STYLE === "subdomain") {
    const apex = extractApexHost(env.NEXT_PUBLIC_APP_URL);
    const protocol = extractProtocol(env.NEXT_PUBLIC_APP_URL);
    return `${protocol}//${storeSlug}.${apex}${normalizedPath}`;
  }

  // mode=path (default)
  const baseUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  return `${baseUrl}/${storeSlug}${normalizedPath}`;
}

/**
 * Normaliza caminho:
 *  - "" / "/" → "" (raiz, evita trailing slash duplicado)
 *  - "/foo" / "foo" → "/foo"
 *  - "/foo/" → "/foo" (sem trailing)
 */
function normalizePath(path: string): string {
  if (!path || path === "/") return "";
  const withLeading = path.startsWith("/") ? path : `/${path}`;
  return withLeading.replace(/\/$/, "");
}

/**
 * Extrai o host "apex" da APP_URL. Em dev (`http://localhost:3000`)
 * retorna "localhost:3000"; em prod (`https://vitre.site`) retorna
 * "vitre.site". Usado pra montar subdomain canônico sem hard-coding
 * de "vitre.site" — preview Vercel funciona sem mudança.
 */
function extractApexHost(appUrl: string): string {
  try {
    return new URL(appUrl).host;
  } catch {
    return "vitre.site";
  }
}

function extractProtocol(appUrl: string): string {
  try {
    return new URL(appUrl).protocol;
  } catch {
    return "https:";
  }
}
