# 05 — Arquitetura

**Escopo:** boundaries entre camadas (client/server/db), naming consistency PT-vs-EN, organização de pastas, dependência circular, arquivos gigantes.

---

## Resumo

| Dimensão | Status |
|---|---|
| Client components importando Drizzle (value) | **0** |
| Client components importando `@/db/schema` (value) | **0** — todos os 12 hits são `import type` |
| Actions sem `"use server"` | **0** |
| Identifiers TypeScript com acento PT | **0** |
| Rotas URL em PT | sim (intencional — UI BR) |
| Pastas de código em EN | sim (intencional — convenção dev) |
| Re-export aggregators | 5 (`db/schema/index.ts`, `actions/coupon/index.ts`, `actions/customer-group/index.ts`, `actions/storefront-collection/index.ts`, `actions/order/balcao/schema.ts` re-exporta enum) |
| Arquivos > 1000 linhas | 2 (`pdv-shell.tsx`, `create-balcao-sale.ts`) — já listados em doc 03 |
| Dependência circular | nenhuma detectada via tsc (zero erros) |

**Veredito:** arquitetura **senior-grade**. Boundaries respeitados, naming consistente, sem violações estruturais. Os 2 arquivos gigantes são o único débito.

---

## 1. Boundaries client/server

### 1.1 Regra (CLAUDE.md #7)

> "Tudo de mutação é server action `'use server'`. Client nunca chama Drizzle. Loaders com prefixo `load*` são leituras puras, sem side-effect."

### 1.2 Verificação

```
Client components com import VALUE de 'drizzle-orm':         0
Client components com import VALUE de '@/db/schema':         0
Actions files (70) com "use server":                         70/70
```

Os 12 client components que importam `@/db/schema` fazem **`import type { X }`** — types são apagados pelo TypeScript no compile, **zero bytes no bundle client**. Não há violação.

### 1.3 Padrão de execução

```
[client] form submit
  ↓ React server action call
[server] action "use server"
  ↓ withTenant(storeId, userId, async tx => ...)
[postgres] RLS policies aplicam current_setting('app.current_store_id')
  ↓
[response] back to client
```

Modelo consistente em todas as ~70 actions.

---

## 2. Naming consistency

### 2.1 Convenção observada

| Camada | Idioma | Exemplo |
|---|---|---|
| URL paths (visíveis ao lojista) | **PT** | `/admin/aparencia`, `/admin/atributos`, `/admin/colecoes` |
| Pastas de código | **EN** | `src/actions/attribute`, `src/components/admin/dashboard` |
| Identifiers TS | **EN** | `attributeTable`, `loadOrderDetail`, `CreateBalcaoSaleInput` |
| UI strings | **PT** | `"Filtros da loja"`, `"Vitrines"`, `"Recados do site"` |
| Comentários | **PT/EN mistos** | aceitável (devs brasileiros lendo) |

**Distinção clara:** URLs e UI strings são PT-BR (vocabulário do lojista). Código é EN (convenção dev). Senior-grade.

### 2.2 Verificações automatizadas

- Identifiers TypeScript com acento PT em `function`, `const`, `interface`, `type` declarations: **0**
- Identifiers TypeScript em PT sem acento (palavras tipo `vendas`, `produtos`, etc): existem como nomes de **schema fields** (ex: `vendas: number` em SalesSummary) — aceitável quando representa entidade de domínio que faz parte do produto.

---

## 3. Organização de pastas

```
src/
├── actions/           ← server actions, 1 pasta por domínio (16 domínios)
│   ├── attribute/
│   ├── auth/
│   ├── ...
│   └── order/
│       ├── balcao/    ← sub-domínio (PDV)
│       │   ├── create-balcao-sale.ts
│       │   ├── load-day-summary.ts
│       │   └── schema.ts
│       ├── create-from-cart.ts
│       └── ...
├── app/               ← rotas Next.js
│   ├── (admin)/admin/ ← group route admin
│   ├── (auth)/        ← group route login
│   ├── (storefront)/  ← group route loja pública
│   └── api/           ← REST APIs (cron, auth handler)
├── components/
│   ├── admin/         ← componentes do admin
│   │   ├── dashboard/ ← sub-pasta dashboard
│   │   ├── pdv/       ← sub-pasta PDV
│   │   ├── product-form/ ← sub-pasta tabs do form
│   │   ├── report/    ← componentes de relatório
│   │   └── shell/     ← header, sidebar, layout
│   ├── storefront/    ← componentes da loja pública
│   └── ui/            ← primitivos shadcn
├── db/
│   ├── schema/        ← 1 arquivo por domínio + index.ts
│   └── index.ts       ← cliente Drizzle
├── hooks/             ← React hooks compartilhados
└── lib/               ← utils server-side
    └── storefront/    ← loaders do storefront
```

**Avaliação:** organização **excelente**. Cada nível tem propósito claro:
- `actions/` = mutations server-side por domínio
- `components/` = UI por audiência (admin / storefront / ui primitivos)
- `lib/` = utils sem state
- `db/schema/` = source-of-truth do schema

Nenhuma pasta órfã. Nenhuma pasta com 50+ arquivos (caso clássico de "uma pasta cresce demais e vira monte de tudo").

---

## 4. Re-export aggregators

5 arquivos `index.ts` re-exportam de irmãos:

| Arquivo | Propósito |
|---|---|
| `src/db/schema/index.ts` | Re-export de todas as 16 schemas de tabelas (consumido como `@/db/schema`) |
| `src/actions/coupon/index.ts` | API pública do domínio coupon (load/upsert/delete/validate) |
| `src/actions/customer-group/index.ts` | Idem customer-group |
| `src/actions/storefront-collection/index.ts` | Idem storefront-collection |

**Avaliação:** consistente. Pattern padrão em projetos TS sêniors. Os 4 domínios que usam index.ts são os 4 que têm 3+ actions agrupadas. Os outros (15) têm cada action em arquivo isolado direto, sem index — também válido.

---

## 5. Dependência circular

- `npx tsc --noEmit` retorna **zero erros** consistentemente em cada commit.
- Drizzle relations (relations(table, ({ one, many }) => ...)) podem teoricamente causar ciclo TS quando `tableA` referencia `tableB` e vice-versa, mas Drizzle lazy-evalua (callback). Sem problema.

---

## 6. Arquivos gigantes (já em doc 03)

| Arquivo | Linhas | Plano |
|---|---|---|
| `src/components/admin/pdv/pdv-shell.tsx` | 2154 | Extrair 5 sub-componentes pra `src/components/admin/pdv/` (~1000 linhas remanescentes) |
| `src/actions/order/balcao/create-balcao-sale.ts` | 1141 | Extrair 2 helpers (`run-shortcode-retry`, `lock-and-check-stock`) (~800 linhas remanescentes) |

Refator dos 2 fica como **Sprint 1.5 (Limpeza)** entre a auditoria atual e Sprint 2.

---

## 7. ADRs

`docs/decisoes/` tem 34 ADRs documentando todas as decisões arquiteturais não-óbvias:

```
0001-product-domain-decisions.md
...
0034-camada-comercial-vitre.md
```

CLAUDE.md tem seção "Quando uma decisão merece ADR" definindo critérios:
- Muda schema OU cria tabela nova
- Consequência arquitetural irreversível em ≤30 dias
- Outro dev abrindo o projeto pela primeira vez precisa entender o porquê

ADR-0019 (Dublin v3) está marcado como `parked` corretamente. ADR-0033 (veto fiscal explícito) é régua durável. ADR-0034 (Camada Comercial) é o roadmap atual.

**Avaliação:** disciplina de ADR mantida.

---

## 8. Findings com severidade

| # | Severidade | Finding | Ação |
|---|---|---|---|
| 1 | **MÉDIO** | `pdv-shell.tsx` 2154 linhas (já em doc 03) | Extrair 5 sub-componentes — Sprint 1.5 |
| 2 | **BAIXO** | `create-balcao-sale.ts` 1141 linhas com ~300 duplicadas entre branches | Extrair 2 helpers — Sprint 1.5 |
| 3 | **INFO** | Convenção PT-vs-EN clara e consistente | Documentar em CLAUDE.md se ainda não estiver explícito |

**Crítico/Alto:** **nenhum.**

---

## 9. Conclusão arquitetural

Arquitetura está **sólida e respeita convenções senior**:

- **Boundaries:** client nunca toca Drizzle (zero violações). Toda mutation passa por server action. RLS no DB garante isolamento.
- **Naming:** distinção clara entre PT (lojista vê) e EN (dev lê). Identifiers consistentes.
- **Organização:** pastas por audiência (admin/storefront/ui), actions por domínio, schemas em `db/schema/`. Sem pasta sem dono.
- **Documentação:** 34 ADRs cobrem cada decisão estrutural. CLAUDE.md é a norma operacional viva.
- **Type safety:** zero `any`, zero `@ts-ignore`. 270 testes.

**Único débito real:** 2 arquivos gigantes. Não impedem nada hoje, mas o refator deles **antes** de Sprint 2 vai ser preventivo — Sprint 2 vai mexer em `product-form/` e `pdv-shell.tsx` provavelmente.

Não há sinal de "código feito por IA" ou "amador". Não há shortcut técnico que precise ser desfeito.
