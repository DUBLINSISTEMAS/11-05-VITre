# ADR-0025: Grupos de clientes (VIP/Atacado/Comum) + desconto automático

- **Data**: 2026-05-18
- **Status**: aceito

## Contexto

Lojistas segmentam clientes informalmente — "Marta é VIP, dá 10%", "Pedro é
atacadista, dá 15%". Hoje vive na cabeça da Sandra. Vitrê precisa:

1. Catálogo de grupos por loja (não 1 tabela enum global).
2. Vínculo customer ↔ group (1-pra-N — cliente pertence a 1 grupo).
3. Desconto automático aplicado no PDV quando cliente do grupo X for selecionado.

## Opções consideradas

| Opção | Prós | Contras |
|-------|------|---------|
| A. Enum estática `customer.tier = vip|wholesale|regular` | Trivial | Quebra quando lojista cria 4º grupo; não tem desconto associado |
| B. Tabela `customer_group` + FK customer.group_id | Flexível, desconto por grupo, lojista cria N | 1 join no listing; PDV precisa carregar grupo do cliente selecionado |
| C. M2M cliente↔grupos | Cliente em vários grupos | Conflito de desconto (qual aplica?); over-engineering |

## Decisão

**Opção B**. Schema:

```
customer_group:
  id, store_id, name "VIP", discountBps int default 0,
  description?, position, isActive, createdAt, updatedAt
  UNIQUE (store_id, name)

customer.groupId: uuid? FK customer_group ON DELETE SET NULL
```

**Por que `ON DELETE SET NULL`**: lojista apagar o grupo "VIP" não deve
sumir com os clientes — só desvincula.

PDV: quando cliente é selecionado e tem grupo com `discountBps > 0`, a UI
**sugere** o desconto na linha de desconto manual (não aplica silenciosamente
— lojista confirma com botão "Aplicar desconto do grupo"). Anti-surpresa.

Storefront: hoje não há login — desconto de grupo NÃO se aplica ao checkout
WhatsApp (lojista pode ajustar manualmente no WA depois). Vínculo só pra
PDV + relatório.

## Consequências

- ✅ Lojista cria N grupos com seus próprios descontos
- ✅ PDV sugere mas não aplica → previne confusão
- ✅ Sem refactor de checkout WhatsApp
- ⚠️ Cliente pertence a 1 grupo apenas — atacadista que também é VIP precisa escolher
- 🔧 Storefront por enquanto ignora — quando virar feature, requer login (fora de escopo MVP)

## Quem decidiu

Anderson Felipe (founder) — execução autônoma 2026-05-18 noite.
