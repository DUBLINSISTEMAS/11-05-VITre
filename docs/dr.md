# Disaster Recovery — Mangos Pay

> **S1.6 do Plano de Endurecimento.** Documenta RTO/RPO + procedimento
> manual de restore. Não substitui backup automático do Supabase (Free
> tier mantém 7 dias rolling), serve como **plano B** quando o automático
> falhar OU quando precisar restaurar para timestamp específico.

## Targets

| Métrica | Target | Realidade Free | Realidade Pro |
|---------|--------|----------------|---------------|
| RTO (Recovery Time Objective) | 4h | 1-2h via support Supabase | 30min via PITR |
| RPO (Recovery Point Objective) | 24h | 24h (last nightly backup) | 5min (PITR continuous) |

**Decisão de produto**: enquanto estiver no plano Free, RTO/RPO acima são limites aceitos. Quando primeiro lojista pagante entrar, migrar pra Plano Pro (US$ 25/mês) com PITR ativado é gate.

## Cenários cobertos

### 1. Tabela drop acidental ou DELETE em massa

- **Causa**: bug em migration, RLS bypass acidental, dev rodando script de cleanup em URL errado.
- **Mitigação ativa**: append-only nas tabelas críticas (`cash_adjustment`, `order_payment`, `stock_movement`, `receivable_payment` — não permitem DELETE legitimo).
- **Recovery**: restaurar do backup mais recente. Aceitar perda de até 24h.

### 2. Disk corruption / database loss

- **Causa**: hardware Supabase falha (raríssimo, redundância gerenciada).
- **Recovery**: support Supabase via dashboard. SLA Free é "best effort", Pro tem SLA 99.9%.

### 3. Erro humano em UI (lojista deleta categoria com produtos)

- **Mitigação ativa**: FK ON DELETE RESTRICT bloqueia cascata destrutiva. Soft-delete onde aplicável.
- **Recovery**: lojista re-cadastra OU restore se nada melhor.

### 4. Rollback de deploy ruim que corrompe dados

- **Causa**: bug em server action gravando dado errado em massa.
- **Recovery (técnica)**: `git revert` do código + restore parcial via backup. Pode requerer migration de "reconciliação".

## Procedimento de restore manual (cenário 1 / 2)

### Passo 1 — confirmar incidente

```bash
# Sintoma: dados sumidos, integridade quebrada
psql $DIRECT_URL -c "SELECT COUNT(*) FROM product"
# Confirmar com lojista afetado o que sumiu.
```

### Passo 2 — pausar tráfego (opcional, se janela > 30min)

```bash
# Vercel Dashboard → Settings → Pause Deployment.
# Storefront fica 503 mas evita escrever sobre estado parcial restored.
```

### Passo 3 — obter backup

**Opção A — Supabase auto-backup (Free, últimas 7 dias)**:
1. Dashboard Supabase → Database → Backups
2. Clicar no backup desejado → "Download"
3. Salva `.sql.gz`

**Opção B — Snapshot manual gerado pelo script `backup-snapshot.mjs`**:
1. GitHub Actions → Workflow "Backup weekly" → último run com artifact
2. Download `.sql.gz` (retenção 30 dias)

### Passo 4 — restore em DB ephemeral (NÃO direto em prod)

```bash
# Sobe Postgres local temporário
docker run -d --name restore-test -e POSTGRES_PASSWORD=local -p 6543:5432 postgres:16

# Aplica backup
gunzip < backup.sql.gz | psql postgres://postgres:local@localhost:6543/postgres

# Valida que dado esperado existe
psql postgres://postgres:local@localhost:6543/postgres -c "SELECT COUNT(*) FROM product"
```

### Passo 5 — extrair só o que precisa (restore parcial)

```bash
# Não substitui prod inteiro — exporta só as tabelas afetadas
pg_dump -t product -t product_image \
  postgres://postgres:local@localhost:6543/postgres > restore-partial.sql

# Aplica em prod
psql $DIRECT_URL < restore-partial.sql
```

### Passo 6 — invalidar caches

```bash
# Storefront cache do Vercel: forçar revalidate via redeploy fresh
# OU rodar /admin/aparencia → Salvar → revalidateTag dispara

# Service worker cache do PWA: bumpar public/sw.js CACHE_VERSION
```

### Passo 7 — pos-mortem em `docs/incidents/YYYY-MM-DD-titulo.md`

Documentar: cronologia, causa raiz, ação corretiva, mitigação futura.

## Backup manual via script

Script `scripts/backup-snapshot.mjs` faz `pg_dump` da DB inteira. Roda local OU via GitHub Action.

```bash
# Local
node --env-file=.env.local scripts/backup-snapshot.mjs
# Output: backups/2026-05-26.sql.gz

# CI weekly (cron 0 6 * * 0 = domingo 6h UTC)
# .github/workflows/backup-weekly.yml
```

## Testes de restore — Q1 obrigatório

A cada 3 meses, executar **restore drill** em DB ephemeral:

1. Pegar backup mais recente
2. Restore num Postgres ephemeral
3. Validar contagem de linhas das 5 tabelas críticas (`store`, `product`, `customer`, `order`, `receivable`)
4. Validar que `tests/integration/rls-cross-tenant.test.ts` passa contra esse DB
5. Documentar resultado em `docs/incidents/restore-drill-YYYY-QN.md`

**Por que importante**: backup que nunca foi testado **não é backup**, é arquivo .gz aleatório. Já houve casos de empresa perder semanas porque backup estava corrompido.

## Contato em incidente real

- Founder (Anderson): dublinsistemas@gmail.com
- Supabase support (Plano Free): https://supabase.com/dashboard → Help (resposta ~24h)
- Supabase support (Plano Pro): SLA 99.9%, email priority
- Vercel support: https://vercel.com/help (Free tier resposta ~48h)

## Anti-patterns

- ❌ Testar restore em PROD — sempre em ephemeral primeiro
- ❌ Aplicar `pg_dump` inteiro sobre prod com dados novos no meio — perde tudo entre backup e agora
- ❌ Esquecer de invalidar cache do Vercel/PWA após restore — usuário vê estado fantasma
- ❌ Não documentar incidente em `docs/incidents/` — perde aprendizado
