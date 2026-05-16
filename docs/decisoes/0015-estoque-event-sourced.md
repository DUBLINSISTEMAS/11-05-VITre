# ADR-0015: Estoque event-sourced via `stock_movement`

- **Data**: 2026-05-16
- **Status**: proposto
- **Deriva de**: [ADR-0012](0012-pivot-vitre-gestao.md) (Fase 4 do pivô)
- **Convive com**:
  - [ADR-0014](0014-customer-admin-vs-storefront.md) — Fase 3, sem conflito
  - Fase 5 (PDV, ADR-0016 futuro) — venda balcão grava movement do tipo `sale`
  - Fase 6 (PWA/Tauri, ADR-0017 futuro) — cache local de movements em offline-first opcional

## Contexto

Hoje o estoque do Vitrê é **uma coluna agregada simples**:

```ts
// src/db/schema/catalog.ts:102-103 e 226-227
trackStock: boolean("track_stock").notNull().default(false),
stockQuantity: integer("stock_quantity"),
```

Mutações:

- **Admin form** (lojista digita "12 unidades" e salva) — `SET stock_quantity = 12` direto.
- **Checkout WhatsApp** (`src/actions/order/create-from-cart.ts`) — em pedido confirmado, `UPDATE product SET stock_quantity = stock_quantity - quantity` dentro de transação com advisory lock.

**Limitações disso:**

1. **Sem trilha de auditoria.** Lojista vê estoque baixar; não sabe se foi pedido, ajuste manual, perda, ou erro de digitação anterior. Quando reclamar "o sistema apagou meu estoque", não há histórico pra investigar.
2. **Sem reversão.** Cancelou pedido confirmado? O sistema não devolve estoque automaticamente — `update-status.ts` zera o status mas o decremento de `stock_quantity` já aconteceu e não tem como reverter limpo (é cálculo destrutivo).
3. **Sem relatórios temporais.** "Quantas peças vendi essa semana?" exige somar pedidos confirmados por janela — `orderTable` ajuda, mas mistura com cancelados/expirados e não cobre ajustes manuais.
4. **PDV (Fase 5) precisa do mesmo conceito.** Venda balcão = decremento de estoque com referência ao "pedido balcão". Sem entidade de movimento, PDV vai duplicar a lógica de decremento e a fragilidade.
5. **Backfill / inventário inicial não tem origem rastreável.** Quando lojista cadastra produto e digita "tenho 20 em estoque", esse 20 é um chute. Em 3 meses ele não lembra se veio do estoque real ou se digitou errado.

Cliente B (prospect) pediu **relatório de movimentação** explicitamente. Resolver isso colando `stock_quantity` em cima de um log paralelo só pra auditoria (opção C abaixo) é meia-medida: o log fica fora de sincronia da realidade na primeira falha. A solução robusta é **mover a fonte de verdade pro evento**.

## Opções consideradas

| Opção | Prós | Contras |
|-------|------|---------|
| **A.** Tabela `stock_movement` event-sourced + coluna `stock_cache` em `product`/`variant` atualizada via trigger SQL | Fonte de verdade no evento; cache hot-path = O(1) read; trigger garante consistência sem app-layer; histórico/relatório triviais (SUM por janela); PDV (Fase 5) reusa direto | Trigger SQL exige cuidado em migrations futuras; backfill de produtos existentes é momento crítico (1 movement "initial" por produto); cache fica fora de sync se trigger desabilitado por mistake |
| **B.** Tabela `stock_movement` event-sourced + cálculo `SUM(quantity_delta) GROUP BY product_id` em CADA leitura (sem cache) | Sem trigger, sem cache, "uma fonte de verdade" pura | Storefront PDP faz N+1 ou JOIN pesado a cada render; lista admin de produtos vira aggregate grande; cache de Next (`unstable_cache`) ajuda mas não resolve query de listagem; vira problema cedo |
| **C.** Manter `stock_quantity` agregado como source of truth + `stock_movement` opcional só pra auditoria | Migration mínima; código atual fica intocado | Auditoria pode divergir do agregado em qualquer bug futuro; não resolve reversão; "log que ninguém olha" — anti-pattern conhecido |
| **D.** PostgreSQL Logical Replication / CDC pra audit table externa | Zero código de app; auditoria garantida pelo Postgres | Overkill brutal — Vitrê hoje cabe num Free tier de 500MB; CDC sobe consumo de WAL, exige consumer separado; alvo de cliente é micro-varejo, não fintech |

**Escolhida: opção A.** É o padrão que ERP de gente grande adota (Bling, Conta Azul, Tiny) — não por moda, mas porque resolve sem fricção os 5 problemas listados acima. O custo (trigger SQL + backfill cuidadoso) é pago uma vez; o ganho (auditoria, reversão, relatórios, base pra PDV) é permanente.

## Decisão

Criar a tabela `stock_movement` como **fonte de verdade** das alterações de estoque. Manter as colunas `stock_quantity` existentes em `product` e `product_variant` como **cache denormalizado**, sincronizado automaticamente por trigger SQL em cada INSERT em `stock_movement`. Reescrever os call-sites de decremento (`create-from-cart.ts`) e ajuste manual (form do produto) para inserir `stock_movement` em vez de UPDATE direto. Backfill da tabela com 1 movement `initial` por produto/variant carregando o valor atual.

## Schema proposto

### Novo enum

```ts
// src/db/schema/inventory.ts (arquivo novo — não vai em catalog.ts pra
// não inflar; segue padrão de customer.ts da Fase 3)
import { pgEnum } from "drizzle-orm/pg-core";

/**
 * Tipo de movimento. Cada um tem semântica clara — não usar `manual_in`
 * pra cobrir "venda PDV"; criar entrada nova se aparecer caso novo.
 *   - initial:     saldo inicial cadastrado no produto ou backfill
 *   - manual_in:   entrada manual (compra de fornecedor, devolução de cliente)
 *   - manual_out:  saída manual (perda, dano, doação)
 *   - sale:        venda confirmada (pedido storefront OU venda balcão Fase 5)
 *   - return:      devolução que volta pro estoque (cancelamento de pedido)
 *   - adjustment:  ajuste de inventário (contagem física vs sistema)
 */
export const stockMovementTypeEnum = pgEnum("stock_movement_type", [
  "initial",
  "manual_in",
  "manual_out",
  "sale",
  "return",
  "adjustment",
]);
```

### Nova tabela `stock_movement`

```ts
export const stockMovementTable = pgTable(
  "stock_movement",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storeTable.id, { onDelete: "cascade" }),

    // Produto sempre presente. Variant nullable: produto sem variantes
    // tem stock direto no product; com variantes, stock é por variant.
    // Regra do app: produto que tem variants NÃO acumula stock_quantity
    // no nível do product (variants são source of truth) — mesma regra
    // que já vale hoje no decremento de create-from-cart.
    productId: uuid("product_id")
      .notNull()
      .references(() => productTable.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariantTable.id, {
      onDelete: "cascade",
    }),

    movementType: stockMovementTypeEnum("movement_type").notNull(),

    // Signed delta. Positivo = entrada, negativo = saída. Permite SUM()
    // direto pra calcular saldo, sem condicional. CHECK quantity_delta != 0
    // no SQL out-of-band (movimento de 0 não tem semântica útil).
    quantityDelta: integer("quantity_delta").notNull(),

    // Referência opcional pra origem do movimento.
    // referenceType: "order" | "manual" | null
    // referenceId: uuid do order (quando referenceType = "order"), null caso contrário
    referenceType: text("reference_type"),
    referenceId: uuid("reference_id"),

    // Texto livre — lojista escreve "fornecedor X, NF 12345" ou
    // "achei 2 peças na gaveta do balcão". Até 500 chars (CHECK no SQL).
    notes: text("notes"),

    // Quem registrou. Para sale via storefront, fica null (não há user
    // logado no checkout anônimo). Para manual/adjustment, é o lojista.
    createdBy: text("created_by"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    // Hot path: SUM por produto pra reconstruir saldo
    productIdx: index("stock_movement_product_idx").on(t.storeId, t.productId, t.createdAt),
    // Relatório por janela temporal
    storeCreatedIdx: index("stock_movement_store_created_idx").on(t.storeId, t.createdAt),
    // Lookup por origem (cancela pedido → encontra o sale movement pra reverter)
    referenceIdx: index("stock_movement_reference_idx").on(t.referenceType, t.referenceId),
  }),
);
```

### Trigger SQL para sincronizar cache

```sql
-- supabase/sql/22_stock_movement_trigger.sql
CREATE OR REPLACE FUNCTION sync_stock_cache_on_movement()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.variant_id IS NOT NULL THEN
    UPDATE product_variant
       SET stock_quantity = COALESCE(stock_quantity, 0) + NEW.quantity_delta
     WHERE id = NEW.variant_id;
  ELSE
    UPDATE product
       SET stock_quantity = COALESCE(stock_quantity, 0) + NEW.quantity_delta
     WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS stock_movement_sync_cache ON stock_movement;
CREATE TRIGGER stock_movement_sync_cache
  AFTER INSERT ON stock_movement
  FOR EACH ROW
  EXECUTE FUNCTION sync_stock_cache_on_movement();
```

Trigger é `AFTER INSERT FOR EACH ROW` — invariante: cada movement persistido implica cache sincronizado. Não há caminho de movement sem cache update. Bulk insert dentro de uma transação garante atomicidade (movement + cache update no mesmo commit).

### CHECK constraints (SQL out-of-band)

```sql
-- supabase/sql/23_stock_movement_check_constraints.sql
ALTER TABLE stock_movement
  ADD CONSTRAINT stock_movement_delta_nonzero
    CHECK (quantity_delta <> 0),
  ADD CONSTRAINT stock_movement_reference_consistency
    CHECK (
      (reference_type IS NULL AND reference_id IS NULL)
      OR (reference_type IN ('order', 'manual') AND reference_id IS NOT NULL)
    ),
  ADD CONSTRAINT stock_movement_notes_length
    CHECK (notes IS NULL OR char_length(notes) <= 500);
```

### RLS

```sql
-- supabase/sql/24_stock_movement_rls.sql
ALTER TABLE stock_movement ENABLE ROW LEVEL SECURITY;

CREATE POLICY stock_movement_tenant_isolation ON stock_movement
  FOR ALL
  USING (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid)
  WITH CHECK (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid);
```

Sem `public_read`. Storefront não lê movimentações; apenas o `stock_quantity` cacheado em `product`/`variant` (que já existe).

## Backfill de produtos existentes

Crítico — não pode ser pulado, ou produtos viram "estoque 0" no PDP em prod.

```sql
-- supabase/sql/25_stock_movement_backfill.sql (idempotente)
-- Cria 1 movement "initial" pra cada produto/variant com track_stock=true
-- e stock_quantity > 0. Idempotência via WHERE NOT EXISTS na product_id+initial.

INSERT INTO stock_movement (store_id, product_id, variant_id, movement_type, quantity_delta, notes)
SELECT p.store_id, p.id, NULL, 'initial', p.stock_quantity, 'Saldo inicial — migração ADR-0015'
  FROM product p
 WHERE p.track_stock = true
   AND p.stock_quantity IS NOT NULL
   AND p.stock_quantity > 0
   AND NOT EXISTS (
     SELECT 1 FROM stock_movement m
      WHERE m.product_id = p.id
        AND m.movement_type = 'initial'
   );

INSERT INTO stock_movement (store_id, product_id, variant_id, movement_type, quantity_delta, notes)
SELECT v.store_id, v.product_id, v.id, 'initial', v.stock_quantity, 'Saldo inicial — migração ADR-0015'
  FROM product_variant v
 WHERE v.track_stock = true
   AND v.stock_quantity IS NOT NULL
   AND v.stock_quantity > 0
   AND NOT EXISTS (
     SELECT 1 FROM stock_movement m
      WHERE m.variant_id = v.id
        AND m.movement_type = 'initial'
   );
```

**Atenção**: o trigger vai disparar pra cada INSERT do backfill. Como o `stock_quantity` JÁ tem o valor correto e o backfill insere `quantity_delta = stock_quantity`, o trigger somaria de novo (double counting). 

**Mitigação**: o backfill SQL **desabilita o trigger temporariamente** com `ALTER TABLE stock_movement DISABLE TRIGGER stock_movement_sync_cache;` antes do INSERT, e reabilita depois. O `stock_quantity` é preservado como está. Após o backfill, novos movements (sale, manual_in, etc) atualizam o cache normalmente. Documento o `DISABLE/ENABLE` no header do SQL com `--` explicativo.

## Refactor de call-sites existentes

### 1. `src/actions/order/create-from-cart.ts` — decremento via movement

Hoje (linha ~377):
```ts
await tx
  .update(productTable)
  .set({ stockQuantity: sql`${productTable.stockQuantity} - ${item.quantity}` })
  .where(eq(productTable.id, item.productId));
```

Vira:
```ts
await tx.insert(stockMovementTable).values({
  storeId: store.id,
  productId: item.productId,
  variantId: item.variantId, // null se sem variant
  movementType: "sale",
  quantityDelta: -item.quantity,
  referenceType: "order",
  referenceId: order.id,
  // createdBy stays null — checkout anônimo
});
```

Trigger atualiza `product/variant.stockQuantity` automaticamente. **Mesma transação que cria order/order_items — atomicidade preservada**.

### 2. Cancelamento de pedido — devolução automática

`src/actions/order/update-status.ts` ganha bloco quando `confirmed → canceled` (ou `expired`):

```ts
if (statusFrom === "confirmed" && statusTo === "canceled") {
  // Insere movement de devolução pra cada item do pedido
  for (const item of items) {
    await tx.insert(stockMovementTable).values({
      storeId: store.id,
      productId: item.productId,
      variantId: item.variantId,
      movementType: "return",
      quantityDelta: +item.quantity,
      referenceType: "order",
      referenceId: orderId,
      notes: "Devolução por cancelamento de pedido",
    });
  }
}
```

**Decisão**: devolver automaticamente é o caminho default (lojista cancelou pedido = produto não saiu mesmo, faz sentido voltar). Lojista pode lançar `manual_out` se houver perda real. NÃO devolver em `expired` por padrão — `expired` é "cliente sumiu", lojista pode ter separado o produto e ele ficou indisponível. Reabrir essa decisão se Sandra reclamar.

### 3. Editor de produto — ajuste manual

Hoje o campo de estoque no form (`src/components/admin/product-form.tsx`) faz `SET stock_quantity`. Vira:

- Form mostra `stock_quantity` (cache) read-only após criação inicial
- Botão "Lançar movimentação" abre dialog com: tipo (manual_in / manual_out / adjustment), quantidade, notas
- Salvar = INSERT em `stock_movement`; cache reflete automaticamente

**Exceção**: criação de produto novo pode passar `stockQuantity` direto via `manual_in` ou `initial` no primeiro insert (não há history pra preservar). Define isso na action `createProductFromValues` — após criar o produto, se `stockQuantity > 0`, insere 1 movement `initial`.

## UI — `/admin/estoque`

Rota dedicada (convenção `admin-rota-dedicada-por-dominio-2026-05-16`):

- `/admin/estoque/page.tsx` — listagem de **movimentações** com URL state (filtro por produto, tipo, janela temporal, page)
- Header: 3 cards de KPI (entradas no mês, saídas no mês, ajustes no mês) — SUMs por movement_type filtradas por janela
- Lista: cada linha = movement com produto/variant nome (snapshot), tipo (badge colorido), quantidade (+12 verde / -3 vermelho), notas, data, referência (link pro pedido se `reference_type = order`)
- Sem rota de "criar movimento standalone" — movimentações sempre nascem do contexto (produto via dialog, pedido via cancelar, etc.). Tela é read/relatório.

Sidebar ganha item **"Estoque"** entre "Clientes" e "Pagamento". Ícone `BoxesIcon` ou `WarehouseIcon` (lucide).

## RLS — confirmação

Storefront NÃO lê `stock_movement`. PDP renderiza esgotado quando `stockQuantity` (cache) é 0 — não precisa do log. Carrinho/checkout valida quantidade vs cache atomicamente sob `withTenant(storeId, anonymous)` — a policy do MOVEMENT bloqueia leitura anônima, mas o **INSERT** acontece sob `withTenant(storeId, anonymous)` no checkout, que precisa de policy permissiva pra esse caso.

**Decisão de RLS**: a policy `stock_movement_tenant_isolation` cobre owner-only. Para INSERT anônimo do checkout, complementa com:

```sql
CREATE POLICY stock_movement_anonymous_insert ON stock_movement
  FOR INSERT
  WITH CHECK (
    store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid
    AND current_setting('app.current_user_id', true) = 'anonymous'
    AND movement_type = 'sale'
    AND reference_type = 'order'
  );
```

Anônimo só pode inserir `sale` com `reference_type='order'`. Não consegue inserir `manual_in` fraudulento nem ler. Padrão "least privilege".

## Migration — estratégia

1. `pnpm db:generate` → Drizzle gera `0017_*.sql` (CREATE TYPE enum + CREATE TABLE stock_movement + indexes).
2. Revisar SQL — confirmar FK on-delete e indexes.
3. Commit migration TS-driven.
4. `pnpm db:migrate` em prod.
5. Aplicar manualmente (via `apply-sql.ts`) na ordem:
   - SQL 22 — trigger
   - SQL 23 — CHECK constraints
   - SQL 24 — RLS tenant isolation + anonymous insert
   - SQL 25 — backfill (com DISABLE/ENABLE TRIGGER)
6. Smoke: criar movement de teste em loja de teste, ver `stock_quantity` cacheado mudar.
7. Atualizar `scripts/check-sql-applied.mjs`.

## Trade-offs aceitos

| O que entra | O que NÃO entra (consciente) |
|-------------|------------------------------|
| Event source único (`stock_movement`) | Multi-warehouse (1 cliente Vitrê = 1 estoque físico, varejo micro) |
| Cache denormalizado em `product`/`variant.stock_quantity` | Recalcular SUM a cada leitura (B) |
| Trigger SQL `AFTER INSERT` | Trigger BEFORE / on UPDATE (não permitimos UPDATE em movements — append-only) |
| Movimento tipado (initial/manual_in/manual_out/sale/return/adjustment) | Lotes / validade (perfumaria/joia não tem lote) |
| Devolução automática em cancelamento de pedido | Devolução em expiração (lojista pode ter separado o produto) |
| 1 nota livre por movement (500 chars) | Documento fiscal vinculado (NF, sem escopo no pivô) |
| Saldo via `stock_quantity` cacheado | Custo médio FIFO/LIFO / valoração de estoque (Fase >6 se houver dor) |
| RLS owner-only + INSERT anônimo restrito a sale | Auditoria via Postgres CDC (overkill) |

Decisões que ficam **fora deste ADR**:

- **Serial numbers / IMEI / SKU único por unidade**: micro-varejo não vende em volume que justifique. Reabrir só com dor de cliente pagante.
- **Reserva temporária de estoque** (cliente clicou comprar mas ainda não confirmou): hoje carrinho é localStorage e expira sozinho. Reabrir se houver problema de oversell — não houve até hoje porque tráfego é baixo.
- **Importação CSV de saldo inicial**: lojista que tem 500 SKUs pra cadastrar tem outras dores antes; reabrir quando aparecer caso real.
- **Multi-localização (matriz + filial)**: explicitamente fora do escopo de Vitrê Gestão (ADR-0012 marcou micro-varejo).

## Plano de testes

`tests/stock-movement.test.ts` (novo):

1. Zod schema `createMovementSchema` aceita payload mínimo (productId + movementType + quantityDelta).
2. Zod rejeita `quantityDelta = 0`.
3. Zod rejeita `referenceType` sem `referenceId`.
4. Zod normaliza `notes` "" → null.
5. Action `recordStockMovement` insere com tipo correto e `createdBy` = userId.
6. Action `recordStockMovement` recusa anônimo (forma admin).
7. Cancel order de pedido confirmado gera N `return` movements somando `+ quantity` por item.
8. Sale via checkout gera N `sale` movements somando `- quantity` por item.

`tests/rls.test.ts` (adicionar):

9. Anon não lê stock_movement.
10. Anon insere `sale` com `reference_type=order` (passa).
11. Anon insere `manual_in` (bloqueado).
12. Lojista A não lê movement da loja B.

Sentinel de invariante:

13. Após backfill + N sales + M returns simulados, `stock_quantity` cacheado == `SUM(quantity_delta)` calculado por SELECT.

Total estimado: 13–16 asserts.

## Consequências

### ✅ Ganhos aceitos

- Resolve dor real apontada por Cliente B (relatório de movimentação).
- Permite reversão automática em cancelamento — fricção zero pro lojista.
- Schema preparado pra Fase 5 (PDV) reusar — venda balcão é só `movementType: "sale"` com `referenceType: "balcao"` ou similar.
- Auditoria completa: lojista vê quem registrou cada movimento (`createdBy`) e quando.
- `stock_quantity` cache mantém PDP/storefront sem N+1 — performance não regride.
- Padrão consolidado de ERP (Bling/Conta Azul/Tiny) — vocabulário familiar.

### ⚠️ Trade-offs aceitos

- Trigger SQL adiciona dependência de Postgres em migrations futuras. Documentado em `supabase/sql/22_*`.
- Backfill é momento crítico — janela curta de disable-trigger. Mitigação: SQL idempotente + smoke após.
- Movimentos são append-only (não há UPDATE/DELETE em `stock_movement`). Correção de erro = lançar `adjustment` reverso, não editar histórico. Decisão consciente — auditoria não vale nada se for editável.
- `referenceType` é text (não enum) pra permitir adicionar tipos novos sem migration (ex: `balcao` na Fase 5). CHECK garante apenas valores `("order", "manual")` HOJE; ampliar no SQL quando Fase 5 chegar.

### 🔧 Dívida técnica criada

- Coluna `stockQuantity` em `product`/`variant` continua existindo. Renomear pra `stockCache` seria mais honesto mas exige refactor de N call-sites — adiar pra quando houver janela. Documentar em comment.
- Cache pode ficar fora de sync se trigger for desabilitado por engano (ou se algum DBA escrever direto via service role bypass). Audit script (`scripts/check-stock-cache-sync.mjs`) cobre isso — rodar no cron mensal ou após qualquer ALTER em `stock_movement`.

## Quem decidiu

Anderson Felipe (founder), com base em:
- Apontamento direto de Cliente B (prospect, maio/2026).
- Roadmap consolidado em [ADR-0012](0012-pivot-vitre-gestao.md).
- Padrão de ERP brasileiro (Bling/Conta Azul/Tiny) consultado como referência arquitetural — Vitrê NÃO copia features fiscais, mas adota o vocabulário e a modelagem básica de estoque event-sourced.

## Referências

- [ADR-0012 — Pivô do Vitrê para sistema de gestão](0012-pivot-vitre-gestao.md)
- [ADR-0014 — Cadastro de clientes admin](0014-customer-admin-vs-storefront.md) — Fase 3, precede esta
- `src/actions/order/create-from-cart.ts:340-470` — call-site atual de decremento, vira INSERT em stock_movement
- `src/actions/order/update-status.ts:108-115` — call-site atual de cancelamento, ganha bloco de devolução
- `src/components/admin/product-form.tsx` — campo de estoque vira read-only do cache + botão "lançar movimentação"
- `src/db/schema/catalog.ts:102-103, 226-227` — colunas atuais de stock (viram cache, não source of truth)
- Memory `admin-rota-dedicada-por-dominio-2026-05-16.md` — convenção de rota dedicada
- Memory `db-migrations-discipline.md` — fluxo de migration + SQL out-of-band
- Memory `supabase-sql-numbering-collision-check.md` — checar `ls supabase/sql/` antes de SQLs 22–25
