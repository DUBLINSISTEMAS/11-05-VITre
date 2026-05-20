# Auditoria 2026-05-21 — Sumário executivo

Auditoria read-only profunda do sistema antes de prosseguir pra Sprint 2.
**Nenhum código foi modificado nesta auditoria — apenas mapeamento e geração de docs.**

---

## Veredito global

Sistema está em **estado senior-grade**. Não há sinal de "código feito por IA" ou "amador".
Os 5 docs abaixo detalham cada dimensão. Resumo:

| Dimensão | Status |
|---|---|
| Backend (DB drift, RLS, FKs) | **OK** — 1 migration parada (brand) esperando Sprint 2 |
| Dead code real | **GERENCIÁVEL** — ~640 linhas removíveis em 4 commits |
| Convenções (emojis, console, naming) | **OK** — 5 pequenas correções (10 min) |
| Segurança (CSP/RLS/uploads) | **OK** — 1 alto (rate limit em 3 mutations) + 2 médios (sql.raw, magic bytes) |
| Arquitetura (boundaries, naming, organização) | **OK** — 2 arquivos gigantes (refator opcional) |

**Crítico: 0. Alto: 1. Médios: 8. Baixos: ~10.**

---

## Documentos (5)

| # | Doc | O que cobre |
|---|---|---|
| 01 | [Backend drift](./01-backend-drift.md) | SQLs aplicadas vs não, schema Drizzle vs DB real, RLS coverage, indexes, FKs |
| 02 | [Dead code real](./02-dead-code-real.md) | Validação 1-a-1 dos 341 candidatos do `ts-prune` → 47 reais classificados em 3 categorias |
| 03 | [Convenções e ruído](./03-convencoes.md) | Emojis, console statements, TODOs, `any`, arquivos gigantes |
| 04 | [Segurança](./04-seguranca.md) | RLS, SQL injection, uploads, CSP/HSTS, rate limit, secrets, service role |
| 05 | [Arquitetura](./05-arquitetura.md) | Client/server boundaries, naming PT-vs-EN, organização de pastas, ADRs |

---

## Findings consolidados

### Crítico (corrigir imediatamente)

Nenhum.

### Alto (corrigir antes de Sprint 2)

1. **Rate limit ausente em 3 mutations de storefront-collection** (doc 04). Esforço: 10 min.

### Médio (Sprint 1.5 — Limpeza)

2. **`product-commercial-fields.tsx` (441 linhas) órfão após Sprint 0/Prompt 6** — deletar arquivo inteiro (doc 02).
3. **22 tipos Zod inferidos sem consumer** poluindo IntelliSense — remover `export` (doc 02).
4. **7 helpers utility sem consumer** — deletar (doc 02).
5. **3 emojis em UI interno** (PDV check, slug, env) — substituir (doc 03).
6. **2 `console.info` em create-balcao-sale** — converter pra `logger.info` (doc 03).
7. **`sql.raw(String(periodo))` em dashboard** — refator pra eliminar `.raw()` (doc 04).
8. **Magic bytes não validado em uploads** — Sprint 6 conforme planejado (doc 04).
9. **`pdv-shell.tsx` 2154 linhas** — extrair 5 sub-componentes (doc 03/05).

### Baixo (Sprint dedicada futura)

10. **15 componentes UI órfãos** (skeletons, toast hooks, sub-cards) — deletar (doc 02).
11. **6 FKs com NO ACTION default** — cosmético, sem impacto (doc 01).
12. **Audit log (audit_event) inexistente** — Sprint 6 conforme planejado (doc 04).
13. **CSP `'unsafe-inline'`** — aceitável com Next.js SSR; nonce-based seria upgrade futuro (doc 04).
14. **`create-balcao-sale.ts` 1141 linhas com ~300 duplicadas** — extrair 2 helpers (doc 03/05).
15. **`scripts/check-sql-applied.mjs` só cobre 11-43** — estender pra 44+ (doc 01).
16. **`check-sql-44-50.mjs` standalone** — consolidar no principal (doc 01).
17. **`'unsafe-inline'` em script-src/style-src** — aceitável com Next.js SSR (doc 04).

### Informacional (não-acionável)

18. **3 dead intencional aguardando wiring** (`recordLead`, `getActiveBanners`, `getRecentProducts`) — anotar `@deprecated-until-wired` (doc 02).
19. **2 TODOs anotados Sprint 1B / Sprint 2** — referências documentadas (doc 03).
20. **PT-vs-EN convention** — adicionar uma linha em CLAUDE.md formalizando (doc 05).
21. **Migration 49 (`brand`)** — fica em standby até Sprint 2 (doc 01).

---

## Plano de execução recomendado

### Sprint 1.5 — Limpeza pré-Sprint 2 (1 sessão)

**Onda 1 — Higiene (15 min)**
- Remover 22 tipos Zod sem consumer
- Deletar 7 helpers utility sem consumer
- Substituir 3 emojis em UI interno
- Converter 2 `console.info` pra `logger.info`
- Remover emoji `❌` em `env.ts`

**Onda 2 — Componentes UI órfãos (20 min)**
- Deletar `src/components/admin/product-commercial-fields.tsx` (441 linhas)
- Deletar 4 skeletons + 2 hooks toast + 1 type filter
- Anotar `@deprecated-until-wired` em `recordLead`, `getActiveBanners`, `getRecentProducts`

**Onda 3 — Segurança (15 min)**
- Adicionar `checkRateLimit` em `upsertCollection`, `deleteCollection`, `setCollectionProducts`
- Refator `sql.raw(String(periodo))` em dashboard pra eliminar `.raw()`

**Onda 4 — CLAUDE.md (5 min)**
- Adicionar 2 linhas: 1 sobre 4 tabelas better-auth sem RLS, 1 sobre convenção PT-vs-EN

**Total Sprint 1.5: ~55 min, 4 commits, ~640 linhas removidas + 3 lines security fix.**

### Sprint 1.5b — Refator arquivos gigantes (3-5h, opcional)

- Extrair 5 sub-componentes de `pdv-shell.tsx` (2154 → ~1000 linhas)
- Extrair 2 helpers de `create-balcao-sale.ts` (1141 → ~800 linhas)

Pode ser feito JUNTO da Sprint 2 quando ela for mexer nesses arquivos (oportunidade natural).

### Sprint 2 — Cadastros refeitos

Conforme CLAUDE.md. Migration 49 (brand) entra na aplicação real aqui.

---

## Scripts gerados nesta auditoria (mantidos em `scripts/`)

| Script | Propósito |
|---|---|
| `check-sql-44-50.mjs` | Check das SQLs 44-50 (extensão do `check-sql-applied.mjs`) |
| `investigate-missing.mjs` | Investigação ad-hoc de SQLs falsamente missing |
| `audit-rls-coverage.mjs` | Audit RLS+FORCE coverage por tabela |
| `audit-drizzle-vs-db.mjs` | Diff schema Drizzle vs DB real |
| `validate-dead-code.mjs` | Validador de candidatos do `ts-prune` via busca real |

Esses ficam pra próximas auditorias. Em Sprint 1.5 (item #15) podemos consolidar `check-sql-44-50` dentro do `check-sql-applied`.

---

## Disciplina aplicada

- Nenhum código modificado.
- Nenhum SQL aplicado.
- Nenhum git commit feito.
- Tudo é read-only + 5 docs + 5 scripts em `scripts/`.

Pronto pra você revisar e decidir o que entra na Sprint 1.5.
