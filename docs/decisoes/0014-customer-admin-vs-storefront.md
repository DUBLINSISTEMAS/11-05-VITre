# ADR-0014: Cadastro de clientes no admin (sem login, sem exposição no storefront)

- **Data**: 2026-05-16
- **Status**: proposto
- **Deriva de**: [ADR-0012](0012-pivot-vitre-gestao.md) (Fase 3 do pivô)
- **Convive com**: [ADR-0008](0008-ux-catalogo-publico-storefront.md) — reafirma a regra "zero login no storefront"

## Contexto

Cliente B (prospect, maio/2026) apontou que o Vitrê hoje "resolve para o cliente final, mas resolve pouco pro lojista no dia a dia". Uma das ausências citadas: **não há cadastro de clientes**. A lojista recebe nome + telefone via payload do pedido do storefront (e em breve do PDV — Fase 5), mas:

- Os dados ficam **presos dentro do pedido** (`orderTable.customer_name`, `customer_phone`). Não há entidade reutilizável.
- A mesma compradora recorrente (a Sandra Brito real tem clientes que voltam) é re-cadastrada de zero a cada pedido.
- Não há base pra:
  - Follow-up de WhatsApp ("oi, fulana, chegou peça parecida com a que você comprou em março")
  - Fechamento mensal por cliente
  - Histórico de compras (quem comprou o quê)
  - PDV (Fase 5) registrar venda balcão associada a um cliente já cadastrado

O ADR-0012 colocou "cadastro de clientes" como Fase 3 do pivô, **antes** de estoque (Fase 4) e PDV (Fase 5), porque PDV depende de cliente existir (venda balcão precisa associar a alguém — opcionalmente, mas o caminho preferido é com cliente vinculado).

**Tensão com ADR-0008**: a regra "zero login/cadastro/perfil/favoritos no storefront" continua vigente. Este ADR introduz `customer`, mas é **entidade interna do tenant**, não consumida pelo storefront público. A distinção é a mesma já consolidada no ADR-0012:

- **Consumidor anônimo do storefront** = pessoa que entra em `vitre.site/<loja>` para comprar. Sem login, carrinho em localStorage, sem perfil. Protegida por ADR-0008.
- **Cliente cadastrado pelo admin** = registro CRUD do lojista, mesma natureza de `product` ou `category`. Não tem login, não é exposto no storefront, não tem foto, não tem favoritos.

São coisas categoricamente diferentes. Este ADR formaliza a distinção e cria o schema da segunda.

## Opções consideradas

| Opção | Prós | Contras |
|-------|------|---------|
| **A.** Tabela `customer` CRUD no admin + FK opcional `order.customer_id` | Modela a entidade explicitamente; permite histórico, busca, dedup por telefone; padrão Shopify/Nuvem Shop | 1 tabela nova + 1 coluna em order + UI nova (3 rotas: list/new/edit) |
| **B.** Derivar "clientes" agregando pedidos por telefone (sem tabela) | Zero schema novo; aproveita dados já capturados | Sem notas/endereço/dedup manual; lojista não consegue cadastrar antes da 1ª compra (cliente que ligou pra perguntar e ainda não comprou); JOIN agregado caro em listas |
| **C.** Tabela `customer` com login no storefront (perfil público, "minhas compras") | Reduz fricção de re-digitar dados a cada pedido | **Rejeitada por ADR-0008**. Wedge do produto é "zero login no storefront". Reabrir só com pivô explícito (não é o caso). |
| **D.** Integração com CRM externo (HubSpot/RD Station) | Não constrói nada | Custo > valor para micro-varejo; lojista que ainda usa caderno não vai configurar API key; complexidade fora de proporção |

**Escolhida: opção A.** Cobre os 4 casos de uso reais (follow-up, fechamento, histórico, PDV) com schema mínimo. Coluna `order.customer_id` é `nullable` — pedidos antigos não retroagem, pedidos novos podem vincular. Padrão consolidado por Shopify, Nuvem Shop, Bling — todos têm "Clientes" como entidade primária com FK opcional pra venda.

## Schema proposto

### Nova tabela `customer`

```ts
// src/db/schema/customer.ts (arquivo novo)
import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, uuid, unique, index } from "drizzle-orm/pg-core";

import { storeTable } from "./store";

export const customerTable = pgTable(
  "customer",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storeTable.id, { onDelete: "cascade" }),

    // Identidade — name + phone são obrigatórios (telefone é a chave do
    // varejo brasileiro; nome é como o lojista identifica)
    name: text("name").notNull(),
    phone: text("phone").notNull(), // E.164: +5511999999999

    // Contatos opcionais
    email: text("email"),

    // Endereço — opcional, todo nullable. Usado pra delivery e PDV.
    addressStreet: text("address_street"),
    addressNumber: text("address_number"),
    addressComplement: text("address_complement"),
    addressNeighborhood: text("address_neighborhood"),
    addressCity: text("address_city"),
    addressState: text("address_state"), // UF 2 letras
    addressZip: text("address_zip"),     // 8 dígitos (sem máscara)

    // Notas livres do lojista — "prefere bijuteria dourada", "compra pro
    // marido no aniversário", "atrasou pagamento 2x"
    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Dedup por telefone DENTRO da loja. Dois lojistas diferentes podem
    // ter o mesmo telefone (não é violação). Mesmo telefone duplicado na
    // MESMA loja é erro de cadastro (lojista resolve mesclando).
    unique("customer_store_phone_unique").on(table.storeId, table.phone),

    // Busca por nome no /admin/clientes (lower-case + trigram via SQL
    // out-of-band se houver dor; index simples por enquanto)
    index("customer_store_name_idx").on(table.storeId, table.name),
  ],
);
```

### Alteração em `orderTable`

```ts
// src/db/schema/order.ts (existente)
customerId: uuid("customer_id").references(() => customerTable.id, {
  onDelete: "set null",
}),
```

- **Nullable**: pedidos do storefront podem continuar sem vincular cliente cadastrado (caso onde a lojista não criou cadastro ainda para aquele comprador anônimo).
- **`onDelete: "set null"`**: deletar cliente NÃO apaga pedidos históricos (auditoria). Pedido fica órfão de cliente mas mantém `customer_name`/`customer_phone` da época.
- **Não substitui** `orderTable.customer_name`/`customer_phone`: esses campos continuam como **snapshot da época do pedido**. Cliente pode mudar nome depois; o pedido lembra como ele se chamava quando comprou.

### CHECK constraints (SQL out-of-band)

```sql
-- supabase/sql/20_customer_check_constraints.sql
ALTER TABLE customer
  ADD CONSTRAINT customer_phone_e164
    CHECK (phone ~ '^\+[1-9][0-9]{7,14}$'),
  ADD CONSTRAINT customer_phone_length
    CHECK (char_length(phone) BETWEEN 8 AND 16),
  ADD CONSTRAINT customer_address_state_uf
    CHECK (address_state IS NULL OR address_state ~ '^[A-Z]{2}$'),
  ADD CONSTRAINT customer_address_zip_digits
    CHECK (address_zip IS NULL OR address_zip ~ '^[0-9]{8}$'),
  ADD CONSTRAINT customer_name_length
    CHECK (char_length(trim(name)) BETWEEN 1 AND 120),
  ADD CONSTRAINT customer_notes_length
    CHECK (notes IS NULL OR char_length(notes) <= 1000);
```

Padrão idêntico ao SQL 13 (`storeTable.whatsapp_e164` check). Aplicação manual pelo Editor do Supabase após `db:migrate`.

## RLS

Nova policy padrão Vitrê — `customer_tenant_isolation`:

```sql
-- supabase/sql/21_customer_rls.sql
ALTER TABLE customer ENABLE ROW LEVEL SECURITY;

CREATE POLICY customer_tenant_isolation ON customer
  FOR ALL
  USING (store_id::text = current_setting('app.current_store_id', true))
  WITH CHECK (store_id::text = current_setting('app.current_store_id', true));
```

Mesmo padrão de `productTable`, `categoryTable`, etc. Lojistas só leem/escrevem clientes da própria loja. **Storefront NÃO lê `customerTable`** — confirma RLS por exclusão (storefront usa `withTenant(storeId, null, ...)` que seta `current_user_id='anonymous'`; nenhuma policy de `customer` deixa anônimo entrar).

`orderTable.customer_id` é FK; RLS de `order` continua o mesmo (já isolado por `store_id`).

## Migration — estratégia

1. `pnpm db:generate` → Drizzle gera `drizzle/0016_customer_table.sql` com:
   - `CREATE TABLE customer (...)`
   - `ALTER TABLE order ADD COLUMN customer_id uuid REFERENCES customer(id) ON DELETE SET NULL`
2. Revisar SQL gerado (defaults, FK on-delete, índices).
3. Commit do SQL gerado + snapshot drizzle/meta.
4. `pnpm db:migrate` aplica em prod.
5. Aplicar `supabase/sql/20_customer_check_constraints.sql` no Editor do Supabase.
6. Aplicar `supabase/sql/21_customer_rls.sql` no Editor do Supabase.
7. Smoke: criar cliente test, listar, editar, deletar, criar pedido vinculado.
8. Atualizar `scripts/check-sql-applied.mjs` com entradas pra SQLs 20 e 21.

**Atenção ao numbering** (memory `supabase-sql-numbering-collision-check.md`): `ls supabase/sql/` antes de criar — atualmente o último é 19. Próximos = 20, 21.

## Impacto no código

### 1. Schema TS — novo arquivo

`src/db/schema/customer.ts` (esboço acima). Adicionar ao re-export em `src/db/schema/index.ts`.

### 2. Zod schemas

`src/actions/customer/schema.ts` (novo):

```ts
import { z } from "zod";

const E164 = /^\+[1-9][0-9]{7,14}$/;
const UF = /^[A-Z]{2}$/;
const CEP = /^[0-9]{8}$/;

const trimmedString = (max: number, min = 0) =>
  z.string().trim().min(min).max(max);

export const customerInputSchema = z.object({
  name: trimmedString(120, 1),
  phone: z.string().trim().regex(E164, "Telefone inválido (use +5511999999999)"),
  email: z
    .string()
    .trim()
    .email()
    .nullish()
    .transform((v) => v ?? null),
  addressStreet: trimmedString(160).nullish().transform((v) => v ?? null),
  addressNumber: trimmedString(20).nullish().transform((v) => v ?? null),
  addressComplement: trimmedString(80).nullish().transform((v) => v ?? null),
  addressNeighborhood: trimmedString(80).nullish().transform((v) => v ?? null),
  addressCity: trimmedString(80).nullish().transform((v) => v ?? null),
  addressState: z
    .string()
    .trim()
    .toUpperCase()
    .regex(UF)
    .nullish()
    .transform((v) => v ?? null),
  addressZip: z
    .string()
    .trim()
    .regex(CEP)
    .nullish()
    .transform((v) => v ?? null),
  notes: trimmedString(1000).nullish().transform((v) => v ?? null),
});

export const createCustomerSchema = customerInputSchema;
export const updateCustomerSchema = customerInputSchema.extend({
  id: z.string().uuid(),
});

export type CustomerInput = z.input<typeof customerInputSchema>;
export type CustomerParsed = z.output<typeof customerInputSchema>;
```

Atenção Zod v4 (memory `zod-v4-object-requires-nullish.md`): campos opcionais usam `.nullish().transform(v => v ?? null)`. Atenção `z.input<>` (memory `zod-action-input-type-with-defaults.md`).

### 3. Server actions

`src/actions/customer/` (novo diretório):

- `create.ts` — auth + rate-limit (`rateLimits.mutation`) + safeParse + `withTenant` → INSERT → `revalidateTag('store-${slug}')` opcional (storefront não usa, mas mantém padrão).
- `update.ts` — mesmo, com WHERE id + storeId duplo (defesa em profundidade vs RLS).
- `delete.ts` — DELETE com cascade `set null` em order.
- `load.ts` — `loadCustomerDetail(id)` (read-only, prefixo `load*` por convenção).

Não há override por produto aqui. Customer é simétrico com category — entidade de cadastro pura.

### 4. UI

#### Rota dedicada (convenção `admin-rota-dedicada-por-dominio-2026-05-16`)

- `/admin/clientes/page.tsx` — listagem com URL state (q, page) por convenção item 11 CLAUDE.md
- `/admin/clientes/novo/page.tsx` — form de criação
- `/admin/clientes/[id]/page.tsx` — form de edição + bloco "Últimos pedidos" (read de `orderTable` filtrado por `customer_id`)

#### Sidebar

`src/components/admin/shell/nav-items.ts` ganha item:

```ts
{
  label: "Clientes",
  href: "/admin/clientes",
  icon: UsersIcon, // ou similar do lucide-react
}
```

Posição: entre "Pedidos" e "Pagamento" (agrupa o domínio "Vendas").

#### Editor de pedido (`/admin/pedidos/[id]`)

Bloco "Cliente vinculado":
- Se `customer_id != null`: mostra link pro `/admin/clientes/<id>` + nome/telefone do customer atual
- Se `customer_id == null`: combobox de busca "Vincular cliente cadastrado" (busca por nome ou telefone) + botão "Criar novo cliente a partir deste pedido" (pré-preenche nome/phone do snapshot do pedido)

### 5. Não-auto-vincular no checkout do storefront

Decisão deliberada: **NÃO** fazer upsert automático de `customer` quando pedido novo entra via storefront. Motivos:

- **Dedup é problemática automaticamente**: telefone é único na loja, mas pode haver typos. Upsert "alheio" cria registros desordenados que o lojista vai precisar limpar.
- **Magia esconde controle**: lojista que entra em `/admin/clientes` esperando ver "quem eu cadastrei" e vê 50 registros que nunca tocou perde noção de propriedade.
- **PDV (Fase 5) é diferente**: na venda balcão, lojista escolhe ativamente "vincular a cliente X" antes de fechar a venda. Fluxo controlado.

Lojista que quiser vincular pedido do storefront a cliente vai no `/admin/pedidos/[id]` e usa o combobox descrito acima. Inclui CTA "criar a partir do pedido" pra reduzir fricção.

Reabrir essa decisão se Sandra reclamar de "ter que cadastrar manual sempre".

## Trade-offs aceitos

| O que entra | O que NÃO entra (consciente) |
|-------------|------------------------------|
| CRUD básico de cliente (nome, telefone, email, endereço, notas) | Tags/segmentação ("VIP", "atrasou pagamento") |
| Vínculo opcional `order.customer_id` | Auto-upsert no checkout storefront |
| Histórico de pedidos no detalhe do cliente | Aniversário, dados pessoais profundos (LGPD-light) |
| Dedup por telefone via UNIQUE constraint | Merge UI de "este cliente é o mesmo que aquele" (faz manual: editar A, deletar B) |
| Listagem `/admin/clientes` com busca por nome/telefone | Filtro por "valor total comprado" / "última compra" (cresce com dor) |
| Endereço único por cliente | Múltiplos endereços (entrega vs cobrança) |

Decisões que ficam **fora deste ADR**:

- **Import CSV** — Sandra tem poucos clientes; reabrir quando houver caso de "tenho 200 contatos no caderno". Quando entrar, é menos sobre customer e mais sobre infra de import genérico.
- **Campanhas (email/WhatsApp em massa)** — fora do escopo do pivô. Reabrir só com integração de Resend/WhatsApp Business API e ADR próprio.
- **Conta corrente / fiado** — vira tabela própria `customer_balance` ou similar; entra na Fase 5 (PDV) se houver dor concreta.
- **Login no storefront** — protegido por ADR-0008. Nunca, neste pivô.
- **Tags de cliente** — adicionar quando 3+ clientes diferentes pedirem. Hoje é over-engineering.

## Plano de testes

`tests/customer.test.ts` (novo):

1. Zod aceita payload mínimo (name + phone E.164)
2. Zod rejeita phone sem `+55`, com letras, < 8 dígitos
3. Zod normaliza UF lowercase → uppercase
4. Zod rejeita CEP com máscara (`12345-678`); aceita `12345678`
5. Zod trata strings vazias em campos opcionais como `null` (não como `""`)
6. `email` opcional aceita ausência, valida formato quando presente
7. `notes` aceita até 1000 chars; rejeita > 1000

Sentinelas de RLS (em `tests/rls.test.ts` existente, adicionar):

8. Lojista A não lê customer de lojista B (mesmo phone)
9. Anônimo (`current_user_id='anonymous'`) não lê customer de nenhuma loja
10. INSERT em `customer` com `store_id` de outra loja é bloqueado

Sentinelas de schema (sem DB):

11. Garantir que `customerInputSchema` aceita `addressStreet: null` e converte string vazia em `null` (não em `""`)

Total: 10–12 asserts (8–9 unit + 2–3 integração leve com pg).

## Consequências

### ✅ Ganhos aceitos

- Endereça parte da dor de Cliente B (resto vem em Fase 4 estoque + Fase 5 PDV).
- Base reutilizável: `customer_id` em `order` destrava Fase 5 (PDV) sem schema novo na hora.
- Schema enxuto e auditável — uma tabela, FK opcional, 6 CHECKs declarativos.
- Mantém wedge ADR-0008 intacto — storefront continua anônimo, customer é entidade de admin.
- Padrões já validados (rota dedicada, URL state, RLS tenant-isolation, Zod nullish.transform) replicados sem inventar nada novo.

### ⚠️ Trade-offs aceitos

- Pedidos do storefront não geram cliente automaticamente — lojista assume custo de vincular manual quando quer histórico. Decisão revisitável se Sandra reclamar.
- Endereço único — varejo brasileiro de joia/semijoia raramente tem cobrança ≠ entrega; over-engineering pra MVP.
- Sem merge UI — duplicatas viram trabalho manual. Mitigado por UNIQUE constraint (lojista não cria duplicata acidental).
- 1 tabela nova + 1 coluna em order. `storeTable` não cresce.

### 🔧 Dívida técnica criada

- `orderTable` mantém snapshot `customer_name`/`customer_phone` **e** ganha `customer_id`. Dois caminhos pra mesma info — intencional (snapshot histórico vs vínculo ativo), mas vira ruído pra dev novo. Anotar no `CLAUDE.md` se causar confusão.
- Listagem `/admin/clientes` não tem agregação ("comprou X total"). Quando entrar, é JOIN com `order` ou cache materializado — decisão de Fase 4/5.

## Quem decidiu

Anderson Felipe (founder), com base em:
- Apontamento direto de Cliente B (prospect, maio/2026).
- Roadmap consolidado em [ADR-0012](0012-pivot-vitre-gestao.md).
- Reafirmação de [ADR-0008](0008-ux-catalogo-publico-storefront.md) — distinção formal entre consumidor anônimo e cliente cadastrado.

## Referências

- [ADR-0012 — Pivô do Vitrê para sistema de gestão](0012-pivot-vitre-gestao.md)
- [ADR-0008 — UX do catálogo público (storefront)](0008-ux-catalogo-publico-storefront.md) — **reafirmado**, não conflita
- [ADR-0013 — Pagamento configurável por loja](0013-pagamento-configuravel.md) — Fase 2, precede esta
- `src/db/schema/order.ts` — onde a FK `customer_id` entra
- `src/components/admin/shell/nav-items.ts` — sidebar ganha item "Clientes"
- Memory `admin-rota-dedicada-por-dominio-2026-05-16.md` — convenção de rota
- Memory `zod-v4-object-requires-nullish.md` — gotcha replicado em Zod schema
- Memory `supabase-sql-numbering-collision-check.md` — checar `ls supabase/sql/` antes de SQLs 20/21
