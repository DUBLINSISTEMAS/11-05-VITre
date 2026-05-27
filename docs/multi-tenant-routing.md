# Roteamento multi-tenant — guia operacional

> Cobre Fase 2 Bloco 5a (subdomínio wildcard). Para custom domain (CNAME
> do lojista), ver Bloco 5c (pendente).
>
> ADR de referência: [0035-roteamento-hibrido-path-subdomain.md](decisoes/0035-roteamento-hibrido-path-subdomain.md)

## TL;DR

| URL externa | Renderiza |
|---|---|
| `vitre.site` | Landing pública |
| `vitre.site/admin/*` | Painel admin (auth) |
| `vitre.site/entrar`, `criar-loja/*` | Auth flows |
| `vitre.site/dublin-sistemas/*` | Storefront da loja (path-based) |
| `dublin-sistemas.vitre.site/*` | Mesma storefront (subdomain) |
| `admin.vitre.site/*` | Redirect 301 → `vitre.site/admin/*` |
| `*.localtest.me:3000` | Teste local (resolve pra 127.0.0.1) |

## Setup em PROD (founder, 1x)

### 1. Vercel — adicionar wildcard domain

1. Dashboard → Project → Settings → Domains
2. Add → digitar `*.vitre.site` → Continue
3. Vercel pede verificação via TXT record (uma vez só)
4. Adicionar o TXT no DNS conforme instrução do Vercel
5. Aguardar verificação (~5 min)

### 2. DNS — registro wildcard

No mesmo painel onde `vitre.site` foi comprado (Vercel Domains, Cloudflare,
Registro.br, etc):

```
Tipo: CNAME
Nome: *
Valor: cname.vercel-dns.com
TTL: 3600 (1h)
```

Verificar propagação:

```bash
dig dublin-sistemas.vitre.site
# Deve retornar IP de cname.vercel-dns.com (ex: 76.76.21.x)
```

### 3. SSL wildcard

Vercel emite automaticamente após (1)+(2). Sem ação manual. Confirmar
em Dashboard → Project → Domains → status "Valid Configuration" no
domain `*.vitre.site`.

### 4. Smoke test em PROD

```bash
# Path-based (deve continuar OK)
curl -I https://vitre.site/dublin-sistemas
# Esperado: 200

# Subdomain (novo)
curl -I https://dublin-sistemas.vitre.site
# Esperado: 200 (mesmo conteúdo, URL diferente)

# Reservado deve redirecionar
curl -I https://admin.vitre.site
# Esperado: 301 → https://vitre.site/admin
```

## Setup em DEV (qualquer dev)

Sem mexer em nada. `*.localtest.me` resolve pra `127.0.0.1` automaticamente:

```bash
# Servidor dev rodando em :3000
npm run dev

# Acessar via subdomain (não precisa /etc/hosts):
open http://dublin-sistemas.localtest.me:3000

# Reservados:
open http://admin.localtest.me:3000
# Redireciona pra http://localtest.me:3000/admin (segundo o middleware)
```

## Como funciona internamente

`middleware.ts` na raiz roda em TODA request (exceto assets):

```typescript
const host = request.headers.get("host");
// Detecta vitre.site, *.vitre.site, *.localtest.me, ou outros (localhost/preview)

if (apex) → next() // vitre.site puro: roteamento normal
if (reserved subdomain) → redirect 301 pro apex/path
if (slug subdomain) → rewrite interno pra /[slug]/* sem mudar URL externa
```

Next.js roteia normalmente após o rewrite — `app/(storefront)/[storeSlug]/page.tsx`
recebe `storeSlug` resolvido do path interno.

## Edge cases conhecidos

| Cenário | Comportamento |
|---|---|
| Slug não existe (`inexistente.vitre.site`) | Rewrite → `/inexistente` → Storefront `notFound()` → 404 padrão Next |
| Subdomain com `www` (`www.dublin-sistemas.vitre.site`) | NÃO suportado (regex pega só 1ª label). Cliente raramente digita |
| Slug com hífen no início (`-loja.vitre.site`) | Inválido pelo regex `RESERVED_SLUGS` — passa direto, gera 404 |
| Preview Vercel (`xyz.vercel.app`) | Passa direto sem rewrite (não é vitre.site) |

## Próximas fases

- **5b** (SEO canonical): `generateMetadata` aponta canonical pra subdomain.
  Path-based ganha redirect 301 opt-in via env var.
- **5c** (custom domain CNAME): lojista aponta `loja.com.br` pro Mangos Pay
  via página `/admin/configuracoes/dominio`. Vercel Domains API + SSL on-demand.
