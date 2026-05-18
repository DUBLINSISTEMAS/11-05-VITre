# ADR-0021: Cliente PF/PJ + documento (CPF/CNPJ)

- **Data**: 2026-05-18
- **Status**: aceito
- **Estende**: ADR-0014 (Fase 3 — cadastro de clientes)

## Contexto

A tabela `customer` foi criada em ADR-0014 só com nome + telefone + email + endereço + notas. No varejo brasileiro de pequeno e médio porte (Sandra Brito e similares) duas demandas aparecem assim que a loja começa a usar o cadastro:

1. **Distinguir PF de PJ na lista** — atacado para revendedora, cliente corporativo que compra periodicamente vs cliente final balcão.
2. **Guardar CPF/CNPJ** — pra emitir recibo nominal, identificar cliente recorrente quando o lojista esquece o nome, base pra futuro NF-e (`fora de escopo deste ADR — só guardar o dado`).

Hoje o lojista escreve "PJ — XYZ Ltda — CNPJ 12.345.678/0001-99" no campo `notes`, o que mata busca e relatórios.

## Decisão

Estender `customer` com 2 colunas e validação BR completa (não só length):

```ts
// src/db/schema/customer.ts
type: customerTypeEnum("type").notNull().default("individual"),
document: text("document"),  // CPF 11 dígitos ou CNPJ 14, SEM máscara
```

### Enum

```sql
CREATE TYPE customer_type AS ENUM ('individual', 'company');
```

Não há "outro" — empresa estrangeira sem CNPJ vira `individual` com `document NULL`. Manter binário simplifica UI (toggle) e relatórios.

### Validação em 2 camadas

**Camada DB (CHECK + UNIQUE)** — barreira de integridade, não de UX:

```sql
-- length só (algoritmo dos dígitos verificadores fica em Zod, vide abaixo)
ALTER TABLE customer ADD CONSTRAINT customer_document_length CHECK (
  document IS NULL
  OR (type = 'individual' AND length(document) = 11)
  OR (type = 'company'    AND length(document) = 14)
);

-- só dígitos
ALTER TABLE customer ADD CONSTRAINT customer_document_digits CHECK (
  document IS NULL OR document ~ '^[0-9]+$'
);

-- dedup por documento DENTRO da loja, mas só quando não-NULL
CREATE UNIQUE INDEX customer_store_document_unique
  ON customer(store_id, document) WHERE document IS NOT NULL;
```

**Camada Zod (algoritmo)** — bloqueia documento sintático mas inválido (`111.111.111-11`, dígito verificador errado). Validador puro em `src/lib/document.ts` exportando `isValidCpf(s) / isValidCnpj(s) / normalizeDocument(s) / formatDocument(s, type)`. Sem dependência externa — algoritmo é ~30 linhas cada.

### Default `individual`

Lojista médio cadastra 95% PF. Form abre em PF; toggle no topo muda pra PJ. Migration de backfill marca todos os clientes existentes como `individual` (safe — historicamente Sandra cadastrou só PF).

### Documento opcional

Cliente pode existir sem CPF/CNPJ (anônimo, dado não fornecido, perdido). NULL permitido. Só o **tipo** é obrigatório. UNIQUE parcial garante que `NULL` não bloqueia múltiplos cadastros sem documento.

## Consequências

**Positivas:**
- Lojista filtra "só PJ" / "só PF" na lista (B3.2 grupos vai usar essa coluna pra "atacado" virar derivação automática de PJ se quiser).
- Busca por documento (com ou sem máscara — normalizar antes da query).
- Base limpa pra futuro NF-e (`fora de escopo`).
- Dedup por documento previne cadastro duplicado quando o lojista esquece se já tem o cliente.

**Negativas (aceitas):**
- Form ganha mais 2 campos. Mitigação: toggle PF/PJ no topo, documento opcional, máscara automática.
- Migration precisa backfillar `type='individual'` — feita com `DEFAULT 'individual'` no `ADD COLUMN`, sem janela transacional perigosa.

**Não-objetivos:**
- ❌ NF-e / SEFAZ — explicitamente fora (CLAUDE.md veta).
- ❌ Validação de "CNPJ ativo" via API Receita — coupling externo, custo, ROI negativo agora.
- ❌ Trade name / razão social separados — quando alguém pedir, abrimos ADR. Hoje `name` cobre os dois.

## Plano de execução

1. **Migration Drizzle** `0020_customer_pf_pj.sql`:
   - `CREATE TYPE customer_type ...`
   - `ALTER TABLE customer ADD COLUMN type customer_type NOT NULL DEFAULT 'individual'`
   - `ALTER TABLE customer ADD COLUMN document text`
2. **SQL out-of-band** `supabase/sql/28_customer_document_check.sql`:
   - CHECK length + digits
   - UNIQUE parcial por documento
   - Pattern idempotente (DO $$ + IF NOT EXISTS) per ADR-0020 lesson.
3. **`src/lib/document.ts`** — validadores puros + máscara.
4. **Zod schema** `actions/customer/schema.ts` — `type` enum + `document` opcional com `.refine()` usando os validadores.
5. **UI** `/admin/clientes/novo` + `/admin/clientes/[id]/editar`:
   - Toggle PF/PJ (`b3-tab` style).
   - Input documento com máscara on-blur (não on-change pra não brigar com paste).
   - `name` label muda: PF "Nome" / PJ "Razão social".
6. **Lista `/admin/clientes`** — coluna "Tipo" (badge), filtro `?type=individual|company`, busca por documento normalizado.
7. **PDV `/admin/pdv`** — combobox de cliente mostra `[PJ] Razão Social · 12.345.678/0001-99`.
