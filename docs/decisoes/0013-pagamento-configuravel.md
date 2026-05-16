# ADR-0013: Pagamento configurável por loja

- **Data**: 2026-05-15
- **Status**: proposto
- **Deriva de**: [ADR-0012](0012-pivot-vitre-gestao.md) (Fase 2 do pivô)
- **Convive com**: [ADR-0008](0008-ux-catalogo-publico-storefront.md) — não toca em login/conta de cliente; apenas adiciona configuração do lojista

## Contexto

Hoje o storefront mostra automaticamente uma label de parcelamento em todo PDP com produto acima de R$ 0:

```ts
// src/lib/pricing.ts:80
export function formatInstallments(cents: number, installments = 3): string {
  if (installments <= 1 || cents <= 0) return "";
  const each = Math.floor(cents / installments);
  return `ou ${installments}× de ${formatBRL(each)} sem juros`;
}
```

E o consumidor único, em `src/components/storefront/product-purchase-panel.tsx:146`:

```ts
const installmentLabel = formatInstallments(priceState.effectivePriceInCents, 3);
```

Dois bugs reais convivendo:

1. **`installments = 3` hardcoded global** — toda loja Vitrê, independentemente de aceitar cartão ou não, mostra "ou 3× de R$ X,XX sem juros". A Sandra (joia/semijoia) recebe maioria por PIX/transferência. A label gera expectativa que ela nunca prometeu cumprir.
2. **`priceState.effectivePriceInCents` usa preço promocional** — quando há promoção ativa, a parcela é calculada sobre o preço com desconto, sem que isso seja uma escolha do lojista. Em outras vitrines (Bagy, Nuvem Shop) é comum mostrar parcela sobre o preço cheio para preservar percepção de valor. Hoje não há escolha.

Há também o fato estrutural: não existe nenhuma modelagem de pagamento no schema. Nenhuma coluna em `storeTable`, nenhuma coluna em `productTable`, nenhuma tabela auxiliar. A feature foi implementada por dedução visual a partir do canvas-v1 (`_vitre-storefront.jsx:271`) sem decisão de produto.

Cliente A (prospect 1) reportou o bug. Cliente B (prospect 2) reforçou que a configuração precisa existir mesmo. O ADR-0012 colocou "pagamento configurável" como Fase 2 do pivô, antes de clientes, estoque e PDV, justamente porque é o item de menor escopo que destrava credibilidade da vitrine.

## Opções consideradas

| Opção | Prós | Contras |
|-------|------|---------|
| **A.** Tabela `payment_config` separada (1-1 com `store`) | Encapsula domínio "pagamento" em uma entidade; espaço pra crescer sem inflar `storeTable` | Cria JOIN obrigatório em toda renderização de PDP; viola item 10 do CLAUDE.md (promo já é inline em `productTable`); 1-1 com FK é design smell pra dado que muda pouco e é lido sempre |
| **B.** Colunas inline em `storeTable` (default da loja) + coluna opcional em `productTable` (override por produto) | Bate com padrão já estabelecido pra promoção (item 10 do CLAUDE.md); zero JOIN extra; defaults seguros via DB | `storeTable` cresce 6 colunas; granularidade de "regras por método de pagamento" exige refactor se houver bandeira-específica (Visa 10x, Hiper 3x) |
| **C.** JSON `payment_config jsonb` em `storeTable` | Schema-evolution barato (não precisa migration por campo novo) | Perde CHECK constraints declarativas no Postgres; Drizzle vira `unknown`; bug-prone em mutation; auditoria fica difícil |
| **D.** Variável de ambiente / hardcode "smarter" (ex: ler max-installments por nicho) | Sem migration | Não resolve nada — cada lojista tem regra diferente independente de nicho; volta a frustrar Cliente A |

**Escolhida: opção B.** Bate com o padrão já estabelecido para promoção (decisão consolidada em CLAUDE.md item 10) e mantém a regra "leitura de PDP é uma query, não duas". O risco de inflar `storeTable` é real, mas hoje a tabela tem 23 colunas (longe do limite prático) e o domínio de pagamento da Vitrê é deliberadamente raso — não vamos modelar bandeira/adquirente porque ADR-0012 deixou claro que **Vitrê não processa transação**. A configuração existe para alimentar UI de vitrine e (na Fase 5) registrar metadado no PDV.

## Decisão

Adicionar configuração de pagamento como colunas inline em `storeTable` (default por loja) com possibilidade de override por produto via uma coluna opcional em `productTable`. Refatorar `formatInstallments` para receber um objeto `PaymentConfig` em vez de assumir hardcode. Adicionar seção "Pagamento" na rota existente `/admin/configuracoes` (não criar rota nova). Manter compatibilidade total via defaults seguros: lojista que não configurar nada vê **zero label de parcela no PDP**.

## Schema proposto

### Novo enum

```ts
// src/db/schema/store.ts
export const installmentBasePriceEnum = pgEnum("installment_base_price", [
  "effective", // divide pelo preço atual (promo se ativa, senão base)
  "base",      // divide sempre pelo preço cheio (preserva percepção de valor)
]);
```

### Colunas novas em `storeTable`

```ts
// Bloco "Pagamento" — todas defaultam pra estado conservador:
// lojista que não configurou nada NÃO mostra parcela no PDP.

// Aceita cartão de crédito como meio de pagamento. Quando false, toda
// label de parcelamento some do storefront, independente das outras
// configs. Default false: regressão zero pra lojista existente.
acceptsCard: boolean("accepts_card").notNull().default(false),

// Número máximo de parcelas exibido no PDP. Range 1..12 (CHECK no SQL).
// Quando 1, parcela única é equivalente a "à vista no cartão" e a
// label não é renderizada (parcela única = preço cheio, ruído visual).
cardMaxInstallments: integer("card_max_installments").notNull().default(1),

// Taxa de juros em basis points (1bps = 0.01%). 0 = sem juros.
// MVP da Fase 2: UI só permite 0. Coluna existe pra evitar migration
// quando Fase 5 (PDV) introduzir "3x com juros de X% no balcão".
// CHECK 0..9999 (0% a 99.99%) no SQL.
cardInterestRateBps: integer("card_interest_rate_bps").notNull().default(0),

// Base de cálculo da parcela. "base" preserva preço cheio mesmo em
// promo (defensável: o desconto da promo é separado da divisão em
// parcelas). "effective" divide pelo preço atual (comportamento
// vigente, atualmente bugado por não ser opt-in). Default "base"
// porque é o comportamento que NÃO induz cliente a achar que tem
// "3x da promo" automático.
installmentBasePrice: installmentBasePriceEnum("installment_base_price")
  .notNull()
  .default("base"),

// Gate explícito pra mostrar label de parcelamento no PDP. Mesmo com
// acceptsCard=true e cardMaxInstallments=10, se isso for false a label
// não aparece. Existe pra lojista que aceita cartão mas prefere não
// poluir o PDP com a parcela calculada (deixa o cliente perguntar no
// WhatsApp). Default false: ainda mais conservador que acceptsCard.
showInstallmentsOnPDP: boolean("show_installments_on_pdp").notNull().default(false),

// Desconto à vista em basis points. 0..9999. 0 = sem desconto.
// Renderiza linha auxiliar "à vista R$ X,XX (10% off no PIX)" no PDP.
// MVP da Fase 2: a label NÃO assume método (PIX/dinheiro) — só fala
// "à vista", porque Vitrê não processa transação e o método é
// combinado no WhatsApp. Decisão de não chamar "PIX" explícito vive
// neste ADR; reabrir no ADR de PDV (Fase 5).
cashDiscountBps: integer("cash_discount_bps").notNull().default(0),

// Texto livre opcional descrevendo formas de pagamento aceitas. Até
// 280 chars. Renderiza num bloco de "Como pagar" no PDP, abaixo do
// trust block. NÃO é parcela, NÃO é desconto — é só copy curado pelo
// lojista. Ex: "Aceitamos PIX, dinheiro e cartão (parcelado em até
// 10x). Combine pelo WhatsApp."
paymentMethodsNote: text("payment_methods_note"),
```

### Coluna nova em `productTable`

```ts
// Override do max-parcelas APENAS pra este produto. null = usa
// store.cardMaxInstallments. Range 1..12 (CHECK).
// Caso de uso: lojista de joia tem default 3x global, mas no produto
// "Aliança de ouro R$ 4.800" quer mostrar 10x.
// NÃO sobrescreve acceptsCard nem showInstallmentsOnPDP — esses gates
// continuam sendo da loja inteira. Apenas o teto de parcelas muda.
installmentsOverride: integer("installments_override"),
```

### CHECK constraints (SQL out-of-band)

Drizzle ainda não tem suporte first-class pra CHECK constraints declarativas em todas as versões. Padrão Vitrê (ver `supabase/sql/16_theme_check_constraints.sql`) é gerar o SQL Drizzle e adicionar um arquivo de constraints separado:

```sql
-- supabase/sql/17_payment_check_constraints.sql
ALTER TABLE store
  ADD CONSTRAINT store_card_max_installments_range
    CHECK (card_max_installments BETWEEN 1 AND 12),
  ADD CONSTRAINT store_card_interest_bps_range
    CHECK (card_interest_rate_bps BETWEEN 0 AND 9999),
  ADD CONSTRAINT store_cash_discount_bps_range
    CHECK (cash_discount_bps BETWEEN 0 AND 9999),
  ADD CONSTRAINT store_payment_methods_note_length
    CHECK (payment_methods_note IS NULL OR char_length(payment_methods_note) <= 280);

ALTER TABLE product
  ADD CONSTRAINT product_installments_override_range
    CHECK (installments_override IS NULL OR installments_override BETWEEN 1 AND 12);
```

Aplicação manual pelo Editor do Supabase, seguindo runbook já estabelecido pela auditoria 2026-05-10 (SQLs 11–14).

## Comportamento default crítico (regressão zero)

Toda loja existente, após a migration, fica com:

- `acceptsCard = false`
- `cardMaxInstallments = 1`
- `cardInterestRateBps = 0`
- `installmentBasePrice = "base"`
- `showInstallmentsOnPDP = false`
- `cashDiscountBps = 0`
- `paymentMethodsNote = null`

**Consequência observável**: a label "ou 3× de R$ X,XX sem juros" desaparece do PDP de todas as lojas no momento do deploy. Nenhuma lojista perde feature que ela escolheu — ela perde a feature que o sistema chutava por ela. O bug atual deixa de existir mesmo antes da nova UI ficar pronta.

Lógica de renderização (no novo `formatInstallments`):

```text
acceptsCard       === false  → "" (sem label)
showInstallmentsOnPDP === false  → "" (sem label)
maxInstallments   === 1     → "" (sem label, "1× sem juros" é ruído)
qualquer outra combinação    → renderiza
```

Os três gates são AND. Decisão deliberada pra dar 3 freios independentes ao lojista.

## Impacto no código

### 1. `src/lib/pricing.ts` — refactor de `formatInstallments`

Assinatura nova (sem quebrar a antiga via deprecation — preferi remover de uma vez porque há **um único** call-site e o refactor é trivial):

```ts
export interface PaymentConfig {
  acceptsCard: boolean;
  cardMaxInstallments: number;
  installmentBasePrice: "base" | "effective";
  showInstallmentsOnPDP: boolean;
}

export interface InstallmentInput {
  basePriceInCents: number;
  effectivePriceInCents: number;
  storePayment: PaymentConfig;
  productInstallmentsOverride: number | null;
}

export function formatInstallments(input: InstallmentInput): string {
  // 1. Gates (early return "")
  if (!input.storePayment.acceptsCard) return "";
  if (!input.storePayment.showInstallmentsOnPDP) return "";

  // 2. Cálculo do teto de parcelas (override de produto OU default da loja)
  const ceiling = input.productInstallmentsOverride ?? input.storePayment.cardMaxInstallments;
  if (ceiling <= 1) return "";

  // 3. Base de cálculo
  const baseCents =
    input.storePayment.installmentBasePrice === "base"
      ? input.basePriceInCents
      : input.effectivePriceInCents;
  if (baseCents <= 0) return "";

  // 4. Render
  const each = Math.floor(baseCents / ceiling);
  return `ou ${ceiling}× de ${formatBRL(each)} sem juros`;
}
```

Também adicionar helper paralelo para desconto à vista:

```ts
export function formatCashDiscount(
  effectivePriceInCents: number,
  cashDiscountBps: number,
): { discountedCents: number; label: string } | null {
  if (cashDiscountBps <= 0 || effectivePriceInCents <= 0) return null;
  const discounted = Math.floor(
    effectivePriceInCents * (10000 - cashDiscountBps) / 10000,
  );
  const percent = (cashDiscountBps / 100).toFixed(cashDiscountBps % 100 === 0 ? 0 : 1);
  return {
    discountedCents: discounted,
    label: `à vista ${formatBRL(discounted)} (${percent}% off)`,
  };
}
```

A escolha de NÃO chamar a forma de pagamento ("PIX", "dinheiro") na label do desconto é deliberada: Vitrê não processa, o método é negociado no WhatsApp, e a copy mais honesta é "à vista" — o método específico vive no `paymentMethodsNote`.

### 2. `src/components/storefront/product-purchase-panel.tsx`

Substitui a linha 146. Passa a precisar de:

- `product.installmentsOverride` (vem do loader)
- `store.{acceptsCard, cardMaxInstallments, installmentBasePrice, showInstallmentsOnPDP, cashDiscountBps, paymentMethodsNote}` (vem do loader que já carrega `store` pra `BrandProvider` etc.)

Decisão de UI: as propriedades de pagamento da loja sobem como prop dedicada `storePayment: PaymentConfig` em vez de espalhar 6 campos no `ProductPurchasePanelProps`. Mantém a interface enxuta.

Renderização nova abaixo do bloco de preço:

```
R$ 89,00  R$ 119,00  −25%
ou 10× de R$ 11,90 sem juros        ← se gates passam
à vista R$ 80,10 (10% off)          ← se cashDiscountBps > 0
```

Bloco "Como pagar" (texto livre `paymentMethodsNote`) entra abaixo do trust block — não substitui o trust block, complementa.

### 3. Loaders

`src/lib/storefront/products-loader.ts` (e equivalente do listing) precisa:

- Selecionar `installmentsOverride` em `ProductDetail`.
- A loja já é carregada para `BrandProvider` — basta estender o select com as 6 colunas novas.

Aumenta payload de `ProductDetail` em 1 campo (`installmentsOverride: number | null`) e o objeto `store` em 6 campos. Impacto em bytes: desprezível.

### 4. Server actions

#### `actions/store/schema.ts`

Adicionar campos ao Zod schema de update da loja. Esboço:

```ts
acceptsCard: z.boolean(),
cardMaxInstallments: z.coerce.number().int().min(1).max(12),
cardInterestRateBps: z.coerce.number().int().min(0).max(9999).default(0),
installmentBasePrice: z.enum(["base", "effective"]),
showInstallmentsOnPDP: z.boolean(),
cashDiscountBps: z.coerce.number().int().min(0).max(9999),
paymentMethodsNote: z.string().trim().max(280).nullable().or(z.literal("").transform(() => null)),
```

Atenção a Zod v4 (`z.object()` é nonoptional por default — ver memory `zod-v4-object-requires-nullish.md`): campos opcionais usam `.nullish()` explicitamente.

#### `actions/store/update.ts`

Recebe os campos via `parsedInput`, faz `revalidateTag('store-${slug}')`. Já é o padrão; só estender.

#### `actions/product/schema.ts`

```ts
installmentsOverride: z.coerce.number().int().min(1).max(12).nullable()
  .or(z.literal("").transform(() => null)),
```

#### `actions/product/update.ts` e `create.ts`

Passar through. Single source of truth no schema.

### 5. UI `/admin/configuracoes`

**Decisão de rota**: nova seção dentro da rota existente, NÃO criar rota dedicada `/admin/configuracoes/pagamento`. Justificativa:

- `/admin/configuracoes` é a "página de loja" do lojista. Toda configuração da loja (logo, cor, endereço, WhatsApp, tema) vive lá. Fragmentar em sub-rotas multiplica navegação sem benefício.
- A seção "Pagamento" cabe num accordion ou em um bloco com `<h2>` âncora `#pagamento` (link interno do menu lateral, se houver).
- Reduz commits cruzados quando outras fases (clientes, estoque) precisarem editar configurações.

Componentes a adicionar:

- Checkbox "Aceito cartão de crédito" (`acceptsCard`)
- Select "Máximo de parcelas" 1..12 (`cardMaxInstallments`) — desabilitado se `acceptsCard=false`
- Select "Base de cálculo da parcela" com 2 opções (`installmentBasePrice`) com tooltip explicando trade-off
- Checkbox "Mostrar parcelas no produto" (`showInstallmentsOnPDP`) — desabilitado se `acceptsCard=false`
- Slider/input "Desconto à vista" 0..50% (`cashDiscountBps`) — UI converte percentual ↔ bps
- Textarea "Como você aceita pagamento" (`paymentMethodsNote`) até 280 chars com counter

`cardInterestRateBps` **não** ganha UI no MVP (fica fixo em 0). Justificativa: parcelas com juros exigem cálculo financeiro correto (tabela Price, IOF, etc) que ainda não temos. Coluna existe para evitar migration na Fase 5.

### 6. UI `/admin/produtos/[id]` (editor de produto)

Campo numérico opcional "Parcelar até X vezes (sobrescreve loja)" — null/vazio quando não personalizado. Renderiza ao lado de promoção, na mesma sub-seção "Pricing avançado".

### 7. Template WhatsApp — placeholder opcional

Adicionar `{formaPagamento}` à lista de placeholders renderizados em `lib/whatsapp-message.ts`. Quando o lojista usa o placeholder e `paymentMethodsNote` está preenchido, substitui pelo texto; senão substitui por string vazia.

**Não** alterar o template default — manter o atual. Lojista pode editar o template em `/admin/configuracoes` se quiser incluir o placeholder.

## RLS

Nada novo. As duas tabelas tocadas (`storeTable`, `productTable`) já têm policy `*_tenant_isolation` aplicada via SQLs anteriores. Não há tabela nova; não há nova superfície de leitura/escrita.

## Migration — estratégia

1. `npm run db:generate` → Drizzle gera `drizzle/0015_payment_config.sql` (ou número que vier).
2. Revisar o SQL gerado. Drizzle vai produzir `ALTER TABLE store ADD COLUMN ...` × 6, `ALTER TABLE product ADD COLUMN ...` × 1 e `CREATE TYPE installment_base_price ...`. Confirmar que defaults batem com o schema TS.
3. Commit do SQL gerado.
4. `npm run db:migrate` — aplica em prod (lembrar: Free tier = 1 projeto, ver memory `db-migrations-discipline.md`; não há DB de dev separado).
5. Aplicar `supabase/sql/17_payment_check_constraints.sql` manualmente pelo Editor do Supabase (mesmo runbook dos SQLs 11–16).
6. Smoke test: `scripts/check-sql-applied.mjs` ganha entrada nova para o SQL 17.

Não usar `db:push`. Não pular o passo das CHECK constraints — sem elas, um lojista pode salvar `cardMaxInstallments = 999` via tampering de form e o front renderiza "999× de R$ 0,10". Zod cobre o caminho feliz; CHECK cobre o resto.

## Trade-offs aceitos

| O que entra | O que NÃO entra (consciente) |
|-------------|------------------------------|
| Cartão, à vista, parcelas configuráveis | PIX como método explícito separado (entra na Fase 5/PDV) |
| Desconto "à vista" genérico | Desconto específico por método (PIX vs dinheiro vs transferência) |
| Override de max-parcelas por produto | Override de aceita-cartão por produto (over-engineering pra micro-varejo) |
| Coluna de juros (não usada no MVP) | UI de juros, cálculo financeiro real, IOF |
| Texto livre de "como pagar" | Vinculação com gateway, link de pagamento, boleto |
| Recalcular base sobre preço cheio ou efetivo | Recalcular sobre custo, margem, ou qualquer derivado |
| 6 colunas em `storeTable` + 1 em `productTable` | Tabela `payment_config` separada |

Decisões que ficam **fora deste ADR** e serão tratadas adiante:

- **PIX como método primeiro-classe** — Fase 5 (PDV) precisa registrar o método escolhido em uma venda balcão como metadado (`order.paymentMethod`). É o lugar natural pra introduzir enum `payment_method`. Antecipar agora seria desenhar uma feature que não vai ser usada na vitrine pública.
- **Bandeira (Visa/Master/Hiper)** — micro-varejo Vitrê não vende em volume que justifique granularidade por bandeira. Reabrir só com dor concreta de cliente pagante.
- **Recorrência / assinatura** — fora do escopo do pivô inteiro (ADR-0012).
- **Boleto, link de pagamento** — Vitrê não processa transação. Reabrir só se houver integração com PSP futura (provavelmente Fase >6).

## Plano de testes

Adicionar em `tests/pricing.test.ts` (criar se não existir; seguir convenção atual dos testes sentinela em `tests/`).

**Casos de gate (acceptsCard / showInstallmentsOnPDP / max=1)** — retorno deve ser `""`:

1. `acceptsCard=false`, mesmo com max=12 e showInstallments=true → `""`
2. `acceptsCard=true`, `showInstallmentsOnPDP=false` → `""`
3. `acceptsCard=true`, `showInstallmentsOnPDP=true`, `cardMaxInstallments=1` → `""`
4. `productInstallmentsOverride=1` força gate mesmo com store `cardMaxInstallments=10` → `""`

**Casos de cálculo**:

5. base=15000, effective=15000, max=3, installmentBasePrice="base" → `"ou 3× de R$ 50,00 sem juros"`
6. base=15000, effective=10000 (promo), max=3, installmentBasePrice="base" → `"ou 3× de R$ 50,00 sem juros"` (preserva preço cheio)
7. base=15000, effective=10000 (promo), max=3, installmentBasePrice="effective" → `"ou 3× de R$ 33,33 sem juros"` (divide pelo promo)
8. base=15000, max=3, `productInstallmentsOverride=10` → renderiza 10× (override vence o default)
9. base=15000, max=10, `productInstallmentsOverride=null` → renderiza 10× (sem override, usa default)

**Casos de desconto à vista** (helper novo `formatCashDiscount`):

10. `cashDiscountBps=0` → `null`
11. `cashDiscountBps=1000` (10%), effective=10000 → `{ discountedCents: 9000, label: "à vista R$ 90,00 (10% off)" }`
12. `cashDiscountBps=550` (5.5%), effective=10000 → percentual com decimal: `"5.5% off"`

**Sentinela de schema**:

13. Garantir que `formatInstallments` não compila mais com a assinatura antiga `(cents, installments)`. (Implícito no TS, mas vale assertar via test de tipo se houver `tsd` no projeto; senão, basta o tsc do build.)

**Sentinela de RLS** (já coberta por `tests/rls.test.ts` existente): nenhuma adição — não há tabela nova.

Total estimado: 12 a 15 asserts, todos pure unit, sem DB.

## Consequências

### ✅ Ganhos aceitos

- Resolve bug real reportado por Cliente A.
- Toda loja existente fica em estado "sem label de parcela" no momento do deploy — sem regressão, sem promessa falsa.
- Padrão de configuração inline replicado coerentemente (segue item 10 do CLAUDE.md).
- Schema preparado pra Fase 5 (PDV) sem migration extra (cardInterestRateBps já existe; UI cresce, schema não muda).
- Lojista ganha 3 freios independentes (`acceptsCard`, `showInstallmentsOnPDP`, `cardMaxInstallments=1`) para controlar o que aparece no PDP.

### ⚠️ Trade-offs aceitos

- `storeTable` cresce de 23 pra 29 colunas. Decisão consciente vs criar tabela 1-1.
- `cardInterestRateBps` fica modelado sem UI no MVP — dead-column durante Fase 2. Risco mitigado pelo default `0` (não afeta cálculo).
- "À vista" é genérico — quem combina "PIX vs dinheiro vs transferência" é o `paymentMethodsNote` em texto livre. Fase 5 promete método primeiro-classe; ADR-0013 deliberadamente não antecipa.
- `productInstallmentsOverride` permite valor > `store.cardMaxInstallments`. A semântica adotada é "override SUBSTITUI o teto da loja" — ou seja, o lojista pode ter loja default 3x e um produto específico 10x sem precisar elevar o teto global. Trade-off: nenhum guard rail impede inconsistência percebida. Mitigação: tooltip na UI explicando o comportamento.

### 🔧 Dívida técnica criada

- A migration introduz uma coluna (`cardInterestRateBps`) sem consumidor. Anotar no roadmap da Fase 5 para conectar.
- O helper `formatCashDiscount` retorna `discountedCents` que precisa ser somado/exibido pelo `product-purchase-panel`. A UI fica responsável por renderizar — o helper não decide layout. Se na Fase 5 quisermos mostrar desconto à vista também na sacola, é refactor.

## Quem decidiu

Anderson Felipe (founder), com base em:
- Bug reportado por Cliente A.
- Roadmap de fases consolidado em [ADR-0012](0012-pivot-vitre-gestao.md).
- Padrão de configuração inline já validado em promoção (item 10 do CLAUDE.md) e tema (ADR-0009).

## Referências

- [ADR-0012 — Pivô do Vitrê para sistema de gestão](0012-pivot-vitre-gestao.md)
- [ADR-0008 — UX do catálogo público (storefront)](0008-ux-catalogo-publico-storefront.md) — não conflita
- [ADR-0009 — Design system tokens navy](0009-design-system-tokens-navy.md) — referência de schema híbrido aplicado ao tema
- `src/lib/pricing.ts:80` — call site do bug atual
- `src/components/storefront/product-purchase-panel.tsx:146` — consumidor único de `formatInstallments`
- `src/db/schema/store.ts` — onde as colunas entram
- `supabase/sql/16_theme_check_constraints.sql` — referência de runbook pra CHECK constraints out-of-band
