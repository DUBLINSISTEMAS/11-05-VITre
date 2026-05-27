# ADR-0035: Roteamento híbrido path + subdomain

- **Data**: 2026-05-27
- **Status**: aceito (Fase 2 Bloco 5a)
- **Atualiza**: [ADR-0004 — Path-based routing no MVP](./0004-routing-path-based.md)

## Contexto

ADR-0004 (2026-05-07) escolheu path-based (`vitre.site/{slug}`) pra MVP por
simplicidade operacional (1 SSL, 1 DNS, deploy trivial). Decisão foi correta
pra fase 1.

Hoje (Fase 2 Bloco 5), há demanda real por subdomínio:
- Lojistas premium pedem URL "mais profissional" pra Instagram/cartão
- Setup DNS wildcard agora é trivial em Vercel (1 entrada CNAME)
- Cookie scoping NÃO é problema porque admin permanece no apex

## Decisão

**Híbrido**: ambos caminhos funcionam em paralelo.

| URL externa | Renderiza | Mecanismo |
|---|---|---|
| `vitre.site/{slug}/*` | Storefront | Roteamento Next direto (path-based) |
| `{slug}.vitre.site/*` | Storefront | Middleware rewrite interno pra `/{slug}/*` |
| `admin.vitre.site/*` | Admin | Redirect 301 pra `vitre.site/admin/*` |
| `vitre.site/admin/*` | Admin | Direto (path-based) |

Path-based continua **DEFAULT**:
- Links existentes no WhatsApp/Insta continuam funcionando sem migração
- SEO já indexado preserva (nada quebra)
- Subdomínio é opt-in pelo cliente que digitar/compartilhar

## Mecanismo técnico

`middleware.ts` na raiz detecta `Host` header:
1. Apex (`vitre.site` / `www.vitre.site`) → passa direto
2. `{reservado}.vitre.site` → redirect 301 pra `vitre.site/{reservado}/*`
3. `{slug-livre}.vitre.site/*` → `NextResponse.rewrite` pra `/{slug}/*`
4. Localhost / preview Vercel → passa direto (devs usam path-based)

Subdomínios reservados (não podem ser slug de loja): mesma lista do
`lib/slug.ts` (`RESERVED_SLUGS`) + reservados de infra (`admin`, `api`,
`app`, `www`, `auth`).

## Cookies / sessão

**Não há mudança em cookie scope**. Admin + auth permanecem no apex
(`vitre.site/admin/*`), cookies HostOnly do Better Auth ficam no apex.
Storefront é público sem auth — não precisa de sessão.

Cenário: lojista logado em `vitre.site/admin` abre `loja.vitre.site` em
outra aba — sessão admin permanece, storefront não pede nada.

## Pendências externas

Pra subdomínio funcionar em PROD:

1. **Vercel**: adicionar `*.vitre.site` como wildcard domain no projeto
   (Dashboard → Project → Settings → Domains → Add → digitar `*.vitre.site`)
2. **DNS provider** (mesmo registrador onde comprou `vitre.site`):
   - Registro: `* CNAME cname.vercel-dns.com` (TTL 3600)
   - Verificar propagação: `dig dublin-sistemas.vitre.site` deve apontar
     pro IP da Vercel
3. **SSL wildcard**: Vercel emite automaticamente (Let's Encrypt) após
   verificação do wildcard domain — ~5 min

Sem esses 3 passos, subdomínios continuam dando erro DNS no browser.
Path-based continua funcionando independente.

## Testes locais

Use `*.localtest.me` (DNS público da Microsoft que resolve qualquer
subdomínio pra 127.0.0.1):

```bash
# Path-based (atual):
http://localhost:3000/dublin-sistemas

# Subdomain (Onda 33+):
http://dublin-sistemas.localtest.me:3000

# Reservado (redirect 301):
http://admin.localtest.me:3000  →  http://localtest.me:3000/admin
```

Não precisa mexer em `/etc/hosts`.

## Consequências

- ✅ Lojistas premium podem migrar pra subdomain sem perder links antigos
- ✅ 1 wildcard DNS + 1 wildcard SSL — operacional simples
- ✅ Migração SEO opt-in (Fase 5b): canonical pode apontar pra subdomain quando founder decidir
- ⚠️ Slug deve continuar único e seguir mesma regex `^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$` (subdomain válido = slug válido)
- ⚠️ Custom domain (CNAME do lojista, ex: `sandrabrito.com.br`) ainda NÃO suportado — Fase 5c

## Quem decidiu

Anderson Felipe (founder) + análise sênior do estado real (auditoria
2026-05-27 — Onda 32 revelou Bloco 3 já pronto, abrindo espaço pra Bloco 5
sem dependências externas além de DNS/SSL).
