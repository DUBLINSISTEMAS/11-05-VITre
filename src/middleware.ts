/**
 * Middleware Next 15 — Roteamento híbrido path/subdomain (Fase 2 Bloco 5a).
 *
 * Onda 33 (2026-05-27): adiciona suporte a `{slug}.vitre.site` como
 * alternativa visual ao `vitre.site/{slug}`. Path-based continua DEFAULT
 * (decisão ADR-0004); subdomain é opt-in pra lojistas que preferem
 * URL "premium" no Instagram/cartão de visita.
 *
 * ESTRATÉGIA
 *  - Apex (`vitre.site` / `www.vitre.site`): passa direto, roteamento
 *    normal (admin + storefront em path-based)
 *  - Subdomínio reservado (admin/api/app/www): redirect 301 pro apex
 *    com o caminho correspondente (ex: admin.vitre.site/x → vitre.site/admin/x)
 *  - Subdomínio livre (`{slug}.vitre.site/*`): rewrite INTERNO pra
 *    `/[slug]/*` no apex — URL externa permanece subdomain, Next renderiza
 *    o storefront da loja resolvido pelo slug
 *  - Localhost / preview Vercel: passa direto (devs usam path-based local)
 *
 * COOKIES — NÃO precisam de scope `.vitre.site`:
 *  - Admin (`vitre.site/admin/*`) e auth (`vitre.site/{entrar,criar-loja}/*`)
 *    permanecem no apex; Better Auth seta cookie HostOnly no apex
 *  - Storefront (`{slug}.vitre.site/*`) é público, sem auth
 *  - Logo: lojista logado em vitre.site/admin pode abrir loja.vitre.site
 *    sem perder sessão (sessão fica no apex de qualquer jeito)
 *
 * LIMITAÇÕES CONHECIDAS
 *  - Custom domain (CNAME do lojista, ex: sandrabrito.com.br): Fase 5c.
 *    Requer Vercel Domains API + SSL on-demand
 *  - SEO canonical ainda aponta pra path-based (Fase 5b). Não há
 *    redirect 301 path→subdomain ainda — ambos coexistem
 *
 * TESTE LOCAL
 *  Use `*.localtest.me` (DNS público que resolve qualquer subdomínio
 *  pra 127.0.0.1). Ex: `http://dublin-sistemas.localtest.me:3000`
 *  funciona sem mexer em /etc/hosts.
 */
import { type NextRequest, NextResponse } from "next/server";

import { env } from "@/lib/env";
import { RESERVED_SLUGS } from "@/lib/slug";

const APEX_DOMAINS = new Set<string>([
  "vitre.site",
  "www.vitre.site",
  // Preview deployments Vercel sempre usam path-based — não rewrite.
  // Hosts dinâmicos (*.vercel.app) caem em "não-apex && não-vitre.site"
  // abaixo e são ignorados.
]);

// Subdomínios que precisam virar paths no apex (cliente digitou
// admin.vitre.site mas a app vive em vitre.site/admin).
const RESERVED_SUBDOMAINS = new Set<string>([
  "admin",
  "api",
  "app",
  "www",
  "auth",
]);

export function middleware(request: NextRequest) {
  // Fonte do host: tenta header "host" primeiro (mais confiável em Edge);
  // fallback pra `nextUrl.host` (cliente Node fetch normal). Em dev local
  // com curl `-H Host:`, o header chega corretamente.
  const host = (
    request.headers.get("host") ??
    request.nextUrl.host ??
    ""
  ).toLowerCase();
  // Strip porta (ex: localhost:3000 → localhost; vitre.site:443 → vitre.site)
  const hostname = host.split(":")[0] ?? "";

  // Dev/preview/IP direto: passa direto, sem mexer.
  // Cobre: localhost, *.vercel.app preview, qualquer hostname não-vitre.site.
  // Localtest.me é tratado igual vitre.site abaixo (regra dinâmica abaixo).
  const isApex = APEX_DOMAINS.has(hostname);
  const isLocaltest = hostname.endsWith(".localtest.me");
  const isVitreSubdomain = hostname.endsWith(".vitre.site");

  if (isApex) {
    // vitre.site puro — roteamento normal Next.
    //
    // Onda 34 (Bloco 5b): se STOREFRONT_REDIRECT_TO_SUBDOMAIN=true E o
    // path começa com um slug de loja (não-reservado), redirect 301
    // pra `{slug}.vitre.site/*`. Consolida tráfego no canonical novo
    // depois que a infra subdomain estiver pronta. Default false.
    if (env.STOREFRONT_REDIRECT_TO_SUBDOMAIN) {
      const redirectUrl = maybeBuildSubdomainRedirect(request, hostname);
      if (redirectUrl) {
        return NextResponse.redirect(redirectUrl, { status: 301 });
      }
    }
    return NextResponse.next();
  }

  if (!isVitreSubdomain && !isLocaltest) {
    // Localhost direto, *.vercel.app preview, IP, etc.
    return NextResponse.next();
  }

  // Extrai subdomínio. Pra `*.vitre.site`, é a primeira label;
  // pra `*.localtest.me`, idem (localtest.me funciona igual).
  const subdomain = hostname.split(".")[0] ?? "";
  if (!subdomain) return NextResponse.next();

  // Subdomínio reservado (admin/api/app/www): redirect 301 pro apex
  // com o path equivalente. Ex: admin.vitre.site/produtos → vitre.site/admin/produtos
  if (RESERVED_SUBDOMAINS.has(subdomain)) {
    const apex = isLocaltest
      ? "localtest.me" + (host.includes(":") ? `:${host.split(":")[1]}` : "")
      : "vitre.site";
    const protocol = request.nextUrl.protocol;
    const path = request.nextUrl.pathname;
    const search = request.nextUrl.search;
    return NextResponse.redirect(
      `${protocol}//${apex}/${subdomain}${path}${search}`,
      { status: 301 },
    );
  }

  // Slug reservado (palavras de rotas internas — sobre, entrar, etc):
  // não deveria virar subdomínio. Trata igual reservado: redirect 301.
  if (RESERVED_SLUGS.has(subdomain)) {
    const apex = isLocaltest
      ? "localtest.me" + (host.includes(":") ? `:${host.split(":")[1]}` : "")
      : "vitre.site";
    const protocol = request.nextUrl.protocol;
    const path = request.nextUrl.pathname;
    const search = request.nextUrl.search;
    return NextResponse.redirect(
      `${protocol}//${apex}${path === "/" ? `/${subdomain}` : `/${subdomain}${path}`}${search}`,
      { status: 301 },
    );
  }

  // SUBDOMÍNIO LIVRE = slug de loja. Rewrite INTERNO pra path-based.
  // URL externa permanece `{slug}.vitre.site/*`; Next renderiza
  // `app/(storefront)/[storeSlug]/*` resolvendo pelo slug.
  //
  // Ex: dublin-sistemas.vitre.site/produto/anel
  //  → rewrite interno: vitre.site/dublin-sistemas/produto/anel
  //  → renderiza app/(storefront)/[storeSlug=dublin-sistemas]/produto/[productSlug=anel]/page.tsx
  const url = request.nextUrl.clone();
  url.pathname = `/${subdomain}${url.pathname === "/" ? "" : url.pathname}`;
  return NextResponse.rewrite(url);
}

/**
 * Onda 34 (Bloco 5b): se request veio em apex (`vitre.site`) E o primeiro
 * segmento do path é um slug de loja válido (não-reservado), monta a URL
 * equivalente no subdomain pra redirect 301.
 *
 * Retorna null quando não deve redirecionar:
 *  - Apex root (`/`) — landing pública
 *  - Rotas reservadas (admin, criar-loja, api, etc.)
 *  - Subdomínios proibidos (admin, www, etc.) — não viram subdomain de loja
 *
 * Em dev (`localhost`), não redireciona (apex check do caller cobre, mas
 * defesa adicional aqui — port + host diferentes não fazem subdomain válido).
 */
function maybeBuildSubdomainRedirect(
  request: NextRequest,
  hostname: string,
): string | null {
  // Dev / preview / qualquer apex que não seja vitre.site puro: skip.
  // (Subdomain redirect só faz sentido com wildcard DNS prod.)
  if (hostname !== "vitre.site" && hostname !== "www.vitre.site") {
    return null;
  }

  const pathname = request.nextUrl.pathname;
  if (pathname === "/" || pathname === "") return null;

  // Primeiro segmento do path.
  const segments = pathname.split("/").filter(Boolean);
  const firstSegment = segments[0];
  if (!firstSegment) return null;

  // Rota reservada (admin, criar-loja, entrar, etc): NÃO redirecionar.
  if (RESERVED_SLUGS.has(firstSegment)) return null;

  // Subdomínio proibido (admin.*, www.*): NÃO virar subdomain.
  if (RESERVED_SUBDOMAINS.has(firstSegment)) return null;

  // Slug válido — monta URL no subdomain mantendo o resto do path/search.
  const remainingPath = "/" + segments.slice(1).join("/");
  const search = request.nextUrl.search;
  const protocol = request.nextUrl.protocol;
  return `${protocol}//${firstSegment}.vitre.site${remainingPath === "/" ? "" : remainingPath}${search}`;
}

// Matcher: pula assets estáticos e API routes (não fazem sentido rewritar).
// next-auth e cron routes ficam no apex sempre.
export const config = {
  matcher: [
    /*
     * Exclui:
     * - api/* (rotas server)
     * - _next/static, _next/image (assets do build)
     * - favicon.ico, manifest, sw.js (PWA)
     * - qualquer arquivo com extensão (jpg/png/svg/etc)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw\\.js|logos|icons|.*\\.[a-z0-9]+$).*)",
  ],
};
