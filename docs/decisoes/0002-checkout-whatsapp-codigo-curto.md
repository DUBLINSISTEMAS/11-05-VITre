# ADR-0002: Checkout WhatsApp com código curto

- **Data**: 2026-05-07
- **Status**: aceito

## Contexto

Vitrê não tem gateway de pagamento. O "checkout" é um redirect para `wa.me/<numero>?text=<mensagem>`. Três buracos identificados pelo conselho:

1. `wa.me` corta texto a ~2000 caracteres — pedido grande quebra.
2. Sem registro server-side, lojista nunca sabe quem clicou e desistiu.
3. Lojista precisa correlacionar a mensagem do cliente com o pedido no painel.

## Opções consideradas

| Opção | Prós | Contras |
|-------|------|---------|
| Redirect direto sem registro | Simples | Sem visibilidade, sem correlação |
| Registro + código curto | Visibilidade total, correlação trivial | 1 endpoint extra, gerenciamento de estado |
| WhatsApp Business API | Mensagem programática completa | Custo, aprovação Meta, complexidade |

## Decisão

**Registro server-side + código curto.**

Fluxo:
1. Cliente clica "Finalizar pelo WhatsApp" no `/checkout`.
2. POST `/api/orders` cria `order` com `status='awaiting_whatsapp'`, gera `shortCode` (ex: `A7K2` — 4 chars alfanuméricos via nanoid).
3. Servidor retorna URL `https://wa.me/<numero>?text=<mensagem-truncada>`.
4. Mensagem inclui: código curto, lista de itens (truncada se > 1500 chars), total, link para detalhes (`vitre.com.br/p/A7K2`).
5. Lojista vê pedido `awaiting_whatsapp` em `/admin/pedidos` e marca como `confirmed` ao atender no WA.

## Consequências

- ✅ Pedido fica registrado mesmo se cliente desistir do WA.
- ✅ Lojista correlaciona facilmente via código curto.
- ✅ Estoque pode ser reservado no `awaiting_whatsapp`.
- ⚠️ Estoque preso por TTL precisa ser liberado se cliente abandonar — job ou expiração no banco.
- ⚠️ Página pública `vitre.com.br/p/<shortCode>` mostra detalhe do pedido sem login — proteger contra enumeração (TTL + código com entropia suficiente).

## Quem decidiu

Anderson Felipe (founder) + Conselho-5-agentes (LÂMINA listou os buracos, TRATOR validou viabilidade).
