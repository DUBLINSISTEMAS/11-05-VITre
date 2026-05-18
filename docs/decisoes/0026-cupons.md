# ADR-0026: Cupons (% ou R$ fixo, expiração, uso limitado)

- **Data**: 2026-05-18
- **Status**: aceito

## Contexto

Lojista quer rodar campanhas pontuais — "BLACKFRIDAY 10% off até 30/11", "PRIMEIRA 20 reais primeira compra". Hoje o desconto manual no PDV (ADR-0020) cobre só o caso de balcão sem código. Falta:

1. Catálogo de códigos por loja
2. Validade temporal (startsAt/endsAt)
3. Limite total de usos
4. Aplicação no PDV (digita código → desconto aplicado)
5. Storefront: lojista colocaria o cupom no link/banner; cliente combina no WhatsApp — Vitrê NÃO valida automaticamente no checkout WA (lojista vê o código no histórico do WA e aplica manualmente)

## Opções consideradas

| Opção | Prós | Contras |
|-------|------|---------|
| A. % ou R$ fixo, sem validade nem uso | Trivial | Vira muleta — lojista cria 20 cupons sem expiração e perde controle |
| B. % ou R$ fixo + startsAt/endsAt + maxUses + usesCount | Cobre 90% do varejo BR | 1 tabela + contador |
| C. + condições (min order value, primeiro pedido, etc) | Robusto | Over-engineering — Sandra não vai usar; adicionar quando dor real |

## Decisão

**Opção B**. Schema:

```
coupon:
  id, store_id,
  code text NOT NULL  // uppercase, validado app-layer
  discountType enum 'percentage' | 'fixed'
  discountValue int  // percentage 0..9999 bps, fixed cents
  startsAt timestamp?  // null = vale desde sempre
  endsAt timestamp?    // null = sem expiração
  maxUses int?         // null = ilimitado
  usesCount int default 0
  description text?
  isActive boolean default true
  createdAt, updatedAt
  UNIQUE (store_id, code)
```

Aplicação no PDV:
- input "Código cupom" no carrinho
- server action `validateCoupon(code)` retorna `{ ok, coupon, discountInCents }` ou erro ("expirado", "usado", "inválido")
- se ok, aplica como `discountInCents` no order
- ao finalizar venda, increment atomic do `usesCount` (advisory lock OR upsert idempotente)

Storefront: cupom **NÃO** é aplicado automaticamente. Lojista pode mostrar o código no banner ("Use PRIMEIRA20 no WhatsApp"). Cliente combina no WA. Lojista aplica manual no admin/PDV.

## Consequências

- ✅ Lojista controla códigos sem precisar do dev
- ✅ Anti-abuso via maxUses + expiração
- ✅ Sem fricção no storefront (não há cliente logado)
- ⚠️ Sem regras condicionais (min cart, primeiro pedido) — backlog se pedir
- 🔧 `usesCount` atualizado em advisory lock por código pra evitar race

## Quem decidiu

Anderson Felipe (founder) — execução autônoma 2026-05-18 noite.
