# ADR-0016: PDV / venda balcão

- **Data**: 2026-05-16
- **Status**: aceito (implementado 2026-05-16, pendente db:migrate + SQL 26 + commit)
- **Deriva de**: [ADR-0012](0012-pivot-vitre-gestao.md) (Fase 5 do pivô)
- **Convive com**:
  - [ADR-0013](0013-pagamento-configuravel.md) — método de pagamento + `cashDiscountBps` aplicam no PDV também
  - [ADR-0014](0014-customer-admin-vs-storefront.md) — cliente vinculado é **opcional** no balcão (walk-in dominante)
  - [ADR-0015](0015-estoque-event-sourced.md) — venda balcão gera `stock_movement` type=`sale` reusando a infra
  - Fase 6 (PWA/Tauri, ADR-0017 futuro) — PDV é a UI mais sensível a offline

## Contexto

Hoje o Vitrê tem **um único canal de venda**: storefront público → carrinho localStorage → checkout WhatsApp → status `awaiting_whatsapp` → confirmação manual pela lojista.

Sandra (piloto) atende **a maior parte das vendas no balcão da loja física**, não pelo WhatsApp. Hoje ela registra essas vendas em caderno ou planilha externa — e o estoque do Vitrê fica fora de sincronia da realidade. Vendeu 3 anéis no balcão: no Vitrê continuam 12 em estoque; quando alguém pedir pelo WhatsApp, vai dar oversell.

Cliente B (prospect) tem o mesmo padrão. PDV é o que **fecha o loop** do pivô Vitrê Gestão: agora todo decremento de estoque tem origem registrada (Fase 4), todo cliente cadastrado tem vínculo opcional (Fase 3), toda forma de pagamento está modelada (Fase 2). Falta a tela onde a lojista bate venda no balcão.

**Restrições não-negociáveis:**

1. **Não processa cartão.** Vitrê não é gateway. PDV registra a forma de pagamento como metadado da venda, ponto. Lojista usa POS físico próprio (Cielo, PagSeguro, etc) — terminal separado.
2. **Não emite NF-e.** Fora do escopo do pivô (CLAUDE.md: "fora do escopo do pivô — exige certificado digital, homologação por UF e suporte fiscal contínuo").
3. **Não exige cliente cadastrado.** Walk-in é dominante. Combobox de cliente é opcional; sem vínculo, a venda é anônima (snapshot vazio).
4. **Compartilha estoque com WhatsApp.** Mesmo `stock_movement` table; mesma trilha de auditoria; mesmas race conditions resolvidas (advisory lock).
5. **Funciona em celular.** Sandra usa Android. PDVs BR tradicionais são desktop com F-keys; vamos entregar mobile-first agora e adicionar atalhos de teclado quando houver demanda concreta.

## Opções consideradas

| Opção | Prós | Contras |
|-------|------|---------|
| **A.** Estender `order` table com `channel` enum + colunas opcionais (`payment_method`, `discount_in_cents`, `cash_received_in_cents`); PDV produz linhas em `order` com `channel='balcao'`; stock_movement usa `reference_type='order'` igual storefront | Reuso máximo de infra (order_item, stock_movement, RLS, listagens, relatórios); migration simples; PDV e WhatsApp aparecem juntos em `/admin/pedidos` com filtro de canal; relatório de venda total = `SUM(total_in_cents) GROUP BY channel` trivial | `order` table acumula campos opcionais; CHECK constraints precisam discriminar por canal (ex: `payment_method` NOT NULL se canal='balcao') |
| **B.** Tabela `sale` separada com schema próprio | Schema enxuto pra cada caso; separação conceitual clara | Duplica orderItem (ou tem que fazer `sale_item`), duplica integração com stock_movement, duplica RLS, duplica listing/admin/relatório. Custo de manutenção alto pra zero ganho real — venda balcão e venda WhatsApp têm 90% dos mesmos campos |
| **C.** Reusar `order` SEM `channel` — discriminar por `customer_phone IS NULL` ou similar | Migration nula | Heurística frágil ("o que define balcão?"); relatório fica calcado em proxy; quebra na primeira venda balcão com cliente vinculado |
| **D.** Criar `reference_type='balcao'` em `stock_movement` (débito do SQL 22) + tabela `sale` | Stock_movement explicita origem | Mistura preocupações (canal de venda vs origem de movimento); CHECK reference_consistency complica; relatório de "venda total" precisa unir 2 tabelas |

**Escolhida: opção A.** Extende `order`. É a decisão sênior do varejo digital: Shopify, Nuvem Shop e Tiny todos modelam "pedido online" e "venda balcão" como variantes do mesmo agregado, discriminados por `channel`/`source`. Custo de migration: 1 enum novo + 4 colunas opcionais + 1 SQL de CHECK condicional. Ganho: zero duplicação de domínio.

## Decisão

PDV produz uma linha em `order` com `channel='balcao'`, status `fulfilled` (venda já concluída no balcão), `customer_id` opcional, `payment_method` obrigatório, e um `stock_movement` type=`sale` por item rastreado (reusando o helper já extraído da Fase 4).

Nova rota `/admin/pdv` com layout 2-colunas (desktop) / stack (mobile): busca de produto + grid de resultados na esquerda; carrinho + cliente + pagamento + total na direita; botão "Finalizar venda" → server action → redirect pra `/admin/pdv/recibo/[token]` (tela imprimível, `window.print()`).

## Schema proposto

### Novos enums

```ts
// src/db/schema/order.ts (extend existente)

/**
 * Canal de origem da venda. WhatsApp = checkout do storefront público;
 * balcão = venda registrada manualmente pelo lojista no /admin/pdv.
 * Backfill: tudo que existir antes da migration é 'whatsapp'.
 */
export const orderChannelEnum = pgEnum("order_channel", [
  "whatsapp",
  "balcao",
]);

/**
 * Método de pagamento — APENAS metadado. Vitrê NÃO processa cartão.
 * Lojista usa POS físico próprio; o sistema registra o que ele
 * informa, pra relatório/reconciliação.
 *
 *   - cash:   dinheiro (pode ter cash_received_in_cents pra cálculo de troco)
 *   - pix:    transferência PIX
 *   - debit:  débito (POS físico do lojista)
 *   - credit: crédito (POS físico do lojista — sem parcelamento aqui;
 *             parcelamento é exibição no storefront, não payload de venda)
 *   - other:  cheque, fiado, vale, etc — abre campo notes
 *
 * NULL pra orders do canal whatsapp (lojista combina pagamento no chat).
 */
export const orderPaymentMethodEnum = pgEnum("order_payment_method", [
  "cash",
  "pix",
  "debit",
  "credit",
  "other",
]);
```

### Colunas novas em `order`

```ts
// Append a orderTable
channel: orderChannelEnum("channel").notNull().default("whatsapp"),
paymentMethod: orderPaymentMethodEnum("payment_method"),
discountInCents: integer("discount_in_cents"),       // desconto manual no balcão
cashReceivedInCents: integer("cash_received_in_cents"), // só pra method='cash', calcular troco
```

### Tornar nullable

- `customer_phone` — walk-in não tem telefone (snapshot vazio é mentira). Tornar `text("customer_phone")` (sem `.notNull()`). CHECK E.164 do SQL 12 já permite NULL.
- `expires_at` — irrelevante pra PDV (status nasce `fulfilled`). Tornar nullable.

### CHECK constraints (SQL 26)

```sql
-- channel = 'balcao' OBRIGA payment_method (whatsapp pode ter NULL)
ALTER TABLE "order"
  ADD CONSTRAINT order_balcao_requires_payment_method CHECK (
    channel <> 'balcao' OR payment_method IS NOT NULL
  );

-- discount_in_cents >= 0
ALTER TABLE "order"
  ADD CONSTRAINT order_discount_nonneg CHECK (
    discount_in_cents IS NULL OR discount_in_cents >= 0
  );

-- cash_received só faz sentido com method='cash' E >= total
ALTER TABLE "order"
  ADD CONSTRAINT order_cash_received_consistency CHECK (
    cash_received_in_cents IS NULL
    OR (payment_method = 'cash' AND cash_received_in_cents >= total_in_cents)
  );

-- whatsapp não pode ter cash_received nem discount manual
ALTER TABLE "order"
  ADD CONSTRAINT order_whatsapp_no_pos_fields CHECK (
    channel <> 'whatsapp'
    OR (cash_received_in_cents IS NULL AND discount_in_cents IS NULL)
  );
```

### Backfill

```sql
-- Pedidos pré-Fase 5 são todos whatsapp; default da coluna já cobre
-- INSERTs novos, mas o ALTER inicial pode precisar disso se o default
-- não for aplicado retroativamente em Postgres < 11. Em Postgres 16
-- (Supabase) o default vai retroativo, mas explícito não machuca:
UPDATE "order" SET channel = 'whatsapp' WHERE channel IS NULL;
```

## RLS

**Nada muda.** `order` já tem `order_tenant_isolation` por GUC. Anônimo só insere `order` via storefront (canal whatsapp); PDV é admin autenticado, cai na policy de owner.

`stock_movement` já aceita INSERT anônimo restrito a `sale`/`return` + `reference_type='order'` — PDV não usa essa policy porque é owner, mas o anônimo continua funcionando pra storefront.

## Action de criação

`src/actions/order/create-balcao-sale.ts` — server action com escopo de tenant owner:

```ts
"use server";

export const createBalcaoSaleSchema = z.object({
  items: z.array(z.object({
    productId: z.string().uuid(),
    variantId: z.string().uuid().nullable(),
    quantity: z.number().int().positive(),
  })).min(1),
  customerId: z.string().uuid().nullable(),
  paymentMethod: z.enum(["cash", "pix", "debit", "credit", "other"]),
  discountInCents: z.number().int().nonnegative().nullable(),
  cashReceivedInCents: z.number().int().nonnegative().nullable(),
  notes: z.string().max(500).nullable(),
});

// Fluxo dentro de withTenant(storeId, userId, ...):
//   1. tx.transaction(async (innerTx) => {
//   2.   pra cada item: pg_advisory_xact_lock(hashtext('stock-' + entityId))
//   3.   re-leitura do cache stock_quantity sob o lock
//   4.   throw OutOfStockError se < quantity
//   5.   calcular total (usando preço promo ativo de pricing.ts)
//   6.   aplicar discount_in_cents se passado
//   7.   se cash_received passado, garantir >= total
//   8.   INSERT order { channel: 'balcao', status: 'fulfilled', ... }
//   9.   INSERT order_item[] com snapshots
//  10.   INSERT stock_movement[] type='sale', reference_type='order',
//        reference_id = order.id, delta = -quantity
//  11. revalidateTag(`store-${slug}`)  // estoque público mudou
//  12. revalidateTag de listagens admin
//  13. retorna { ok, orderId, publicToken } pra redirect do client
```

Erros tipados igual `create-from-cart.ts`: `OutOfStockError`, `ProductNotFoundError`, `RateLimitError`.

## UX

### `/admin/pdv`

**Mobile (default)** — stack vertical:

1. Header com botão "Nova venda" reiniciando estado
2. Busca de produto (input debounced 200ms) → lista vertical com thumbnail + nome + preço + estoque
3. Tocar produto → adiciona ao carrinho (qty=1) — se já tem, incrementa
4. Carrinho abaixo da busca (sticky no fim da tela): linha por item com -/+/lixeira; total parcial
5. Combobox cliente (opcional)
6. 4 botões grandes método pagamento
7. Se "cash" → input "valor recebido" + cálculo de troco
8. Input opcional "desconto R$" e "observação"
9. Botão fixo bottom "Finalizar venda — R$ XX,XX"

**Desktop (≥ md)** — 2 colunas:

- Esquerda 60%: busca + grid 3 colunas de cards de produto
- Direita 40% sticky: carrinho + cliente + pagamento + finalizar

**Pós-finalização**: redirect `/admin/pdv/recibo/[publicToken]` com:

- Logo da loja (se houver)
- Data/hora, ID curto
- Itens com qty/preço unitário/subtotal
- Total, desconto, troco se aplicável
- Forma de pagamento
- Cliente vinculado se houver
- Botão "Imprimir" → `window.print()` com CSS @media print já existente
- Botão "Nova venda" → volta pro `/admin/pdv` zerado

### Sidebar admin

Adicionar item "PDV" no `nav-items.ts`, ícone `ShoppingCartIcon` (lucide), entre "Pedidos" e "Estoque".

## Rate limit

PDV cai em `mutationLimiter` (10 req/min por user) — mesma quota do form de produto/pedido. Cenário: lojista bate 10 vendas/min no balcão é improvável; se cair, mensagem clara "aguarde X segundos".

## Pricing

Importa `getEffectivePrice` de `src/lib/pricing.ts` (convenção #10). Preço promo ativo entra automaticamente no snapshot do `order_item`. `cashDiscountBps` da loja NÃO é aplicado automaticamente — PDV exibe o preço cheio e o lojista decide aplicar via campo `discount_in_cents` manualmente, porque o desconto à vista no balcão depende da forma escolhida (PIX/dinheiro recebem, débito/crédito não).

**Decisão consciente**: não auto-aplicar `cashDiscountBps` no PDV. UX-wise, lojista pode informar "100,00" no troco e oferecer 5% à vista olho-no-olho — não vamos amarrar isso ao código. Se virar dor de cliente, formaliza em ADR follow-up.

## Recibo

Tela `/admin/pdv/recibo/[publicToken]` server-rendered, layout 80mm pra alinhar com impressoras térmicas comuns (Bematech, Daruma) E desktop (A5 cabe ok). CSS `@media print` esconde header/sidebar/botões.

**NÃO** vamos integrar com impressora térmica via Web Serial / driver agora — `window.print()` cobre 80% dos casos (impressora compartilhada Windows configurada como padrão). Web Serial fica na Fase 6 (Tauri) quando houver demanda.

## Testes

- Schema Zod: aceita combinações válidas, rejeita inválidas (quantity 0, cash_received < total quando method=cash, paymentMethod 'pix' com cash_received)
- Action: cria order com channel='balcao' + status='fulfilled', N order_items, N stock_movements; cobertura de OutOfStockError + ProductNotFoundError
- RLS: lojista de loja A não consegue criar venda em loja B (defesa em profundidade, GUC já protege)
- UI: search debounced, add/remove items, troco calculado correto, botão desabilitado quando carrinho vazio
- CHECK constraints: INSERT direto via SQL falha em casos proibidos (channel='balcao' + payment_method NULL)

## Consequências

### Positivas

- Sandra registra venda balcão em < 30s sem sair do navegador, estoque desce automaticamente, relatório aparece em `/admin/estoque`
- `/admin/pedidos` ganha filtro de canal — view unificada de venda online + balcão
- Relatório de vendas (Fase 6 — TBD ADR) já tem a chave `channel` pra fatiar
- Base pra "fechar caixa" futuro (somar vendas do dia por método)

### Negativas / riscos

- `order` table acumula 4 colunas opcionais — não-crítico (Postgres armazena NULL barato)
- CHECK constraints adicionam complexidade na migration; mitigação = idempotência + teste de CHECK no script de auditoria
- Sem F-keys / atalhos no v1 — lojista power-user vai querer; aceitar e iterar
- Recibo via `window.print()` depende de configuração de impressora do SO — sem Web Serial = sem impressão silenciosa. Aceito pra MVP

### Follow-ups

- Atalhos de teclado (F2 busca, F3 cliente, F4 finalizar, ESC zerar) quando alguém pedir
- Web Serial / Tauri pra impressora térmica (Fase 6)
- "Fechar caixa" — agregação diária de vendas balcão por método de pagamento
- Sangria / suprimento de caixa — gestão de dinheiro físico no caixa (futura ADR fiscal-leve)
- Fiado: payment_method='other' + cliente vinculado obrigatório (relatório de aberto por cliente)
- Importar venda balcão pra Bling/Tiny via CSV export

## Plano de implementação

1. **Migration 0018** — enums + colunas + tornar `customer_phone`/`expires_at` nullable
2. **SQL 26** — 4 CHECK constraints (`order_balcao_requires_payment_method`, `order_discount_nonneg`, `order_cash_received_consistency`, `order_whatsapp_no_pos_fields`)
3. **Schema Drizzle** atualizado (`src/db/schema/order.ts`)
4. **Helper compartilhado** `src/lib/order/record-sale-movements.ts` — extrai INSERT em batch de stock_movement type=`sale` que hoje vive inline em `create-from-cart.ts`. Usar nele E no novo `create-balcao-sale.ts`
5. **Action** `src/actions/order/create-balcao-sale.ts` + schema
6. **UI** `src/app/(admin)/admin/pdv/page.tsx` + componentes:
   - `ProductSearchPicker` (busca debounced + grid)
   - `BalcaoCart` (linha de item + total)
   - `PaymentMethodPicker` (4 botões + troco condicional)
   - `BalcaoCustomerPicker` (combobox reusa do OrderDetailDialog)
7. **Recibo** `src/app/(admin)/admin/pdv/recibo/[token]/page.tsx` + CSS print
8. **Nav** sidebar admin: item "PDV"
9. **Filtro de canal** em `/admin/pedidos` (campo URL `?canal=balcao|whatsapp`)
10. **Tests** unit + static analysis
11. **Audit script** `scripts/check-sql-applied.mjs` cobrindo SQL 26
12. **CLAUDE.md + roadmap** marcando Fase 5 ✅

## Notas finais

- **Pricing config** (Fase 2): instalment_max não afeta PDV. cashDiscountBps NÃO é auto-aplicado (decisão consciente acima).
- **Cliente** (Fase 3): combobox reusa, mesma policy RLS, busca dedup por phone se lojista quiser criar inline.
- **Estoque** (Fase 4): zero alteração no helper restock; venda balcão usa `reference_type='order'` (não 'balcao'). O débito anotado no SQL 22 ("ALTER pra incluir 'balcao'") foi resolvido **pela escolha de não criar entidade separada** — fica explícito aqui.
- **PWA/Tauri** (Fase 6 futura): PDV é a UI mais sensível a offline. v1 é puro online; offline fica pra ADR-0017 com discussão de CRDT/queue.
