# ADR-0022: Caixa formal — `cash_session` + ajustes

- **Data**: 2026-05-18
- **Status**: aceito (2026-05-18 — founder ratificou D1=opt-in, D2=bloqueia reabrir, D3=tabela separada, D4=página dedicada, D5=aceita qualquer + closingNotes se ≠ 0)
- **Estende**: ADR-0016 (Fase 5 PDV — vendas balcão sem caixa formal)

## Contexto

Hoje (pós-Fase 5) o PDV registra venda balcão direto, sem noção de "abertura de caixa", "sangria" ou "fechamento Z". A página `/admin/pdv/caixa` é apenas conferência read-only do que foi vendido no dia, agrupado por método de pagamento.

No varejo BR de PME isso falta em 4 cenários:
1. **Troco inicial** — lojista coloca R$ 50 em dinheiro pra começar o dia; sem registro, o "Dinheiro do dia" fica errado.
2. **Sangria** — durante o dia, retira parte do caixa pra cofre/banco. Sem isso, o saldo esperado no fim do dia diverge do real e ninguém sabe por quê.
3. **Reforço** — adiciona troco no meio do dia (de outro caixa ou do bolso).
4. **Z de caixa** — fechamento ao fim do dia: saldo esperado vs contado, diferença documentada, sessão imutável.

Operacionalmente, sem isso, qualquer auditoria do caixa físico exige memória do lojista. Em loja com >1 operador (B4.2 Equipe), vira buraco.

## Decisão (proposta)

### Schema novo — 2 tabelas

```ts
// src/db/schema/cash.ts (NOVO)
export const cashSessionTable = pgTable("cash_session", {
  id: uuid("id").primaryKey().defaultRandom(),
  storeId: uuid("store_id").notNull().references(() => storeTable.id, { onDelete: "cascade" }),
  openedByUserId: text("opened_by_user_id").notNull().references(() => userTable.id),
  openedAt: timestamp("opened_at").notNull().defaultNow(),
  openingAmountInCents: integer("opening_amount_in_cents").notNull(),  // troco inicial
  closedByUserId: text("closed_by_user_id").references(() => userTable.id),
  closedAt: timestamp("closed_at"),
  closingExpectedInCents: integer("closing_expected_in_cents"),  // calculado: opening + vendas cash + reforço - sangria
  closingActualInCents: integer("closing_actual_in_cents"),       // contado pelo lojista
  closingNotes: text("closing_notes"),  // motivo da diferença
});

// Apenas UMA sessão aberta por loja — UNIQUE PARTIAL
// CREATE UNIQUE INDEX cash_session_open_per_store ON cash_session(store_id) WHERE closed_at IS NULL;

export const cashAdjustmentTypeEnum = pgEnum("cash_adjustment_type", [
  "sangria",       // saída de dinheiro do caixa (cofre/banco)
  "reinforcement", // entrada de dinheiro (reforço de troco)
]);

export const cashAdjustmentTable = pgTable("cash_adjustment", {
  id: uuid("id").primaryKey().defaultRandom(),
  cashSessionId: uuid("cash_session_id").notNull().references(() => cashSessionTable.id, { onDelete: "cascade" }),
  type: cashAdjustmentTypeEnum("type").notNull(),
  amountInCents: integer("amount_in_cents").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdByUserId: text("created_by_user_id").notNull().references(() => userTable.id),
});
```

### Order ganha FK opcional

```ts
// src/db/schema/order.ts (ALTER)
cashSessionId: uuid("cash_session_id").references(() => cashSessionTable.id),
// NULLABLE — vendas balcão sem sessão ativa continuam funcionando (opt-in).
// Storefront/WhatsApp NUNCA preenche (canal não passa por caixa físico).
```

### Fluxo operacional

1. **Abrir caixa** — `/admin/pdv` mostra modal "Caixa fechado — abrir?" se não há sessão ativa. Form: `openingAmountInCents`. INSERT em cash_session.
2. **Venda balcão durante sessão ativa** — `createBalcaoSale` busca sessão ativa da loja (`WHERE closed_at IS NULL`) e anexa `cashSessionId` automaticamente. Se não houver, pode escolher: (a) bloquear venda OU (b) prosseguir sem vincular. **Decisão aberta D1 abaixo.**
3. **Sangria/Reforço** — botão no PDV ou na página `/admin/pdv/caixa`. Modal com valor + motivo. INSERT em cash_adjustment.
4. **Fechar caixa** — botão "Fechar caixa" em `/admin/pdv/caixa`. Sistema calcula `closingExpected = opening + vendas_cash + reforço - sangria`. Lojista digita `closingActual` (contagem física). Sistema mostra diferença; se ≠ 0 exige `closingNotes` obrigatório. UPDATE `closed_at`, `closing_expected`, `closing_actual`, `closing_notes`. Sessão fica imutável (RLS bloqueia UPDATE/DELETE em sessão fechada — ver decisão D5).
5. **Z de caixa** — página de visualização `/admin/pdv/caixa/[sessionId]` mostrando abertura, todas vendas (read-only), todas adjustments, fechamento. Imprimível.

### RLS

Mesma convenção das outras tabelas — `withTenant`, policy `cash_session_tenant_isolation` por `store_id`. `cash_adjustment` herda via JOIN com cash_session.

## 5 decisões abertas pro founder

| # | Pergunta | Opção A | Opção B (recomendada) |
|---|---|---|---|
| D1 | Vender sem caixa aberto? | Bloqueia: força abrir caixa antes da 1ª venda balcão do dia | **Opt-in**: vende sem vincular, opening_amount=0 implícito, deixa pra adoção gradual |
| D2 | Reabrir caixa fechado? | Permite (admin only) | **Bloqueia**: erro de fechamento exige nova sessão de ajuste |
| D3 | Sangria/reforço = tabela separada? | Uma tabela `cash_movement` com type extra (sale/sangria/reinforcement) | **Tabela separada `cash_adjustment`** — sale fica em `order` (já existe), adjustment é coisa diferente |
| D4 | Z de caixa = página ou modal? | Modal no momento de fechar | **Página dedicada** `/admin/pdv/caixa/[id]` — permite revisitar depois, imprimir |
| D5 | Diferença esperado vs contado | Bloqueia se diferença > limite | **Aceita qualquer diferença + obriga `closingNotes` se ≠ 0** — auditoria depois, não policial agora |

## Consequências

**Positivas:**
- Caixa físico auditável fim-a-fim.
- Sangria registrada com motivo — para quando "sumiu dinheiro" ninguém investiga 2 horas.
- Histórico de Z imutável (read-only após fechar) — base de relatório financeiro (B4.1).
- Base pra B4.2 Equipe — `opened_by_user_id`/`closed_by_user_id`/`created_by_user_id` rastreia quem mexeu no caixa.

**Negativas (aceitas):**
- +2 tabelas + 1 FK + 1 enum. Schema fica mais rico — só usa quem ativa.
- Página `/admin/pdv/caixa` atual (Onda A.12 read-only) **vira histórica**: lista de sessões fechadas + sessão aberta atual + botão fechar. Reescrita parcial.

**Não-objetivos:**
- ❌ TEF (transferência eletrônica de fundos) — fora.
- ❌ Múltiplas gavetas (cash drawers) simultâneas por loja — uma sessão aberta por vez.
- ❌ Bloqueio do PDV se caixa não abrir — vide D1, opt-in.
- ❌ Histórico de "operações suspeitas" automatizado — auditoria humana, não compliance.

## Plano de execução (após ratificação)

1. **Schema** Drizzle migration 0021 — 2 tabelas + enum + ALTER order ADD cash_session_id.
2. **SQL out-of-band** 29 — UNIQUE PARTIAL `cash_session_open_per_store` + RLS policies + CHECK amount >= 0.
3. **Actions** `actions/cash-session/` — open / close / adjustment / load.
4. **createBalcaoSale** atualiza pra buscar sessão ativa + anexar `cashSessionId` (lógica per D1).
5. **UI**:
   - Modal "Abrir caixa" em `/admin/pdv` se sem sessão ativa
   - Botões "Sangria"/"Reforço"/"Fechar caixa" em `/admin/pdv/caixa`
   - Página nova `/admin/pdv/caixa/[id]` (Z imprimível)
   - `/admin/pdv/caixa` (atual) vira lista de sessões + sessão ativa em destaque
