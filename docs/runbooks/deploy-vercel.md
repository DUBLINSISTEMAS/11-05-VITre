# Deploy Vercel (Fase 1.7)

Procedimento pra subir o Mangos Pay do "pronto em dev" pra produção.
Sandra Brito Collection é o primeiro tenant real.

## Quando usar

- Primeira ida pra produção (Fase 1.7).
- Migrar pra nova conta Vercel / novo projeto.
- Re-deploy após reset de envs.

Para rollback, ver final do doc.

---

## Pré-requisitos

- [ ] Conta Vercel logada (`vercel login`)
- [ ] Conta GitHub com permissão de import no repo
- [ ] Acesso ao projeto Supabase de produção (ou criar um agora)
- [ ] Acesso ao painel Resend com domínio verificado (`mangospay.app` ou
      similar) — sem isso, email de reset/verificação não chega
- [ ] Acesso ao Upstash Redis de produção
- [ ] (Opcional) Sentry: DSN do projeto de produção
- [ ] `.env.local` localmente preenchido — vamos usar pra extrair
      vários valores e como referência

---

## Passos

### 1. Validar local antes de qualquer push

```powershell
npm run lint            # warnings OK, não bloqueia
npx tsc --noEmit        # ZERO erro obrigatório
npm test                # 491/491 esperado
npm run db:check        # 58/58 SQLs aplicados
npm run db:check-anon   # 10/10 tabelas bloqueadas
npm run build           # build production sem erro
```

Se algo falhar aqui, NÃO deploya. Resolve primeiro.

### 2. Provisionar Supabase de produção (se ainda não tiver)

Se for projeto Supabase NOVO:

1. Criar projeto na região mais próxima (sa-east-1 / São Paulo)
2. Anotar a connection string (Settings → Database → Connection string)
   - Pegar **URI** em modo **Transaction** (porta 6543) → `DATABASE_URL`
   - Pegar **URI** em modo **Session** (porta 5432) → `DIRECT_URL`
3. Settings → API → anotar:
   - URL → `NEXT_PUBLIC_SUPABASE_URL`
   - anon key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - service_role key → `SUPABASE_SERVICE_ROLE_KEY` (SEGREDO — não logar)
4. Aplicar todas as SQLs em ordem (`01_*.sql` até `57_*.sql`):

```powershell
# preencher .env.local com a URL de PROD temporariamente
npm run db:apply        # aplica SQLs idempotentes
npm run db:check-sql    # confirma 58/58
```

5. Criar buckets Storage (já idempotente em `02_storage_buckets.sql`)
6. Restaurar `.env.local` pra apontar pro Supabase de dev

### 3. Gerar secrets fortes (uma vez só, anotar)

```powershell
# BETTER_AUTH_SECRET (>= 32 chars)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# CRON_SECRET (>= 16 chars — use 32 hex)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# HEALTH_SECRET (opcional, mesmo formato do CRON_SECRET)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Esses 3 nunca podem ir pro git nem pro Slack/email. Salvar no
gerenciador de senhas do Anderson (1Password / KeePass / Bitwarden).

### 4. Vercel: link + import

```powershell
vercel login
vercel link
```

Aceitar criar novo projeto. Quando perguntar o framework, ele detecta
Next.js automaticamente.

Em alternativa, no painel Vercel: New Project → Import Git Repository →
selecionar `Mangos Pay`.

### 5. Configurar envs no painel Vercel

Painel: Project → Settings → Environment Variables.

**Scope: Production**. Adicionar TODAS as 14 obrigatórias:

| Chave | Valor (origem) |
|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://mangospay.app` (ou o domínio real) |
| `NODE_ENV` | `production` (Vercel já define automaticamente, mas garante) |
| `DATABASE_URL` | URI pooler 6543 do Supabase de prod (com `?pgbouncer=true&connection_limit=1`) |
| `DIRECT_URL` | URI direta 5432 do Supabase de prod |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` do Supabase de prod |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key do Supabase de prod |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key do Supabase de prod |
| `BETTER_AUTH_SECRET` | gerado no passo 3 |
| `RESEND_API_KEY` | da conta Resend (domínio JÁ verificado) |
| `RESEND_FROM_EMAIL` | `noreply@mangospay.app` (ou domínio verificado) |
| `UPSTASH_REDIS_REST_URL` | do projeto Upstash de prod |
| `UPSTASH_REDIS_REST_TOKEN` | do projeto Upstash de prod |
| `CRON_SECRET` | gerado no passo 3 |

Opcionais (recomendado configurar mesmo assim):

| Chave | Valor |
|---|---|
| `HEALTH_SECRET` | gerado no passo 3 — habilita detalhe do `/api/health` |
| `SENTRY_DSN` | DSN do projeto Sentry de produção |
| `NEXT_PUBLIC_SENTRY_DSN` | MESMO valor de `SENTRY_DSN` |
| `SENTRY_ENVIRONMENT` | `production` |
| `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | `production` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | só se for habilitar OAuth Google na Fase 1 |

> Pra cada chave: **Production** scope (não marcar Preview/Development
> a menos que você tenha um Supabase de staging separado).

### 6. Configurar region São Paulo

`vercel.json` ainda não força região. Adicionar (se quiser garantir,
não obrigatório — Vercel já tenta colocar perto do banco):

```json
{
  "regions": ["gru1"],
  ...
}
```

Ou via painel: Settings → Functions → Region → `gru1` (São Paulo).

### 7. Gerar URLs assinadas dos crons e atualizar vercel.json

```powershell
# usar o MESMO CRON_SECRET que está em prod
pnpm exec tsx scripts/sign-cron-urls.ts
```

Saída tipo:

```
/api/cron/keep-alive          →  /api/cron/keep-alive?sig=<hex>
/api/cron/expire-orders       →  /api/cron/expire-orders?sig=<hex>
```

Colar cada `path` (com `?sig=...`) em `vercel.json` substituindo os
placeholders `REPLACE_WITH_HMAC_FROM_SIGN_CRON_URLS`. Commitar.

> Se rotacionar `CRON_SECRET` em prod no futuro, rodar de novo e
> commitar — senão o cron quebra silencioso.

### 8. Deploy

```powershell
vercel --prod
```

Ou: push pro `main` se o auto-deploy estiver configurado.

Acompanhar o log de build no painel. Se quebrar por env faltando, o
schema Zod em `src/lib/env.ts` mostra exatamente qual.

### 9. Smoke test em produção

Substituir `<dom>` pelo domínio real (`mangospay.app` ou
`mangospay.vercel.app`):

- [ ] `https://<dom>/api/health` retorna `200 { ok: true }`
- [ ] `https://<dom>/sandra-brito` (ou qualquer loja seedada) carrega
      catálogo sem erro
- [ ] Adicionar ao carrinho → finalizar checkout WhatsApp → recebe
      código curto + abre link WhatsApp
- [ ] `https://<dom>/entrar` → login admin → criar produto via câmera
      mobile → upload OK (imagem aparece em ≤3s)
- [ ] Pedido aparece em `/admin/pedidos`
- [ ] PDV: abrir caixa, vender (cartão + dinheiro), fechar caixa Z
- [ ] Cron `keep-alive` aparece em Vercel → Project → Crons UI

### 10. Lighthouse mobile

Chrome DevTools → Lighthouse → Mobile → Performance + Accessibility +
Best Practices + SEO. Alvo: **≥ 90 em Performance**. Outros métricas
≥ 95.

Rodar 3 vezes (variação típica), pegar a mediana.

### 11. Seed Sandra com dados reais

- Criar conta Sandra via `/criar-loja/conta`
- Onboarding → criar slug `sandra-brito` (ou negociar com ela)
- Catalogar produtos reais (sessão de fotos + sharp pipeline)
- Configurar WhatsApp da loja, cores, banner

Quando Sandra acessar e vender 1 venda real, **Fase 1.7 está fechada**.

---

## Verificação final

Tudo verde:

- [ ] Build production verde no Vercel
- [ ] 14 envs configuradas em `production`
- [ ] Crons aparecem em Vercel Crons UI
- [ ] Smoke test do passo 9 todo marcado
- [ ] Lighthouse mobile ≥ 90
- [ ] Sandra acessou `/sandra-brito` e validou 1 fluxo end-to-end

---

## Rollback

Se algo der errado **antes** de Sandra usar:

1. Vercel → Deployments → versão anterior → "Promote to production"
2. Se o problema for env: corrigir no painel, redeploy (sem precisar
   git push, basta "Redeploy" no Vercel)

Se algo der errado **depois** de Sandra ter feito vendas:

1. NÃO derrubar o banco — vendas são append-only, dados são valor real
2. Promover deploy anterior (passo 1 acima)
3. Investigar com calma; só re-aplicar SQL se realmente necessário
   (idempotentes, mas exigem cuidado)

---

## Notas de longo prazo

- Vercel Hobby permite Crons mas SEM `Authorization` header (por isso
  usamos HMAC em query string). Migrar pra Pro quando quiser headers
  e tirar a query string.
- `connection_limit=1` na DATABASE_URL é deliberado: Vercel cold-start
  pode abrir várias conexões simultaneamente e estourar o pooler.
  Aumentar SÓ se medir esgotamento real.
- Em Supabase free tier, o banco entra em "pause" após 7 dias sem
  query. O cron `keep-alive` evita isso (roda 09:00 todo dia).
