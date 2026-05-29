# Configurar `*.vitre.site` (subdomínio por lojista)

> Doc da Onda 4 — gerado em 2026-05-28. Founder configura no painel Vercel +
> DNS provider. Esta tarefa NÃO é executada por código — é infraestrutura.

## O que isso destrava

Cada loja ganha URL própria no Instagram/cartão:
- `dublin-sistemas.vitre.site` (loja A)
- `joiarte.vitre.site` (loja B)

Resolve para o storefront público da loja. O admin continua em `vitre.site/admin`.

O código já está pronto (`src/middleware.ts:142-144`) — falta DNS + Vercel.

## Estado atual (verificado)

- ✅ `src/middleware.ts` faz rewrite `{slug}.vitre.site/*` → `/{slug}/*` internamente.
- ✅ Apex (`vitre.site`, `www.vitre.site`) e subdomínios reservados (`admin`, `api`, `app`, `www`, `auth`) tratados.
- ✅ Cookies vivem no apex (`HostOnly`), sessão continua válida ao trocar entre apex e subdomain.
- 🔴 DNS wildcard `*.vitre.site` **não configurado** (não há registro CNAME wildcard).
- 🔴 Vercel não tem `*.vitre.site` cadastrado como domínio do projeto.

Sintoma observável: `https://dublin-sistemas.vitre.site` retorna **connection refused** (DNS falha antes mesmo de chegar na Vercel).

## Passo 1 — DNS

No seu provedor DNS (Registro.br, Cloudflare, Namecheap, etc.), adicione:

```
Tipo:   CNAME
Nome:   *           (ou *.vitre.site, dependendo do painel)
Valor:  cname.vercel-dns.com
TTL:    3600 (1h)
Proxy:  desativado/desabilitado (Cloudflare: cinza, não laranja)
```

> Cloudflare em "Proxied" (laranja) NÃO funciona com Vercel sem
> configuração extra do SSL — deixe DNS-only (cinza).

Confirme a propagação:
```bash
dig dublin-sistemas.vitre.site CNAME
# espera-se "cname.vercel-dns.com" na resposta
```

Propagação típica: 5 minutos. Pode demorar até 1h.

## Passo 2 — Vercel

1. Acesse `vercel.com/dashboard` → projeto **vitre** (ou nome do projeto Mangos Pay).
2. **Settings** → **Domains**.
3. Add Domain: `*.vitre.site`
4. Aguarde Vercel verificar o CNAME e emitir certificado SSL wildcard (até ~10 min).
5. Confirme: aparece "Valid Configuration" no painel.

## Passo 3 — Validação

```bash
curl -I https://dublin-sistemas.vitre.site
# Esperado:
# HTTP/2 200
# server: Vercel
# x-vercel-cache: <qualquer>
```

E no navegador: `https://dublin-sistemas.vitre.site` deve renderizar o storefront da loja `dublin-sistemas` (mesma página de `vitre.site/dublin-sistemas`).

## Troubleshooting

### `connection refused`
DNS ainda não propagou OU CNAME wildcard ausente. Re-rode `dig` no passo 1.

### `SSL_ERROR` / "certificado inválido"
Vercel ainda não emitiu SSL. Espere mais 5-10min. Se persistir > 1h, abra ticket Vercel — wildcard SSL pode requerer plano Pro.

### Subdomínio resolve mas devolve 404
- `vitre.site/{slug}` funciona mas `{slug}.vitre.site` não?
- Verifique `src/middleware.ts` — o slug está em `RESERVED_SUBDOMAINS` por engano?
- Logs Vercel mostram middleware sendo invocado? Pode ser que Edge runtime esteja desabilitado em produção.

### Cookies de admin caem ao trocar apex → subdomain
**Não deve acontecer** — Better Auth grava cookie HostOnly no apex. Se acontecer, é regressão: cookie domínio virou `.vitre.site` em algum momento. Audit dos commits que tocaram em `src/lib/auth*`.

## Quando ativar custom domains (CNAME do lojista)

Ex: `joiarte.com.br` apontando pra Vercel.

**Não está no escopo da Onda 4.** Requer:
- Vercel Domains API (paid)
- SSL on-demand
- Onboarding UI no admin

Fica como Fase 5c quando 3+ lojas pedirem.

## Quem mexer / quando mexer

Founder configura. Claude Code NÃO tem acesso ao painel Vercel/DNS — esta é uma das pendências externas registradas na memória ([🚢 Catch-up feat → main 2026-05-26](catchup-main-2026-05-26.md) menciona "4 pendências externas do founder").

Se Mangos Pay ganhar SRE/devops dedicado, mover este doc pra `docs/runbooks/`.
