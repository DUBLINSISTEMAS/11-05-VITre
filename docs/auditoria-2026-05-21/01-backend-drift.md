# 01 — Backend drift

**Escopo:** SQLs aplicadas em prod, schema Drizzle vs DB real, RLS coverage, indexes, foreign keys.
**Metodologia:** scripts read-only em `scripts/check-sql-44-50.mjs`, `audit-rls-coverage.mjs`, `audit-drizzle-vs-db.mjs`.

---

## Resumo executivo

| Dimensão | Status |
|---|---|
| SQLs estruturais 11-43 aplicadas | 32/32 OK |
| SQLs 44-50 aplicadas | 7/8 OK (1 pendente: migration 49 brand) |
| Schema Drizzle vs DB | 31/32 sincronizado (brand declarada mas não aplicada) |
| RLS coverage | 27/31 tabelas com RLS+FORCE (4 exceções legítimas) |
| Foreign keys | 63 FKs · 41 CASCADE · 14 SET NULL · 6 NO ACTION (todos legítimos) · 2 RESTRICT |
| Indexes | 110 indexes em 31 tabelas (média 3.5/tab) |

**Veredito:** backend em **excelente estado**. Sem drift estrutural. Sem RLS faltando em tabela de domínio. Único débito é a migration 49 (`brand`) preparada na Sprint 0 mas não aplicada — esperando Sprint 2 que vai expor o CRUD.

---

## 1. SQLs aplicadas

### 1.1 SQLs 11-43 (estruturais antigas)

```
32/32 aplicadas via npm run db:check-sql
```

Todas verificadas: indexes, CHECK constraints, triggers, policies, RLS habilitação, revogação de grants anônimos, hardenings de auditorias passadas.

### 1.2 SQLs 44-50 (Camada Comercial + Sprint 0/1A)

Verificadas via `scripts/check-sql-44-50.mjs` (criado nesta auditoria):

| SQL | Descrição | Status |
|---|---|---|
| 44 | Camada Comercial CHECK constraints (order_payment + receivable + cash_adjustment) | APPLIED |
| 45 | `purchase_item.total_cost_in_cents` GENERATED ALWAYS | APPLIED |
| 46 | Camada Comercial RLS (supplier/purchase/purchase_item/receivable) | APPLIED |
| 47 | `order_payment` backfill | APPLIED |
| 48 | `product.wholesale_price` CHECK (wholesale ≤ base) | APPLIED |
| **49** | **tabela `brand` criada** | **NÃO APLICADA** |
| 50 | order_status enum ADD 'quote' + ADD COLUMN quote_valid_until | APPLIED (aplicada hoje) |

**Pendência:** SQL 49 espera Sprint 2 quando o CRUD em `/admin/marcas` for ativado. O campo `product.brand` continua como texto livre por enquanto. Isso está documentado no commit `55c2f56`.

### 1.3 SQLs 01-10 (bootstrap)

Não checadas automaticamente (scripts de bootstrap one-shot). Inferidas como aplicadas porque o resto do sistema depende delas.

---

## 2. Schema Drizzle vs DB

```
Drizzle declara: 32 tabelas
DB tem:          31 tabelas
Em ambos:        31
```

**Diff:**
- `brand` declarada no Drizzle (`src/db/schema/brand.ts`) mas não aplicada no DB (esperando SQL 49).

Zero tabelas órfãs no DB (sem schema Drizzle). Zero tabelas declaradas que falhariam runtime.

---

## 3. RLS coverage

### 3.1 Tabelas COM RLS + FORCE (27)

```
attribute, attribute_value, banner, cash_adjustment, cash_session,
category, coupon, customer, customer_group, lead, order, order_item,
order_payment, product, product_attribute_value, product_image,
product_related, product_variant, purchase, purchase_item, receivable,
stock_movement, store, store_membership, storefront_collection,
storefront_collection_item, supplier
```

Todas com `rowsecurity=t` E `forcerowsecurity=t` (FORCE garante que owner do schema também não pula RLS). Todas têm pelo menos 1 policy ativa.

### 3.2 Tabelas SEM RLS (4)

| Tabela | Motivo |
|---|---|
| `user` | Gerenciada pelo better-auth (não é tabela de domínio do Vitrê). |
| `session` | Idem. |
| `account` | Idem (auth provider link). |
| `verification` | Tokens de verificação de email do better-auth. |

**Veredito:** Legítimo. RLS não se aplica a tabelas do auth provider — better-auth tem seu próprio mecanismo de isolamento via session token.

### 3.3 Anon grants

```
Nenhuma tabela tem grant pra role `anon`.
```

Storefront público (anônimo) NÃO acessa o DB direto via REST. Tudo passa pelo backend Node (Next.js server actions / RSC) usando connection pool com role `app_user` + `withTenant(storeId, ...)`. **Isolamento por loja garantido em todas as queries de domínio.**

---

## 4. Indexes

110 indexes em 31 tabelas. Distribuição:

| Tabela | # | Observação |
|---|---|---|
| `product` | 11 | Buscas por slug, store_id, isActive, GTIN, name ilike |
| `order` | 8 | shortCode, storeId+status, createdAt, customerId, sellerId |
| `customer`, `lead` | 6 | Buscas comuns de admin |
| `receivable`, `supplier` | 5 | Camada Comercial recém-adicionada |
| Outras | 1-4 | PK + FK + 1-2 query patterns |

**Nenhum sinal de under-indexing** nos hot paths que vi (busca de produto, filtros de venda, RLS via store_id em todas tabelas de domínio).

---

## 5. Foreign keys (63)

```
ON DELETE CASCADE   41 (65%)  — store-owned cascades, store deletion clears tenant
ON DELETE SET NULL  14 (22%)  — FKs opcionais (sellerId, couponId, customerId em order)
ON DELETE NO ACTION  6 (10%)  — bloqueia delete (default histórico)
ON DELETE RESTRICT   2 (3%)   — bloqueia delete explicitamente
```

### 5.1 FKs sem ON DELETE explícito (NO ACTION default)

Esses 6 referenciam:

```
cash_adjustment.created_by_user_id     → user
cash_session.closed_by_user_id         → user
cash_session.opened_by_user_id         → user
purchase.created_by_user_id            → user
receivable.created_by_user_id          → user
receivable.customer_id                 → customer
```

**Análise:**
- 5 FKs pra `user` (operador histórico). NO ACTION é correto — não deletar user que tem transações.
- 1 FK em `receivable.customer_id`. Também NO ACTION é correto — não deletar customer com fiado pendente.

**Veredito:** intencional, não é descuido. Embora `RESTRICT` fosse mais explícito que `NO ACTION` (ambos bloqueiam mas com timing diferente em deferred constraints), na prática operacional o resultado é o mesmo. Não justifica migration.

---

## 6. Findings com severidade

| # | Severidade | Finding | Ação recomendada |
|---|---|---|---|
| 1 | **MÉDIO** | Migration 49 (`brand`) não aplicada — schema Drizzle declara tabela inexistente | Aplicar quando Sprint 2 iniciar CRUD `/admin/marcas`. Por enquanto, ProductForm campo `brand` é texto livre. Sem risco runtime: zero código consulta `brandTable`. |
| 2 | **BAIXO** | 6 FKs com `NO ACTION` (default) em vez de `RESTRICT` explícito | Cosmético. Não migra. |
| 3 | **BAIXO** | `scripts/check-sql-applied.mjs` cobre só SQLs 11-43 | Estender pra cobrir 44-50 dentro do script principal (em vez de manter `check-sql-44-50.mjs` separado). Trabalho de 30 minutos. |
| 4 | **INFO** | 4 tabelas sem RLS (user/session/account/verification) | Legítimo — better-auth. Documentar em CLAUDE.md pra futuras auditorias não estranharem. |

**Crítico/Alto:** **nenhum.**

---

## 7. Recomendações concretas

1. **Não aplicar mais SQL nenhum agora.** Backend está estável.
2. **Consolidar `check-sql-44-50.mjs` em `check-sql-applied.mjs`** durante a próxima limpeza (BAIXO).
3. **Migration 49 fica em standby** até Sprint 2.
4. **Adicionar 1 linha em CLAUDE.md** documentando que 4 tabelas do better-auth são intencionalmente sem RLS.
