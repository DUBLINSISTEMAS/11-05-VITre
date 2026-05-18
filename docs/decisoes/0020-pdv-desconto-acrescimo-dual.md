# ADR-0020: PDV — desconto e acréscimo duais (R$ ou %) com auto-cálculo

- **Data**: 2026-05-18
- **Status**: aceito
- **Substitui parcialmente**: ADR-0016 (Fase 5 PDV — só desconto em R$)

## Contexto

PDV balcão hoje suporta apenas **desconto manual em reais** (`order.discount_in_cents` adicionado em ADR-0016/Fase 5). No varejo brasileiro de pequeno e médio porte (Sandra Brito, prospects similares) duas necessidades aparecem direto na operação:

1. **Acréscimo** — taxa de cartão, frete, embalagem, ou simplesmente "fechar redondo pra cima". Hoje não tem como registrar — vai pra `notes` em texto livre, perdendo categorização.
2. **Pensar em porcentagem** — operador frequentemente raciocina "dar 10% pra cliente fiel" em vez de "dar R$ 27 de desconto numa venda de R$ 270". Calcular a mão erra e demora.

Founder pediu explicitamente em 2026-05-18: campos R$ E % simultaneamente visíveis, auto-cálculo cruzado (digita um → o outro preenche automaticamente). Layout sugerido 2×2: desconto (R$/%) e acréscimo (R$/%) lado a lado.

## Opções consideradas

| Opção | Prós | Contras |
|---|---|---|
| **A** — Armazenar apenas em **R$** (cents). % é só UX de entrada, computada no client a partir do subtotal. | Schema mínimo (+1 coluna). Recibo/relatórios mostram valor exato sem ambiguidade. Sem drift de arredondamento entre R$ canônico e % derivado. | Histórico não preserva "intenção original" (lojista digitou 10% pra cliente fiel; daqui 6 meses só vê R$ 27,00). |
| **B** — Armazenar **R$ e BPS (basis points)** lado a lado. Lojista escolhe o "mode". | Preserva intenção. Útil em auditoria ("foi 10% ou R$ 27?"). | +2 colunas por canal (desconto e acréscimo = +4 colunas no order). Total duplicado em 2 representações exige CHECK consistente. |
| **C** — Tabela `order_adjustment` separada (1:N, tipo, valor, unidade) | Modela qualquer ajuste (sangria, frete, taxa cartão...) genérico. | Overkill pra Sandra e similares. Reporting fica mais complexo. PDV vira write em 2 tabelas. |

## Decisão

**Opção A**: armazenar **apenas em centavos**.

- Adicionar coluna `order.surcharge_in_cents integer` (nullable, padrão NULL). Simétrica a `discount_in_cents`.
- UI mostra R$ + %, com auto-cálculo bidirecional. R$ é canônico — % é label visual.
- `total_in_cents = subtotal - discount + surcharge`. CHECK constraint mantém `total_in_cents >= 0`.
- Server-action `createBalcaoSale` aceita `discountInCents` (já existia) e novo `surchargeInCents`.

## Consequências

- ✅ Schema mínimo (+1 coluna). Recibos e relatórios mostram valor financeiro exato.
- ✅ Auto-cálculo no client é trivial (`pct = cents / subtotal * 100`). Re-cálculo automático quando subtotal muda (carrinho mudou).
- ✅ Compatibilidade total com vendas antigas (`surcharge_in_cents IS NULL` = sem acréscimo).
- ⚠️ Intenção original ("foi 10% ou R$ 27?") não preservada. Aceitável — operador raciocina em R$ na hora de bater caixa.
- ⚠️ Acréscimo NÃO é taxa fiscal — é só metadado de ajuste financeiro. Vitrê não emite nota; quando emitir, ADR fiscal específico revisita semântica de "ICMS sobre acréscimo".
- 🔧 UI do PDV ganha 4 inputs sincronizados (2 desconto + 2 acréscimo). Risco de stomp em focused state durante typing — solução: o input focado é master, o irmão recalcula.

## Schema mudanças

```sql
-- Migration Drizzle 0019_pdv_surcharge.sql
ALTER TABLE "order" ADD COLUMN "surcharge_in_cents" integer;

-- supabase/sql/27_pdv_surcharge_check.sql (manual paste)
ALTER TABLE "order"
  ADD CONSTRAINT order_surcharge_nonneg
  CHECK (surcharge_in_cents IS NULL OR surcharge_in_cents >= 0);
-- order_total_nonneg já existe via ADR-0016 (SQL 26)
```

## UI mudanças

PDV right column ganha grid `grid-cols-2` com 4 inputs:

```
┌─────────────────┬─────────────────┐
│ Desconto R$     │ Desconto %      │
├─────────────────┼─────────────────┤
│ Acréscimo R$    │ Acréscimo %     │
└─────────────────┴─────────────────┘
```

Auto-cálculo:
- `onChange` num R$ → set state R$ + compute % = R$ / subtotal * 100 (1 casa decimal)
- `onChange` num % → set state % + compute R$ = (% / 100) * subtotal (arredondado)
- `useEffect` em subtotal: se R$ é canônico, recompute %

Caixa do dia (`/admin/pdv/caixa`) e recibo (`/admin/pdv/recibo/[token]`) mostram acréscimo separadamente quando > 0.

## Quem decidiu

Anderson Felipe (founder) — pedido explícito em chamada 2026-05-18 ("ela pode dar desconto ou acrescentar um acréscimo. [...] pode adicionar tanto a questão de valor do acréscimo ou então a porcentagem"). Análise sênior por Claude (Opus 4.7) — opção A vs B vs C.
