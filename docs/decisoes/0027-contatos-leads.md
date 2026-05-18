# ADR-0027: Contatos / Inbox de leads WhatsApp

- **Data**: 2026-05-18
- **Status**: aceito

## Contexto

Cliente entra no storefront, vê produto, clica "Comprar via WhatsApp" — abre a
conversa, mas o lojista só sabe que veio do site se o cliente disser.
Vitrê precisa registrar **toda** intenção de compra como **lead**, mesmo
que não vire pedido, pra:

1. Lojista saber quem demonstrou interesse hoje (mesmo sem fechar)
2. Follow-up: "vi que você se interessou no Vestido Azul, ainda quer?"
3. Distinguir leads ↔ clientes (cliente = lead que virou venda)

## Opções consideradas

| Opção | Prós | Contras |
|-------|------|---------|
| A. Não registrar — confiar no histórico do WhatsApp | Zero schema | Lojista perde lead se WA esquece, sem visão agregada |
| B. Tabela `lead` com row por click no botão WA + product_id | Métricas + follow-up | Storefront precisa pingar server quando clicar |
| C. Tabela `lead` + ligar com `customer` quando vira venda | Junção lead→cliente | Mais 1 FK + lógica de matching por phone |

## Decisão

**Opção B + matching por phone na criação de cliente**. Schema:

```
lead:
  id, store_id,
  product_id?  FK ON DELETE SET NULL  // null = veio de listagem
  customerName?  // se cliente forneceu antes de abrir WA
  customerPhone? // pode chegar via deep link com tel pre-preenchido (NÃO no MVP)
  productSnapshot jsonb { name, priceInCents, url }  // imutável
  source enum 'pdp_button' | 'list_button' | 'cart_button' | 'other'
  status enum 'new' | 'contacted' | 'converted' | 'lost'
  customerId?  FK customer ON DELETE SET NULL  // populado quando lead vira cliente
  notes?
  createdAt
```

Storefront chama `recordLead({ productId, source })` antes de window.open()
no botão WhatsApp. Falha silenciosa não bloqueia o WhatsApp.

UI `/admin/contatos`:
- Listing de leads (URL state, mesmo padrão de /admin/produtos)
- Filtros: status (new/contacted/converted/lost) + busca por nome/produto
- Row click abre drawer com detalhes + actions: marcar contatado, marcar convertido, vincular cliente existente, criar cliente novo
- Stats no topo: total / novos hoje / convertidos no mês

Matching ↔ customer:
- Quando lojista marca lead como "converted" + tem `customerPhone`, sugere criar/vincular cliente existente com mesmo phone.

## Consequências

- ✅ Lojista tem inbox de intenções, não só de vendas confirmadas
- ✅ Métricas: taxa de conversão visíveis
- ⚠️ Volume de leads pode ser alto (1 click = 1 row). Cleanup automático >90d = follow-up se virar problema
- 🔧 Rate limit no endpoint público pra evitar lead spam (boa cidadania)

## Quem decidiu

Anderson Felipe (founder) — execução autônoma 2026-05-18 noite.
