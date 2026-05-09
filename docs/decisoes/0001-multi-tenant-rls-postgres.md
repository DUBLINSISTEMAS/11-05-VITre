# ADR-0001: Multi-tenancy com Postgres RLS

- **Data**: 2026-05-07
- **Status**: aceito

## Contexto

Vitrê é SaaS multi-tenant. Lojistas isolados, clientes finais isolados por loja. Vazamento entre tenants = falha catastrófica de confiança. Decisão precisa estar tomada antes da primeira migration porque define o shape de toda tabela de domínio.

## Opções consideradas

| Opção | Prós | Contras |
|-------|------|---------|
| RLS no Postgres | Segurança por construção; nativo do Supabase | Curva de aprendizado; debug mais difícil |
| Filtro no app-layer | Mais simples no início | Um `where store_id = X` esquecido = vazamento; risco que escala com a base de código |
| DB por tenant | Isolamento máximo | Inviável com Supabase Free; ops insustentável em N lojas |
| Schema por tenant | Aceitável em nichos | Migrations rodam N vezes; complexidade desnecessária |

## Decisão

**RLS no Postgres.** Toda tabela de domínio carrega `store_id` (FK → `store.id`). Políticas RLS:

```sql
CREATE POLICY tenant_isolation ON product
  USING (store_id = current_setting('app.current_store_id')::uuid);
```

Drizzle executa `set local app.current_store_id = '...'` no início de cada request via middleware.

## Consequências

- ✅ Defesa em duas camadas: app-layer (`withTenant`) + RLS.
- ✅ Funciona nativamente com Supabase (RLS automaticamente habilitada em novas tabelas).
- ✅ `withTenant` é encapsulado em helper único — qualquer dev que escreva server action passa por ele.
- ⚠️ **Nuance importante (MVP)**: nossa conexão Drizzle usa role `postgres` do Supabase, que **bypassa RLS por padrão**. Isso significa:
  - **1ª linha de defesa**: `withTenant` (app-layer, disciplina obrigatória).
  - **2ª linha de defesa**: RLS — barra acessos via `supabase-js` anônimo direto (que não fazemos no servidor, mas defende contra ataques tipo "alguém roubou anon key e tenta query").
  - **Esquecer `withTenant` causa vazamento via Drizzle** — mitigado por (a) helper único, (b) review de PR, (c) busca por queries sem `withTenant` na CI futura.
- ⚠️ `service_role` (jobs admin, seeds) bypassa RLS; usar com cuidado e logar via `withServiceRole(reason, fn)`.
- 🔧 Dívida (Fase 2+): criar role custom `vitre_app` sem BYPASSRLS + `ALTER TABLE ... FORCE ROW LEVEL SECURITY` para promover RLS a 1ª linha de defesa também via Drizzle. Documentar processo em `runbooks/`.

## Tabelas SEM RLS (intencional)

`user`, `session`, `account`, `verification` (Better Auth) — RLS desabilitada porque Better Auth gerencia autorização internamente. Acesso a essas tabelas é controlado pela camada de auth, não pelo Postgres.

## Quem decidiu

Anderson Felipe (founder) + Conselho-5-agentes (LÂMINA propôs, NEXUS confirmou, AXIOMA aprovou).
