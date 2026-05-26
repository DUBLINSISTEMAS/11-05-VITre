# Sentry Sourcemap Setup — S0.3 do Plano de Endurecimento

> **Status**: pendente ação do founder (setar 3 env vars no Vercel).
> Sem isso, stacks de erro em prod vêm **minificadas** e debug é cego.

## O que isso resolve

O `next.config.ts` linha 137-143 já tem `withSentryConfig` plugado. O upload de sourcemaps acontece automaticamente no build SE 3 env vars estiverem setadas no Vercel:

- `SENTRY_AUTH_TOKEN` — token com scope `project:releases` (pra subir sourcemap)
- `SENTRY_ORG` — slug da organização Sentry
- `SENTRY_PROJECT` — slug do projeto

Sem o token, o plugin do Sentry no Webpack/Turbopack tenta upload, falha com warning, e build segue (não derruba deploy). O resultado é prod servindo sem sourcemap, então erros vêm como:

```
Error: undefined is not a function
  at p (/_next/static/chunks/9281-24ab100fbd2cbb36.js:1:18923)
  at u (/_next/static/chunks/4528-179452d53faea77f.js:1:5021)
```

Ilegível. Com sourcemap correto, fica:

```
Error: undefined is not a function
  at calculateInstallments (src/lib/installments.ts:42:18)
  at PdvShell.handlePayment (src/components/admin/pdv/pdv-shell.tsx:1287:5)
```

## Passos pro founder fazer (10 min)

### 1. Gerar token no Sentry

1. Acessar https://sentry.io
2. Settings → Auth Tokens → Create New Token
3. **Scope mínimo**:
   - `project:releases` (pra subir sourcemap)
   - `org:read` (pra Plugin saber org/project)
4. Nome sugerido: `mangos-pay-vercel-sourcemaps`
5. Copiar o token (só aparece uma vez)

### 2. Identificar org slug + project slug

No URL do projeto no Sentry. Exemplo:
- `https://sentry.io/organizations/mangos-pay/projects/mangos-pay-web/`
- Org slug: `mangos-pay`
- Project slug: `mangos-pay-web`

### 3. Setar 3 env vars no Vercel

1. Dashboard Vercel → Projeto `mangos-pay` (ou nome equivalente) → Settings → Environment Variables
2. Adicionar 3 variáveis em **Production, Preview, e Development**:

| Variável | Valor | Type |
|----------|-------|------|
| `SENTRY_AUTH_TOKEN` | token gerado no passo 1 | Secret (sensível) |
| `SENTRY_ORG` | `mangos-pay` (ou o slug correto) | Plain |
| `SENTRY_PROJECT` | `mangos-pay-web` (ou o slug correto) | Plain |

3. **Importante**: marcar `SENTRY_AUTH_TOKEN` como **secret** (Vercel não loga + mascara em outputs).

### 4. Trigger rebuild pra subir sourcemap

Opções:
- **Mais fácil**: Vercel Dashboard → Deployments → último deploy → ⋯ → Redeploy → Use existing build cache **NÃO**, deve ser fresh build.
- **Via push**: qualquer commit (ex: bumpar `CACHE_VERSION` do `sw.js` de novo) dispara rebuild.

### 5. Validar que sourcemaps foram enviados

No log do build do Vercel, procurar por linha tipo:

```
[Sentry CLI] Uploading sourcemaps for release X.Y.Z
[Sentry CLI] > Found 42 source maps
```

Se aparece, está OK. Se aparece warning "no auth token configured", as env vars não chegaram.

### 6. Confirmar comigo (Claude)

Me avise quando o passo 5 estiver OK. Eu disparo um erro controlado em prod via uma rota de teste, verificamos no Sentry se a stack vem legível, e marcamos S0.3 ✅.

---

## DoD checklist (preencher após setup)

- [ ] Token gerado no Sentry com scope `project:releases` + `org:read`
- [ ] 3 env vars setadas em Production, Preview, Development do Vercel
- [ ] Próximo build do Vercel mostra log "Uploading sourcemaps" no console
- [ ] Erro de teste disparado em prod aparece no Sentry com **stack legível** (arquivo/linha do source, não chunk hash)

## Anti-pattern: NÃO fazer

- ❌ Setar token só em Production — Preview deploys também precisam (PR previews têm bugs novos)
- ❌ Setar token plain text (não secret) — vaza em logs públicos do build
- ❌ Bumpar `CACHE_VERSION` apenas pra triggar rebuild sem verificar log — pode passar sem o upload
- ❌ Confundir org slug com nome organização — slug é a parte da URL, lowercase com hífen

## Custo (Sentry Free tier)

- Free tier: 5k erros/mês, 10k transactions/mês, 1GB attachments.
- Sourcemaps contam como attachment — projeto deste tamanho consome ~50-100MB/mês. Folga.
- Quando primeiro lojista real entrar e gerar > 5k erros/mês, considerar Sentry Developer Plan ($26/mês).
